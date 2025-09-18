const express = require('express');
const router = express.Router();
const RideRequest = require('../../models/RideRequest');
const User = require('../../models/User');
const Driver = require('../../models/Driver');
const BoothQueue = require('../../models/BoothQueue');
const PickupLocation = require('../../models/PickupLocation');
const { adminProtect } = require('../../middleware/auth');
const { generateOTP } = require('../../utils/otpUtils');
const { getIO, sendRideRequestToDriver } = require('../../socket');
const { v4: uuidv4 } = require('uuid');
const { logRideEvent, logDriverAction, logStatusTransition, logSocketDelivery, logError } = require('../../utils/rideLogger');
const { calculateFare } = require('../../utils/fareCalculator');

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
      selectedDriverId, // Add support for manual driver selection
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

    // Calculate fare with commission structure
    const fareDetails = await calculateFare(vehicleType, distance, true, 0);

    // Create the ride request with both driver and customer fares
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
      estimatedFare: fareDetails.customerTotalFare, // What customer sees and pays
      fare: fareDetails.driverFare, // Driver earnings (base fare without GST/commission)
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
      rideId: bookingId,
      bookingId,
      queueNumber,
      bookingSource: 'manual',
      paymentStatus: 'collected',
      status: 'pending',
      adminId: req.admin._id,
      adminName: req.admin.name
    });

    // Save the ride request first
    await rideRequest.save();
    
    // Log ride creation
    logRideEvent(rideRequest._id, 'manual_booking_created', {
      bookingId: rideRequest.bookingId,
      adminId: req.admin._id,
      adminName: req.admin.name,
      pickupStation,
      dropLocation,
      vehicleType,
      estimatedFare,
      userPhone,
      userName
    });

    // Find driver to send request to
    let targetDriver = null;
    
    if (selectedDriverId) {
      // Manual driver selection - validate the selected driver
      console.log(`\n🎯 MANUAL DRIVER SELECTION DEBUGGING`);
      console.log(`   Selected Driver ID: ${selectedDriverId}`);
      console.log(`   Pickup Station: ${pickupStation}`);
      console.log(`   Vehicle Type: ${vehicleType}`);
      
      // First check if driver exists at all
      const driverExists = await Driver.findById(selectedDriverId);
      if (!driverExists) {
        console.log(`❌ Driver with ID ${selectedDriverId} not found in database`);
        return res.status(400).json({
          success: false,
          message: 'Selected driver not found in database'
        });
      }
      
      console.log(`✅ Driver found in database: ${driverExists.fullName}`);
      console.log(`   Current Status:`, {
        isOnline: driverExists.isOnline,
        currentMetroBooth: driverExists.currentMetroBooth,
        currentRide: driverExists.currentRide,
        vehicleType: driverExists.vehicleType,
        queuePosition: driverExists.queuePosition
      });
      
      // Now check with all criteria
      targetDriver = await Driver.findOne({
        _id: selectedDriverId,
        currentMetroBooth: pickupStation,
        isOnline: true,
        currentRide: null,
        vehicleType: vehicleType // Ensure vehicle type matches
      });
      
      // If driver doesn't have booth set, try without booth restriction
      if (!targetDriver && (!driverExists.currentMetroBooth || driverExists.currentMetroBooth === null)) {
        console.log(`🔄 Driver booth is null, checking without booth restriction...`);
        targetDriver = await Driver.findOne({
          _id: selectedDriverId,
          isOnline: true,
          currentRide: null,
          vehicleType: vehicleType
        });
        
        if (targetDriver) {
          console.log(`✅ Found driver without booth restriction, updating booth to ${pickupStation}`);
          targetDriver.currentMetroBooth = pickupStation;
          await targetDriver.save();
        }
      }
      
      if (targetDriver) {
        console.log(`✅ Driver passes all validation checks: ${targetDriver.fullName} (Queue #${targetDriver.queuePosition})`);
      } else {
        console.log(`❌ Driver ${driverExists.fullName} failed validation checks`);
        
        // Determine specific reason for failure
        const reasons = [];
        if (!driverExists.isOnline) reasons.push('Driver is offline');
        if (driverExists.currentMetroBooth && driverExists.currentMetroBooth !== pickupStation) {
          reasons.push(`Driver at wrong station (${driverExists.currentMetroBooth} vs ${pickupStation})`);
        }
        if (driverExists.currentRide) reasons.push('Driver has active ride');
        if (driverExists.vehicleType !== vehicleType) reasons.push(`Vehicle type mismatch (${driverExists.vehicleType} vs ${vehicleType})`);
        
        // If only issue is null booth, allow it and update
        if (reasons.length === 0 && !driverExists.currentMetroBooth) {
          console.log(`✅ Only issue was null booth, allowing driver and updating booth`);
          targetDriver = driverExists;
          targetDriver.currentMetroBooth = pickupStation;
          await targetDriver.save();
        } else {
          return res.status(400).json({
            success: false,
            message: `Selected driver is not available: ${reasons.join(', ')}`
          });
        }
      }
    } else {
      // Auto-selection - find driver from queue position 1
      console.log(`🔍 Auto-selection: Looking for available driver at ${pickupStation} with queue position 1`);
      
      // First, check all drivers at this station for debugging
      const allDriversAtStation = await Driver.find({
        currentMetroBooth: pickupStation,
        isOnline: true
      }).select('fullName queuePosition currentRide isOnline vehicleType currentMetroBooth');
      
      // Also get all online drivers regardless of booth for debugging
      const allOnlineDrivers = await Driver.find({
        isOnline: true,
        vehicleType: vehicleType
      }).select('fullName queuePosition currentRide isOnline vehicleType currentMetroBooth');
      
      console.log(`📊 All online drivers at ${pickupStation}:`, allDriversAtStation.map(d => ({
        name: d.fullName,
        queuePosition: d.queuePosition,
        currentRide: d.currentRide,
        isOnline: d.isOnline,
        vehicleType: d.vehicleType,
        currentMetroBooth: d.currentMetroBooth
      })));
      
      console.log(`🌐 All online ${vehicleType} drivers (any location):`, allOnlineDrivers.map(d => ({
        name: d.fullName,
        queuePosition: d.queuePosition,
        currentMetroBooth: d.currentMetroBooth || 'NOT SET',
        hasActiveRide: !!d.currentRide
      })));
      
      // Also check drivers that might be connected via socket but DB not updated yet
      const io = getIO();
      if (io && allDriversAtStation.length === 0) {
        console.log(`🔌 No drivers found in DB, checking socket connections...`);
        const allSockets = io.sockets.sockets;
        for (const [socketId, socket] of allSockets) {
          if (socket.user && socket.user.role === 'driver' && 
              socket.user.currentMetroBooth === pickupStation &&
              socket.user.vehicleType === vehicleType) {
            console.log(`🔌 Found connected driver via socket: ${socket.user.fullName} (${socket.user._id})`);
            // Try to find this driver in DB and update their status
            const connectedDriver = await Driver.findById(socket.user._id);
            if (connectedDriver && !connectedDriver.isOnline) {
              console.log(`📝 Updating socket-connected driver ${socket.user._id} to online in DB`);
              await Driver.findByIdAndUpdate(socket.user._id, {
                isOnline: true,
                currentMetroBooth: pickupStation,
                vehicleType: vehicleType,
                lastActiveTime: new Date()
              });
            }
          }
        }
      }
      
      // First try exact match
      targetDriver = await Driver.findOne({
        currentMetroBooth: pickupStation,
        queuePosition: 1,
        isOnline: true,
        currentRide: null,
        vehicleType: vehicleType // Ensure vehicle type matches
      });
      
      // If no exact match, try without booth restriction (for drivers who haven't set location)
      if (!targetDriver) {
        console.log(`🔄 No driver found with exact booth match, trying without booth restriction...`);
        console.log(`🔍 Looking for: vehicleType=${vehicleType}, queuePosition=1, isOnline=true, currentRide=null`);
        
        targetDriver = await Driver.findOne({
          queuePosition: 1,
          isOnline: true,
          currentRide: null,
          vehicleType: vehicleType
        });
        
        if (targetDriver) {
          console.log(`✅ Found driver without booth restriction: ${targetDriver.fullName}`);
          console.log(`   Current booth: ${targetDriver.currentMetroBooth || 'NOT SET'}`);
          console.log(`   Updating to: ${pickupStation}`);
          // Update their booth to match the booking
          targetDriver.currentMetroBooth = pickupStation;
          await targetDriver.save();
          console.log(`   ✅ Driver booth updated successfully`);
        } else {
          console.log(`❌ No driver found even without booth restriction`);
        }
      }
      
      if (targetDriver) {
        console.log(`✅ Found available driver at queue position 1: ${targetDriver.fullName} (${targetDriver._id})`);
      } else {
        console.log(`❌ No available ${vehicleType} driver found at queue position 1 for ${pickupStation}`);
        
        // Provide more detailed debugging info
        const debugInfo = {
          searchCriteria: {
            pickupStation,
            vehicleType,
            queuePosition: 1,
            isOnline: true,
            currentRide: null
          },
          driversFoundAtStation: allDriversAtStation.length,
          driversAtStation: allDriversAtStation.map(d => ({
            name: d.fullName,
            queuePosition: d.queuePosition,
            vehicleType: d.vehicleType,
            isOnline: d.isOnline,
            currentMetroBooth: d.currentMetroBooth || 'NOT SET',
            hasActiveRide: !!d.currentRide
          })),
          allOnlineDriversOfType: allOnlineDrivers.map(d => ({
            name: d.fullName,
            queuePosition: d.queuePosition,
            currentMetroBooth: d.currentMetroBooth || 'NOT SET',
            hasActiveRide: !!d.currentRide
          }))
        };
        
        console.log('📊 Debug info for failed driver search:', debugInfo);
        
        return res.status(400).json({
          success: false,
          message: `No available ${vehicleType} driver at queue position 1. Please select a specific driver or wait for drivers to come online.`,
          debug: debugInfo
        });
      }
    }

    // Send ride request to target driver
    if (targetDriver) {
      // Update ride status to pending
      rideRequest.status = 'pending';
      await rideRequest.save();
      
      console.log(`\n📤 MANUAL BOOKING: Sending ride request to driver`);
      console.log(`   Driver Name: ${targetDriver.fullName}`);
      console.log(`   Driver ID: ${targetDriver._id}`);
      console.log(`   Driver ID Type: ${typeof targetDriver._id}`);
      console.log(`   Ride ID: ${rideRequest._id}`);
      console.log(`   Booking ID: ${rideRequest.bookingId}`);
      
      // Send ride request to the driver using the new function
      const broadcastResult = await sendRideRequestToDriver(rideRequest, targetDriver._id);
      
      console.log(`📊 Broadcast Result:`, broadcastResult);
      
      if (broadcastResult.success) {
        console.log(`✅ Ride request sent to driver ${targetDriver.fullName}`);
        console.log(`   Method: ${broadcastResult.method}`);
        console.log(`   Attempts: ${broadcastResult.attempt || 1}`);
        
        // Log the event
        logRideEvent(rideRequest._id, 'manual_booking_sent_to_driver', {
          bookingId: rideRequest.bookingId,
          driverId: targetDriver._id,
          driverName: targetDriver.fullName,
          driverQueuePosition: targetDriver.queuePosition,
          status: 'pending',
          method: broadcastResult.method
        });
      } else {
        console.error(`❌ Failed to send ride request to driver: ${broadcastResult.error}`);
        
        // Update status back to pending if failed
        rideRequest.status = 'pending';
        await rideRequest.save();
        
        // Check if this is a connectivity issue
        const errorMessage = broadcastResult.error || 'Failed to send ride request to driver';
        const isConnectivityIssue = errorMessage.includes('not online') || errorMessage.includes('not reachable');
        
        return res.status(400).json({
          success: false,
          message: isConnectivityIssue 
            ? `Driver ${targetDriver.fullName} is not online or not reachable. Please ensure the driver is online and try again.`
            : errorMessage,
          driverStatus: isConnectivityIssue ? 'offline' : 'unknown'
        });
      }
    }

    // Populate ride details for response
    const populatedRide = await RideRequest.findById(rideRequest._id)
      .populate('user', 'name phone');

    // Emit to admin room about the manual booking
    const io = getIO();
    if (io) {
      // Notify admins about the manual booking creation
      io.to('admin-room').emit('manualBookingCreated', {
        rideId: rideRequest._id,
        bookingId: rideRequest.bookingId,
        status: rideRequest.status,
        targetDriver: targetDriver ? {
          id: targetDriver._id,
          name: targetDriver.fullName,
          phone: targetDriver.mobileNo,
          queuePosition: targetDriver.queuePosition
        } : null,
        user: {
          name: user.name,
          phone: user.phone
        },
        pickupLocation: rideRequest.pickupLocation,
        dropLocation: rideRequest.dropLocation,
        vehicleType: rideRequest.vehicleType,
        estimatedFare: rideRequest.estimatedFare,
        timestamp: new Date().toISOString()
      });
    }
    
    // Send success response
    res.json({
      success: true,
      message: targetDriver ? 'Ride request sent to driver' : 'Ride booked successfully',
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
        targetDriver: targetDriver ? {
          id: targetDriver._id,
          name: targetDriver.fullName,
          phone: targetDriver.mobileNo,
          queuePosition: targetDriver.queuePosition
        } : null,
        userName: user.name,
        userPhone: user.phone,
        bookingSource: 'manual'
      }
    });

  } catch (error) {
    console.error('Manual booking error:', error);
    
    // Log the error with context
    logError(null, 'manual_booking_failed', {
      adminId: req.admin?._id,
      adminName: req.admin?.name,
      requestBody: req.body,
      errorMessage: error.message,
      errorStack: error.stack
    });
    
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