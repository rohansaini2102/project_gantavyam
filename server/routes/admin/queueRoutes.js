const express = require('express');
const router = express.Router();
const { protect, adminProtect } = require('../../middleware/auth');
const { 
  getBoothQueueStatus, 
  getBoothQueueList, 
  getAllBoothQueues,
  getQueueAnalytics 
} = require('../../utils/queueManager');
const BoothQueue = require('../../models/BoothQueue');
const RideRequest = require('../../models/RideRequest');

// Middleware to ensure only admins can access these routes
router.use(adminProtect);

/**
 * GET /admin/queue/booths
 * Get all booth queue statuses
 */
router.get('/booths', async (req, res) => {
  try {
    console.log('\n=== ADMIN: GET ALL BOOTH QUEUES ===');
    
    const allQueues = await getAllBoothQueues();
    
    // Add additional analytics
    const enrichedQueues = await Promise.all(allQueues.map(async (queue) => {
      const analytics = await getQueueAnalytics(queue.boothName, 1); // Today's data
      return {
        ...queue,
        todayAnalytics: analytics.dailyBreakdown[0] || {
          totalRides: 0,
          maxQueueSize: 0,
          averageWaitTime: 0
        }
      };
    }));
    
    const summary = {
      totalBooths: enrichedQueues.length,
      totalActiveRides: enrichedQueues.reduce((sum, q) => sum + q.totalActive, 0),
      totalQueuedRides: enrichedQueues.reduce((sum, q) => sum + q.queuedCount, 0),
      busiestBooth: enrichedQueues.reduce((max, q) => 
        q.totalActive > (max?.totalActive || 0) ? q : max, null),
      averageWaitTime: enrichedQueues.length > 0 ?
        (enrichedQueues.reduce((sum, q) => sum + q.estimatedWaitTime, 0) / enrichedQueues.length).toFixed(1) : 0
    };
    
    res.json({
      success: true,
      data: {
        summary,
        booths: enrichedQueues.sort((a, b) => b.totalActive - a.totalActive)
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching booth queues:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booth queue data',
      error: error.message
    });
  }
});

/**
 * GET /admin/queue/booths/:boothName
 * Get detailed queue information for a specific booth
 */
router.get('/booths/:boothName', async (req, res) => {
  try {
    const { boothName } = req.params;
    console.log(`\n=== ADMIN: GET BOOTH QUEUE - ${boothName} ===`);
    
    const queueStatus = await getBoothQueueStatus(boothName);
    const queueList = await getBoothQueueList(boothName);
    const analytics = await getQueueAnalytics(boothName, 7); // Last 7 days
    
    res.json({
      success: true,
      data: {
        boothName,
        status: queueStatus,
        activeRides: queueList,
        analytics
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching booth queue details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booth queue details',
      error: error.message
    });
  }
});

/**
 * PUT /admin/queue/booths/:boothName/serving
 * Manually update the currently serving number for a booth
 */
router.put('/booths/:boothName/serving', async (req, res) => {
  try {
    const { boothName } = req.params;
    const { servingNumber } = req.body;
    
    console.log(`\n=== ADMIN: UPDATE SERVING NUMBER ===`);
    console.log('Booth:', boothName);
    console.log('New serving number:', servingNumber);
    
    if (!servingNumber || servingNumber < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid serving number is required'
      });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const boothQueue = await BoothQueue.findOne({ 
      boothName: boothName, 
      date: today 
    });
    
    if (!boothQueue) {
      return res.status(404).json({
        success: false,
        message: 'Booth queue not found for today'
      });
    }
    
    boothQueue.currentlyServing = servingNumber;
    await boothQueue.save();
    
    console.log('✅ Serving number updated successfully');
    
    res.json({
      success: true,
      message: `Currently serving number updated to ${servingNumber}`,
      data: {
        boothName,
        currentlyServing: servingNumber,
        updatedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating serving number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update serving number',
      error: error.message
    });
  }
});

/**
 * GET /admin/queue/analytics
 * Get queue performance analytics across all booths
 */
router.get('/analytics', async (req, res) => {
  try {
    const { days = 7, boothName } = req.query;
    console.log('\n=== ADMIN: GET QUEUE ANALYTICS ===');
    console.log('Days:', days);
    console.log('Booth filter:', boothName || 'All booths');
    
    if (boothName) {
      // Single booth analytics
      const analytics = await getQueueAnalytics(boothName, parseInt(days));
      res.json({
        success: true,
        data: analytics
      });
    } else {
      // All booths analytics
      const today = new Date().toISOString().split('T')[0];
      const allQueues = await BoothQueue.find({ date: today });
      
      const analyticsPromises = allQueues.map(queue => 
        getQueueAnalytics(queue.boothName, parseInt(days))
      );
      
      const allAnalytics = await Promise.all(analyticsPromises);
      
      const globalSummary = {
        totalBooths: allAnalytics.length,
        totalRides: allAnalytics.reduce((sum, a) => sum + a.totalRides, 0),
        averageRidesPerDay: allAnalytics.length > 0 ?
          (allAnalytics.reduce((sum, a) => sum + parseFloat(a.averageRidesPerDay), 0) / allAnalytics.length).toFixed(1) : 0,
        busiestBooth: allAnalytics.reduce((max, a) => 
          a.totalRides > (max?.totalRides || 0) ? a : max, null),
        boothAnalytics: allAnalytics
      };
      
      res.json({
        success: true,
        data: globalSummary
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching queue analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queue analytics',
      error: error.message
    });
  }
});

/**
 * GET /admin/queue/live
 * Get real-time queue status for dashboard
 */
router.get('/live', async (req, res) => {
  try {
    console.log('\n=== ADMIN: GET LIVE QUEUE STATUS ===');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get all active queues
    const activeQueues = await BoothQueue.find({ date: today })
      .populate('activeRides.rideId', 'userName userPhone vehicleType estimatedFare status')
      .sort({ totalToday: -1 });
    
    // Get recent ride activity
    const recentRides = await RideRequest.find({
      queueAssignedAt: { 
        $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours
      }
    })
    .select('queueNumber queuePosition pickupLocation.boothName userName vehicleType status queueAssignedAt')
    .sort({ queueAssignedAt: -1 })
    .limit(20);
    
    const liveData = {
      timestamp: new Date(),
      totalActiveQueues: activeQueues.length,
      totalActiveRides: activeQueues.reduce((sum, q) => 
        q.activeRides.filter(r => r.status !== 'completed').length + sum, 0),
      busiestBooths: activeQueues
        .slice(0, 5)
        .map(q => ({
          boothName: q.boothName,
          activeRides: q.activeRides.filter(r => r.status !== 'completed').length,
          currentlyServing: q.currentlyServing,
          totalToday: q.totalToday
        })),
      recentActivity: recentRides.map(ride => ({
        queueNumber: ride.queueNumber,
        boothName: ride.pickupLocation?.boothName,
        userName: ride.userName,
        vehicleType: ride.vehicleType,
        status: ride.status,
        assignedAt: ride.queueAssignedAt
      }))
    };
    
    res.json({
      success: true,
      data: liveData
    });
    
  } catch (error) {
    console.error('❌ Error fetching live queue status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live queue status',
      error: error.message
    });
  }
});

/**
 * DELETE /admin/queue/booths/:boothName/rides/:rideId
 * Remove a ride from queue (for emergency situations)
 */
router.delete('/booths/:boothName/rides/:rideId', async (req, res) => {
  try {
    const { boothName, rideId } = req.params;
    const { reason = 'Admin removal' } = req.body;
    
    console.log('\n=== ADMIN: REMOVE RIDE FROM QUEUE ===');
    console.log('Booth:', boothName);
    console.log('Ride ID:', rideId);
    console.log('Reason:', reason);
    
    const today = new Date().toISOString().split('T')[0];
    const boothQueue = await BoothQueue.findOne({ 
      boothName: boothName, 
      date: today 
    });
    
    if (!boothQueue) {
      return res.status(404).json({
        success: false,
        message: 'Booth queue not found'
      });
    }
    
    const success = boothQueue.removeFromQueue(rideId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found in queue'
      });
    }
    
    await boothQueue.save();
    
    // Update the ride request
    await RideRequest.findByIdAndUpdate(rideId, {
      queueStatus: 'completed',
      cancellationReason: `Admin removal: ${reason}`,
      cancelledBy: 'admin',
      cancelledAt: new Date()
    });
    
    console.log('✅ Ride removed from queue successfully');
    
    res.json({
      success: true,
      message: 'Ride removed from queue successfully',
      data: {
        rideId,
        boothName,
        reason,
        removedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Error removing ride from queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove ride from queue',
      error: error.message
    });
  }
});

module.exports = router;