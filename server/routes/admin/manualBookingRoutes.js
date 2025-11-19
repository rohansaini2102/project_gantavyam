const express = require('express');
const router = express.Router();
const RideRequest = require('../../models/RideRequest');
const User = require('../../models/User');
const Driver = require('../../models/Driver');
const BoothQueue = require('../../models/BoothQueue');
const PickupLocation = require('../../models/PickupLocation');
const { adminProtect } = require('../../middleware/auth');
const { checkPermission, PERMISSIONS } = require('../../middleware/permissions');
const { generateOTP } = require('../../utils/otpUtils');
const twilioSmsService = require('../../services/twilioSmsService');
const { getIO, sendRideRequestToDriver } = require('../../socket');
const { v4: uuidv4 } = require('uuid');
const { logRideEvent, logDriverAction, logStatusTransition, logSocketDelivery, logError } = require('../../utils/rideLogger');
const { calculateFare } = require('../../utils/fareCalculator');

// Manual booking endpoint (requires manual booking permission)
router.post('/manual-booking', adminProtect, checkPermission(PERMISSIONS.RIDES_MANUAL_BOOKING), async (req, res) => {
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

    // Validate phone number
    if (!userPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if phone number is valid (10 digits starting with 6-9)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(userPhone)) {
      console.error(`❌ Invalid phone number format: ${userPhone}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Must be 10 digits starting with 6-9'
      });
    }

    console.log(`✅ Valid phone number received: ${userPhone}`);

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
          isPhoneVerified: true,
          createdBy: 'admin'
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
    
    // Send SMS to customer with OTPs if ride was successfully created
    let smsResult = null;
    if (targetDriver && twilioSmsService.isConfigured()) {
      try {
        // Validate phone number before sending SMS
        const phoneValidation = twilioSmsService.validatePhoneNumber(user.phone);
        if (!phoneValidation.isValid) {
          console.warn(`⚠️ SMS skipped - invalid phone number: ${user.phone}`);
          smsResult = {
            success: false,
            skipped: true,
            reason: phoneValidation.error,
            phone: user.phone
          };

          // Log the SMS skip but don't fail the booking
          logError(populatedRide._id, 'sms_skipped_invalid_phone', {
            phone: user.phone,
            error: phoneValidation.error
          });
        } else {
          console.log(`📱 Sending booking confirmation SMS to ${phoneValidation.formatted}`);
          smsResult = await twilioSmsService.sendBookingOTP(
            user.phone,
            populatedRide.startOTP,
            populatedRide.endOTP,
            targetDriver.fullName,
            {
              rideId: populatedRide._id,
              adminId: req.admin?._id,
              adminName: req.admin?.name
            }
          );
        }

        if (smsResult.success) {
          console.log(`✅ SMS sent successfully to ${user.phone}`);

          // Log SMS success
          logRideEvent(populatedRide._id, 'sms_booking_sent', {
            phone: user.phone,
            messageId: smsResult.messageId,
            startOTP: populatedRide.startOTP,
            endOTP: populatedRide.endOTP,
            driverName: targetDriver.fullName
          });
        } else {
          console.error(`❌ Failed to send SMS to ${user.phone}:`, smsResult.error);

          // Log SMS failure
          logError(populatedRide._id, 'sms_booking_failed', {
            phone: user.phone,
            error: smsResult.error,
            errorCode: smsResult.errorCode
          });
        }
      } catch (smsError) {
        console.error('❌ SMS service error:', smsError.message);

        // Log SMS service error
        logError(populatedRide._id, 'sms_service_error', {
          phone: user.phone,
          error: smsError.message
        });
      }
    } else if (!twilioSmsService.isConfigured()) {
      console.warn('⚠️ SMS service not configured - skipping SMS');
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
        bookingSource: 'manual',
        smsStatus: smsResult ? {
          sent: smsResult.success,
          error: smsResult.success ? null : smsResult.error
        } : null
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

// Register new customer (quick registration during manual booking)
router.post('/register-customer', adminProtect, checkPermission(PERMISSIONS.RIDES_MANUAL_BOOKING), async (req, res) => {
  try {
    const { phone, name, email } = req.body;

    // Validate required fields
    if (!phone || !name) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and name are required'
      });
    }

    // Validate phone number format (10 digits starting with 6-9)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Must be 10 digits starting with 6-9'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this phone number already exists',
        user: {
          _id: existingUser._id,
          name: existingUser.name,
          phone: existingUser.phone,
          email: existingUser.email
        }
      });
    }

    // Create new user
    const newUser = new User({
      name,
      phone,
      email: email || undefined,
      password: phone, // Default password is phone number
      role: 'user',
      isPhoneVerified: true,
      createdBy: 'admin'
    });

    await newUser.save();

    console.log(`✅ New customer registered by ${req.admin.name}: ${name} (${phone})`);

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      user: {
        _id: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Error registering customer:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering customer',
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

// Resend OTP via SMS for manual booking
router.post('/resend-otp/:rideId', adminProtect, async (req, res) => {
  try {
    const { rideId } = req.params;

    // Fetch ride details with populated user data
    const ride = await RideRequest.findById(rideId)
      .populate('user', 'name phone')
      .populate('driver', 'fullName name');

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    // Check if ride has OTPs
    if (!ride.startOTP || !ride.endOTP) {
      return res.status(400).json({
        success: false,
        message: 'OTPs not available for this ride'
      });
    }

    // Check if user phone is available
    if (!ride.user || !ride.user.phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer phone number not available'
      });
    }

    // Send resend OTP SMS if Twilio is configured
    let smsResult = null;
    if (twilioSmsService.isConfigured()) {
      try {
        // Validate phone number before sending SMS
        const phoneValidation = twilioSmsService.validatePhoneNumber(ride.user.phone);
        if (!phoneValidation.isValid) {
          return res.status(400).json({
            success: false,
            message: `Invalid phone number: ${phoneValidation.error}`
          });
        }

        console.log(`📱 Resending OTP SMS to ${phoneValidation.formatted}`);
        smsResult = await twilioSmsService.sendResendOTP(
          ride.user.phone,
          ride.startOTP,
          ride.endOTP,
          {
            rideId: ride._id,
            adminId: req.admin?._id,
            adminName: req.admin?.name,
            resendBy: 'admin'
          }
        );

        if (smsResult.success) {
          console.log(`✅ Resend OTP SMS sent successfully to ${ride.user.phone}`);

          // Log SMS success
          logRideEvent(ride._id, 'sms_otp_resent', {
            phone: ride.user.phone,
            messageId: smsResult.messageId,
            startOTP: ride.startOTP,
            endOTP: ride.endOTP,
            adminId: req.admin?._id,
            adminName: req.admin?.name
          });

          res.json({
            success: true,
            message: 'OTP resent successfully via SMS',
            phone: ride.user.phone,
            messageId: smsResult.messageId
          });
        } else {
          console.error(`❌ Failed to resend OTP SMS to ${ride.user.phone}:`, smsResult.error);

          // Log SMS failure
          logError(ride._id, 'sms_otp_resend_failed', {
            phone: ride.user.phone,
            error: smsResult.error,
            errorCode: smsResult.errorCode,
            adminId: req.admin?._id
          });

          res.status(500).json({
            success: false,
            message: 'Failed to send OTP via SMS',
            error: smsResult.error
          });
        }
      } catch (smsError) {
        console.error('❌ SMS service error during OTP resend:', smsError.message);

        // Log SMS service error
        logError(ride._id, 'sms_otp_resend_service_error', {
          phone: ride.user.phone,
          error: smsError.message,
          adminId: req.admin?._id
        });

        res.status(500).json({
          success: false,
          message: 'SMS service error',
          error: smsError.message
        });
      }
    } else {
      res.status(503).json({
        success: false,
        message: 'SMS service not configured'
      });
    }
  } catch (error) {
    console.error('❌ Error resending OTP:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error resending OTP',
      error: error.message
    });
  }
});

module.exports = router;