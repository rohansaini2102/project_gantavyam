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

// Track connected clients by user ID
const connectedClients = new Map();

// Broadcast state change to all relevant clients
const broadcastStateChange = (eventType, data) => {
  console.log(`📢 Broadcasting ${eventType} to all clients:`, data);
  
  // Notify all admins
  notifyAdmins(eventType, data);
  
  // Notify specific driver if applicable
  if (data.driverId) {
    const driverSocket = connectedClients.get(data.driverId);
    if (driverSocket) {
      // Send personalized event to driver
      driverSocket.emit(`driver${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`, data);
    }
  }
  
  // Notify all drivers about queue changes
  if (eventType === 'queuePositionsUpdated') {
    connectedClients.forEach((socket, userId) => {
      if (socket.user && socket.user.role === 'driver') {
        const driverUpdate = data.queueUpdates?.find(q => q._id?.toString() === userId);
        if (driverUpdate) {
          socket.emit('queuePositionUpdated', {
            queuePosition: driverUpdate.queuePosition,
            totalOnline: data.totalOnline,
            timestamp: data.timestamp,
            action: data.action
          });
        }
      }
    });
  }
};

// Function to update queue after driver goes offline (proper queue shifting)
const updateQueueAfterDriverRemoval = async (removedDriverId) => {
  try {
    console.log(`🔄 Updating queue after driver ${removedDriverId} removal...`);
    
    // Get the removed driver's position
    const removedDriver = await Driver.findById(removedDriverId);
    if (!removedDriver || !removedDriver.queuePosition) {
      console.log('❌ Removed driver not found or had no queue position');
      return await getCompleteQueueState();
    }
    
    const removedPosition = removedDriver.queuePosition;
    console.log(`📋 Removed driver was at position ${removedPosition}`);
    
    // Clear the removed driver's queue position
    await Driver.findByIdAndUpdate(removedDriverId, {
      queuePosition: null
    });
    
    // Find all drivers who were AFTER the removed driver (position > removedPosition)
    const driversToShift = await Driver.find({
      isOnline: true,
      isVerified: true,
      queuePosition: { $gt: removedPosition }
    }).sort({ queuePosition: 1 });
    
    console.log(`📋 Found ${driversToShift.length} drivers to shift up`);
    
    // Validate queue integrity and reorder if needed
    await validateQueueIntegrity();
    
    console.log(`✅ Queue reordered after driver removal - ${driversToShift.length} drivers repositioned`);
    
    // Get complete queue state for broadcasting
    const completeQueueState = await getCompleteQueueState();
    
    // Broadcast updated queue state to all clients
    broadcastStateChange('queuePositionsUpdated', {
      queueUpdates: completeQueueState,
      totalOnline: completeQueueState.length,
      timestamp: new Date().toISOString(),
      action: 'driver_removed',
      removedDriverId
    });
    
    console.log('📢 Queue positions broadcasted to all admins and individual drivers after driver removal');
    return completeQueueState;
    
  } catch (error) {
    console.error('❌ Error updating queue after driver removal:', error);
    return await getCompleteQueueState();
  }
};

// Function to update queue after driver goes online (proper queue insertion)
const updateQueueAfterDriverAddition = async (addedDriverId) => {
  try {
    console.log(`🔄 Updating queue after driver ${addedDriverId} addition...`);
    
    // Get the added driver
    const addedDriver = await Driver.findById(addedDriverId);
    if (!addedDriver || !addedDriver.isOnline) {
      console.log('❌ Added driver not found or not online');
      return await getCompleteQueueState();
    }
    
    // Get all current online drivers sorted by queue entry time (first-come-first-served)
    const onlineDrivers = await Driver.find({
      isOnline: true,
      isVerified: true,
      _id: { $ne: addedDriverId }
    }).sort({ queueEntryTime: 1 });
    
    // New driver gets the next position in sequence (first-come-first-served)
    const newPosition = onlineDrivers.length + 1;
    
    console.log(`📋 New driver will be assigned position ${newPosition} (${onlineDrivers.length} drivers already online)`);
    console.log(`📋 Queue entry time: ${addedDriver.queueEntryTime || addedDriver.lastActiveTime}`);
    
    // Set the new driver's position
    await Driver.findByIdAndUpdate(addedDriverId, {
      queuePosition: newPosition
    });
    
    console.log(`✅ Driver ${addedDriver.fullName} assigned position ${newPosition}`);
    
    // Validate queue integrity and reorder if needed
    await validateQueueIntegrity();
    
    // Get complete queue state for broadcasting
    const completeQueueState = await getCompleteQueueState();
    
    // Broadcast updated queue state to all clients
    broadcastStateChange('queuePositionsUpdated', {
      queueUpdates: completeQueueState,
      totalOnline: completeQueueState.length,
      timestamp: new Date().toISOString(),
      action: 'driver_added',
      addedDriverId
    });
    
    console.log('📢 Queue positions broadcasted to all admins and individual drivers after driver addition');
    return completeQueueState;
    
  } catch (error) {
    console.error('❌ Error updating queue after driver addition:', error);
    return await getCompleteQueueState();
  }
};

// Function to validate queue integrity and fix any issues
const validateQueueIntegrity = async () => {
  try {
    console.log('🔍 Validating queue integrity...');
    
    const onlineDrivers = await Driver.find({
      isOnline: true,
      isVerified: true
    }).sort({ 
      queueEntryTime: 1,
      lastActiveTime: 1
    });
    
    let hasIssues = false;
    const issues = [];
    
    // Check for duplicate positions
    const positions = onlineDrivers.map(d => d.queuePosition).filter(p => p !== null);
    const duplicates = positions.filter((pos, index) => positions.indexOf(pos) !== index);
    if (duplicates.length > 0) {
      hasIssues = true;
      issues.push(`Duplicate queue positions: ${duplicates.join(', ')}`);
    }
    
    // Check for missing positions (gaps in sequence)
    const expectedPositions = Array.from({ length: onlineDrivers.length }, (_, i) => i + 1);
    const missingPositions = expectedPositions.filter(pos => !positions.includes(pos));
    if (missingPositions.length > 0) {
      hasIssues = true;
      issues.push(`Missing queue positions: ${missingPositions.join(', ')}`);
    }
    
    // Check for drivers without queue entry time
    const driversWithoutEntryTime = onlineDrivers.filter(d => !d.queueEntryTime);
    if (driversWithoutEntryTime.length > 0) {
      hasIssues = true;
      issues.push(`${driversWithoutEntryTime.length} drivers without queue entry time`);
    }
    
    if (hasIssues) {
      console.log('⚠️ Queue integrity issues found:', issues);
      await reorderQueueByEntryTime();
      console.log('✅ Queue integrity issues fixed');
      return false;
    }
    
    console.log('✅ Queue integrity validated - no issues found');
    return true;
    
  } catch (error) {
    console.error('❌ Error validating queue integrity:', error);
    return false;
  }
};

// Function to reorder queue by entry time (first-come-first-served)
const reorderQueueByEntryTime = async () => {
  try {
    console.log('🔄 Reordering queue by entry time...');
    
    // Get all online drivers sorted by queue entry time
    const onlineDrivers = await Driver.find({
      isOnline: true,
      isVerified: true
    }).sort({ 
      queueEntryTime: 1,
      lastActiveTime: 1 // Fallback for drivers without queueEntryTime
    });
    
    // Reassign positions based on sorted order
    const updatePromises = onlineDrivers.map((driver, index) => {
      const newPosition = index + 1;
      console.log(`📋 Driver ${driver.fullName} -> Position ${newPosition} (Entry: ${driver.queueEntryTime || driver.lastActiveTime})`);
      
      // Set queue entry time if missing
      const updateData = { queuePosition: newPosition };
      if (!driver.queueEntryTime) {
        updateData.queueEntryTime = driver.lastActiveTime;
      }
      
      return Driver.findByIdAndUpdate(driver._id, updateData);
    });
    
    await Promise.all(updatePromises);
    console.log('✅ Queue reordered by entry time');
    
  } catch (error) {
    console.error('❌ Error reordering queue by entry time:', error);
  }
};

// Helper function to get complete queue state
const getCompleteQueueState = async () => {
  try {
    const onlineDrivers = await Driver.find({
      isOnline: true,
      isVerified: true
    }).sort({ 
      queueEntryTime: 1,
      lastActiveTime: 1 // Fallback for drivers without queueEntryTime
    });
    
    return onlineDrivers.map(driver => ({
      driverId: driver._id,
      driverName: driver.fullName,
      queuePosition: driver.queuePosition,
      isOnline: true,
      currentPickupLocation: driver.currentPickupLocation,
      lastActiveTime: driver.lastActiveTime,
      queueEntryTime: driver.queueEntryTime
    }));
  } catch (error) {
    console.error('❌ Error getting complete queue state:', error);
    return [];
  }
};

const initializeSocket = (server) => {
  console.log('\n=== INITIALIZING SOCKET.IO SERVER ===');
  
  io = socketIO(server, {
    cors: {
      origin: [
        "http://localhost:3000", // Frontend development server
        "http://localhost:3001", // Alternative frontend port
        "https://gt2-seven.vercel.app",
        "https://gantavyam.site",
        "https://www.gantavyam.site", // Main production domain
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

  // Track connection attempts by IP to prevent spam
  const connectionAttempts = new Map();
  const KNOWN_EXPIRED_TIMESTAMP = new Date('2025-07-18T01:35:34.000Z').getTime() / 1000;

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    const clientIP = socket.handshake.address;
    
    console.log('\n=== NEW SOCKET CONNECTION ATTEMPT ===');
    console.log('Token received:', token ? token.substring(0, 20) + '...' : 'undefined');
    console.log('Socket ID:', socket.id);
    console.log('Client IP:', clientIP);
    
    if (!token) {
      console.error('❌ No token provided - rejecting connection');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      // Check for the specific problematic token before verifying
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(atob(tokenParts[1]));
          if (payload.exp === KNOWN_EXPIRED_TIMESTAMP) {
            console.error('❌ BLOCKED: Known expired token detected');
            console.error('❌ Token expired at:', new Date(payload.exp * 1000).toISOString());
            
            // Track this attempt
            const attemptKey = `${clientIP}-expired`;
            const attempts = connectionAttempts.get(attemptKey) || 0;
            connectionAttempts.set(attemptKey, attempts + 1);
            
            if (attempts > 5) {
              console.error('❌ RATE LIMITED: Too many expired token attempts from IP:', clientIP);
              return next(new Error('Rate limited: Too many expired token attempts'));
            }
            
            // Send aggressive cleanup message
            socket.emit('forceTokenCleanup', {
              error: 'Expired token detected',
              expiredAt: new Date(payload.exp * 1000).toISOString(),
              message: 'Please clear your browser cache and login again',
              action: 'FORCE_RELOAD',
              severity: 'CRITICAL'
            });
            
            // Also emit to all other sockets from this IP (if available)
            const allSockets = io.sockets.sockets;
            allSockets.forEach(s => {
              if (s.id !== socket.id) {
                s.emit('forceTokenCleanup', {
                  error: 'Expired token detected on another session',
                  expiredAt: new Date(payload.exp * 1000).toISOString(),
                  message: 'Please clear your browser cache and login again',
                  action: 'FORCE_RELOAD',
                  severity: 'CRITICAL'
                });
              }
            });
            
            setTimeout(() => {
              socket.disconnect();
            }, 100);
            
            return;
          }
        } catch (parseError) {
          console.error('❌ Error parsing token payload:', parseError);
        }
      }

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
      
      // Load full user information based on role
      try {
        if (userRole === 'driver') {
          // Load full driver information
          const driver = await Driver.findById(decoded.id);
          if (!driver) {
            console.error('❌ Driver not found for ID:', decoded.id);
            return next(new Error('Authentication error: Driver not found'));
          }
          
          socket.user = {
            _id: decoded.id,
            role: userRole,
            fullName: driver.fullName,
            mobileNo: driver.mobileNo,
            vehicleNo: driver.vehicleNo,
            vehicleType: driver.vehicleType,
            currentMetroBooth: driver.currentMetroBooth,
            isOnline: driver.isOnline,
            isVerified: driver.isVerified
          };
          
          console.log('✅ Driver authentication successful:', {
            userId: socket.user._id,
            name: socket.user.fullName,
            vehicle: `${socket.user.vehicleType} - ${socket.user.vehicleNo}`,
            booth: socket.user.currentMetroBooth
          });
        } else if (userRole === 'user') {
          // Load full user information
          const user = await User.findById(decoded.id);
          if (!user) {
            console.error('❌ User not found for ID:', decoded.id);
            return next(new Error('Authentication error: User not found'));
          }
          
          socket.user = {
            _id: decoded.id,
            role: userRole,
            name: user.name,
            phone: user.phone,
            email: user.email
          };
          
          console.log('✅ User authentication successful:', {
            userId: socket.user._id,
            name: socket.user.name
          });
        } else {
          // For admin or other roles, keep minimal info
          socket.user = {
            _id: decoded.id,
            role: userRole
          };
          
          console.log('✅ Authentication successful for:', {
            userId: socket.user._id,
            role: socket.user.role
          });
        }
        
        next();
      } catch (err) {
        console.error('❌ Error loading user information:', err);
        return next(new Error('Authentication error: Failed to load user information'));
      }
    } catch (err) {
      console.error('❌ JWT Verification error:', err.message);
      console.error('Error details:', err);
      
      // Handle specific expired token
      if (err.name === 'TokenExpiredError') {
        const isKnownExpired = err.expiredAt && 
          new Date(err.expiredAt).getTime() === new Date('2025-07-18T01:35:34.000Z').getTime();
        
        if (isKnownExpired) {
          console.error('❌ CONFIRMED: This is the known problematic token');
          socket.emit('forceTokenCleanup', {
            error: 'Known expired token',
            expiredAt: err.expiredAt,
            message: 'Please clear your browser cache and login again',
            action: 'FORCE_RELOAD'
          });
        } else {
          // Send specific error for expired tokens
          socket.emit('tokenExpired', {
            error: 'Token expired',
            expiredAt: err.expiredAt,
            message: 'Your session has expired. Please log in again.',
            action: 'REDIRECT_LOGIN'
          });
        }
        
        // Give client time to receive the message before disconnecting
        setTimeout(() => {
          socket.disconnect();
        }, 100);
        
        return;
      }
      
      next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    console.log('\n=== NEW CLIENT CONNECTED ===');
    console.log('Socket ID:', socket.id);
    console.log('User ID:', socket.user._id);
    console.log('User Role:', socket.user.role);
    console.log('Time:', new Date().toISOString());

    // Track connected client
    connectedClients.set(socket.user._id, socket);
    console.log(`✅ Client ${socket.user._id} added to connected clients map`);

    // Join role-specific room based on the user's role
    if (socket.user.role === 'driver') {
      socket.join('drivers');
      socket.join(`driver_${socket.user._id}`);
      socket.join('admin-room'); // Also join admin room for notifications
      console.log(`\n✅ Driver connected and joined rooms:`);
      console.log(`   Driver ID: ${socket.user._id}`);
      console.log(`   Driver Name: ${socket.user.fullName || socket.user.name}`);
      console.log(`   Vehicle Type: ${socket.user.vehicleType}`);
      console.log(`   Vehicle No: ${socket.user.vehicleNo}`);
      console.log(`   Current Booth: ${socket.user.currentMetroBooth}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Rooms joined: drivers, driver_${socket.user._id}, admin-room`);
      
      // Verify driver is actually in the rooms
      const driverSpecificRoom = `driver_${socket.user._id}`;
      setTimeout(() => {
        const rooms = Array.from(socket.rooms);
        const inDriversRoom = rooms.includes('drivers');
        const inDriverSpecificRoom = rooms.includes(driverSpecificRoom);
        const inAdminRoom = rooms.includes('admin-room');
        
        console.log(`🔍 Driver ${socket.user._id} room verification:`, {
          inDriversRoom,
          inDriverSpecificRoom,
          inAdminRoom,
          allRooms: rooms
        });
        
        // Ensure driver is in the room by re-joining if necessary
        if (!inDriverSpecificRoom) {
          console.log(`⚠️ Driver ${socket.user._id} not in specific room, re-joining...`);
          socket.join(driverSpecificRoom);
        }
        if (!inDriversRoom) {
          console.log(`⚠️ Driver ${socket.user._id} not in drivers room, re-joining...`);
          socket.join('drivers');
        }
        if (!inAdminRoom) {
          console.log(`⚠️ Driver ${socket.user._id} not in admin room, re-joining...`);
          socket.join('admin-room');
        }
      }, 1000);
      
      // Log all driver connections
      const driversRoom = io.sockets.adapter.rooms.get('drivers');
      console.log(`Total drivers online: ${driversRoom ? driversRoom.size : 0}`);
    } else if (socket.user.role === 'admin') {
      socket.join('admins');
      socket.join('admin-room');
      socket.join(`admin_${socket.user._id}`);
      console.log(`✅ Admin ${socket.user._id} joined rooms: admins, admin-room, admin_${socket.user._id}`);
      
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

    // Handle driver room rejoin (for connection recovery)
    socket.on('driverRoomRejoin', async (data) => {
      console.log('\n=== DRIVER ROOM REJOIN ===');
      console.log('Driver ID:', socket.user._id);
      console.log('Driver Name:', data.driverName);
      console.log('Timestamp:', data.timestamp);
      
      try {
        // Ensure driver is in all required rooms
        const driverSpecificRoom = `driver_${socket.user._id}`;
        const requiredRooms = ['drivers', driverSpecificRoom, 'admin-room'];
        
        console.log(`[DriverRoomRejoin] Rejoining rooms for driver ${socket.user._id}:`, requiredRooms);
        
        // Join all required rooms
        requiredRooms.forEach(roomName => {
          socket.join(roomName);
          console.log(`✅ Driver ${socket.user._id} rejoined room: ${roomName}`);
        });
        
        // Verify room membership after joining
        setTimeout(() => {
          const rooms = Array.from(socket.rooms);
          console.log(`🔍 Driver ${socket.user._id} current rooms after rejoin:`, rooms);
          
          // Send confirmation back to driver
          socket.emit('roomRejoinConfirmed', {
            success: true,
            rooms: rooms,
            timestamp: new Date().toISOString(),
            message: 'Successfully rejoined all required rooms'
          });
        }, 500);
        
      } catch (error) {
        console.error('❌ Error during driver room rejoin:', error);
        socket.emit('roomRejoinConfirmed', {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle driver going online with metro booth selection
    socket.on('driverGoOnline', async (data) => {
      console.log('\n=== DRIVER GOING ONLINE ===');
      console.log('Driver ID:', socket.user._id);
      console.log('Metro booth data:', data);
      
      try {
        const { metroBooth, location, vehicleType } = data;
        
        // Check for potential conflicts - get current driver state
        const currentDriver = await Driver.findById(socket.user._id);
        if (currentDriver && currentDriver.isOnline) {
          console.log('⚠️ Driver is already online, checking for conflicts...');
          
          // Check if there's a recent admin change (within last 5 seconds)
          const recentChangeThreshold = new Date(Date.now() - 5000);
          if (currentDriver.lastActiveTime && currentDriver.lastActiveTime > recentChangeThreshold) {
            console.log('⚠️ Recent admin change detected, informing driver of current state');
            socket.emit('driverOnlineConfirmed', { 
              success: false,
              conflict: true,
              currentState: {
                isOnline: currentDriver.isOnline,
                currentMetroBooth: currentDriver.currentMetroBooth,
                queuePosition: currentDriver.queuePosition
              },
              message: 'Your status was recently changed by an admin. Please check current status.'
            });
            return;
          }
        }
        
        // Use fixed pickup location if not provided
        const fixedMetroBooth = metroBooth || "Hauz Khas Metro Gate No 1";
        
        // Update driver status with queue entry timestamp
        const queueEntryTime = new Date();
        await Driver.findByIdAndUpdate(socket.user._id, {
          isOnline: true,
          currentMetroBooth: fixedMetroBooth,
          location: {
            type: 'Point',
            coordinates: [location.lng, location.lat],
            lastUpdated: new Date()
          },
          vehicleType: vehicleType,
          lastActiveTime: queueEntryTime,
          queueEntryTime: queueEntryTime // Dedicated field for queue entry tracking
        });
        
        console.log(`📋 Driver ${socket.user._id} queue entry time set to: ${queueEntryTime.toISOString()}`);
        
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
        
        // Update queue positions after driver goes online
        console.log('🔄 Updating queue after driver goes online...');
        await updateQueueAfterDriverAddition(socket.user._id);
        
        // Notify admins of driver going online
        notifyAdmins('driverOnline', {
          driverId: socket.user._id,
          driverName: `Driver ${socket.user._id}`,
          metroBooth: fixedMetroBooth,
          vehicleType,
          location,
          timestamp: new Date().toISOString()
        });

        // Broadcast comprehensive status update
        broadcastStateChange('driverStatusUpdated', {
          driverId: socket.user._id,
          driverName: `Driver ${socket.user._id}`,
          isOnline: true,
          currentPickupLocation: fixedMetroBooth,
          vehicleType,
          lastActiveTime: new Date().toISOString(),
          changedBy: 'driver',
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
        
        // Check for potential conflicts
        if (driver && !driver.isOnline) {
          console.log('⚠️ Driver is already offline, checking for conflicts...');
          
          // Check if there's a recent admin change (within last 5 seconds)
          const recentChangeThreshold = new Date(Date.now() - 5000);
          if (driver.lastActiveTime && driver.lastActiveTime > recentChangeThreshold) {
            console.log('⚠️ Recent admin change detected, informing driver of current state');
            socket.emit('driverOfflineConfirmed', { 
              success: false,
              conflict: true,
              currentState: {
                isOnline: driver.isOnline,
                currentMetroBooth: driver.currentMetroBooth,
                queuePosition: driver.queuePosition
              },
              message: 'Your status was recently changed by an admin. Please check current status.'
            });
            return;
          }
        }
        
        const metroBooth = driver.currentMetroBooth;
        
        // Update driver status
        await Driver.findByIdAndUpdate(socket.user._id, {
          isOnline: false,
          currentMetroBooth: null,
          lastActiveTime: new Date(),
          queuePosition: null,
          queueEntryTime: null
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
        
        // Update queue positions after driver goes offline
        console.log('🔄 Updating queue after driver goes offline...');
        await updateQueueAfterDriverRemoval(socket.user._id);
        
        // Notify admins of driver going offline
        notifyAdmins('driverOffline', {
          driverId: socket.user._id,
          driverName: `Driver ${socket.user._id}`,
          metroBooth,
          timestamp: new Date().toISOString()
        });

        // Broadcast comprehensive status update
        broadcastStateChange('driverStatusUpdated', {
          driverId: socket.user._id,
          driverName: `Driver ${socket.user._id}`,
          isOnline: false,
          currentPickupLocation: null,
          lastActiveTime: new Date().toISOString(),
          changedBy: 'driver',
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

    // Handle admin queue validation request
    socket.on('validateQueue', async () => {
      console.log('\n=== ADMIN QUEUE VALIDATION REQUEST ===');
      console.log('Admin ID:', socket.user._id);
      console.log('Admin Role:', socket.user.role);
      
      try {
        // Verify admin role
        if (socket.user.role !== 'admin') {
          console.error('❌ Unauthorized: Only admins can validate queue');
          socket.emit('queueValidationError', { 
            success: false, 
            error: 'Unauthorized: Only admins can validate queue' 
          });
          return;
        }
        
        // Run queue validation
        const isValid = await validateQueueIntegrity();
        
        // Get current queue state
        const queueState = await getCompleteQueueState();
        
        // Send validation result
        socket.emit('queueValidationResult', {
          success: true,
          isValid,
          queueState,
          timestamp: new Date().toISOString(),
          message: isValid ? 'Queue is valid' : 'Queue issues found and fixed'
        });
        
        // If queue was fixed, notify all admins
        if (!isValid) {
          notifyAdmins('queuePositionsUpdated', {
            queueUpdates: queueState,
            totalOnline: queueState.length,
            timestamp: new Date().toISOString(),
            action: 'queue_validation_fix'
          });
        }
        
        console.log(`✅ Queue validation completed by admin ${socket.user._id}`);
        
      } catch (error) {
        console.error('❌ Error during queue validation:', error);
        socket.emit('queueValidationError', { 
          success: false, 
          error: error.message 
        });
      }
    });

    // Handle admin driver status toggle
    socket.on('adminToggleDriverStatus', async (data) => {
      console.log('\n=== ADMIN TOGGLING DRIVER STATUS ===');
      console.log('Admin ID:', socket.user._id);
      console.log('Admin Role:', socket.user.role);
      console.log('Target Driver ID:', data.driverId);
      console.log('New Status:', data.isOnline);
      
      try {
        // Verify admin role
        if (socket.user.role !== 'admin') {
          console.error('❌ Unauthorized: Only admins can toggle driver status');
          socket.emit('adminToggleDriverStatusError', { 
            success: false, 
            error: 'Unauthorized: Only admins can toggle driver status' 
          });
          return;
        }
        
        const driver = await Driver.findById(data.driverId);
        if (!driver) {
          console.error('❌ Driver not found');
          socket.emit('adminToggleDriverStatusError', { 
            success: false, 
            error: 'Driver not found' 
          });
          return;
        }
        
        // Check for potential conflicts - if driver recently changed status
        const recentChangeThreshold = new Date(Date.now() - 3000); // 3 seconds
        if (driver.lastActiveTime && driver.lastActiveTime > recentChangeThreshold && driver.isOnline === data.isOnline) {
          console.log('⚠️ Driver recently changed to same status, possible conflict');
          socket.emit('adminToggleDriverStatusError', { 
            success: false, 
            conflict: true,
            currentState: {
              isOnline: driver.isOnline,
              currentMetroBooth: driver.currentMetroBooth,
              queuePosition: driver.queuePosition
            },
            error: 'Driver recently changed to this status. Current state may be up to date.'
          });
          return;
        }
        
        // Update driver status
        const queueEntryTime = new Date();
        const updateData = {
          isOnline: data.isOnline,
          lastActiveTime: queueEntryTime
        };
        
        // If setting online, set queue entry time
        if (data.isOnline) {
          updateData.queueEntryTime = queueEntryTime;
          console.log(`📋 Admin setting driver ${data.driverId} online with queue entry time: ${queueEntryTime.toISOString()}`);
        } else {
          // If setting offline, clear current booth and queue entry time
          updateData.currentMetroBooth = null;
          updateData.currentPickupLocation = null;
          updateData.queueEntryTime = null;
          console.log(`📋 Admin setting driver ${data.driverId} offline - clearing queue entry time`);
        }
        
        await Driver.findByIdAndUpdate(data.driverId, updateData);
        
        // Update metro station online drivers count
        if (driver.currentMetroBooth) {
          const metroStation = await MetroStation.findOne({ name: driver.currentMetroBooth });
          if (metroStation) {
            if (data.isOnline) {
              await metroStation.incrementOnlineDrivers();
            } else {
              await metroStation.decrementOnlineDrivers();
            }
          }
        }
        
        console.log(`✅ Admin ${socket.user._id} toggled driver ${data.driverId} status to ${data.isOnline ? 'online' : 'offline'}`);
        logRideEvent(`ADMIN-${socket.user._id}`, 'admin_toggle_driver_status', { 
          driverId: data.driverId, 
          newStatus: data.isOnline 
        });
        
        // Find driver socket and notify them
        const driverSocket = connectedClients.get(data.driverId);
        if (driverSocket) {
          driverSocket.emit('statusChangedByAdmin', {
            isOnline: data.isOnline,
            message: `Your status has been changed to ${data.isOnline ? 'online' : 'offline'} by admin`,
            changedBy: 'admin',
            timestamp: new Date().toISOString()
          });
        }
        
        // Update queue positions after admin status change
        console.log('🔄 Updating queue after admin status change...');
        if (data.isOnline) {
          await updateQueueAfterDriverAddition(data.driverId);
        } else {
          await updateQueueAfterDriverRemoval(data.driverId);
        }
        
        // Broadcast comprehensive status update
        broadcastStateChange('driverStatusUpdated', {
          driverId: data.driverId,
          driverName: driver.fullName,
          isOnline: data.isOnline,
          currentPickupLocation: driver.currentPickupLocation,
          lastActiveTime: updateData.lastActiveTime,
          changedBy: 'admin',
          adminId: socket.user._id,
          timestamp: new Date().toISOString()
        });
        
        // Confirm to the admin who made the change
        socket.emit('adminToggleDriverStatusConfirmed', { 
          success: true,
          message: `Driver ${data.isOnline ? 'set online' : 'set offline'} successfully`
        });
        
      } catch (error) {
        console.error('❌ Error toggling driver status:', error);
        socket.emit('adminToggleDriverStatusError', { 
          success: false, 
          error: error.message 
        });
      }
    });

    // DISABLED: Handle ride request broadcasting from API (customer online booking removed)
    socket.on('broadcastRideRequest', async (data) => {
      console.log('\n=== RIDE BROADCAST BLOCKED - CUSTOMER BOOKING DISABLED ===');
      console.log('Attempt blocked for ride ID:', data.rideId);
      
      socket.emit('error', { 
        message: 'Customer online booking is disabled. All rides must be created through admin manual booking.',
        code: 'CUSTOMER_BOOKING_DISABLED'
      });
    });

    // Handle driver accepting a ride with queue management
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
        rideRequest.driverVehicleNo = driver?.vehicleNumber || driver?.vehicleNo || 'Unknown';
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
          boothName: boothName,
          // Driver information
          driverId: driverId,
          driverName: driverName,
          driverPhone: driverPhone,
          vehicleNumber: vehicleDetails?.number || driver?.vehicleNumber || 'Unknown',
          vehicleType: vehicleDetails?.type || rideRequest.vehicleType,
          // OTP information
          startOTP: rideRequest.startOTP,
          endOTP: rideRequest.endOTP,
          // Status
          status: 'driver_assigned',
          acceptedAt: rideRequest.acceptedAt
        };

        // Update driver's current ride
        if (driver) {
          driver.currentRide = rideRequest._id;
          driver.isAvailable = false;
          await driver.save();
        }

        // Notify the accepting driver
        socket.emit('rideAcceptConfirmed', acceptanceData);
        
        // Send queue number to driver
        if (queueInfo && queueInfo.success) {
          socket.emit('queueNumberAssigned', {
            rideId: rideRequest._id.toString(),
            queueNumber: queueInfo.queueNumber,
            queuePosition: queueInfo.queuePosition,
            estimatedWaitTime: queueInfo.estimatedWaitTime,
            totalInQueue: queueInfo.totalInQueue,
            boothName: boothName
          });
        }

        // Notify the customer
        io.to(`user_${rideRequest.userId}`).emit('rideAccepted', acceptanceData);
        
        // Also send queue number to customer
        if (queueInfo && queueInfo.success) {
          io.to(`user_${rideRequest.userId}`).emit('queueNumberAssigned', {
            rideId: rideRequest._id.toString(),
            queueNumber: queueInfo.queueNumber,
            queuePosition: queueInfo.queuePosition,
            estimatedWaitTime: queueInfo.estimatedWaitTime,
            totalInQueue: queueInfo.totalInQueue,
            boothName: boothName
          });
        }

        // Close the ride request to other drivers
        socket.to('drivers').emit('rideRequestClosed', {
          rideId: rideRequest._id.toString()
        });

        // Notify admins
        notifyAdmins('driverAssigned', acceptanceData);
        
        console.log('✅ Ride acceptance complete:', {
          rideId: rideRequest._id,
          driverId: driverId,
          queueNumber: rideRequest.queueNumber
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
      console.log('OTP Type:', typeof data.otp);
      
      try {
        const { rideId, otp } = data;
        
        // Ensure OTP is a string for consistent comparison
        const providedOTP = String(otp).trim();
        
        // Try to find ride by MongoDB ObjectId first, then by rideId field
        let rideRequest = null;
        try {
          rideRequest = await RideRequest.findById(rideId);
          console.log('Found ride by MongoDB ObjectId');
        } catch (error) {
          // If it's not a valid ObjectId, try finding by rideId field
          console.log('Not a valid ObjectId, searching by rideId field...');
          rideRequest = await RideRequest.findOne({ rideId: rideId });
          if (rideRequest) {
            console.log('Found ride by rideId field');
          }
        }
        
        if (!rideRequest) {
          console.error('❌ Ride not found for ID:', rideId);
          const errorResponse = { success: false, message: 'Ride not found' };
          socket.emit('otpVerificationError', errorResponse);
          if (callback) callback(errorResponse);
          return;
        }
        
        // Log ride details for debugging
        console.log('Ride found:', {
          _id: rideRequest._id,
          rideId: rideRequest.rideId,
          status: rideRequest.status,
          startOTP: rideRequest.startOTP,
          startOTPType: typeof rideRequest.startOTP,
          endOTP: rideRequest.endOTP,
          bookingSource: rideRequest.bookingSource
        });
        
        // Ensure stored OTP is also a string
        const storedStartOTP = String(rideRequest.startOTP).trim();
        
        console.log('OTP Comparison:', {
          provided: providedOTP,
          stored: storedStartOTP,
          match: providedOTP === storedStartOTP
        });
        
        // Verify OTP
        if (!verifyOTP(providedOTP, storedStartOTP)) {
          console.error('❌ Invalid start OTP - mismatch');
          const errorResponse = { success: false, message: 'Invalid OTP. Please try again.' };
          socket.emit('otpVerificationError', errorResponse);
          if (callback) callback(errorResponse);
          return;
        }
        
        console.log('✅ Start OTP verified successfully!');
        
        // Update ride status
        rideRequest.status = 'ride_started';
        rideRequest.rideStartedAt = new Date();
        rideRequest.queueStatus = 'in_progress'; // Update queue status
        await rideRequest.save();
        
        console.log('✅ Ride started successfully');
        
        // Log start OTP event
        logRideEvent(rideRequest.rideId, 'ride_started', {
          startedAt: rideRequest.rideStartedAt,
          startOTP: otp,
          verifiedBy: socket.user.role,
          driverId: rideRequest.driverId,
          userId: rideRequest.userId
        });
        
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
          dropLocation: rideRequest.dropLocation,
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

    // Handle driver rejecting a ride
    socket.on('driverRejectRide', async (data, callback) => {
      console.log('\n=== DRIVER REJECTING RIDE ===');
      console.log('Driver Socket ID:', socket.id);
      console.log('Driver ID:', socket.user._id);
      console.log('Reject data:', JSON.stringify(data, null, 2));
      
      try {
        const { rideId, driverId, reason } = data;
        
        // Find the ride request
        const rideRequest = await RideRequest.findById(rideId);
        
        if (!rideRequest) {
          console.error('❌ Ride request not found:', rideId);
          if (callback) callback({ success: false, message: 'Ride request not found' });
          return;
        }
        
        // Check if ride is still pending
        if (rideRequest.status !== 'pending') {
          console.error('❌ Ride is no longer pending:', rideRequest.status);
          if (callback) callback({ success: false, message: 'Ride is no longer available for rejection' });
          return;
        }
        
        console.log('✅ Ride rejection processed');
        
        // Log the rejection
        logDriverAction(driverId, 'ride_rejected', {
          rideId: rideRequest._id,
          bookingId: rideRequest.bookingId,
          reason: reason || 'Driver not available',
          pickupLocation: rideRequest.pickupLocation?.boothName,
          vehicleType: rideRequest.vehicleType
        });
        
        // Notify the driver of successful rejection
        const rejectionResponse = {
          success: true,
          message: 'Ride rejected successfully',
          rideId: rideRequest._id
        };
        
        if (callback) callback(rejectionResponse);
        
        // Notify admins about the rejection
        notifyAdmins('rideRejectedByDriver', {
          rideId: rideRequest._id,
          bookingId: rideRequest.bookingId,
          driverId: driverId,
          driverName: socket.user.fullName || 'Unknown Driver',
          reason: reason || 'Driver not available',
          userName: rideRequest.userName,
          pickupLocation: rideRequest.pickupLocation?.boothName,
          dropLocation: rideRequest.dropLocation?.address,
          vehicleType: rideRequest.vehicleType,
          estimatedFare: rideRequest.estimatedFare,
          timestamp: new Date().toISOString()
        });
        
        console.log('📤 Admin notified of ride rejection');
        
      } catch (error) {
        console.error('❌ Error rejecting ride:', error);
        const errorResponse = {
          success: false,
          message: 'Failed to reject ride',
          error: error.message
        };
        if (callback) callback(errorResponse);
      }
    });

    // Handle OTP verification for ride end
    socket.on('verifyEndOTP', async (data, callback) => {
      console.log('\n=== VERIFYING END OTP ===');
      console.log('Requester:', socket.user.role, socket.user._id);
      console.log('Ride ID:', data.rideId);
      console.log('Provided OTP:', data.otp);
      console.log('OTP Type:', typeof data.otp);
      
      try {
        const { rideId, otp } = data;
        
        // Ensure OTP is a string for consistent comparison
        const providedOTP = String(otp).trim();
        
        // Try to find ride by MongoDB ObjectId first, then by rideId field
        let rideRequest = null;
        try {
          rideRequest = await RideRequest.findById(rideId);
          console.log('Found ride by MongoDB ObjectId');
        } catch (error) {
          // If it's not a valid ObjectId, try finding by rideId field
          console.log('Not a valid ObjectId, searching by rideId field...');
          rideRequest = await RideRequest.findOne({ rideId: rideId });
          if (rideRequest) {
            console.log('Found ride by rideId field');
          }
        }
        
        if (!rideRequest) {
          console.error('❌ Ride not found for ID:', rideId);
          const errorResponse = { success: false, message: 'Ride not found' };
          socket.emit('otpVerificationError', errorResponse);
          if (callback) callback(errorResponse);
          return;
        }
        
        // Log ride details for debugging
        console.log('Ride found:', {
          _id: rideRequest._id,
          rideId: rideRequest.rideId,
          status: rideRequest.status,
          startOTP: rideRequest.startOTP,
          endOTP: rideRequest.endOTP,
          endOTPType: typeof rideRequest.endOTP,
          bookingSource: rideRequest.bookingSource
        });
        
        // Ensure stored OTP is also a string
        const storedEndOTP = String(rideRequest.endOTP).trim();
        
        console.log('OTP Comparison:', {
          provided: providedOTP,
          stored: storedEndOTP,
          match: providedOTP === storedEndOTP
        });
        
        // Verify OTP
        if (!verifyOTP(providedOTP, storedEndOTP)) {
          console.error('❌ Invalid end OTP - mismatch');
          const errorResponse = { success: false, message: 'Invalid OTP. Please try again.' };
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
        
        // Calculate ride duration
        if (rideRequest.rideStartedAt) {
          const durationMs = rideRequest.rideEndedAt - rideRequest.rideStartedAt;
          rideRequest.rideDuration = Math.floor(durationMs / 60000); // Duration in minutes
        }
        
        await rideRequest.save();
        
        // Clear driver's currentRide field and make them available for new rides
        const driver = await Driver.findById(rideRequest.driverId);
        if (driver) {
          driver.currentRide = null;
          await driver.save();
          console.log(`📋 Driver ${driver.fullName} is now available for new rides`);
        }
        
        console.log('✅ Ride ended with driver info:', {
          driverId: rideRequest.driverId,
          driverName: rideRequest.driverName,
          driverPhone: rideRequest.driverPhone,
          driverVehicleNo: rideRequest.driverVehicleNo
        });
        
        console.log('✅ End OTP verified successfully! Ride ending...');
        
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
            dropLocation: rideRequest.dropLocation,
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
        
        // Clear driver's currentRide field if ride was assigned to a driver
        if (rideRequest.driverId) {
          try {
            const driver = await Driver.findById(rideRequest.driverId);
            if (driver && driver.currentRide && driver.currentRide.toString() === rideRequest._id.toString()) {
              driver.currentRide = null;
              await driver.save();
              console.log(`📋 Driver ${driver.fullName} is now available for new rides after cancellation`);
            }
          } catch (driverError) {
            console.error('❌ Error clearing driver currentRide field:', driverError);
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
          dropLocation: rideRequest.dropLocation,
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
      
      // Remove from connected clients map
      connectedClients.delete(socket.user._id);
      console.log(`✅ Client ${socket.user._id} removed from connected clients map`);
      
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

// Standalone function to broadcast ride requests to available drivers
const broadcastRideRequest = async (rideRequest) => {
  console.log('\n=== BROADCASTING RIDE REQUEST ===');
  console.log('Ride ID:', rideRequest._id);
  console.log('Pickup:', rideRequest.pickupLocation?.boothName);
  console.log('Vehicle Type:', rideRequest.vehicleType);
  
  const io = getIO();
  if (!io) {
    console.error('❌ Socket.IO not initialized');
    return { 
      success: false, 
      error: 'Socket service not available',
      driversNotified: 0
    };
  }

  try {
    // Prepare ride data for broadcast
    const rideData = {
      _id: rideRequest._id,
      rideId: rideRequest.rideId,
      pickupLocation: {
        boothName: rideRequest.pickupLocation.boothName,
        latitude: rideRequest.pickupLocation.latitude,
        longitude: rideRequest.pickupLocation.longitude
      },
      dropLocation: {
        address: rideRequest.dropLocation.address,
        latitude: rideRequest.dropLocation.latitude,
        longitude: rideRequest.dropLocation.longitude
      },
      vehicleType: rideRequest.vehicleType,
      estimatedFare: rideRequest.estimatedFare,
      distance: rideRequest.distance,
      startOTP: rideRequest.startOTP,
      userName: rideRequest.userName,
      userPhone: rideRequest.userPhone,
      status: 'pending',
      timestamp: rideRequest.timestamp || new Date()
    };

    // Broadcast to all drivers
    const driversRoom = io.sockets.adapter.rooms.get('drivers');
    const driversInRoom = driversRoom ? driversRoom.size : 0;
    
    console.log(`📢 Broadcasting to ${driversInRoom} drivers in 'drivers' room`);
    io.to('drivers').emit('newRideRequest', rideData);

    // Also broadcast to admin room for monitoring
    const adminRoom = io.sockets.adapter.rooms.get('admin-room');
    const adminsInRoom = adminRoom ? adminRoom.size : 0;
    
    console.log(`📢 Broadcasting to ${adminsInRoom} admins in 'admin-room'`);
    io.to('admin-room').emit('customerRideRequest', {
      ...rideData,
      message: 'New customer ride request',
      needsAssignment: true
    });

    // Find online drivers at the pickup station and notify them specifically
    const Driver = require('./models/Driver');
    const onlineDrivers = await Driver.find({
      isOnline: true,
      currentMetroBooth: rideRequest.pickupLocation.boothName,
      vehicleType: rideRequest.vehicleType,
      currentRide: null
    }).select('_id fullName');

    console.log(`🎯 Found ${onlineDrivers.length} eligible drivers at ${rideRequest.pickupLocation.boothName}`);
    
    // Send targeted notifications to eligible drivers
    let targetedNotifications = 0;
    for (const driver of onlineDrivers) {
      const driverRoom = `driver_${driver._id}`;
      io.to(driverRoom).emit('newRideRequest', {
        ...rideData,
        targetedNotification: true,
        message: `New ride request at your station: ${rideRequest.pickupLocation.boothName}`
      });
      targetedNotifications++;
    }

    console.log(`✅ Ride broadcast completed:`);
    console.log(`   - Drivers room: ${driversInRoom} connections`);
    console.log(`   - Admin room: ${adminsInRoom} connections`);
    console.log(`   - Targeted notifications: ${targetedNotifications} drivers`);

    return { 
      success: true, 
      driversNotified: Math.max(driversInRoom, targetedNotifications),
      adminsNotified: adminsInRoom,
      broadcastMethod: 'socket',
      eligibleDrivers: onlineDrivers.map(d => ({ id: d._id, name: d.fullName }))
    };

  } catch (error) {
    console.error('❌ Error broadcasting ride request:', error);
    return { 
      success: false, 
      error: error.message,
      driversNotified: 0
    };
  }
};

// Export function to get services for admin tools
const getServices = () => ({
  enhancedNotificationService,
  rideCompletionService,
  io
});

// Function to send ride request to specific driver only
const sendRideRequestToDriver = async (rideRequest, driverId) => {
  console.log('\n=== SENDING RIDE REQUEST TO SPECIFIC DRIVER ===');
  console.log('Ride ID:', rideRequest._id);
  console.log('Target Driver ID:', driverId);
  console.log('Pickup:', rideRequest.pickupLocation?.boothName);
  console.log('Vehicle Type:', rideRequest.vehicleType);
  
  const io = getIO();
  if (!io) {
    console.error('❌ Socket.IO not initialized');
    return { 
      success: false, 
      error: 'Socket service not available',
      driverNotified: false
    };
  }

  try {
    // Prepare ride data for the driver
    const rideData = {
      _id: rideRequest._id,
      rideId: rideRequest.rideId,
      bookingId: rideRequest.bookingId,
      pickupLocation: {
        boothName: rideRequest.pickupLocation.boothName,
        latitude: rideRequest.pickupLocation.latitude,
        longitude: rideRequest.pickupLocation.longitude
      },
      dropLocation: {
        address: rideRequest.dropLocation.address,
        latitude: rideRequest.dropLocation.latitude,
        longitude: rideRequest.dropLocation.longitude
      },
      vehicleType: rideRequest.vehicleType,
      estimatedFare: rideRequest.estimatedFare,
      distance: rideRequest.distance,
      startOTP: rideRequest.startOTP,
      endOTP: rideRequest.endOTP,
      userName: rideRequest.userName,
      userPhone: rideRequest.userPhone,
      status: 'pending',
      timestamp: rideRequest.timestamp || new Date(),
      isManualBooking: true,
      bookingSource: 'manual',
      queueNumber: rideRequest.queueNumber
    };

    // Convert driverId to string for comparison
    const driverIdString = driverId.toString();
    const driverRoom = `driver_${driverIdString}`;
    
    // Function to find driver socket
    const findDriverSocket = () => {
      const allSockets = io.sockets.sockets;
      for (const [socketId, socket] of allSockets) {
        if (socket.user && 
            socket.user._id.toString() === driverIdString && 
            socket.user.role === 'driver') {
          return socket;
        }
      }
      return null;
    };

    // Function to send ride request with retry
    const sendWithRetry = async (retries = 3, delay = 1000) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`\n📤 Attempt ${attempt}/${retries} to send ride request to driver ${driverIdString}`);
        
        // Try to find driver socket
        const driverSocket = findDriverSocket();
        
        if (driverSocket) {
          console.log(`✅ Found driver socket ${driverSocket.id}`);
          
          // Ensure driver is in their room
          const rooms = Array.from(driverSocket.rooms);
          if (!rooms.includes(driverRoom)) {
            console.log(`⚠️ Driver not in room ${driverRoom}, joining now...`);
            driverSocket.join(driverRoom);
            // Small delay to ensure room join is processed
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Send via both methods for reliability
          console.log(`📨 Sending ride request via direct socket and room...`);
          
          // Direct socket emission with acknowledgment
          const directSent = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 5000);
            
            driverSocket.emit('newRideRequest', rideData, (ack) => {
              clearTimeout(timeout);
              console.log('✅ Driver acknowledged ride request:', ack);
              resolve(true);
            });
          });
          
          // Also emit to room
          io.to(driverRoom).emit('newRideRequest', rideData);
          
          // Verify room size after sending
          const roomSize = io.sockets.adapter.rooms.get(driverRoom)?.size || 0;
          console.log(`📊 Driver room ${driverRoom} has ${roomSize} connections`);
          
          return {
            success: true,
            driverNotified: true,
            driverId: driverIdString,
            method: directSent ? 'direct_socket_acknowledged' : 'room_broadcast',
            driverSocketFound: true,
            roomSize: roomSize,
            attempt: attempt
          };
        } else {
          console.log(`⚠️ Driver socket not found on attempt ${attempt}`);
          
          // Check if driver might be reconnecting
          if (attempt < retries) {
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5; // Exponential backoff
          }
        }
      }
      
      // All retries failed
      return null;
    };

    // Log all connected sockets for debugging
    console.log('\n🔍 DEBUGGING: All connected sockets:');
    const allSockets = io.sockets.sockets;
    let driverSocketsFound = 0;
    for (const [socketId, socket] of allSockets) {
      if (socket.user) {
        console.log(`   Socket ${socketId}:`);
        console.log(`     - user._id: ${socket.user._id} (type: ${typeof socket.user._id})`);
        console.log(`     - role: ${socket.user.role}`);
        console.log(`     - fullName: ${socket.user.fullName}`);
        console.log(`     - vehicleType: ${socket.user.vehicleType}`);
        console.log(`     - currentMetroBooth: ${socket.user.currentMetroBooth}`);
        console.log(`     - Comparing with target: ${socket.user._id.toString() === driverIdString ? '✅ MATCH' : '❌ NO MATCH'}`);
        
        if (socket.user.role === 'driver') {
          driverSocketsFound++;
          console.log(`      -> Driver socket, rooms:`, Array.from(socket.rooms));
        }
      }
    }
    console.log(`   Total driver sockets found: ${driverSocketsFound}`);
    console.log(`   Looking for driver ID: ${driverIdString}`);
    
    // Try to send with retry logic
    const result = await sendWithRetry();
    
    if (result && result.success) {
      console.log(`✅ Successfully sent ride request to driver after ${result.attempt} attempt(s)`);
      
      // Notify admin room
      io.to('admin-room').emit('manualBookingSentToDriver', {
        rideId: rideRequest._id,
        bookingId: rideRequest.bookingId,
        driverId: driverIdString,
        status: 'pending',
        timestamp: new Date(),
        attempt: result.attempt
      });
      
      return result;
    } else {
      console.error(`❌ Failed to send ride request to driver ${driverIdString} after all retries`);
      
      // Notify admin room of failure
      io.to('admin-room').emit('manualBookingFailedToSend', {
        rideId: rideRequest._id,
        bookingId: rideRequest.bookingId,
        driverId: driverIdString,
        error: 'Driver not online or not reachable',
        timestamp: new Date()
      });
      
      return {
        success: false,
        error: 'Driver not online - could not establish connection after retries',
        driverNotified: false,
        driverId: driverIdString
      };
    }

  } catch (error) {
    console.error('❌ Error sending ride request to driver:', error);
    return { 
      success: false, 
      error: error.message,
      driverNotified: false
    };
  }
};

module.exports = {
  initializeSocket,
  getIO,
  broadcastRideRequest,
  sendRideRequestToDriver,
  notifyAdmins,
  getServices
};