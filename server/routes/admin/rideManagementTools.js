/**
 * Admin tools for manually managing and fixing stuck rides
 */

const express = require('express');
const router = express.Router();
const RideRequest = require('../../models/RideRequest');
const RideDataCleaner = require('../../utils/rideDataCleaner');
const RideCompletionService = require('../../utils/rideCompletionService');
const { logStatusTransition, logRideEvent, getActiveRideStats } = require('../../utils/rideLogger');
const { adminProtect } = require('../../middleware/auth');

// Initialize ride completion service for manual operations
let rideCompletionService;

// Use existing admin authentication middleware

/**
 * GET /api/admin/ride-tools/stats
 * Get comprehensive ride statistics and health status
 */
router.get('/stats', adminProtect, async (req, res) => {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      database: {},
      activeRides: {},
      problematicRides: {}
    };

    // Database statistics
    stats.database.totalRides = await RideRequest.countDocuments();
    stats.database.byStatus = {};
    
    const statusCounts = await RideRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    statusCounts.forEach(item => {
      stats.database.byStatus[item._id] = item.count;
    });

    // Active rides from logger
    stats.activeRides = getActiveRideStats();

    // Problematic rides analysis
    if (rideCompletionService) {
      stats.problematicRides = await rideCompletionService.getStats();
    }

    // Recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    stats.database.recentActivity = {
      created: await RideRequest.countDocuments({ createdAt: { $gte: yesterday } }),
      completed: await RideRequest.countDocuments({ 
        status: 'completed', 
        completedAt: { $gte: yesterday } 
      }),
      cancelled: await RideRequest.countDocuments({ 
        status: 'cancelled', 
        cancelledAt: { $gte: yesterday } 
      })
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting ride stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/ride-tools/stuck-rides
 * Find rides that are stuck in various states
 */
router.get('/stuck-rides', adminProtect, async (req, res) => {
  try {
    const now = new Date();
    const stuckRides = {
      pendingTooLong: [],
      assignedNotStarted: [],
      startedTooLong: [],
      endedNotCompleted: []
    };

    // Pending rides older than 30 minutes
    const pendingCutoff = new Date(now - 30 * 60 * 1000);
    stuckRides.pendingTooLong = await RideRequest.find({
      status: 'pending',
      createdAt: { $lt: pendingCutoff }
    }).select('rideId userName pickupLocation createdAt').limit(20);

    // Assigned rides not started within 15 minutes
    const assignedCutoff = new Date(now - 15 * 60 * 1000);
    stuckRides.assignedNotStarted = await RideRequest.find({
      status: 'driver_assigned',
      acceptedAt: { $lt: assignedCutoff }
    }).select('rideId userName driverName acceptedAt').limit(20);

    // Started rides running for more than 1 hour
    const startedCutoff = new Date(now - 60 * 60 * 1000);
    stuckRides.startedTooLong = await RideRequest.find({
      status: 'ride_started',
      rideStartedAt: { $lt: startedCutoff }
    }).select('rideId userName driverName rideStartedAt').limit(20);

    // Ended rides not completed within 1 hour
    const endedCutoff = new Date(now - 60 * 60 * 1000);
    stuckRides.endedNotCompleted = await RideRequest.find({
      status: 'ride_ended',
      rideEndedAt: { $lt: endedCutoff }
    }).select('rideId userName driverName rideEndedAt paymentStatus').limit(20);

    const totalStuck = Object.values(stuckRides).reduce((sum, arr) => sum + arr.length, 0);

    res.json({ 
      success: true, 
      data: stuckRides,
      summary: {
        totalStuck,
        pendingCount: stuckRides.pendingTooLong.length,
        assignedCount: stuckRides.assignedNotStarted.length,
        startedCount: stuckRides.startedTooLong.length,
        endedCount: stuckRides.endedNotCompleted.length
      }
    });
  } catch (error) {
    console.error('Error finding stuck rides:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/ride-tools/auto-fix
 * Run automatic cleanup to fix stuck rides
 */
router.post('/auto-fix', adminProtect, async (req, res) => {
  try {
    const adminId = req.user.id;
    
    let results = {};

    // Run data cleaner
    console.log('🧹 [Admin Tools] Running automatic ride cleanup...');
    results.dataCleanup = await RideDataCleaner.runFullCleanup();

    // Run stuck ride fixes if completion service available
    if (rideCompletionService) {
      console.log('🔧 [Admin Tools] Running stuck ride fixes...');
      results.stuckRideFixes = await rideCompletionService.checkAndFixStuckRides();
    }

    // Log admin action
    logRideEvent('SYSTEM', 'admin_auto_fix', {
      adminId,
      results,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      message: 'Automatic cleanup completed',
      data: results
    });
  } catch (error) {
    console.error('Error during auto-fix:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/ride-tools/manual-complete/:rideId
 * Manually complete a specific ride
 */
router.post('/manual-complete/:rideId', adminProtect, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!rideId) {
      return res.status(400).json({ success: false, message: 'Ride ID is required' });
    }

    // Find the ride
    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    let result;
    if (rideCompletionService) {
      result = await rideCompletionService.manuallyCompleteRide(
        rideId, 
        adminId, 
        reason || 'Manual admin completion'
      );
    } else {
      // Fallback manual completion
      const previousStatus = ride.status;
      ride.status = 'completed';
      ride.completedAt = new Date();
      ride.paymentStatus = 'collected';
      if (!ride.actualFare) {
        ride.actualFare = ride.estimatedFare;
      }
      await ride.save();

      logStatusTransition(ride.rideId, previousStatus, 'completed', {
        adminId,
        manual: true,
        reason
      });

      result = { success: true, message: 'Ride completed manually' };
    }

    res.json(result);
  } catch (error) {
    console.error('Error manually completing ride:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/ride-tools/cancel-ride/:rideId
 * Manually cancel a specific ride
 */
router.post('/cancel-ride/:rideId', adminProtect, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!rideId) {
      return res.status(400).json({ success: false, message: 'Ride ID is required' });
    }

    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    if (ride.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Ride is already cancelled' });
    }

    const previousStatus = ride.status;
    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    ride.cancelledBy = 'admin';
    ride.cancellationReason = reason || 'Manual admin cancellation';
    await ride.save();

    logStatusTransition(ride.rideId, previousStatus, 'cancelled', {
      adminId,
      manual: true,
      reason: ride.cancellationReason
    });

    res.json({ 
      success: true, 
      message: 'Ride cancelled successfully',
      data: {
        rideId: ride.rideId,
        previousStatus,
        cancelledAt: ride.cancelledAt,
        reason: ride.cancellationReason
      }
    });
  } catch (error) {
    console.error('Error cancelling ride:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/ride-tools/force-status/:rideId
 * Force change ride status (emergency use only)
 */
router.post('/force-status/:rideId', adminProtect, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { newStatus, reason } = req.body;
    const adminId = req.user.id;

    if (!rideId || !newStatus) {
      return res.status(400).json({ success: false, message: 'Ride ID and new status are required' });
    }

    const validStatuses = ['pending', 'driver_assigned', 'ride_started', 'ride_ended', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    const previousStatus = ride.status;
    ride.status = newStatus;

    // Set appropriate timestamps
    const now = new Date();
    switch (newStatus) {
      case 'driver_assigned':
        if (!ride.acceptedAt) ride.acceptedAt = now;
        break;
      case 'ride_started':
        if (!ride.rideStartedAt) ride.rideStartedAt = now;
        break;
      case 'ride_ended':
        if (!ride.rideEndedAt) ride.rideEndedAt = now;
        if (!ride.actualFare) ride.actualFare = ride.estimatedFare;
        break;
      case 'completed':
        if (!ride.completedAt) ride.completedAt = now;
        if (!ride.actualFare) ride.actualFare = ride.estimatedFare;
        ride.paymentStatus = 'collected';
        break;
      case 'cancelled':
        ride.cancelledAt = now;
        ride.cancelledBy = 'admin';
        ride.cancellationReason = reason || 'Admin force status change';
        break;
    }

    await ride.save();

    logStatusTransition(ride.rideId, previousStatus, newStatus, {
      adminId,
      forced: true,
      reason: reason || 'Admin force status change'
    });

    res.json({ 
      success: true, 
      message: `Ride status forced to ${newStatus}`,
      data: {
        rideId: ride.rideId,
        previousStatus,
        newStatus,
        timestamp: now.toISOString()
      }
    });
  } catch (error) {
    console.error('Error forcing ride status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/ride-tools/inconsistency-report
 * Get detailed report of data inconsistencies
 */
router.get('/inconsistency-report', adminProtect, async (req, res) => {
  try {
    const report = await RideDataCleaner.generateInconsistencyReport();
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating inconsistency report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/ride-tools/cleanup-data
 * Run data cleanup operations
 */
router.post('/cleanup-data', adminProtect, async (req, res) => {
  try {
    const { operations } = req.body;
    const adminId = req.user.id;
    
    let results = {};

    if (!operations || operations.includes('all')) {
      results = await RideDataCleaner.runFullCleanup();
    } else {
      if (operations.includes('drivers')) {
        results.driverFixes = await RideDataCleaner.fixRidesWithoutDriver();
      }
      if (operations.includes('completion')) {
        results.completionFixes = await RideDataCleaner.fixUncompletedRides();
      }
      if (operations.includes('timestamps')) {
        results.timestampFixes = await RideDataCleaner.fixMissingTimestamps();
      }
    }

    logRideEvent('SYSTEM', 'admin_data_cleanup', {
      adminId,
      operations: operations || ['all'],
      results
    });

    res.json({ 
      success: true, 
      message: 'Data cleanup completed',
      data: results 
    });
  } catch (error) {
    console.error('Error during data cleanup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Initialize the completion service when module loads
 */
const initializeServices = (notificationService) => {
  if (notificationService) {
    rideCompletionService = new RideCompletionService(notificationService);
    console.log('✅ Admin ride management tools initialized with completion service');
  } else {
    console.log('⚠️ Admin ride management tools initialized without completion service');
  }
};

module.exports = { router, initializeServices };