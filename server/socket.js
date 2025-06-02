// server/socket.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config/config');
const RideRequest = require('./models/RideRequest');
const Driver = require('./models/Driver');
const User = require('./models/User');

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

    // Handle driver status updates
    socket.on('updateDriverStatus', async (data) => {
      console.log('\n=== DRIVER STATUS UPDATE ===');
      console.log('Driver ID:', socket.user._id);
      console.log('Status data:', data);
      
      try {
        const { isOnline, location } = data;
        await Driver.findByIdAndUpdate(socket.user._id, {
          isOnline,
          currentLocation: location,
          lastSeen: new Date()
        });
        
        console.log(`✅ Driver ${socket.user._id} status updated: isOnline=${isOnline}`);
        socket.emit('statusUpdated', { success: true });
      } catch (error) {
        console.error('❌ Error updating driver status:', error);
        socket.emit('statusUpdated', { success: false, error: error.message });
      }
    });

    // Handle user ride request
    socket.on('userRideRequest', async (data) => {
      console.log('\n=== NEW RIDE REQUEST ===');
      console.log('User ID:', socket.user._id);
      console.log('Request data:', {
        userName: data.userName,
        pickupLocation: data.pickupLocation,
        dropLocation: data.dropLocation.address,
        fare: data.fare,
        distance: data.distance
      });
      
      try {
        // Create the ride request in database
        const rideRequest = await RideRequest.create({
          ...data,
          status: 'pending',
          userId: socket.user._id,
          createdAt: new Date()
        });
        
        console.log(`✅ Ride request created with ID: ${rideRequest._id}`);
        
        // Prepare the data to send to drivers
        const rideRequestData = {
          _id: rideRequest._id.toString(),
          id: rideRequest._id.toString(),
          userId: rideRequest.userId,
          userName: data.userName,
          userPhone: data.userPhone,
          pickupLocation: data.pickupLocation,
          dropLocation: data.dropLocation,
          fare: data.fare,
          distance: data.distance,
          status: 'pending',
          timestamp: new Date().toISOString()
        };
        
        // Emit to all drivers
        const driversRoom = io.sockets.adapter.rooms.get('drivers');
        const numberOfDrivers = driversRoom ? driversRoom.size : 0;
        
        console.log(`Broadcasting to ${numberOfDrivers} drivers...`);
        io.to('drivers').emit('newRideRequest', rideRequestData);
        
        console.log('✅ Ride request broadcasted to all drivers');
        
        // Confirm to the user
        socket.emit('rideRequestConfirmed', {
          success: true,
          rideId: rideRequest._id.toString(),
          message: 'Ride request sent to drivers'
        });
        
        // Log for debugging
        console.log('✅ Confirmation sent to user');
      } catch (error) {
        console.error('❌ Error creating ride request:', error);
        socket.emit('rideRequestConfirmed', {
          success: false,
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

        // Update ride request with driver details
        rideRequest.status = 'accepted';
        rideRequest.driverId = driverId;
        rideRequest.acceptedAt = new Date();
        await rideRequest.save();
        
        console.log('✅ Ride request updated in database');

        // Get driver details for sending to user
        const driver = await Driver.findById(driverId);
        
        // Prepare acceptance data
        const acceptanceData = {
          rideId: rideRequest._id.toString(),
          driverId: driverId,
          driverName: driverName,
          driverPhone: driverPhone,
          driverPhoto: driver?.profileImage || null,
          driverRating: driver?.rating || 4.5,
          vehicleMake: vehicleDetails?.make || 'Unknown',
          vehicleModel: vehicleDetails?.model || 'Unknown',
          licensePlate: vehicleDetails?.licensePlate || 'Unknown',
          timestamp: new Date().toISOString(),
          driverLocation: data.currentLocation
        };
        
        console.log('📤 Notifying user:', rideRequest.userId);
        io.to(`user_${rideRequest.userId}`).emit('rideAccepted', acceptanceData);
        
        // Notify other drivers that this ride is taken
        socket.broadcast.to('drivers').emit('rideRequestClosed', {
          rideId: rideRequest._id.toString()
        });
        
        console.log('✅ All notifications sent');

        // Confirm to the accepting driver
        socket.emit('rideAcceptConfirmed', {
          success: true,
          rideId: rideRequest._id.toString(),
          message: 'Ride accepted successfully',
          userDetails: {
            name: rideRequest.userName,
            phone: rideRequest.userPhone,
            pickupLocation: rideRequest.pickupLocation,
            dropLocation: rideRequest.dropLocation
          }
        });

      } catch (error) {
        console.error('❌ Error accepting ride:', error);
        socket.emit('rideAcceptError', { 
          message: 'Failed to accept ride',
          error: error.message 
        });
      }
    });

    // Handle ride cancellation
    socket.on('cancelRide', async (data) => {
      console.log('\n=== RIDE CANCELLATION ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Ride ID:', data.rideId);
      
      try {
        const { rideId, reason } = data;
        
        const rideRequest = await RideRequest.findById(rideId);
        if (!rideRequest) {
          console.error('❌ Ride not found');
          socket.emit('rideCancelError', { message: 'Ride not found' });
          return;
        }
        
        // Update ride status
        rideRequest.status = 'cancelled';
        rideRequest.cancelledAt = new Date();
        rideRequest.cancellationReason = reason || 'No reason provided';
        rideRequest.cancelledBy = socket.user.role;
        await rideRequest.save();
        
        console.log('✅ Ride cancelled in database');
        
        // Notify both parties
        if (socket.user.role === 'driver') {
          // Driver cancelled - notify user
          io.to(`user_${rideRequest.userId}`).emit('rideCancelled', {
            rideId: rideId,
            cancelledBy: 'driver',
            reason: reason
          });
          console.log('📤 User notified of cancellation');
        } else {
          // User cancelled - notify driver
          if (rideRequest.driverId) {
            io.to(`driver_${rideRequest.driverId}`).emit('rideCancelled', {
              rideId: rideId,
              cancelledBy: 'user',
              reason: reason
            });
            console.log('📤 Driver notified of cancellation');
          }
        }
        
        socket.emit('rideCancelConfirmed', {
          success: true,
          message: 'Ride cancelled successfully'
        });
        
      } catch (error) {
        console.error('❌ Error cancelling ride:', error);
        socket.emit('rideCancelError', {
          message: 'Failed to cancel ride',
          error: error.message
        });
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

module.exports = {
  initializeSocket,
  getIO
};