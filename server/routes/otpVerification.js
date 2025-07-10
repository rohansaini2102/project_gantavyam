// routes/otpVerification.js
const express = require('express');
const router = express.Router();
const { verifyOTP, logRideEvent } = require('../utils/otpUtils');
const RideRequest = require('../models/RideRequest');
const Driver = require('../models/Driver');
const { auth } = require('../middleware/auth');

// Verify start OTP
router.post('/verify-start', auth, async (req, res) => {
  try {
    const { rideId, otp } = req.body;
    const userId = req.user.id;
    
    console.log('\n=== START OTP VERIFICATION ===');
    console.log('User ID:', userId);
    console.log('Ride ID:', rideId);
    console.log('Provided OTP:', otp);
    
    // Validate input
    if (!rideId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Ride ID and OTP are required'
      });
    }
    
    // Find ride request
    const rideRequest = await RideRequest.findById(rideId);
    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }
    
    // Check if user has permission
    if (rideRequest.userId.toString() !== userId && rideRequest.driverId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to verify this ride'
      });
    }
    
    // Check if ride is in correct state
    if (rideRequest.status !== 'driver_assigned') {
      return res.status(400).json({
        success: false,
        message: `Cannot start ride. Current status: ${rideRequest.status}`
      });
    }
    
    // Verify OTP
    if (!verifyOTP(otp, rideRequest.startOTP)) {
      console.error('❌ Invalid start OTP provided');
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }
    
    // Update ride status
    rideRequest.status = 'ride_started';
    rideRequest.rideStartedAt = new Date();
    await rideRequest.save();
    
    console.log('✅ Ride started successfully');
    
    // Log ride event
    logRideEvent(rideRequest.rideId, 'ride_started_api', {
      userId,
      driverId: rideRequest.driverId,
      startedAt: new Date(),
      verifiedBy: req.user.role || 'user'
    });
    
    res.json({
      success: true,
      message: 'Ride started successfully',
      rideId: rideRequest._id,
      uniqueRideId: rideRequest.rideId,
      status: 'ride_started',
      startedAt: rideRequest.rideStartedAt,
      endOTP: rideRequest.endOTP
    });
    
  } catch (error) {
    console.error('❌ Error verifying start OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying start OTP',
      error: error.message
    });
  }
});

// Verify end OTP
router.post('/verify-end', auth, async (req, res) => {
  try {
    const { rideId, otp } = req.body;
    const userId = req.user.id;
    
    console.log('\n=== END OTP VERIFICATION ===');
    console.log('User ID:', userId);
    console.log('Ride ID:', rideId);
    console.log('Provided OTP:', otp);
    
    // Validate input
    if (!rideId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Ride ID and OTP are required'
      });
    }
    
    // Find ride request
    const rideRequest = await RideRequest.findById(rideId);
    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }
    
    // Check if user has permission
    if (rideRequest.userId.toString() !== userId && rideRequest.driverId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to verify this ride'
      });
    }
    
    // Check if ride is in correct state
    if (rideRequest.status !== 'ride_started') {
      return res.status(400).json({
        success: false,
        message: `Cannot end ride. Current status: ${rideRequest.status}`
      });
    }
    
    // Verify OTP
    if (!verifyOTP(otp, rideRequest.endOTP)) {
      console.error('❌ Invalid end OTP provided');
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }
    
    // Calculate ride duration and final fare
    const rideDuration = Math.floor((new Date() - rideRequest.rideStartedAt) / 60000); // in minutes
    const actualFare = rideRequest.estimatedFare; // For now, use estimated fare
    
    // Update ride status
    rideRequest.status = 'ride_ended';
    rideRequest.rideEndedAt = new Date();
    rideRequest.actualFare = actualFare;
    await rideRequest.save();
    
    // Update driver stats
    if (rideRequest.driverId) {
      await Driver.findByIdAndUpdate(rideRequest.driverId, {
        $inc: { totalRides: 1, totalEarnings: actualFare }
      });
    }
    
    console.log('✅ Ride ended successfully');
    
    // Log ride event
    logRideEvent(rideRequest.rideId, 'ride_ended_api', {
      userId,
      driverId: rideRequest.driverId,
      endedAt: new Date(),
      rideDuration,
      actualFare,
      verifiedBy: req.user.role || 'user'
    });
    
    res.json({
      success: true,
      message: 'Ride completed successfully',
      rideId: rideRequest._id,
      uniqueRideId: rideRequest.rideId,
      status: 'ride_ended',
      endedAt: rideRequest.rideEndedAt,
      actualFare: actualFare,
      rideDuration: rideDuration
    });
    
  } catch (error) {
    console.error('❌ Error verifying end OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying end OTP',
      error: error.message
    });
  }
});

// Get ride details with OTP status
router.get('/ride/:rideId', auth, async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;
    
    console.log('\n=== GET RIDE DETAILS ===');
    console.log('User ID:', userId);
    console.log('Ride ID:', rideId);
    
    // Find ride request
    const rideRequest = await RideRequest.findById(rideId)
      .populate('userId', 'fullName email phone')
      .populate('driverId', 'fullName mobileNo vehicleNo vehicleType rating');
    
    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }
    
    // Check if user has permission
    if (rideRequest.userId._id.toString() !== userId && rideRequest.driverId?._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this ride'
      });
    }
    
    // Prepare response data
    const rideDetails = {
      rideId: rideRequest._id,
      uniqueRideId: rideRequest.rideId,
      status: rideRequest.status,
      vehicleType: rideRequest.vehicleType,
      pickupLocation: rideRequest.pickupLocation,
      dropLocation: rideRequest.dropLocation,
      distance: rideRequest.distance,
      estimatedFare: rideRequest.estimatedFare,
      actualFare: rideRequest.actualFare,
      user: rideRequest.userId,
      driver: rideRequest.driverId,
      timestamps: {
        created: rideRequest.timestamp,
        accepted: rideRequest.acceptedAt,
        started: rideRequest.rideStartedAt,
        ended: rideRequest.rideEndedAt,
        cancelled: rideRequest.cancelledAt
      }
    };
    
    // Include OTPs only for active rides and authorized parties
    if (['driver_assigned', 'ride_started'].includes(rideRequest.status)) {
      if (rideRequest.status === 'driver_assigned') {
        rideDetails.startOTP = rideRequest.startOTP;
      }
      if (rideRequest.status === 'ride_started') {
        rideDetails.endOTP = rideRequest.endOTP;
      }
    }
    
    console.log('✅ Ride details retrieved');
    
    res.json({
      success: true,
      ride: rideDetails
    });
    
  } catch (error) {
    console.error('❌ Error getting ride details:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting ride details',
      error: error.message
    });
  }
});

// Get user's active rides
router.get('/active-rides', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'user';
    
    console.log('\n=== GET ACTIVE RIDES ===');
    console.log('User ID:', userId);
    console.log('Role:', userRole);
    
    let query;
    if (userRole === 'driver') {
      query = { 
        driverId: userId,
        status: { $in: ['driver_assigned', 'ride_started'] }
      };
    } else {
      query = { 
        userId: userId,
        status: { $in: ['pending', 'driver_assigned', 'ride_started'] }
      };
    }
    
    const activeRides = await RideRequest.find(query)
      .populate('userId', 'fullName phone')
      .populate('driverId', 'fullName mobileNo vehicleNo vehicleType rating')
      .sort({ timestamp: -1 });
    
    console.log(`📋 Found ${activeRides.length} active rides`);
    
    const ridesWithOTPs = activeRides.map(ride => ({
      rideId: ride._id,
      uniqueRideId: ride.rideId,
      status: ride.status,
      vehicleType: ride.vehicleType,
      pickupLocation: ride.pickupLocation,
      dropLocation: ride.dropLocation,
      estimatedFare: ride.estimatedFare,
      user: ride.userId,
      driver: ride.driverId,
      startOTP: ['driver_assigned', 'ride_started'].includes(ride.status) ? ride.startOTP : null,
      endOTP: ride.status === 'ride_started' ? ride.endOTP : null,
      timestamps: {
        created: ride.timestamp,
        accepted: ride.acceptedAt,
        started: ride.rideStartedAt
      }
    }));
    
    res.json({
      success: true,
      activeRides: ridesWithOTPs,
      count: ridesWithOTPs.length
    });
    
  } catch (error) {
    console.error('❌ Error getting active rides:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting active rides',
      error: error.message
    });
  }
});

module.exports = router;