const express = require('express');
const router = express.Router();
const RideRequest = require('../../models/RideRequest');
const User = require('../../models/User');
const Driver = require('../../models/Driver');
const BoothQueue = require('../../models/BoothQueue');
const PickupLocation = require('../../models/PickupLocation');
const { adminProtect } = require('../../middleware/auth');
const { generateOTP } = require('../../utils/otpUtils');
const { getIO } = require('../../socket');
const { v4: uuidv4 } = require('uuid');

// Manual booking endpoint
router.post('/manual-booking', adminProtect, async (req, res) => {
  try {
    const {
      pickupStation,
      pickupLocation,
      dropLocation,
      vehicleType,
      estimatedFare,
      distance,
      userPhone,
      userName,
      existingUserId,
      bookingSource,
      paymentStatus
    } = req.body;

    // Find or create user
    let user;
    if (existingUserId) {
      user = await User.findById(existingUserId);
    } else {
      // Check if user with phone exists
      user = await User.findOne({ phone: userPhone });
      
      if (!user) {
        // Create new user
        user = new User({
          name: userName,
          phone: userPhone,
          password: userPhone, // Default password is phone number
          role: 'user',
          isPhoneVerified: true
        });
        await user.save();
      }
    }

    // Find pickup location by name to get ObjectId
    const pickupLocationDoc = await PickupLocation.findOne({ 
      name: pickupStation,
      isActive: true 
    });

    if (!pickupLocationDoc) {
      return res.status(400).json({
        success: false,
        message: `Pickup location '${pickupStation}' not found or inactive`
      });
    }

    // Generate both OTPs upfront
    const startOTP = generateOTP();
    const endOTP = generateOTP();
    const bookingId = `MNL${Date.now()}${Math.floor(Math.random() * 100)}`;

    // Get queue number for the booth
    const queueEntry = await BoothQueue.findOneAndUpdate(
      { boothName: pickupStation },
      { $inc: { currentNumber: 1 } },
      { new: true, upsert: true }
    );

    const queueNumber = queueEntry.currentNumber;

    // Create the ride request
    const rideRequest = new RideRequest({
      userId: user._id,
      user: user._id,
      userName: user.name,
      userPhone: user.phone,
      pickupStation: pickupLocationDoc._id,
      pickupLocation: {
        boothName: pickupLocationDoc.name,
        latitude: pickupLocationDoc.location?.coordinates?.[1] || 0,
        longitude: pickupLocationDoc.location?.coordinates?.[0] || 0
      },
      dropLocation: {
        address: dropLocation,
        latitude: 0, // These can be populated from geocoding if needed
        longitude: 0
      },
      vehicleType,
      estimatedFare,
      fare: estimatedFare,
      distance,
      startOTP,
      endOTP,
      rideId: bookingId,
      bookingId,
      queueNumber,
      bookingSource: 'manual',
      paymentStatus: 'collected',
      status: 'pending',
      adminId: req.admin._id,
      adminName: req.admin.name
    });

    // Find available driver from queue position 1
    const availableDriver = await Driver.findOne({
      currentMetroBooth: pickupStation,
      queuePosition: 1,
      isOnline: true,
      currentRide: null
    });

    if (availableDriver) {
      // Assign driver
      rideRequest.driver = availableDriver._id;
      rideRequest.driverId = availableDriver._id;
      rideRequest.driverName = availableDriver.name;
      rideRequest.driverPhone = availableDriver.phone;
      rideRequest.driverVehicleNo = availableDriver.vehicleNumber;
      rideRequest.status = 'driver_assigned';
      rideRequest.assignedAt = new Date();
      rideRequest.acceptedAt = new Date();

      // Update driver
      availableDriver.currentRide = rideRequest._id;
      await availableDriver.save();

      // Remove driver from queue and adjust positions
      await Driver.updateMany(
        { 
          currentMetroBooth: pickupStation,
          queuePosition: { $gt: 1 }
        },
        { $inc: { queuePosition: -1 } }
      );

      // Set driver queue position to null
      availableDriver.queuePosition = null;
      await availableDriver.save();
    }

    await rideRequest.save();

    // Populate driver details for response
    const populatedRide = await RideRequest.findById(rideRequest._id)
      .populate('driver', 'name phone vehicleNumber vehicleType')
      .populate('user', 'name phone');

    // Emit socket event to driver if assigned
    const io = getIO();
    if (availableDriver) {
      io.to(`driver-${availableDriver._id}`).emit('newRideRequest', {
        rideId: rideRequest._id,
        bookingId: rideRequest.bookingId,
        pickupLocation: rideRequest.pickupLocation.boothName,
        dropLocation: rideRequest.dropLocation.address,
        estimatedFare: rideRequest.estimatedFare,
        vehicleType: rideRequest.vehicleType,
        startOTP: rideRequest.startOTP,
        user: {
          name: user.name,
          phone: user.phone
        }
      });
    }

    // Emit to admin room
    io.to('admin-room').emit('manualBookingCreated', {
      rideId: rideRequest._id,
      bookingId: rideRequest.bookingId,
      status: rideRequest.status,
      driver: availableDriver ? {
        name: availableDriver.name,
        phone: availableDriver.phone
      } : null
    });

    res.json({
      success: true,
      message: 'Ride booked successfully',
      booking: {
        _id: populatedRide._id,
        bookingId: populatedRide.bookingId,
        queueNumber: populatedRide.queueNumber,
        pickupLocation: populatedRide.pickupLocation,
        dropLocation: populatedRide.dropLocation,
        vehicleType: populatedRide.vehicleType,
        estimatedFare: populatedRide.estimatedFare,
        startOTP: populatedRide.startOTP,
        endOTP: populatedRide.endOTP,
        status: populatedRide.status,
        driver: populatedRide.driver,
        userName: user.name,
        userPhone: user.phone,
        bookingSource: 'manual'
      }
    });

  } catch (error) {
    console.error('Manual booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
});

// Check if user exists by phone
router.get('/check-user/:phone', adminProtect, async (req, res) => {
  try {
    const { phone } = req.params;
    const user = await User.findOne({ phone });
    
    if (user) {
      res.json({
        exists: true,
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone
        }
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking user',
      error: error.message
    });
  }
});

// Get manual booking details
router.get('/manual-booking/:id', adminProtect, async (req, res) => {
  try {
    const booking = await RideRequest.findById(req.params.id)
      .populate('user', 'name phone')
      .populate('driver', 'name phone vehicleNumber vehicleType')
      .populate('pickupStation', 'name location');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching booking',
      error: error.message
    });
  }
});

module.exports = router;