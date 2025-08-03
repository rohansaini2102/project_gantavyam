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
      console.log(`🎯 Manual driver selection: ${selectedDriverId}`);
      
      targetDriver = await Driver.findOne({
        _id: selectedDriverId,
        currentMetroBooth: pickupStation,
        isOnline: true,
        currentRide: null,
        vehicleType: vehicleType // Ensure vehicle type matches
      });
      
      if (targetDriver) {
        console.log(`✅ Validated manually selected driver: ${targetDriver.fullName} (Queue #${targetDriver.queuePosition})`);
      } else {
        console.log(`❌ Selected driver ${selectedDriverId} is not available or doesn't match criteria`);
        return res.status(400).json({
          success: false,
          message: 'Selected driver is not available or does not match the vehicle type requirements'
        });
      }
    } else {
      // Auto-selection - find driver from queue position 1
      console.log(`🔍 Auto-selection: Looking for available driver at ${pickupStation} with queue position 1`);
      
      // First, check all drivers at this station for debugging
      const allDriversAtStation = await Driver.find({
        currentMetroBooth: pickupStation,
        isOnline: true
      }).select('fullName queuePosition currentRide isOnline vehicleType');
      
      console.log(`📊 All online drivers at ${pickupStation}:`, allDriversAtStation.map(d => ({
        name: d.fullName,
        queuePosition: d.queuePosition,
        currentRide: d.currentRide,
        isOnline: d.isOnline,
        vehicleType: d.vehicleType
      })));
      
      targetDriver = await Driver.findOne({
        currentMetroBooth: pickupStation,
        queuePosition: 1,
        isOnline: true,
        currentRide: null,
        vehicleType: vehicleType // Ensure vehicle type matches
      });
      
      if (targetDriver) {
        console.log(`✅ Found available driver at queue position 1: ${targetDriver.fullName} (${targetDriver._id})`);
      } else {
        console.log(`❌ No available ${vehicleType} driver found at queue position 1 for ${pickupStation}`);
        return res.status(400).json({
          success: false,
          message: `No available ${vehicleType} driver at queue position 1. Please select a specific driver or wait for drivers to come online.`
        });
      }
    }

    // Send ride request to target driver
    if (targetDriver) {
      // Update ride status to searching
      rideRequest.status = 'searching';
      await rideRequest.save();
      
      console.log(`📤 Sending ride request to driver ${targetDriver.fullName} (${targetDriver._id})`);
      
      // Send ride request to the driver using the new function
      const broadcastResult = await sendRideRequestToDriver(rideRequest, targetDriver._id);
      
      if (broadcastResult.success) {
        console.log(`✅ Ride request sent to driver ${targetDriver.fullName}`);
        
        // Log the event
        logRideEvent(rideRequest._id, 'manual_booking_sent_to_driver', {
          bookingId: rideRequest.bookingId,
          driverId: targetDriver._id,
          driverName: targetDriver.fullName,
          driverQueuePosition: targetDriver.queuePosition,
          status: 'searching'
        });
      } else {
        console.error(`❌ Failed to send ride request to driver: ${broadcastResult.error}`);
        
        // Update status back to pending if failed
        rideRequest.status = 'pending';
        await rideRequest.save();
        
        return res.status(400).json({
          success: false,
          message: broadcastResult.error || 'Failed to send ride request to driver'
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
        driverSpecific: rooms.has(driverRoomName),
        driversGeneral: rooms.has('drivers'),
        adminRoom: rooms.has('admin-room')
      };
      
      console.log(`🔍 Socket rooms check for driver ${availableDriver._id}:`);
      console.log(`   - Room ${driverRoomName} exists: ${roomsStatus.driverSpecific}`);
      console.log(`   - Room 'drivers' exists: ${roomsStatus.driversGeneral}`);
      console.log(`   - Room 'admin-room' exists: ${roomsStatus.adminRoom}`);
      
      // Track delivery status
      const deliveryAttempts = [];
      
      // Emit to driver-specific room
      const driverSpecificClients = rooms.get(driverRoomName)?.size || 0;
      io.to(driverRoomName).emit('rideAssigned', rideAssignmentData);
      deliveryAttempts.push({
        room: driverRoomName,
        clientsReached: driverSpecificClients,
        roomExists: roomsStatus.driverSpecific
      });
      console.log(`📤 Event sent to room: ${driverRoomName} (${driverSpecificClients} clients)`);
      
      // Also emit to all drivers room as backup
      const driversGeneralClients = rooms.get('drivers')?.size || 0;
      io.to('drivers').emit('rideAssigned', rideAssignmentData);
      deliveryAttempts.push({
        room: 'drivers',
        clientsReached: driversGeneralClients,
        roomExists: roomsStatus.driversGeneral
      });
      console.log(`📤 Event sent to room: drivers (${driversGeneralClients} clients)`);
      
      // Log socket delivery status
      logSocketDelivery(rideRequest._id, 'rideAssigned', {
        delivered: Math.max(driverSpecificClients, driversGeneralClients > 0 ? 1 : 0),
        total: 1,
        attempts: deliveryAttempts,
        driverId: availableDriver._id,
        roomsStatus
      });
      
      // Log the assignment event
      logRideEvent(rideRequest._id, 'driver_assignment_broadcast', {
        driverId: availableDriver._id,
        driverName: availableDriver.fullName,
        assignmentType: selectedDriverId ? 'manual' : 'auto',
        deliveryAttempts,
        totalClientsReached: driverSpecificClients + driversGeneralClients
      });
      
      // Enhanced delivery with confirmation tracking
      let deliveryConfirmed = false;
      let confirmationTimeout;
      
      const waitForDeliveryConfirmation = () => {
        return new Promise((resolve) => {
          // Set up confirmation listener
          const confirmationListener = (data) => {
            if (data.rideId === rideRequest._id.toString() && data.driverId === availableDriver._id.toString()) {
              console.log(`✅ Delivery confirmed by driver ${availableDriver._id} for ride ${rideRequest._id}`);
              deliveryConfirmed = true;
              clearTimeout(confirmationTimeout);
              io.off('rideAssignmentConfirmed', confirmationListener);
              
              // Log successful confirmation
              logRideEvent(rideRequest._id, 'assignment_confirmed', {
                driverId: availableDriver._id,
                driverName: availableDriver.fullName,
                confirmationTime: new Date().toISOString(),
                assignmentMethod: 'socket_delivery'
              });
              
              resolve(true);
            }
          };
          
          io.on('rideAssignmentConfirmed', confirmationListener);
          
          // Set timeout for confirmation
          confirmationTimeout = setTimeout(() => {
            if (!deliveryConfirmed) {
              console.log(`⚠️ No delivery confirmation received from driver ${availableDriver._id} within 5 seconds`);
              
              // Log confirmation timeout
              logRideEvent(rideRequest._id, 'assignment_confirmation_timeout', {
                driverId: availableDriver._id,
                driverName: availableDriver.fullName,
                timeoutDuration: 5000,
                originalDeliveryAttempts: deliveryAttempts
              });
              
              io.off('rideAssignmentConfirmed', confirmationListener);
              resolve(false);
            }
          }, 5000);
        });
      };
      
      // Additional verification - find specific socket and emit directly
      setTimeout(async () => {
        const allSockets = io.sockets.sockets;
        let driverSocket = null;
        
        for (const [socketId, socket] of allSockets) {
          if (socket.user && socket.user._id === availableDriver._id.toString()) {
            driverSocket = socket;
            break;
          }
        }
        
        if (driverSocket) {
          console.log(`📤 Found driver socket ${driverSocket.id}, sending direct emission`);
          
          // Add confirmation request to the assignment data
          const enhancedAssignmentData = {
            ...rideAssignmentData,
            requiresConfirmation: true,
            confirmationTimeout: 5000
          };
          
          driverSocket.emit('rideAssigned', enhancedAssignmentData);
          
          // Verify driver is in correct rooms
          const rooms = Array.from(driverSocket.rooms);
          console.log(`🔍 Driver ${availableDriver._id} socket rooms:`, rooms);
          
          // Re-join rooms if necessary
          if (!rooms.includes(driverRoomName)) {
            console.log(`⚠️ Driver not in room ${driverRoomName}, re-joining...`);
            driverSocket.join(driverRoomName);
          }
          if (!rooms.includes('drivers')) {
            console.log(`⚠️ Driver not in 'drivers' room, re-joining...`);
            driverSocket.join('drivers');
          }
          if (!rooms.includes('admin-room')) {
            console.log(`⚠️ Driver not in 'admin-room', re-joining...`);
            driverSocket.join('admin-room');
          }
          
          // Wait for confirmation
          const confirmed = await waitForDeliveryConfirmation();
          
          if (!confirmed) {
            console.log(`⚠️ Retrying assignment delivery to driver ${availableDriver._id}...`);
            
            // Log retry attempt
            logRideEvent(rideRequest._id, 'assignment_delivery_retry', {
              driverId: availableDriver._id,
              driverName: availableDriver.fullName,
              reason: 'confirmation_timeout',
              retryMethod: 'direct_socket_emission'
            });
            
            // Retry emission with forced room rejoin
            driverSocket.emit('driverRoomRejoin', {
              driverId: availableDriver._id,
              driverName: availableDriver.fullName,
              timestamp: new Date().toISOString()
            });
            
            // Wait a bit and try again
            setTimeout(() => {
              driverSocket.emit('rideAssigned', enhancedAssignmentData);
              console.log(`🔄 Retried assignment delivery to driver ${availableDriver._id}`);
              
              // Log retry completion
              logRideEvent(rideRequest._id, 'assignment_retry_completed', {
                driverId: availableDriver._id,
                driverName: availableDriver.fullName,
                retryDelay: 2000
              });
            }, 2000);
          }
        } else {
          console.log(`⚠️ Driver socket for ${availableDriver._id} not found in connected sockets`);
          
          // Log socket not found
          logRideEvent(rideRequest._id, 'assignment_socket_not_found', {
            driverId: availableDriver._id,
            driverName: availableDriver.fullName,
            totalConnectedSockets: allSockets.size,
            roomsChecked: Object.keys(roomsStatus)
          });
        }
      }, 500); // Small delay to ensure all operations complete
      
      console.log(`✅ Enhanced rideAssigned event delivery with confirmation tracking completed for driver ${availableDriver._id}`);
    } else {
      console.log('⚠️ No available driver found - ride created but not assigned');
      
      // Log no driver available
      logRideEvent(rideRequest._id, 'no_driver_available', {
        pickupStation,
        vehicleType,
        selectedDriverId,
        assignmentType: selectedDriverId ? 'manual' : 'auto',
        searchCriteria: {
          currentMetroBooth: pickupStation,
          vehicleType,
          isOnline: true,
          currentRide: null,
          queuePosition: selectedDriverId ? 'any' : 1
        }
      });
    }

    // Emit to admin room
    io.to('admin-room').emit('manualBookingCreated', {
      rideId: rideRequest._id,
      bookingId: rideRequest.bookingId,
      status: rideRequest.status,
      driver: availableDriver ? {
        name: availableDriver.fullName,
        phone: availableDriver.mobileNo
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

// Debug endpoint to view assignment tracking data
router.get('/debug/assignments', adminProtect, async (req, res) => {
  try {
    const { getActiveRideStats, getActiveRidesSummary } = require('../../utils/rideLogger');
    
    console.log('\n=== ASSIGNMENT DEBUG REQUEST ===');
    console.log('Admin ID:', req.admin._id);
    
    // Get active ride statistics
    const activeStats = getActiveRideStats();
    const activeSummary = getActiveRidesSummary();
    
    // Get recent manual bookings
    const recentBookings = await RideRequest.find({
      bookingSource: 'manual',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .populate('driver', 'fullName mobileNo')
    .populate('user', 'name phone')
    .sort({ createdAt: -1 })
    .limit(20);
    
    // Get driver status summary
    const driversOnline = await Driver.find({ isOnline: true })
      .select('fullName mobileNo currentMetroBooth vehicleType queuePosition currentRide lastActiveTime');
    
    // Get socket room information
    const io = require('../../socket').getIO();
    const socketRooms = {};
    if (io) {
      const rooms = io.sockets.adapter.rooms;
      socketRooms.driversRoom = rooms.get('drivers')?.size || 0;
      socketRooms.adminRoom = rooms.get('admin-room')?.size || 0;
      
      // Individual driver rooms
      socketRooms.driverRooms = [];
      driversOnline.forEach(driver => {
        const roomName = `driver_${driver._id}`;
        const room = rooms.get(roomName);
        socketRooms.driverRooms.push({
          driverId: driver._id.toString(),
          driverName: driver.fullName,
          roomName,
          socketsInRoom: room ? room.size : 0
        });
      });
    }
    
    const debugData = {
      timestamp: new Date().toISOString(),
      summary: {
        activeRides: activeSummary.totalActive,
        onlineDrivers: driversOnline.length,
        recentManualBookings: recentBookings.length,
        socketConnections: socketRooms.driversRoom || 0
      },
      activeRideStats: activeStats,
      activRidesSummary: activeSummary,
      recentManualBookings: recentBookings.map(booking => ({
        id: booking._id,
        bookingId: booking.bookingId,
        status: booking.status,
        createdAt: booking.createdAt,
        assignedAt: booking.assignedAt,
        pickupLocation: booking.pickupLocation?.boothName,
        dropLocation: booking.dropLocation?.address,
        driver: booking.driver ? {
          id: booking.driver._id,
          name: booking.driver.fullName,
          phone: booking.driver.mobileNo
        } : null,
        user: booking.user ? {
          name: booking.user.name,
          phone: booking.user.phone
        } : null,
        vehicleType: booking.vehicleType,
        estimatedFare: booking.estimatedFare
      })),
      driversOnline: driversOnline.map(driver => ({
        id: driver._id,
        name: driver.fullName,
        phone: driver.mobileNo,
        currentMetroBooth: driver.currentMetroBooth,
        vehicleType: driver.vehicleType,
        queuePosition: driver.queuePosition,
        hasActiveRide: !!driver.currentRide,
        activeRideId: driver.currentRide,
        lastActiveTime: driver.lastActiveTime,
        socketRoom: socketRooms.driverRooms?.find(room => room.driverId === driver._id.toString())
      })),
      socketRooms
    };
    
    console.log('Debug data compiled:', {
      activeRides: debugData.summary.activeRides,
      onlineDrivers: debugData.summary.onlineDrivers,
      recentBookings: debugData.summary.recentManualBookings
    });
    
    res.json({
      success: true,
      data: debugData
    });
    
  } catch (error) {
    console.error('❌ Error getting assignment debug data:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting assignment debug data',
      error: error.message
    });
  }
});

module.exports = router;