const BoothQueue = require('../models/BoothQueue');
const RideRequest = require('../models/RideRequest');

/**
 * Queue Manager Utility
 * Handles booth queue operations for ride management
 */

/**
 * Generate a queue number for a ride after driver acceptance
 * @param {string} boothName - Name of the pickup booth
 * @param {string} rideId - MongoDB ObjectId of the ride request
 * @returns {Promise<Object>} Queue information object
 */
const generateQueueNumber = async (boothName, rideId) => {
  try {
    console.log(`\n=== GENERATING QUEUE NUMBER ===`);
    console.log('Booth Name:', boothName);
    console.log('Ride ID:', rideId);
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const boothCode = BoothQueue.getBoothCode(boothName);
    
    console.log('Date:', today);
    console.log('Booth Code:', boothCode);
    
    // Find or create booth queue for today
    let boothQueue = await BoothQueue.findOne({ 
      boothName: boothName, 
      date: today 
    });
    
    if (!boothQueue) {
      console.log('Creating new booth queue for today');
      boothQueue = new BoothQueue({
        boothName: boothName,
        boothCode: boothCode,
        date: today,
        dailyCounter: 0,
        activeRides: [],
        totalToday: 0,
        currentlyServing: 0
      });
    }
    
    // Add ride to queue
    const queueInfo = boothQueue.addToQueue(rideId);
    await boothQueue.save();
    
    console.log('✅ Queue number generated:', queueInfo);
    
    return {
      success: true,
      queueNumber: queueInfo.queueNumber,
      queuePosition: queueInfo.queuePosition,
      totalInQueue: queueInfo.totalInQueue,
      boothCode: boothCode,
      estimatedWaitTime: queueInfo.totalInQueue * 3 // 3 minutes per ride estimate
    };
    
  } catch (error) {
    console.error('❌ Error generating queue number:', error);
    
    // Fallback queue number generation
    const timestamp = Date.now();
    const boothCode = BoothQueue.getBoothCode(boothName);
    const fallbackNumber = `${boothCode}-${timestamp.toString().slice(-6)}`;
    
    return {
      success: false,
      error: error.message,
      fallbackQueueNumber: fallbackNumber,
      queueNumber: fallbackNumber,
      queuePosition: 999,
      totalInQueue: 0,
      estimatedWaitTime: 0
    };
  }
};

/**
 * Get current queue status for a booth
 * @param {string} boothName - Name of the booth
 * @returns {Promise<Object>} Queue status information
 */
const getBoothQueueStatus = async (boothName) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const boothQueue = await BoothQueue.findOne({ 
      boothName: boothName, 
      date: today 
    }).populate('activeRides.rideId', 'userName vehicleType status');
    
    if (!boothQueue) {
      return {
        boothName: boothName,
        boothCode: BoothQueue.getBoothCode(boothName),
        date: today,
        totalToday: 0,
        currentlyServing: 0,
        queuedCount: 0,
        inProgressCount: 0,
        totalActive: 0,
        nextQueueNumber: 1,
        estimatedWaitTime: 0,
        activeRides: []
      };
    }
    
    return boothQueue.getQueueStatus();
    
  } catch (error) {
    console.error('Error getting booth queue status:', error);
    throw error;
  }
};

/**
 * Update the status of a ride in the queue
 * @param {string} rideId - MongoDB ObjectId of the ride
 * @param {string} newStatus - New status ('queued', 'in_progress', 'completed')
 * @returns {Promise<boolean>} Success status
 */
const updateQueuePosition = async (rideId, newStatus) => {
  try {
    console.log(`\n=== UPDATING QUEUE POSITION ===`);
    console.log('Ride ID:', rideId);
    console.log('New Status:', newStatus);
    
    // Find the ride to get booth information
    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      console.error('Ride not found');
      return false;
    }
    
    const boothName = ride.pickupLocation?.boothName;
    if (!boothName) {
      console.error('No booth name found for ride');
      return false;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const boothQueue = await BoothQueue.findOne({ 
      boothName: boothName, 
      date: today 
    });
    
    if (!boothQueue) {
      console.error('Booth queue not found');
      return false;
    }
    
    const success = boothQueue.updateRideStatus(rideId, newStatus);
    if (success) {
      await boothQueue.save();
      console.log('✅ Queue position updated successfully');
    }
    
    return success;
    
  } catch (error) {
    console.error('Error updating queue position:', error);
    return false;
  }
};

/**
 * Get all active rides in a booth's queue
 * @param {string} boothName - Name of the booth
 * @returns {Promise<Array>} List of active rides in queue
 */
const getBoothQueueList = async (boothName) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const boothQueue = await BoothQueue.findOne({ 
      boothName: boothName, 
      date: today 
    }).populate({
      path: 'activeRides.rideId',
      select: 'userName userPhone vehicleType estimatedFare status driverName'
    });
    
    if (!boothQueue) {
      return [];
    }
    
    // Filter and sort active rides
    const activeRides = boothQueue.activeRides
      .filter(ride => ride.status !== 'completed')
      .sort((a, b) => a.queuePosition - b.queuePosition)
      .map(ride => ({
        rideId: ride.rideId._id,
        queueNumber: ride.queueNumber,
        queuePosition: ride.queuePosition,
        status: ride.status,
        assignedAt: ride.assignedAt,
        userName: ride.rideId.userName,
        userPhone: ride.rideId.userPhone,
        vehicleType: ride.rideId.vehicleType,
        estimatedFare: ride.rideId.estimatedFare,
        driverName: ride.rideId.driverName
      }));
    
    return activeRides;
    
  } catch (error) {
    console.error('Error getting booth queue list:', error);
    return [];
  }
};

/**
 * Remove a ride from the queue (when completed or cancelled)
 * @param {string} rideId - MongoDB ObjectId of the ride
 * @returns {Promise<boolean>} Success status
 */
const removeFromQueue = async (rideId) => {
  try {
    console.log(`\n=== REMOVING FROM QUEUE ===`);
    console.log('Ride ID:', rideId);
    
    // Find the ride to get booth information
    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      console.error('Ride not found');
      return false;
    }
    
    const boothName = ride.pickupLocation?.boothName;
    if (!boothName) {
      console.error('No booth name found for ride');
      return false;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const boothQueue = await BoothQueue.findOne({ 
      boothName: boothName, 
      date: today 
    });
    
    if (!boothQueue) {
      console.error('Booth queue not found');
      return false;
    }
    
    const success = boothQueue.removeFromQueue(rideId);
    if (success) {
      await boothQueue.save();
      console.log('✅ Ride removed from queue successfully');
    }
    
    return success;
    
  } catch (error) {
    console.error('Error removing from queue:', error);
    return false;
  }
};

/**
 * Get queue analytics for a specific booth
 * @param {string} boothName - Name of the booth
 * @param {number} days - Number of days to analyze (default: 7)
 * @returns {Promise<Object>} Queue analytics data
 */
const getQueueAnalytics = async (boothName, days = 7) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const dateRange = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateRange.push(d.toISOString().split('T')[0]);
    }
    
    const analytics = await BoothQueue.find({
      boothName: boothName,
      date: { $in: dateRange }
    }).sort({ date: 1 });
    
    const summary = {
      boothName: boothName,
      totalDays: days,
      totalRides: analytics.reduce((sum, day) => sum + day.totalToday, 0),
      averageRidesPerDay: analytics.length > 0 ? 
        (analytics.reduce((sum, day) => sum + day.totalToday, 0) / analytics.length).toFixed(1) : 0,
      peakDay: analytics.reduce((max, day) => 
        day.totalToday > (max?.totalToday || 0) ? day : max, null),
      dailyBreakdown: analytics.map(day => ({
        date: day.date,
        totalRides: day.totalToday,
        maxQueueSize: day.activeRides.length,
        averageWaitTime: (day.activeRides.length * 3) // Estimate
      }))
    };
    
    return summary;
    
  } catch (error) {
    console.error('Error getting queue analytics:', error);
    throw error;
  }
};

/**
 * Get all booth queues status for admin dashboard
 * @returns {Promise<Array>} All booth queue statuses
 */
const getAllBoothQueues = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const allQueues = await BoothQueue.find({ date: today })
      .populate('activeRides.rideId', 'userName vehicleType status')
      .sort({ boothName: 1 });
    
    return allQueues.map(queue => queue.getQueueStatus());
    
  } catch (error) {
    console.error('Error getting all booth queues:', error);
    return [];
  }
};

module.exports = {
  generateQueueNumber,
  getBoothQueueStatus,
  updateQueuePosition,
  getBoothQueueList,
  removeFromQueue,
  getQueueAnalytics,
  getAllBoothQueues
};