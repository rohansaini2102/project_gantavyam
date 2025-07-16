// server/socket.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config/config');
const RideRequest = require('./models/RideRequest');
const Driver = require('./models/Driver');
const User = require('./models/User');
const MetroStation = require('./models/MetroStation');
const { generateRideId, generateRideOTPs, verifyOTP } = require('./utils/otpUtils');
const { logRideEvent, logUserAction, logDriverAction, logError, logStatusTransition, logSocketDelivery } = require('./utils/rideLogger');
const { calculateFareEstimates, getDynamicPricingFactor } = require('./utils/fareCalculator');
const { generateQueueNumber, updateQueuePosition, removeFromQueue } = require('./utils/queueManager');
const RideLifecycleService = require('./services/rideLifecycle');
const EnhancedNotificationService = require('./utils/enhancedNotification');
const RideCompletionService = require('./utils/rideCompletionService');

let io;
let enhancedNotificationService;
let rideCompletionService;

const initializeSocket = (server) => {
  console.log('\n=== INITIALIZING SOCKET.IO SERVER ===');
  
  io = socketIO(server, {
    cors: {
      origin: [
        "http://localhost:3000", // Frontend development server
        "https://gt2-seven.vercel.app",
        "https://gantavyam.site",
        "https://www.gantavyam.site",
        "https://gt2-evx6vat1j-rohan-sainis-projects.vercel.app",
        "https://gt2-2.onrender.com",
        "https://gt3-nkqc.onrender.com",
        "https://gt3-nine.vercel.app",
        "https://project-gantavyam.onrender.com" // Render backend URL
      ],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    console.log('\n=== NEW SOCKET CONNECTION ATTEMPT ===');
    console.log('Token received:', token ? token.substring(0, 20) + '...' : 'undefined');
    console.log('Socket ID:', socket.id);
    
    if (!token) {
      console.error('❌ No token provided - rejecting connection');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, config.jwtSecret || process.env.JWT_SECRET);
      console.log('\n✅ JWT Verified successfully');
      console.log('Decoded payload:', {
        id: decoded.id,
        role: decoded.role,
        exp: new Date(decoded.exp * 1000).toISOString(),
        iat: new Date(decoded.iat * 1000).toISOString()
      });
      
      // Validate required fields
      if (!decoded.id) {
        console.error('❌ Token missing id field');
        return next(new Error('Authentication error: Missing id in token'));
      }
      
      // Determine role from token
      const userRole = decoded.role || 'user';
      console.log('Determined role:', userRole);
      
      // Set user information on socket
      socket.user = {
        _id: decoded.id,
        role: userRole
      };
      
      console.log('✅ Authentication successful for:', {
        userId: socket.user._id,
        role: socket.user.role
      });
      
      next();
    } catch (err) {
      console.error('❌ JWT Verification error:', err.message);
      console.error('Error details:', err);
      next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    console.log('\n=== NEW CLIENT CONNECTED ===');
    console.log('Socket ID:', socket.id);
    console.log('User ID:', socket.user._id);
    console.log('User Role:', socket.user.role);
    console.log('Time:', new Date().toISOString());

    // Join role-specific room based on the user's role
    if (socket.user.role === 'driver') {
      socket.join('drivers');
      socket.join(`driver_${socket.user._id}`);
      console.log(`✅ Driver ${socket.user._id} joined rooms: drivers, driver_${socket.user._id}`);
      
      // Log all driver connections
      const driversRoom = io.sockets.adapter.rooms.get('drivers');
      console.log(`Total drivers online: ${driversRoom ? driversRoom.size : 0}`);
    } else if (socket.user.role === 'admin') {
      socket.join('admins');
      socket.join(`admin_${socket.user._id}`);
      console.log(`✅ Admin ${socket.user._id} joined rooms: admins, admin_${socket.user._id}`);
      
      // Send queued notifications to reconnecting admin
      if (enhancedNotificationService) {
        enhancedNotificationService.sendQueuedNotifications(socket.id);
      }
      
      // Log all admin connections
      const adminsRoom = io.sockets.adapter.rooms.get('admins');
      console.log(`Total admins online: ${adminsRoom ? adminsRoom.size : 0}`);
    } else {
      socket.join(`user_${socket.user._id}`);
      console.log(`✅ User ${socket.user._id} joined room: user_${socket.user._id}`);
    }

    // Send connection success confirmation
    socket.emit('connectionSuccess', {
      status: 'connected',
      userId: socket.user._id,
      role: socket.user.role,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Handle driver going online with metro booth selection
    socket.on('driverGoOnline', async (data) => {
      console.log('\n=== DRIVER GOING ONLINE ===');
      console.log('Driver ID:', socket.user._id);
      console.log('Metro booth data:', data);
      
      try {
        const { metroBooth, location, vehicleType } = data;
        
        // Use fixed pickup location if not provided
        const fixedMetroBooth = metroBooth || "Hauz Khas Metro Gate No 1";
        
        // Update driver status
        await Driver.findByIdAndUpdate(socket.user._id, {
          isOnline: true,
          currentMetroBooth: fixedMetroBooth,
          location: {
            type: 'Point',
            coordinates: [location.lng, location.lat],
            lastUpdated: new Date()
          },
          vehicleType: vehicleType,
          lastActiveTime: new Date()
        });
        
        // Update metro station online drivers count
        const metroStation = await MetroStation.findOne({ name: fixedMetroBooth });
        if (metroStation) {
          await metroStation.incrementOnlineDrivers();
        }
        
        // Verify driver is actually in the drivers room
        const rooms = Array.from(socket.rooms);
        const inDriversRoom = rooms.includes('drivers');
        const driverSpecificRoom = `driver_${socket.user._id}`;
        const inDriverSpecificRoom = rooms.includes(driverSpecificRoom);
        
        console.log(`✅ Driver ${socket.user._id} is now online at ${fixedMetroBooth} with ${vehicleType}`);
        console.log(`🔍 Driver socket room status:`);
        console.log(`  - Driver ID: ${socket.user._id}`);
        console.log(`  - Socket rooms: ${rooms.join(', ')}`);
        console.log(`  - In 'drivers' room: ${inDriversRoom}`);
        console.log(`  - In '${driverSpecificRoom}' room: ${inDriverSpecificRoom}`);
        
        logRideEvent(`DRIVER-${socket.user._id}`, 'driver_online', {
          metroBooth: fixedMetroBooth,
          vehicleType,
          location,
          roomStatus: { inDriversRoom, inDriverSpecificRoom, allRooms: rooms }
        });
        
        // Notify admins of driver going online
        notifyAdmins('driverOnline', {
          driverId: socket.user._id,
          driverName: `Driver ${socket.user._id}`,
          metroBooth: fixedMetroBooth,
          vehicleType,
          location,
          timestamp: new Date().toISOString()
        });
        
        socket.emit('driverOnlineConfirmed', { 
          success: true,
          metroBooth: fixedMetroBooth,
          vehicleType,
          message: 'You are now online and ready to accept rides',
          roomStatus: {
            inDriversRoom: inDriversRoom,
            inDriverSpecificRoom: inDriverSpecificRoom,
            allRooms: rooms
          }
        });
        
      } catch (error) {
        console.error('❌ Error updating driver status:', error);
        socket.emit('driverOnlineConfirmed', { success: false, error: error.message });
      }
    });

    // Handle driver going offline
    socket.on('driverGoOffline', async (data) => {
      console.log('\n=== DRIVER GOING OFFLINE ===');
      console.log('Driver ID:', socket.user._id);
      
      try {
        const driver = await Driver.findById(socket.user._id);
        const metroBooth = driver.currentMetroBooth;
        
        // Update driver status
        await Driver.findByIdAndUpdate(socket.user._id, {
          isOnline: false,
          currentMetroBooth: null,
          lastActiveTime: new Date()
        });
        
        // Update metro station online drivers count
        if (metroBooth) {
          const metroStation = await MetroStation.findOne({ name: metroBooth });
          if (metroStation) {
            await metroStation.decrementOnlineDrivers();
          }
        }
        
        console.log(`✅ Driver ${socket.user._id} is now offline`);
        logRideEvent(`DRIVER-${socket.user._id}`, 'driver_offline', { metroBooth });
        
        // Notify admins of driver going offline
        notifyAdmins('driverOffline', {
          driverId: socket.user._id,
          driverName: `Driver ${socket.user._id}`,
          metroBooth,
          timestamp: new Date().toISOString()
        });
        
        socket.emit('driverOfflineConfirmed', { 
          success: true,
          message: 'You are now offline'
        });
        
      } catch (error) {
        console.error('❌ Error updating driver status:', error);
        socket.emit('driverOfflineConfirmed', { success: false, error: error.message });
      }
    });

    // Handle ride request broadcasting from API (called when user books via API)
    socket.on('broadcastRideRequest', async (data) => {
      console.log('\n=== BROADCASTING RIDE REQUEST ===');
      console.log('Ride ID:', data.rideId);
      console.log('Vehicle Type:', data.vehicleType);
      console.log('Pickup Station:', data.pickupStation);
      
      try {
        // Find the ride request in database
        const rideRequest = await RideRequest.findById(data.rideId);
        if (!rideRequest) {
          console.error('❌ Ride request not found in database');
          return;
        }
        
        // Find ALL online drivers (no vehicle type filtering)
        const matchingDrivers = await Driver.find({
          isOnline: true
        });
        
        console.log(`🚗 Found ${matchingDrivers.length} online drivers (all vehicle types)`);
        
        if (matchingDrivers.length === 0) {
          console.log('⚠️ No online drivers found');
          return;
        }
        
        // Since we removed vehicle type filtering, fallback logic is no longer needed
        // All online drivers will receive ride requests regardless of vehicle type
        const fallbackDrivers = matchingDrivers;
          
          // This fallback is no longer needed as we broadcast to all drivers by default
        
        // Prepare the data to send to matching drivers
        const rideRequestData = {
          _id: rideRequest._id.toString(),
          rideId: rideRequest.rideId,
          userId: rideRequest.userId,
          userName: rideRequest.userName,
          userPhone: rideRequest.userPhone,
          pickupLocation: rideRequest.pickupLocation,
          dropLocation: rideRequest.dropLocation,
          vehicleType: rideRequest.vehicleType,
          fare: rideRequest.estimatedFare,
          distance: rideRequest.distance,
          status: 'pending',
          timestamp: rideRequest.timestamp.toISOString(),
          requestNumber: rideRequest.rideId // Add request number for driver display
        };
        
        // Emit to drivers with matching vehicle type at the same metro booth
        let notifiedDrivers = 0;
        matchingDrivers.forEach(driver => {
          const driverSocketId = `driver_${driver._id}`;
          io.to(driverSocketId).emit('newRideRequest', rideRequestData);
          notifiedDrivers++;
          
          // Log individual driver notification
          logRideEvent(rideRequest.rideId, 'request_sent_to_driver', {
            driverId: driver._id,
            driverName: driver.fullName,
            metroBooth: driver.currentMetroBooth
          });
        });
        
        console.log(`📢 Ride request broadcasted to ${notifiedDrivers} matching drivers`);
        
        // Update ride request with broadcast info
        await RideRequest.findByIdAndUpdate(rideRequest._id, {
          $set: { 
            driversNotified: notifiedDrivers,
            broadcastAt: new Date()
          }
        });
        
        // Log ride event
        logRideEvent(rideRequest.rideId, 'ride_broadcasted_to_drivers', {
          driversNotified: notifiedDrivers,
          vehicleType: data.vehicleType,
          pickupStation: data.pickupStation
        });
        
      } catch (error) {
        console.error('❌ Error broadcasting ride request:', error);
        logRideEvent(data.rideId, 'broadcast_error', {
          error: error.message
        });
      }
    });

    // Handle driver accepting a ride (ENHANCED VERSION)
    socket.on('driverAcceptRide', async (data) => {
      console.log('\n=== DRIVER ACCEPTING RIDE ===');
      console.log('Driver Socket ID:', socket.id);
      console.log('Driver ID:', socket.user._id);
      console.log('Accept data:', JSON.stringify(data, null, 2));
      
      try {
        const { rideId, driverId, driverName, driverPhone, vehicleDetails } = data;
        
        // Find and update ride request
        const rideRequest = await RideRequest.findById(rideId);
        
        if (!rideRequest) {
          console.error('❌ Ride request not found:', rideId);
          socket.emit('rideAcceptError', { message: 'Ride request not found' });
          return;
        }

        if (rideRequest.status !== 'pending') {
          console.error('❌ Ride no longer available:', rideRequest.status);
          socket.emit('rideAcceptError', { message: 'Ride is no longer available' });
          return;
        }

        // Get driver details
        const driver = await Driver.findById(driverId);
        
        // Update ride request with driver details
        rideRequest.status = 'driver_assigned';
        rideRequest.driverId = driverId;
        rideRequest.driverName = driverName;
        rideRequest.driverPhone = driverPhone;
        rideRequest.driverVehicleNo = driver?.vehicleNo || 'Unknown';
        rideRequest.driverRating = driver?.rating || 0;
        rideRequest.acceptedAt = new Date();
        await rideRequest.save();
        
        console.log('✅ Ride request updated in database');
        
        // Generate queue number for this accepted ride
        let queueInfo = null;
        const boothName = rideRequest.pickupLocation?.boothName;
        console.log('🎫 [Queue] Booth name from ride request:', boothName);
        
        if (boothName) {
          try {
            console.log('🎫 [Queue] Generating queue number for booth:', boothName);
            queueInfo = await generateQueueNumber(boothName, rideRequest._id);
            console.log('🎫 [Queue] Queue generation result:', queueInfo);
            
            if (queueInfo.success) {
              // Update ride request with queue information
              rideRequest.queueNumber = queueInfo.queueNumber;
              rideRequest.queuePosition = queueInfo.queuePosition;
              rideRequest.queueAssignedAt = new Date();
              rideRequest.queueStatus = 'queued';
              await rideRequest.save();
              
              console.log('✅ Queue number assigned:', queueInfo.queueNumber);
            } else {
              console.warn('⚠️ Queue number generation failed, using fallback:', queueInfo.fallbackQueueNumber);
              rideRequest.queueNumber = queueInfo.fallbackQueueNumber;
              rideRequest.queuePosition = queueInfo.queuePosition;
              rideRequest.queueAssignedAt = new Date();
              rideRequest.queueStatus = 'queued';
              await rideRequest.save();
            }
          } catch (queueError) {
            console.error('❌ Queue number generation error:', queueError);
            // Continue without queue number - don't fail the ride acceptance
          }
        } else {
          console.warn('⚠️ No booth name found, skipping queue number generation');
        }
        
        // Log ride event
        logRideEvent(rideRequest.rideId, 'ride_accepted', {
          driverId,
          driverName,
          vehicleType: rideRequest.vehicleType,
          acceptedAt: new Date(),
          queueNumber: rideRequest.queueNumber,
          queuePosition: rideRequest.queuePosition
        });

        // Prepare acceptance data with OTP info and queue information
        const acceptanceData = {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          boothRideNumber: rideRequest.boothRideNumber,
          // Queue information
          queueNumber: rideRequest.queueNumber,
          queuePosition: rideRequest.queuePosition,
          queueStatus: rideRequest.queueStatus,
          queueAssignedAt: rideRequest.queueAssignedAt,
          estimatedWaitTime: queueInfo?.estimatedWaitTime || 0,
          totalInQueue: queueInfo?.totalInQueue || 0,
          // Driver information
          driverId: driverId,
          driverName: driverName,
          driverPhone: driverPhone,
          driverPhoto: driver?.profileImage || null,
          driverRating: driver?.rating || 0,
          vehicleType: rideRequest.vehicleType,
          vehicleNo: driver?.vehicleNo || 'Unknown',
          startOTP: rideRequest.startOTP,
          endOTP: rideRequest.endOTP,
          timestamp: new Date().toISOString(),
          driverLocation: data.currentLocation,
          status: 'driver_assigned',
          pickupStation: rideRequest.pickupLocation?.boothName,
          dropLocation: rideRequest.dropLocation
        };
        
        console.log('📤 Notifying user:', rideRequest.userId);
        io.to(`user_${rideRequest.userId}`).emit('rideAccepted', acceptanceData);
        
        // Send queue-specific notification if queue number was generated
        if (rideRequest.queueNumber) {
          const queueNotification = {
            queueNumber: rideRequest.queueNumber,
            queuePosition: rideRequest.queuePosition,
            boothName: boothName,
            boothCode: queueInfo?.boothCode,
            estimatedWaitTime: queueInfo?.estimatedWaitTime || 0,
            totalInQueue: queueInfo?.totalInQueue || 0,
            message: `You are number ${rideRequest.queuePosition} in the queue at ${boothName}`
          };
          
          // Notify user about queue assignment
          io.to(`user_${rideRequest.userId}`).emit('queueNumberAssigned', queueNotification);
          
          // Notify driver about queue assignment
          socket.emit('queueNumberAssigned', {
            ...queueNotification,
            message: `Ride assigned queue number ${rideRequest.queueNumber} at ${boothName}`
          });
          
          console.log('📋 Queue notifications sent:', rideRequest.queueNumber);
        }
        
        // Notify ALL drivers that this ride is taken (including the one who accepted)
        const rideClosedData = {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          acceptedBy: driverId,
          reason: 'accepted'
        };
        
        console.log('📢 Broadcasting rideRequestClosed to all drivers:', rideClosedData);
        
        // Broadcast to the general drivers room
        io.to('drivers').emit('rideRequestClosed', rideClosedData);
        
        // Also broadcast to individual driver rooms to ensure delivery
        const onlineDrivers = await Driver.find({ isOnline: true });
        console.log(`📢 Sending rideRequestClosed to ${onlineDrivers.length} individual driver rooms`);
        
        onlineDrivers.forEach(driver => {
          const driverSocketId = `driver_${driver._id}`;
          io.to(driverSocketId).emit('rideRequestClosed', rideClosedData);
          console.log(`  ✅ Sent rideRequestClosed to ${driverSocketId}`);
        });
        
        // Notify admins of ride acceptance
        notifyAdmins('rideAccepted', {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          driverId: driverId,
          driverName: driverName,
          userName: rideRequest.userName,
          pickupLocation: rideRequest.pickupLocation,
          status: 'driver_assigned',
          queueNumber: rideRequest.queueNumber,
          acceptedAt: rideRequest.acceptedAt
        });
        
        console.log('✅ All notifications sent');

        // Confirm to the accepting driver with complete ride information
        socket.emit('rideAcceptConfirmed', {
          success: true,
          _id: rideRequest._id.toString(),
          rideId: rideRequest.rideId,
          uniqueRideId: rideRequest.rideId,
          boothRideNumber: rideRequest.boothRideNumber,
          message: 'Ride accepted successfully',
          userName: rideRequest.userName,
          userPhone: rideRequest.userPhone,
          pickupLocation: rideRequest.pickupLocation,
          dropLocation: rideRequest.dropLocation,
          vehicleType: rideRequest.vehicleType,
          distance: rideRequest.distance,
          fare: rideRequest.estimatedFare,
          estimatedFare: rideRequest.estimatedFare,
          startOTP: rideRequest.startOTP,
          endOTP: rideRequest.endOTP,
          status: 'driver_assigned',
          timestamp: rideRequest.timestamp.toISOString(),
          paymentStatus: rideRequest.paymentStatus || 'pending'
        });

      } catch (error) {
        console.error('❌ Error accepting ride:', error);
        socket.emit('rideAcceptError', { 
          message: 'Failed to accept ride',
          error: error.message 
        });
      }
    });

    // Handle OTP verification for ride start
    socket.on('verifyStartOTP', async (data, callback) => {
      console.log('\n=== VERIFYING START OTP ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Ride ID:', data.rideId);
      console.log('Provided OTP:', data.otp);
      
      try {
        const { rideId, otp } = data;
        
        // Try to find ride by MongoDB ObjectId first, then by rideId field
        let rideRequest = null;
        try {
          rideRequest = await RideRequest.findById(rideId);
        } catch (error) {
          // If it's not a valid ObjectId, try finding by rideId field
          console.log('Not a valid ObjectId, searching by rideId field...');
          rideRequest = await RideRequest.findOne({ rideId: rideId });
        }
        
        if (!rideRequest) {
          console.error('❌ Ride not found');
          const errorResponse = { success: false, message: 'Ride not found' };
          socket.emit('otpVerificationError', errorResponse);
          if (callback) callback(errorResponse);
          return;
        }
        
        // Verify OTP
        if (!verifyOTP(otp, rideRequest.startOTP)) {
          console.error('❌ Invalid start OTP');
          const errorResponse = { success: false, message: 'Invalid OTP' };
          socket.emit('otpVerificationError', errorResponse);
          if (callback) callback(errorResponse);
          return;
        }
        
        // Update ride status
        rideRequest.status = 'ride_started';
        rideRequest.rideStartedAt = new Date();
        rideRequest.queueStatus = 'in_progress'; // Update queue status
        await rideRequest.save();
        
        console.log('✅ Ride started successfully');
        
        // Update queue position to in_progress
        if (rideRequest.queueNumber) {
          try {
            await updateQueuePosition(rideRequest._id, 'in_progress');
            console.log('📋 Queue status updated to in_progress');
          } catch (queueError) {
            console.error('❌ Error updating queue status:', queueError);
          }
        }
        
        // Log ride event
        logRideEvent(rideRequest.rideId, 'ride_started', {
          startedAt: new Date(),
          startOTP: otp
        });
        
        // Notify both parties
        const startData = {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          boothRideNumber: rideRequest.boothRideNumber,
          status: 'ride_started',
          startedAt: new Date().toISOString(),
          endOTP: rideRequest.endOTP
        };
        
        io.to(`user_${rideRequest.userId}`).emit('rideStarted', startData);
        io.to(`driver_${rideRequest.driverId}`).emit('rideStarted', startData);
        
        // Notify admins of ride start
        notifyAdmins('rideStarted', {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          userName: rideRequest.userName,
          driverName: rideRequest.driverName,
          pickupLocation: rideRequest.pickupLocation,
          status: 'ride_started',
          startedAt: rideRequest.rideStartedAt,
          queueNumber: rideRequest.queueNumber
        });
        
        console.log('📤 Both parties notified of ride start');
        
        const successResponse = {
          success: true,
          message: 'Ride started successfully',
          status: 'ride_started'
        };
        
        socket.emit('otpVerificationSuccess', successResponse);
        if (callback) callback(successResponse);
        
      } catch (error) {
        console.error('❌ Error verifying start OTP:', error);
        const errorResponse = {
          success: false,
          message: 'Failed to verify OTP',
          error: error.message
        };
        socket.emit('otpVerificationError', errorResponse);
        if (callback) callback(errorResponse);
      }
    });

    // Handle OTP verification for ride end
    socket.on('verifyEndOTP', async (data, callback) => {
      console.log('\n=== VERIFYING END OTP ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Ride ID:', data.rideId);
      console.log('Provided OTP:', data.otp);
      
      try {
        const { rideId, otp } = data;
        
        // Try to find ride by MongoDB ObjectId first, then by rideId field
        let rideRequest = null;
        try {
          rideRequest = await RideRequest.findById(rideId);
        } catch (error) {
          // If it's not a valid ObjectId, try finding by rideId field
          console.log('Not a valid ObjectId, searching by rideId field...');
          rideRequest = await RideRequest.findOne({ rideId: rideId });
        }
        
        if (!rideRequest) {
          console.error('❌ Ride not found');
          const errorResponse = { success: false, message: 'Ride not found' };
          socket.emit('otpVerificationError', errorResponse);
          if (callback) callback(errorResponse);
          return;
        }
        
        // Verify OTP
        if (!verifyOTP(otp, rideRequest.endOTP)) {
          console.error('❌ Invalid end OTP');
          const errorResponse = { success: false, message: 'Invalid OTP' };
          socket.emit('otpVerificationError', errorResponse);
          if (callback) callback(errorResponse);
          return;
        }
        
        // Validate driver information before completing
        if (!rideRequest.driverId) {
          console.error('❌ Critical: No driverId found during ride completion');
          const errorResponse = { success: false, message: 'Driver information missing - cannot complete ride' };
          socket.emit('otpVerificationError', errorResponse);
          if (callback) callback(errorResponse);
          return;
        }
        
        // Ensure driver details are populated in the ride request
        if (!rideRequest.driverName || !rideRequest.driverPhone) {
          console.warn('⚠️ Warning: Driver details missing, attempting to fetch from driver record');
          try {
            const driver = await Driver.findById(rideRequest.driverId);
            if (driver) {
              rideRequest.driverName = rideRequest.driverName || driver.fullName;
              rideRequest.driverPhone = rideRequest.driverPhone || driver.mobileNo;
              rideRequest.driverVehicleNo = rideRequest.driverVehicleNo || driver.vehicleNo;
              rideRequest.driverRating = rideRequest.driverRating || driver.rating;
              console.log('✅ Driver details populated from driver record:', {
                driverName: rideRequest.driverName,
                driverPhone: rideRequest.driverPhone,
                driverVehicleNo: rideRequest.driverVehicleNo
              });
            } else {
              console.error('❌ Driver record not found for ID:', rideRequest.driverId);
            }
          } catch (driverFetchError) {
            console.error('❌ Error fetching driver details:', driverFetchError);
          }
        }
        
        // Update ride status to ride_ended first
        rideRequest.status = 'ride_ended';
        rideRequest.rideEndedAt = new Date();
        rideRequest.actualFare = rideRequest.estimatedFare; // For now, use estimated fare
        rideRequest.paymentStatus = 'collected'; // Auto-assume cash payment collected
        rideRequest.paymentMethod = 'cash';
        rideRequest.paymentCollectedAt = new Date();
        rideRequest.queueStatus = 'completed'; // Update queue status
        await rideRequest.save();
        
        console.log('✅ Ride ended with driver info:', {
          driverId: rideRequest.driverId,
          driverName: rideRequest.driverName,
          driverPhone: rideRequest.driverPhone,
          driverVehicleNo: rideRequest.driverVehicleNo
        });
        
        console.log('✅ Ride ended, now completing automatically...');
        
        // Remove from queue and update queue positions
        if (rideRequest.queueNumber) {
          try {
            await removeFromQueue(rideRequest._id);
            console.log('📋 Ride removed from queue successfully');
          } catch (queueError) {
            console.error('❌ Error removing from queue:', queueError);
          }
        }
        
        // Log ride event
        logRideEvent(rideRequest.rideId, 'ride_ended', {
          endedAt: new Date(),
          endOTP: otp,
          actualFare: rideRequest.actualFare
        });
        
        // Automatically complete ride using RideLifecycleService
        const completionResult = await RideLifecycleService.completeRide(rideRequest._id, {
          status: 'completed',
          paymentMethod: 'cash'
        });
        
        if (completionResult.success) {
          console.log('✅ Ride automatically completed and moved to history');
          
          // Prepare completion notification data
          const completionData = {
            rideId: rideRequest._id.toString(),
            uniqueRideId: rideRequest.rideId,
            boothRideNumber: rideRequest.boothRideNumber,
            status: 'completed',
            endedAt: rideRequest.rideEndedAt.toISOString(),
            completedAt: new Date().toISOString(),
            actualFare: rideRequest.actualFare,
            paymentStatus: 'collected',
            paymentMethod: 'cash',
            rideDuration: Math.floor((rideRequest.rideEndedAt - rideRequest.rideStartedAt) / 60000), // in minutes
            message: 'Ride completed successfully and moved to history'
          };
          
          // Notify both parties of completion
          io.to(`user_${rideRequest.userId}`).emit('rideCompleted', completionData);
          io.to(`driver_${rideRequest.driverId}`).emit('rideCompleted', completionData);
          
          // Notify admins of ride completion
          notifyAdmins('rideCompleted', {
            rideId: rideRequest._id.toString(),
            uniqueRideId: rideRequest.rideId,
            userName: rideRequest.userName,
            driverName: rideRequest.driverName,
            pickupLocation: rideRequest.pickupLocation,
            status: 'completed',
            completedAt: completionData.completedAt,
            actualFare: rideRequest.actualFare,
            paymentMethod: rideRequest.paymentMethod,
            queueNumber: rideRequest.queueNumber
          });
          
          console.log('📤 Both parties notified of ride completion');
        } else {
          console.error('❌ Failed to complete ride automatically:', completionResult.error);
          
          // Fallback to old behavior - just notify of ride end
          const endData = {
            rideId: rideRequest._id.toString(),
            uniqueRideId: rideRequest.rideId,
            boothRideNumber: rideRequest.boothRideNumber,
            status: 'ride_ended',
            endedAt: rideRequest.rideEndedAt.toISOString(),
            actualFare: rideRequest.actualFare,
            rideDuration: Math.floor((rideRequest.rideEndedAt - rideRequest.rideStartedAt) / 60000) // in minutes
          };
          
          io.to(`user_${rideRequest.userId}`).emit('rideEnded', endData);
          io.to(`driver_${rideRequest.driverId}`).emit('rideEnded', endData);
          
          console.log('📤 Fallback: Both parties notified of ride end only');
        }
        
        const successResponse = {
          success: true,
          message: 'Ride completed successfully',
          status: 'ride_ended',
          fare: rideRequest.actualFare
        };
        
        socket.emit('otpVerificationSuccess', successResponse);
        if (callback) callback(successResponse);
        
      } catch (error) {
        console.error('❌ Error verifying end OTP:', error);
        const errorResponse = {
          success: false,
          message: 'Failed to verify OTP',
          error: error.message
        };
        socket.emit('otpVerificationError', errorResponse);
        if (callback) callback(errorResponse);
      }
    });

    // Handle ride cancellation
    socket.on('cancelRide', async (data, callback) => {
      console.log('\n=== RIDE CANCELLATION ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Ride ID:', data.rideId);
      console.log('Cancel Data:', data);
      
      try {
        const { rideId, reason } = data;
        
        // Validate rideId
        if (!rideId) {
          console.error('❌ No ride ID provided');
          if (callback) callback({ success: false, message: 'Ride ID is required for cancellation' });
          return;
        }
        
        console.log('🔍 Looking for ride with ID:', rideId);
        
        // First try to find by MongoDB _id
        let rideRequest = await RideRequest.findById(rideId);
        
        // If not found by _id, try to find by custom rideId field
        if (!rideRequest) {
          console.log('🔍 Not found by _id, trying custom rideId field...');
          rideRequest = await RideRequest.findOne({ rideId: rideId });
        }
        
        // If still not found, try uniqueRideId field (legacy support)
        if (!rideRequest) {
          console.log('🔍 Not found by rideId field, trying uniqueRideId field...');
          rideRequest = await RideRequest.findOne({ uniqueRideId: rideId });
        }
        
        if (!rideRequest) {
          console.error('❌ Ride not found with any ID format');
          console.log('❌ Tried searching for:', rideId);
          if (callback) callback({ success: false, message: 'Ride not found' });
          return;
        }
        
        console.log('✅ Found ride:', rideRequest._id, 'Status:', rideRequest.status);
        
        // Update ride status
        rideRequest.status = 'cancelled';
        rideRequest.cancelledAt = new Date();
        rideRequest.cancellationReason = reason || 'No reason provided';
        rideRequest.cancelledBy = socket.user.role;
        rideRequest.queueStatus = 'completed'; // Mark queue as completed when cancelled
        await rideRequest.save();
        
        console.log('✅ Ride cancelled in database');
        
        // Remove from queue if it was in queue
        if (rideRequest.queueNumber) {
          try {
            await removeFromQueue(rideRequest._id);
            console.log('📋 Cancelled ride removed from queue successfully');
          } catch (queueError) {
            console.error('❌ Error removing cancelled ride from queue:', queueError);
          }
        }
        
        // Log ride event
        logRideEvent(rideRequest.rideId, 'ride_cancelled', {
          cancelledBy: socket.user.role,
          reason: reason,
          cancelledAt: new Date()
        });
        
        // Notify both parties
        if (socket.user.role === 'driver') {
          // Driver cancelled - notify user
          io.to(`user_${rideRequest.userId}`).emit('rideCancelled', {
            rideId: rideId,
            uniqueRideId: rideRequest.rideId,
            cancelledBy: 'driver',
            reason: reason
          });
          console.log('📤 User notified of cancellation');
        } else {
          // User cancelled - notify driver
          if (rideRequest.driverId) {
            io.to(`driver_${rideRequest.driverId}`).emit('rideCancelled', {
              rideId: rideId,
              uniqueRideId: rideRequest.rideId,
              cancelledBy: 'user',
              reason: reason
            });
            console.log('📤 Driver notified of cancellation');
          }
        }
        
        // Notify admins of ride cancellation
        notifyAdmins('rideCancelled', {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          userName: rideRequest.userName,
          driverName: rideRequest.driverName || 'No driver assigned',
          pickupLocation: rideRequest.pickupLocation,
          status: 'cancelled',
          cancelledAt: rideRequest.cancelledAt,
          cancelledBy: socket.user.role,
          reason: reason,
          queueNumber: rideRequest.queueNumber
        });
        
        // Send callback acknowledgment
        if (callback) {
          callback({
            success: true,
            message: 'Ride cancelled successfully'
          });
        }
        
      } catch (error) {
        console.error('❌ Error cancelling ride:', error);
        if (callback) {
          callback({
            success: false,
            message: 'Failed to cancel ride',
            error: error.message
          });
        }
      }
    });

    // Handle payment collection and ride completion
    socket.on('collectPayment', async (data, callback) => {
      console.log('\n=== PAYMENT COLLECTION ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Data:', data);
      
      try {
        const { rideId, paymentMethod, actualFare, userRating, driverRating } = data;
        
        // Try to find ride by MongoDB ObjectId first, then by rideId field
        let rideRequest = null;
        try {
          rideRequest = await RideRequest.findById(rideId);
        } catch (error) {
          console.log('Not a valid ObjectId, searching by rideId field...');
          rideRequest = await RideRequest.findOne({ rideId: rideId });
        }
        
        if (!rideRequest) {
          console.error('❌ Ride not found');
          const errorResponse = { success: false, message: 'Ride not found' };
          if (callback) callback(errorResponse);
          return;
        }
        
        // Verify ride is in ended state
        if (rideRequest.status !== 'ride_ended') {
          console.error('❌ Ride is not in ended state');
          const errorResponse = { success: false, message: 'Ride must be ended before payment collection' };
          if (callback) callback(errorResponse);
          return;
        }
        
        // Update payment information
        rideRequest.paymentStatus = 'collected';
        rideRequest.paymentMethod = paymentMethod || 'cash';
        rideRequest.paymentCollectedAt = new Date();
        rideRequest.actualFare = actualFare || rideRequest.estimatedFare;
        rideRequest.status = 'completed';
        await rideRequest.save();
        
        console.log('✅ Payment collected and ride marked as completed');
        
        // Prepare completion data for lifecycle service
        const completionData = {
          status: 'completed',
          userRating: userRating ? {
            rating: userRating.rating,
            feedback: userRating.feedback,
            ratedAt: new Date()
          } : null,
          driverRatingForUser: driverRating ? {
            rating: driverRating.rating,
            feedback: driverRating.feedback,
            ratedAt: new Date()
          } : null
        };
        
        // Move ride to history using lifecycle service
        const lifecycleResult = await RideLifecycleService.completeRide(
          rideRequest._id.toString(), 
          completionData
        );
        
        if (lifecycleResult.success) {
          console.log('✅ Ride successfully moved to history');
          
          // Notify both parties of completion
          const completionNotification = {
            rideId: rideRequest._id.toString(),
            uniqueRideId: rideRequest.rideId,
            boothRideNumber: rideRequest.boothRideNumber,
            status: 'completed',
            actualFare: rideRequest.actualFare,
            paymentMethod: rideRequest.paymentMethod,
            completedAt: new Date().toISOString()
          };
          
          io.to(`user_${rideRequest.userId}`).emit('rideCompleted', completionNotification);
          io.to(`driver_${rideRequest.driverId}`).emit('rideCompleted', completionNotification);
          
          console.log('📤 Both parties notified of ride completion');
          
          const successResponse = {
            success: true,
            message: 'Payment collected and ride completed successfully',
            rideId: rideRequest._id.toString(),
            actualFare: rideRequest.actualFare,
            status: 'completed'
          };
          
          if (callback) callback(successResponse);
          
        } else {
          console.error('❌ Failed to move ride to history:', lifecycleResult.error);
          const errorResponse = {
            success: false,
            message: 'Payment collected but failed to finalize ride completion',
            error: lifecycleResult.error
          };
          if (callback) callback(errorResponse);
        }
        
      } catch (error) {
        console.error('❌ Error collecting payment:', error);
        const errorResponse = {
          success: false,
          message: 'Failed to collect payment',
          error: error.message
        };
        if (callback) callback(errorResponse);
      }
    });
    
    // Handle ride completion with cancellation (using lifecycle service)
    socket.on('completeRideWithCancellation', async (data, callback) => {
      console.log('\n=== COMPLETING RIDE WITH CANCELLATION ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Data:', data);
      
      try {
        const { rideId, reason } = data;
        
        // Use lifecycle service to cancel ride
        const lifecycleResult = await RideLifecycleService.cancelRide(rideId, {
          reason: reason || 'No reason provided',
          cancelledBy: socket.user.role
        });
        
        if (lifecycleResult.success) {
          console.log('✅ Ride cancelled and moved to history');
          
          // Notify both parties
          const cancellationNotification = {
            rideId: rideId,
            status: 'cancelled',
            reason: reason,
            cancelledBy: socket.user.role,
            cancelledAt: new Date().toISOString()
          };
          
          // Find the ride to get user and driver IDs for notification
          const rideHistory = lifecycleResult.rideHistory;
          if (rideHistory) {
            io.to(`user_${rideHistory.userId}`).emit('rideCancelled', cancellationNotification);
            if (rideHistory.driverId) {
              io.to(`driver_${rideHistory.driverId}`).emit('rideCancelled', cancellationNotification);
            }
          }
          
          const successResponse = {
            success: true,
            message: 'Ride cancelled and moved to history successfully'
          };
          
          if (callback) callback(successResponse);
          
        } else {
          console.error('❌ Failed to cancel ride:', lifecycleResult.error);
          const errorResponse = {
            success: false,
            message: 'Failed to cancel ride',
            error: lifecycleResult.error
          };
          if (callback) callback(errorResponse);
        }
        
      } catch (error) {
        console.error('❌ Error cancelling ride:', error);
        const errorResponse = {
          success: false,
          message: 'Failed to cancel ride',
          error: error.message
        };
        if (callback) callback(errorResponse);
      }
    });

    // Enhanced driver location updates with logging
    socket.on('updateDriverLocation', async (data) => {
      console.log('\n=== DRIVER LOCATION UPDATE ===');
      console.log('Driver ID:', socket.user._id);
      console.log('Location:', data.location);
      console.log('Ride ID:', data.rideId);
      console.log('Timestamp:', data.timestamp);
      
      try {
        const { location, rideId, bearing, speed } = data;
        
        // Update driver's location in database
        await Driver.findByIdAndUpdate(socket.user._id, {
          currentLocation: location,
          lastLocationUpdate: new Date(),
          currentBearing: bearing,
          currentSpeed: speed
        });

        // If there's an active ride, notify the user with enhanced data
        if (rideId) {
          // Try to find ride by MongoDB ObjectId first, then by rideId field
          let rideRequest = null;
          try {
            rideRequest = await RideRequest.findById(rideId);
          } catch (error) {
            // If it's not a valid ObjectId, try finding by rideId field
            console.log('Not a valid ObjectId, searching by rideId field...');
            rideRequest = await RideRequest.findOne({ rideId: rideId });
          }
          
          if (rideRequest && rideRequest.userId) {
            const locationUpdate = {
              rideId,
              location,
              bearing,
              speed,
              timestamp: new Date().toISOString()
            };
            
            io.to(`user_${rideRequest.userId}`).emit('driverLocationUpdated', locationUpdate);
            console.log('✅ Location update sent to user');
          }
        }
      } catch (error) {
        console.error('❌ Error updating driver location:', error);
        socket.emit('locationUpdateError', {
          message: 'Failed to update location',
          error: error.message
        });
      }
    });

    // Add debug endpoint to provide room membership info
    socket.on('getRoomInfo', () => {
      const rooms = Array.from(socket.rooms);
      const driversRoom = io.sockets.adapter.rooms.get('drivers');
      const driversCount = driversRoom ? driversRoom.size : 0;

      socket.emit('roomInfo', {
        socketId: socket.id,
        userId: socket.user._id,
        role: socket.user.role,
        rooms: rooms,
        driversOnline: driversCount,
        inDriversRoom: rooms.includes('drivers')
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('\n=== CLIENT DISCONNECTED ===');
      console.log('Socket ID:', socket.id);
      console.log('User ID:', socket.user._id);
      console.log('Role:', socket.user.role);
      console.log('Reason:', reason);
      console.log('Time:', new Date().toISOString());
      
      // Update driver status if it's a driver
      if (socket.user.role === 'driver') {
        Driver.findByIdAndUpdate(socket.user._id, {
          isOnline: false,
          lastSeen: new Date()
        }).catch(err => console.error('Error updating driver status on disconnect:', err));
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('\n=== SOCKET ERROR ===');
      console.error('Socket ID:', socket.id);
      console.error('Error:', error);
    });
  });

  // Global error handler
  io.on('error', (error) => {
    console.error('\n=== SOCKET.IO SERVER ERROR ===');
    console.error('Error:', error);
  });

  // Initialize enhanced notification service
  enhancedNotificationService = new EnhancedNotificationService(io);
  console.log('✅ Enhanced notification service initialized');
  
  // Initialize ride completion service
  rideCompletionService = new RideCompletionService(enhancedNotificationService);
  console.log('✅ Ride completion service initialized');
  
  console.log('✅ Socket.IO server initialized successfully\n');
};

// Get IO instance
const getIO = () => {
  if (!io) {
    console.error('Socket.IO not initialized');
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Enhanced function to notify admins of ride events
const notifyAdmins = (eventType, data, options = {}) => {
  if (!enhancedNotificationService) {
    console.warn('Enhanced notification service not initialized - falling back to basic notification');
    // Fallback to basic notification
    if (io) {
      io.to('admins').emit('rideUpdate', {
        type: eventType,
        data: data,
        timestamp: new Date().toISOString()
      });
      io.to('admins').emit(eventType, data);
    }
    return;
  }
  
  return enhancedNotificationService.notifyAdmins(eventType, data, options);
};

// Standalone function to broadcast ride requests (called from API routes)
const broadcastRideRequest = async (data) => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  
  console.log('\n=== BROADCASTING RIDE REQUEST ===');
  console.log('Ride ID:', data.rideId);
  console.log('Vehicle Type:', data.vehicleType);
  console.log('Pickup Station:', data.pickupStation);
  console.log('User Name:', data.userName);
  
  try {
    // Find the ride request in database
    const rideRequest = await RideRequest.findById(data.rideId);
    if (!rideRequest) {
      console.error('❌ Ride request not found in database');
      return { success: false, error: 'Ride request not found' };
    }
    
    console.log('📋 Ride request details:', {
      _id: rideRequest._id,
      vehicleType: rideRequest.vehicleType,
      pickupStation: rideRequest.pickupLocation?.boothName,
      estimatedFare: rideRequest.estimatedFare
    });
    
    // Step 1: Find ALL online drivers (no vehicle type filtering)
    const pickupStation = data.pickupStation.toLowerCase();
    
    // Get all online drivers regardless of vehicle type
    const totalOnlineDrivers = await Driver.countDocuments({ isOnline: true });
    console.log(`📊 Total online drivers: ${totalOnlineDrivers}`);
    
    const allDriversWithVehicleType = await Driver.find({
      isOnline: true
      // Removed vehicle type filtering - all drivers can see all requests
    });
    
    console.log(`📊 All online drivers: ${allDriversWithVehicleType.length}`);
    
    if (allDriversWithVehicleType.length === 0) {
      console.log('❌ No online drivers found');
      return { success: false, error: 'No online drivers available' };
    }
    
    // Log available drivers and their booths
    console.log('📋 Available drivers and their current booths:');
    allDriversWithVehicleType.forEach((driver, index) => {
      console.log(`  ${index + 1}. ${driver.fullName} - Booth: "${driver.currentMetroBooth}" - Vehicle: ${driver.vehicleType}`);
    });
    
    // Filter drivers with flexible station name matching
    const matchingDrivers = allDriversWithVehicleType.filter(driver => {
      if (!driver.currentMetroBooth) return false;
      
      const driverBooth = driver.currentMetroBooth.toLowerCase();
      const targetStation = pickupStation;
      
      console.log(`🔍 Matching driver ${driver.fullName}: "${driverBooth}" vs "${targetStation}"`);
      
      // Exact match
      if (driverBooth === targetStation) {
        console.log(`✅ Exact match found for ${driver.fullName}`);
        return true;
      }
      
      // Partial matching - driver booth is contained in station name or vice versa
      if (driverBooth.includes(targetStation) || targetStation.includes(driverBooth)) return true;
      
      // Check common abbreviations and variants
      const abbreviationMaps = [
        { full: ['kashmere', 'kashmere gate'], short: ['kash', 'kg'] },
        { full: ['rajiv chowk', 'rajiv'], short: ['rajiv', 'rc'] },
        { full: ['connaught place', 'connaught'], short: ['cp', 'connought'] },
        { full: ['new delhi', 'newdelhi'], short: ['ndls', 'nd', 'new delhi'] },
        { full: ['central secretariat'], short: ['cs', 'central'] },
        { full: ['hauz khas'], short: ['hk', 'hauz'] },
        { full: ['dwarka sector 21', 'dwarka'], short: ['dwarka', 'dwarka21'] },
        { full: ['noida city centre', 'noida'], short: ['ncc', 'noida'] },
        { full: ['chandni chowk'], short: ['cc', 'chandni'] }
      ];
      
      for (const map of abbreviationMaps) {
        const matchesFull = map.full.some(name => targetStation.includes(name));
        const matchesShort = map.short.some(abbr => driverBooth.includes(abbr));
        const matchesReverse = map.full.some(name => driverBooth.includes(name)) && map.short.some(abbr => targetStation.includes(abbr));
        
        if ((matchesFull && matchesShort) || matchesReverse) return true;
      }
      
      return false;
    });
    
    console.log(`🚗 Found ${matchingDrivers.length} drivers matching station "${data.pickupStation}"`);
    console.log('📍 Driver booth matching details:');
    allDriversWithVehicleType.forEach(driver => {
      const isMatch = matchingDrivers.includes(driver);
      console.log(`  ${isMatch ? '✅' : '❌'} Driver ${driver._id}: booth="${driver.currentMetroBooth}" ${isMatch ? '(MATCHED)' : ''}`);
    });
    
    // Note: We no longer filter by vehicle type - all drivers get all requests
    console.log('📊 All online drivers will receive this request regardless of vehicle type');
    allDriversWithVehicleType.forEach(driver => {
      console.log(`  Driver ${driver._id}: ${driver.fullName}, Vehicle: ${driver.vehicleType}, Metro: ${driver.currentMetroBooth}`);
    });
    
    // Step 3: Check for drivers in the 'drivers' socket room
    const socketDriversRoom = io.sockets.adapter.rooms.get('drivers');
    console.log(`🔌 Drivers in socket room: ${socketDriversRoom ? socketDriversRoom.size : 0}`);
    
    // Always broadcast to ALL online drivers (no filtering by vehicle type or location)
    let targetDrivers = allDriversWithVehicleType; // This now contains all online drivers
    let broadcastMethod = 'all_drivers';
    
    console.log('✅ Broadcasting to ALL online drivers (no vehicle type filtering)');
    console.log(`📢 Will broadcast to ${targetDrivers.length} drivers`);
    
    // Prepare the ride request data
    const rideRequestData = {
      _id: rideRequest._id.toString(),
      rideId: rideRequest.rideId,
      userId: rideRequest.userId,
      userName: rideRequest.userName,
      userPhone: rideRequest.userPhone,
      pickupLocation: rideRequest.pickupLocation,
      dropLocation: rideRequest.dropLocation,
      vehicleType: rideRequest.vehicleType,
      fare: rideRequest.estimatedFare,
      estimatedFare: rideRequest.estimatedFare,
      distance: rideRequest.distance,
      status: 'pending',
      timestamp: rideRequest.timestamp.toISOString(),
      requestNumber: rideRequest.rideId,
      boothRideNumber: rideRequest.boothRideNumber
    };
    
    console.log('📤 Broadcasting to drivers:', rideRequestData);
    
    // Send to target drivers
    let successCount = 0;
    targetDrivers.forEach(driver => {
      const driverSocketId = `driver_${driver._id}`;
      
      // Check if this driver room actually has sockets
      const driverRoom = io.sockets.adapter.rooms.get(driverSocketId);
      const socketsInRoom = driverRoom ? driverRoom.size : 0;
      
      io.to(driverSocketId).emit('newRideRequest', rideRequestData);
      console.log(`📤 Sent ride request to driver ${driver._id} (${driver.fullName}) via ${driverSocketId} [${socketsInRoom} sockets in room]`);
      successCount++;
    });
    
    // Check drivers room before broadcasting
    const broadcastDriversRoom = io.sockets.adapter.rooms.get('drivers');
    const driversInRoom = broadcastDriversRoom ? broadcastDriversRoom.size : 0;
    
    // Also broadcast to the 'drivers' room as additional fallback
    io.to('drivers').emit('newRideRequest', rideRequestData);
    console.log(`📤 Also broadcasted to entire drivers room [${driversInRoom} sockets in room]`);
    
    // Additional debug: Log all current rooms
    console.log('🔍 Current socket rooms:');
    io.sockets.adapter.rooms.forEach((sockets, roomName) => {
      if (!roomName.startsWith('/') && (roomName.includes('driver') || roomName === 'drivers')) {
        console.log(`  - ${roomName}: ${sockets.size} sockets`);
      }
    });
    
    // Update ride request with broadcast info
    await RideRequest.findByIdAndUpdate(rideRequest._id, {
      $set: { 
        driversNotified: successCount,
        broadcastAt: new Date(),
        broadcastMethod: broadcastMethod
      }
    });
    
    console.log(`✅ Ride request broadcast completed - ${successCount} drivers notified using ${broadcastMethod} method`);
    
    // Notify admins of new ride request
    notifyAdmins('newRideRequest', {
      rideId: rideRequest._id.toString(),
      uniqueRideId: rideRequest.rideId,
      userName: rideRequest.userName,
      userPhone: rideRequest.userPhone,
      pickupLocation: rideRequest.pickupLocation,
      dropLocation: rideRequest.dropLocation,
      vehicleType: rideRequest.vehicleType,
      estimatedFare: rideRequest.estimatedFare,
      distance: rideRequest.distance,
      status: 'pending',
      driversNotified: successCount,
      broadcastMethod: broadcastMethod,
      createdAt: rideRequest.createdAt || rideRequest.timestamp
    });
    
    return { 
      success: true, 
      driversNotified: successCount,
      broadcastMethod: broadcastMethod,
      totalOnlineDrivers: allOnlineDrivers.length
    };
    
  } catch (error) {
    console.error('❌ Error broadcasting ride request:', error);
    return { success: false, error: error.message };
  }
};

// Export function to get services for admin tools
const getServices = () => ({
  enhancedNotificationService,
  rideCompletionService,
  io
});

module.exports = {
  initializeSocket,
  getIO,
  broadcastRideRequest,
  notifyAdmins,
  getServices
};