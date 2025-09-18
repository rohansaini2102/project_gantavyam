// server/routes/rideRequests.js
const express = require('express');
const router = express.Router();

// Use proper user authentication middleware
const protectUser = require('../middleware/userAuth');

const RideRequest = require('../models/RideRequest');
const User = require('../models/User');
const MetroStation = require('../models/MetroStation');
const { getIO, broadcastRideRequest } = require('../socket');
const { generateRideId, generateRideOTPs } = require('../utils/otpUtils');
const { logRideEvent, logUserAction } = require('../utils/rideLogger');
const { calculateFare } = require('../utils/fareCalculator');

// @desc    Create a new ride request
// @route   POST /api/ride-requests/request
// @access  Private (User only)
router.post('/request', protectUser, async (req, res) => {
  try {
    const { 
      pickupStation, 
      dropLocation, 
      vehicleType, 
      estimatedFare,
      distance 
    } = req.body;
    
    const userId = req.user.id;
    
    console.log('\n=== NEW RIDE REQUEST ===');
    console.log('User ID:', userId);
    console.log('Pickup Station:', pickupStation);
    console.log('Drop Location:', dropLocation);
    console.log('Vehicle Type:', vehicleType);
    console.log('Estimated Fare:', estimatedFare);
    console.log('Distance:', distance);
    
    // Validate input
    if (!pickupStation || !dropLocation || !vehicleType || estimatedFare === undefined || distance === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All booking details are required'
      });
    }
    
    // Validate drop location structure
    if (!dropLocation.address || typeof dropLocation.lat !== 'number' || typeof dropLocation.lng !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Drop location must include address, lat, and lng'
      });
    }
    
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Handle fixed pickup location
    let station;
    if (pickupStation === 'Hauz Khas Metro Gate No 1') {
      station = {
        name: 'Hauz Khas Metro Gate No 1',
        lat: 28.5433,
        lng: 77.2066,
        line: 'yellow',
        type: 'metro'
      };
    } else {
      return res.status(404).json({
        success: false,
        message: 'Invalid pickup location'
      });
    }
    
    // Generate ride details
    const rideId = generateRideId();
    const { startOTP, endOTP } = generateRideOTPs();

    // Calculate fare with commission structure
    const fareDetails = await calculateFare(vehicleType, distance, true, 0);

    // Create ride request with both driver and customer fares
    const rideRequest = new RideRequest({
      userId: user._id,
      user: user._id,
      userName: user.name,
      userPhone: user.phone,
      pickupLocation: {
        boothName: station.name,
        latitude: station.lat,
        longitude: station.lng
      },
      dropLocation: {
        address: dropLocation.address,
        latitude: dropLocation.lat,
        longitude: dropLocation.lng
      },
      vehicleType,
      estimatedFare: fareDetails.customerTotalFare, // What customer sees
      fare: fareDetails.driverFare, // Driver earnings (base fare)
      driverFare: fareDetails.driverFare, // Explicit driver earnings
      customerFare: fareDetails.customerTotalFare, // What customer pays
      baseFare: fareDetails.baseFare,
      gstAmount: fareDetails.gstAmount,
      commissionAmount: fareDetails.commissionAmount,
      nightChargeAmount: fareDetails.nightChargeAmount,
      fareBreakdown: fareDetails.breakdown,
      distance,
      startOTP,
      endOTP,
      rideId,
      status: 'pending',
      timestamp: new Date()
    });
    
    await rideRequest.save();
    
    // Log ride event
    logRideEvent(rideRequest._id, 'ride_request_created', {
      userId,
      pickupStation: station.name,
      dropLocation: dropLocation.address,
      vehicleType,
      estimatedFare
    });
    
    console.log('✅ Ride request created:', rideRequest._id);
    
    // Broadcast to available drivers
    try {
      await broadcastRideRequest(rideRequest);
      console.log('✅ Ride request broadcast to drivers');
    } catch (broadcastError) {
      console.error('❌ Error broadcasting ride request:', broadcastError);
      // Continue even if broadcast fails
    }
    
    res.json({
      success: true,
      data: {
        _id: rideRequest._id,
        rideId: rideRequest.rideId,
        status: 'pending',
        pickupLocation: rideRequest.pickupLocation,
        dropLocation: rideRequest.dropLocation,
        vehicleType: rideRequest.vehicleType,
        estimatedFare: rideRequest.customerFare || rideRequest.estimatedFare, // Customer sees total
        fare: rideRequest.customerFare || rideRequest.estimatedFare, // For backward compatibility
        startOTP: rideRequest.startOTP
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating ride request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ride request',
      error: error.message
    });
  }
});

// @desc    Get active ride requests
// @route   GET /api/ride-requests/active
// @access  Private (Driver only)
router.get('/active', protectUser, async (req, res) => {
  try {
    const activeRequests = await RideRequest.find({
      status: 'pending'
    }).sort({ timestamp: -1 });

    res.json({
      success: true,
      data: activeRequests
    });
  } catch (error) {
    console.error('Error fetching active ride requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active ride requests'
    });
  }
});

// @desc    Cancel a ride request
// @route   POST /api/ride-requests/cancel
// @access  Private (User only)
router.post('/cancel', protectUser, async (req, res) => {
  try {
    const { rideId, reason } = req.body;
    const userId = req.user.id;
    
    console.log('\n=== RIDE CANCELLATION REQUEST ===');
    console.log('User ID:', userId);
    console.log('Ride ID:', rideId);
    console.log('Reason:', reason);
    
    // Find the ride request
    const rideRequest = await RideRequest.findOne({
      _id: rideId,
      userId: userId,
      status: { $in: ['pending', 'driver_assigned', 'driver_arrived'] }
    });
    
    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or cannot be cancelled'
      });
    }
    
    // Update ride status
    rideRequest.status = 'cancelled';
    rideRequest.cancelledBy = 'user';
    rideRequest.cancellationReason = reason || 'User cancelled';
    rideRequest.cancelledAt = new Date();
    
    await rideRequest.save();
    
    // If driver was assigned, free them up
    if (rideRequest.driver) {
      await Driver.findByIdAndUpdate(rideRequest.driver, {
        currentRide: null,
        isAvailable: true
      });
      
      // Notify driver via socket
      const io = getIO();
      io.to(`driver_${rideRequest.driver}`).emit('rideCancelled', {
        rideId: rideRequest._id,
        reason: reason || 'User cancelled'
      });
    }
    
    // Log cancellation
    logRideEvent(rideRequest._id, 'ride_cancelled_by_user', {
      userId,
      reason: reason || 'User cancelled',
      previousStatus: rideRequest.status
    });
    
    res.json({
      success: true,
      message: 'Ride cancelled successfully'
    });
    
  } catch (error) {
    console.error('❌ Error cancelling ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel ride',
      error: error.message
    });
  }
});

// @desc    Debug endpoint to check system status
// @route   GET /api/ride-requests/debug
// @access  Public (for debugging)
router.get('/debug', async (req, res) => {
  try {
    console.log('\n=== SYSTEM DEBUG CHECK ===');
    
    // Check database connections
    const totalDrivers = await Driver.countDocuments();
    const onlineDrivers = await Driver.find({ isOnline: true });
    const totalUsers = await User.countDocuments();
    const pendingRideRequests = await RideRequest.find({ status: 'pending' });
    const totalMetroStations = await MetroStation.countDocuments();
    
    // Check socket connections
    let socketInfo = { error: 'Socket not initialized' };
    try {
      const io = getIO();
      const driversRoom = io.sockets.adapter.rooms.get('drivers');
      socketInfo = {
        driversInRoom: driversRoom ? driversRoom.size : 0,
        totalConnectedSockets: io.sockets.sockets.size
      };
    } catch (socketError) {
      socketInfo.error = socketError.message;
    }
    
    // Detailed driver information
    const driverDetails = onlineDrivers.map(driver => ({
      id: driver._id,
      name: driver.fullName,
      vehicleType: driver.vehicleType,
      currentMetroBooth: driver.currentMetroBooth,
      isOnline: driver.isOnline,
      lastActiveTime: driver.lastActiveTime
    }));
    
    // Recent ride requests
    const recentRideRequests = await RideRequest.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .select('_id rideId vehicleType status pickupLocation userName timestamp driversNotified broadcastMethod');
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      database: {
        totalDrivers,
        onlineDrivers: onlineDrivers.length,
        totalUsers,
        pendingRideRequests: pendingRideRequests.length,
        totalMetroStations
      },
      socket: socketInfo,
      driverDetails,
      recentRideRequests: recentRideRequests.map(req => ({
        id: req._id,
        rideId: req.rideId,
        vehicleType: req.vehicleType,
        status: req.status,
        pickupStation: req.pickupLocation?.boothName,
        userName: req.userName,
        timestamp: req.timestamp,
        driversNotified: req.driversNotified,
        broadcastMethod: req.broadcastMethod
      })),
      pendingRequests: pendingRideRequests.map(req => ({
        id: req._id,
        rideId: req.rideId,
        vehicleType: req.vehicleType,
        pickupStation: req.pickupLocation?.boothName,
        userName: req.userName,
        timeAge: Math.round((Date.now() - req.timestamp.getTime()) / 1000 / 60) + ' minutes'
      }))
    };
    
    console.log('🔍 Debug Info Generated:', JSON.stringify(debugInfo, null, 2));
    
    res.json({
      success: true,
      debug: debugInfo
    });
    
  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Debug endpoint failed',
      message: error.message
    });
  }
});

module.exports = router;