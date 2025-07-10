// server/socket.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config/config');
const RideRequest = require('./models/RideRequest');
const Driver = require('./models/Driver');
const User = require('./models/User');
const MetroStation = require('./models/MetroStation');
const { generateRideId, generateRideOTPs, verifyOTP } = require('./utils/otpUtils');
const { logRideEvent, logUserAction, logDriverAction, logError } = require('./utils/rideLogger');
const { calculateFareEstimates, getDynamicPricingFactor } = require('./utils/fareCalculator');

let io;

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
        "https://gt2-2.onrender.com"
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
        
        // Update driver status
        await Driver.findByIdAndUpdate(socket.user._id, {
          isOnline: true,
          currentMetroBooth: metroBooth,
          location: {
            type: 'Point',
            coordinates: [location.lng, location.lat],
            lastUpdated: new Date()
          },
          vehicleType: vehicleType,
          lastActiveTime: new Date()
        });
        
        // Update metro station online drivers count
        const metroStation = await MetroStation.findOne({ name: metroBooth });
        if (metroStation) {
          await metroStation.incrementOnlineDrivers();
        }
        
        console.log(`✅ Driver ${socket.user._id} is now online at ${metroBooth} with ${vehicleType}`);
        logRideEvent(`DRIVER-${socket.user._id}`, 'driver_online', {
          metroBooth,
          vehicleType,
          location
        });
        
        socket.emit('driverOnlineConfirmed', { 
          success: true,
          metroBooth,
          vehicleType,
          message: 'You are now online and ready to accept rides'
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
        
        // Find online drivers with matching vehicle type at the pickup metro station
        const matchingDrivers = await Driver.find({
          isOnline: true,
          vehicleType: data.vehicleType,
          currentMetroBooth: data.pickupStation
        });
        
        console.log(`🚗 Found ${matchingDrivers.length} online ${data.vehicleType} drivers at ${data.pickupStation}`);
        
        if (matchingDrivers.length === 0) {
          console.log('⚠️ No matching drivers found - broadcasting to all online drivers with vehicle type');
          // Fallback: broadcast to all online drivers with matching vehicle type
          const fallbackDrivers = await Driver.find({
            isOnline: true,
            vehicleType: data.vehicleType
          });
          
          fallbackDrivers.forEach(driver => {
            const driverSocketId = `driver_${driver._id}`;
            io.to(driverSocketId).emit('newRideRequest', {
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
              timestamp: rideRequest.timestamp.toISOString()
            });
          });
          
          console.log(`📢 Fallback: Broadcasted to ${fallbackDrivers.length} drivers`);
          return;
        }
        
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
        
        // Log ride event
        logRideEvent(rideRequest.rideId, 'ride_accepted', {
          driverId,
          driverName,
          vehicleType: rideRequest.vehicleType,
          acceptedAt: new Date()
        });

        // Prepare acceptance data with OTP info
        const acceptanceData = {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
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
          status: 'driver_assigned'
        };
        
        console.log('📤 Notifying user:', rideRequest.userId);
        io.to(`user_${rideRequest.userId}`).emit('rideAccepted', acceptanceData);
        
        // Notify other drivers that this ride is taken
        socket.broadcast.to('drivers').emit('rideRequestClosed', {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId
        });
        
        console.log('✅ All notifications sent');

        // Confirm to the accepting driver
        socket.emit('rideAcceptConfirmed', {
          success: true,
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          message: 'Ride accepted successfully',
          userDetails: {
            name: rideRequest.userName,
            phone: rideRequest.userPhone,
            pickupLocation: rideRequest.pickupLocation,
            dropLocation: rideRequest.dropLocation
          },
          startOTP: rideRequest.startOTP,
          endOTP: rideRequest.endOTP
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
    socket.on('verifyStartOTP', async (data) => {
      console.log('\n=== VERIFYING START OTP ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Ride ID:', data.rideId);
      console.log('Provided OTP:', data.otp);
      
      try {
        const { rideId, otp } = data;
        
        const rideRequest = await RideRequest.findById(rideId);
        if (!rideRequest) {
          console.error('❌ Ride not found');
          socket.emit('otpVerificationError', { message: 'Ride not found' });
          return;
        }
        
        // Verify OTP
        if (!verifyOTP(otp, rideRequest.startOTP)) {
          console.error('❌ Invalid start OTP');
          socket.emit('otpVerificationError', { message: 'Invalid OTP' });
          return;
        }
        
        // Update ride status
        rideRequest.status = 'ride_started';
        rideRequest.rideStartedAt = new Date();
        await rideRequest.save();
        
        console.log('✅ Ride started successfully');
        
        // Log ride event
        logRideEvent(rideRequest.rideId, 'ride_started', {
          startedAt: new Date(),
          startOTP: otp
        });
        
        // Notify both parties
        const startData = {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          status: 'ride_started',
          startedAt: new Date().toISOString(),
          endOTP: rideRequest.endOTP
        };
        
        io.to(`user_${rideRequest.userId}`).emit('rideStarted', startData);
        io.to(`driver_${rideRequest.driverId}`).emit('rideStarted', startData);
        
        console.log('📤 Both parties notified of ride start');
        
        socket.emit('otpVerificationSuccess', {
          success: true,
          message: 'Ride started successfully',
          status: 'ride_started'
        });
        
      } catch (error) {
        console.error('❌ Error verifying start OTP:', error);
        socket.emit('otpVerificationError', {
          message: 'Failed to verify OTP',
          error: error.message
        });
      }
    });

    // Handle OTP verification for ride end
    socket.on('verifyEndOTP', async (data) => {
      console.log('\n=== VERIFYING END OTP ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Ride ID:', data.rideId);
      console.log('Provided OTP:', data.otp);
      
      try {
        const { rideId, otp } = data;
        
        const rideRequest = await RideRequest.findById(rideId);
        if (!rideRequest) {
          console.error('❌ Ride not found');
          socket.emit('otpVerificationError', { message: 'Ride not found' });
          return;
        }
        
        // Verify OTP
        if (!verifyOTP(otp, rideRequest.endOTP)) {
          console.error('❌ Invalid end OTP');
          socket.emit('otpVerificationError', { message: 'Invalid OTP' });
          return;
        }
        
        // Update ride status
        rideRequest.status = 'ride_ended';
        rideRequest.rideEndedAt = new Date();
        rideRequest.actualFare = rideRequest.estimatedFare; // For now, use estimated fare
        await rideRequest.save();
        
        console.log('✅ Ride ended successfully');
        
        // Log ride event
        logRideEvent(rideRequest.rideId, 'ride_ended', {
          endedAt: new Date(),
          endOTP: otp,
          actualFare: rideRequest.actualFare
        });
        
        // Update driver stats
        await Driver.findByIdAndUpdate(rideRequest.driverId, {
          $inc: { totalRides: 1, totalEarnings: rideRequest.actualFare }
        });
        
        // Notify both parties
        const endData = {
          rideId: rideRequest._id.toString(),
          uniqueRideId: rideRequest.rideId,
          status: 'ride_ended',
          endedAt: new Date().toISOString(),
          actualFare: rideRequest.actualFare,
          rideDuration: Math.floor((rideRequest.rideEndedAt - rideRequest.rideStartedAt) / 60000) // in minutes
        };
        
        io.to(`user_${rideRequest.userId}`).emit('rideEnded', endData);
        io.to(`driver_${rideRequest.driverId}`).emit('rideEnded', endData);
        
        console.log('📤 Both parties notified of ride end');
        
        socket.emit('otpVerificationSuccess', {
          success: true,
          message: 'Ride completed successfully',
          status: 'ride_ended',
          fare: rideRequest.actualFare
        });
        
      } catch (error) {
        console.error('❌ Error verifying end OTP:', error);
        socket.emit('otpVerificationError', {
          message: 'Failed to verify OTP',
          error: error.message
        });
      }
    });

    // Handle ride cancellation
    socket.on('cancelRide', async (data, callback) => {
      console.log('\n=== RIDE CANCELLATION ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Ride ID:', data.rideId);
      
      try {
        const { rideId, reason } = data;
        
        const rideRequest = await RideRequest.findById(rideId);
        if (!rideRequest) {
          console.error('❌ Ride not found');
          if (callback) callback({ success: false, message: 'Ride not found' });
          return;
        }
        
        // Update ride status
        rideRequest.status = 'cancelled';
        rideRequest.cancelledAt = new Date();
        rideRequest.cancellationReason = reason || 'No reason provided';
        rideRequest.cancelledBy = socket.user.role;
        await rideRequest.save();
        
        console.log('✅ Ride cancelled in database');
        
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
          const rideRequest = await RideRequest.findById(rideId);
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
    
    // Step 1: Find online drivers with matching vehicle type at the pickup metro station
    const matchingDrivers = await Driver.find({
      isOnline: true,
      vehicleType: data.vehicleType,
      currentMetroBooth: data.pickupStation
    });
    
    console.log(`🚗 Found ${matchingDrivers.length} online ${data.vehicleType} drivers at ${data.pickupStation}`);
    
    // Step 2: Check all online drivers to understand the issue
    const allOnlineDrivers = await Driver.find({ isOnline: true });
    console.log(`📊 Total online drivers: ${allOnlineDrivers.length}`);
    
    allOnlineDrivers.forEach(driver => {
      console.log(`  Driver ${driver._id}: ${driver.fullName}, Vehicle: ${driver.vehicleType}, Metro: ${driver.currentMetroBooth}`);
    });
    
    // Step 3: Check for drivers in the 'drivers' socket room
    const driversRoom = io.sockets.adapter.rooms.get('drivers');
    console.log(`🔌 Drivers in socket room: ${driversRoom ? driversRoom.size : 0}`);
    
    let targetDrivers = [];
    let broadcastMethod = '';
    
    if (matchingDrivers.length > 0) {
      // Preferred: Send to drivers at the specific metro station with matching vehicle type
      targetDrivers = matchingDrivers;
      broadcastMethod = 'exact_match';
      console.log('✅ Using exact match (station + vehicle type)');
    } else {
      // Fallback 1: broadcast to all online drivers with matching vehicle type
      const fallbackDrivers = await Driver.find({
        isOnline: true,
        vehicleType: data.vehicleType
      });
      
      if (fallbackDrivers.length > 0) {
        targetDrivers = fallbackDrivers;
        broadcastMethod = 'vehicle_match';
        console.log('⚠️ Using vehicle type fallback');
      } else {
        // Fallback 2: broadcast to ALL online drivers
        targetDrivers = allOnlineDrivers;
        broadcastMethod = 'all_online';
        console.log('⚠️⚠️ Using all online drivers fallback');
      }
    }
    
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
      requestNumber: rideRequest.rideId
    };
    
    console.log('📤 Broadcasting to drivers:', rideRequestData);
    
    // Send to target drivers
    let successCount = 0;
    targetDrivers.forEach(driver => {
      const driverSocketId = `driver_${driver._id}`;
      io.to(driverSocketId).emit('newRideRequest', rideRequestData);
      console.log(`📤 Sent ride request to driver ${driver._id} (${driver.fullName}) via ${driverSocketId}`);
      successCount++;
    });
    
    // Also broadcast to the 'drivers' room as additional fallback
    io.to('drivers').emit('newRideRequest', rideRequestData);
    console.log('📤 Also broadcasted to entire drivers room');
    
    // Update ride request with broadcast info
    await RideRequest.findByIdAndUpdate(rideRequest._id, {
      $set: { 
        driversNotified: successCount,
        broadcastAt: new Date(),
        broadcastMethod: broadcastMethod
      }
    });
    
    console.log(`✅ Ride request broadcast completed - ${successCount} drivers notified using ${broadcastMethod} method`);
    
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

module.exports = {
  initializeSocket,
  getIO,
  broadcastRideRequest
};