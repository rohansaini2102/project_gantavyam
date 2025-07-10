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

// @desc    Create a new ride request
// @route   POST /api/ride-requests/request
// @access  Private (User only)
router.post('/request', protectUser, async (req, res) => {
  console.log('\n=== NEW RIDE REQUEST VIA API ===');
  console.log('User ID:', req.user.id);
  console.log('Request body:', req.body);
  
  try {
    const {
      pickupStation,
      dropLocation,
      vehicleType,
      estimatedFare
    } = req.body;

    // Validate required fields
    if (!pickupStation || !dropLocation || !vehicleType || !estimatedFare) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pickupStation, dropLocation, vehicleType, estimatedFare'
      });
    }

    // Validate vehicle type
    if (!['bike', 'auto', 'car'].includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle type. Must be: bike, auto, or car'
      });
    }

    // Find pickup station
    const station = await MetroStation.findOne({ name: pickupStation });
    if (!station) {
      return res.status(404).json({
        success: false,
        error: 'Pickup station not found'
      });
    }

    // Get user details
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate unique ride ID and OTPs
    const rideId = generateRideId();
    const { startOTP, endOTP } = generateRideOTPs();

    // Calculate distance for database storage
    const { calculateDistance } = require('../utils/fareCalculator');
    const distance = calculateDistance(
      station.lat, station.lng,
      dropLocation.lat, dropLocation.lng
    );

    // Create ride request
    const rideRequest = await RideRequest.create({
      userId: req.user.id,
      userName: user.name,
      userPhone: user.phone,
      pickupLocation: {
        boothName: pickupStation,
        latitude: station.lat,
        longitude: station.lng
      },
      dropLocation: {
        address: dropLocation.address,
        latitude: dropLocation.lat,
        longitude: dropLocation.lng
      },
      vehicleType: vehicleType,
      distance: distance,
      fare: estimatedFare,
      estimatedFare: estimatedFare,
      rideId: rideId,
      startOTP: startOTP,
      endOTP: endOTP,
      status: 'pending'
    });

    console.log(`✅ Ride request created with ID: ${rideRequest._id}`);
    console.log(`🔐 Generated OTPs - Start: ${startOTP}, End: ${endOTP}`);

    // Log ride event
    logRideEvent(rideId, 'ride_request_created', {
      userId: req.user.id,
      userName: user.name,
      pickupStation,
      vehicleType,
      estimatedFare,
      distance
    });

    // Log user action
    logUserAction(req.user.id, 'ride_booked', {
      rideId,
      pickupStation,
      vehicleType,
      estimatedFare
    });

    // Broadcast ride request to matching drivers using the proper method
    try {
      const broadcastData = {
        rideId: rideRequest._id.toString(),
        pickupStation: pickupStation,
        vehicleType: vehicleType,
        userName: user.name,
        userPhone: user.phone
      };

      console.log(`📡 Broadcasting ride request to matching drivers:`, broadcastData);
      const broadcastResult = await broadcastRideRequest(broadcastData);
      
      if (broadcastResult.success) {
        console.log(`✅ Socket broadcast completed for ride ${rideId} - ${broadcastResult.driversNotified} drivers notified`);
      } else {
        console.error(`❌ Socket broadcast failed for ride ${rideId}:`, broadcastResult.error);
      }

    } catch (socketError) {
      console.error('❌ Socket broadcast failed:', socketError);
      // Don't fail the API call if socket fails
    }

    res.status(201).json({
      success: true,
      message: 'Ride request created successfully',
      data: {
        rideId: rideRequest._id,
        uniqueRideId: rideId,
        status: 'pending',
        pickupStation: pickupStation,
        dropLocation: dropLocation,
        vehicleType: vehicleType,
        estimatedFare: estimatedFare,
        distance: distance,
        startOTP: startOTP,
        timestamp: rideRequest.timestamp
      }
    });

  } catch (error) {
    console.error('❌ Error creating ride request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create ride request',
      message: error.message
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

    if (!rideId) {
      return res.status(400).json({
        success: false,
        error: 'Ride ID is required'
      });
    }

    const rideRequest = await RideRequest.findById(rideId);
    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        error: 'Ride request not found'
      });
    }

    // Check if user owns this ride request
    if (rideRequest.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to cancel this ride'
      });
    }

    // Update ride request status
    rideRequest.status = 'cancelled';
    rideRequest.cancelledAt = new Date();
    rideRequest.cancellationReason = reason || 'User cancelled';
    rideRequest.cancelledBy = 'user';
    await rideRequest.save();

    // Broadcast cancellation to driver if assigned
    if (rideRequest.driverId) {
      try {
        const io = getIO();
        io.to(`driver_${rideRequest.driverId}`).emit('rideCancelled', {
          rideId: rideRequest._id,
          uniqueRideId: rideRequest.rideId,
          cancelledBy: 'user',
          reason: reason
        });
      } catch (socketError) {
        console.error('Failed to notify driver of cancellation:', socketError);
      }
    }

    res.json({
      success: true,
      message: 'Ride request cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling ride request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel ride request'
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