// routes/drivers.js
const express = require('express');
const router = express.Router();
const { dualUploadFields, dualStorageManager } = require('../config/dualStorage');
const { protect } = require('../middleware/auth');
const {
  registerDriver,
  loginDriver,
  getDriverProfile,
  updateDriverLocation
} = require('../controllers/driverController');
const Driver = require('../models/Driver');
const MetroStation = require('../models/MetroStation');
const PickupLocation = require('../models/PickupLocation');
const { logDriverAction } = require('../utils/rideLogger');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getIO } = require('../socket');

// Configure multer for multiple files with dual storage
const driverDocumentUpload = dualUploadFields;

// Public routes
router.post('/register', driverDocumentUpload, async (req, res, next) => {
  try {
    console.log('[Middleware] Processing file uploads with dual storage');
    console.log('[Middleware] req.files:', req.files ? Object.keys(req.files) : 'No files');
    
    // Process file uploads with dual storage
    if (req.files) {
      console.log('[Middleware] Processing uploads with dual storage manager');
      const { results, errors } = await dualStorageManager.processUploads(req.files, req);
      req.uploadResults = results;
      req.uploadErrors = errors;
      console.log('[Middleware] Upload processing complete. Results:', Object.keys(results || {}));
      console.log('[Middleware] Upload errors:', errors);
    } else {
      console.log('[Middleware] No files found in request');
      req.uploadResults = {};
      req.uploadErrors = [];
    }
    next();
  } catch (error) {
    console.error('❌ File upload processing error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message
    });
  }
}, registerDriver);
router.post('/login', loginDriver);

// Protected routes
router.get('/profile', protect, getDriverProfile);
router.put('/location', protect, updateDriverLocation);

// Get all pickup locations for driver booth selection
router.get('/pickup-locations', async (req, res) => {
  try {
    console.log('\n=== GET PICKUP LOCATIONS FOR DRIVER ===');
    console.log('Public endpoint - no authentication required');
    
    // Check database connection
    if (require('mongoose').connection.readyState !== 1) {
      console.error('❌ Database not connected');
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        error: 'Database not connected'
      });
    }
    
    // Get statistics from PickupLocation model
    const totalLocations = await PickupLocation.countDocuments();
    const activeLocations = await PickupLocation.countDocuments({ isActive: true });
    
    console.log(`📊 Database stats: ${totalLocations} total locations, ${activeLocations} active`);
    
    // Get all active pickup locations
    const locations = await PickupLocation.find({ isActive: true })
      .select('id name type subType line lat lng address priority onlineDrivers')
      .sort({ priority: -1, type: 1, name: 1 });
    
    // Group locations by type
    const locationsByType = {};
    
    locations.forEach(location => {
      if (!locationsByType[location.type]) {
        locationsByType[location.type] = [];
      }
      locationsByType[location.type].push({
        id: location.id,
        name: location.name,
        type: location.type,
        subType: location.subType,
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        line: location.line,
        priority: location.priority,
        onlineDrivers: location.onlineDrivers || 0
      });
    });
    
    // Get type statistics
    const typeStats = await PickupLocation.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 }, totalDrivers: { $sum: '$onlineDrivers' } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log(`✅ Returning ${locations.length} pickup locations for driver booth selection`);
    console.log(`📋 Types available: ${Object.keys(locationsByType).join(', ')}`);
    
    res.json({
      success: true,
      data: {
        // All locations in a flat array
        locations: locations.map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          subType: l.subType,
          line: l.line,
          lat: l.lat,
          lng: l.lng,
          address: l.address,
          priority: l.priority,
          onlineDrivers: l.onlineDrivers || 0
        })),
        
        // Grouped by type
        locationsByType,
        
        // Summary counts
        totalLocations: locations.length,
        typeStats: typeStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            onlineDrivers: stat.totalDrivers || 0
          };
          return acc;
        }, {})
      },
      meta: {
        totalInDb: totalLocations,
        activeInDb: activeLocations,
        returned: locations.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting pickup locations for driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting pickup locations',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Go online at a specific pickup location booth
router.post('/go-online', protect, async (req, res) => {
  try {
    const { pickupLocationName, vehicleType, location } = req.body;
    const driverId = req.user.id;
    
    console.log('\n=== DRIVER GO ONLINE REQUEST ===');
    console.log('Driver ID:', driverId);
    console.log('Pickup Location:', pickupLocationName);
    console.log('Vehicle Type:', vehicleType);
    console.log('Location:', location);
    
    // Validate input
    if (!pickupLocationName || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: 'Pickup location and vehicle type are required'
      });
    }
    
    // Check if pickup location exists (try new model first, fallback to old model)
    let pickupLocation = await PickupLocation.findOne({ name: pickupLocationName, isActive: true });
    
    if (!pickupLocation) {
      // Fallback to MetroStation model for backward compatibility
      const metroStation = await MetroStation.findOne({ name: pickupLocationName });
      if (metroStation) {
        pickupLocation = {
          name: metroStation.name,
          type: 'metro',
          line: metroStation.line,
          incrementDriverCount: () => metroStation.incrementOnlineDrivers()
        };
      }
    }
    
    if (!pickupLocation) {
      return res.status(404).json({
        success: false,
        message: 'Pickup location not found'
      });
    }
    
    // Update driver status
    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      {
        isOnline: true,
        currentMetroBooth: pickupLocationName, // Keep field name for backward compatibility
        currentPickupLocation: pickupLocationName, // New field for pickup location
        vehicleType: vehicleType,
        location: location ? {
          type: 'Point',
          coordinates: [location.lng, location.lat],
          lastUpdated: new Date()
        } : undefined,
        lastActiveTime: new Date()
      },
      { new: true }
    );
    
    if (!updatedDriver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Update pickup location driver count
    if (pickupLocation.incrementDriverCount) {
      await pickupLocation.incrementDriverCount();
    } else {
      // For PickupLocation model
      await PickupLocation.findOneAndUpdate(
        { name: pickupLocationName },
        { $inc: { onlineDrivers: 1 } }
      );
    }
    
    // Log driver action
    logDriverAction(driverId, 'go_online', {
      pickupLocationName,
      locationType: pickupLocation.type || 'metro',
      vehicleType,
      location
    });
    
    console.log(`✅ Driver ${driverId} is now online at ${metroBoothName} with ${vehicleType}`);
    
    res.json({
      success: true,
      message: `You are now online at ${metroBoothName}`,
      data: {
        driverId: updatedDriver._id,
        metroBoothName,
        vehicleType,
        isOnline: true,
        location: updatedDriver.location
      }
    });
    
  } catch (error) {
    console.error('❌ Error in go-online:', error);
    res.status(500).json({
      success: false,
      message: 'Error going online',
      error: error.message
    });
  }
});

// Go offline
router.post('/go-offline', protect, async (req, res) => {
  try {
    const driverId = req.user.id;
    
    console.log('\n=== DRIVER GO OFFLINE REQUEST ===');
    console.log('Driver ID:', driverId);
    
    // Get current driver data
    const currentDriver = await Driver.findById(driverId);
    if (!currentDriver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    const previousMetroBooth = currentDriver.currentMetroBooth;
    
    // Update driver status
    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      {
        isOnline: false,
        currentMetroBooth: null,
        lastActiveTime: new Date()
      },
      { new: true }
    );
    
    // Update metro station driver count
    if (previousMetroBooth) {
      const metroStation = await MetroStation.findOne({ name: previousMetroBooth });
      if (metroStation) {
        await metroStation.decrementOnlineDrivers();
      }
    }
    
    // Log driver action
    logDriverAction(driverId, 'go_offline', {
      previousMetroBooth
    });
    
    console.log(`✅ Driver ${driverId} is now offline`);
    
    res.json({
      success: true,
      message: 'You are now offline',
      data: {
        driverId: updatedDriver._id,
        isOnline: false,
        previousMetroBooth
      }
    });
    
  } catch (error) {
    console.error('❌ Error in go-offline:', error);
    res.status(500).json({
      success: false,
      message: 'Error going offline',
      error: error.message
    });
  }
});

// Update vehicle type
router.put('/vehicle-type', protect, async (req, res) => {
  try {
    const { vehicleType } = req.body;
    const driverId = req.user.id;
    
    console.log('\n=== UPDATE VEHICLE TYPE REQUEST ===');
    console.log('Driver ID:', driverId);
    console.log('New Vehicle Type:', vehicleType);
    
    // Validate vehicle type
    const validTypes = ['bike', 'auto', 'car'];
    if (!validTypes.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle type. Must be: bike, auto, or car'
      });
    }
    
    // Update driver vehicle type
    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      { vehicleType: vehicleType },
      { new: true }
    );
    
    if (!updatedDriver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Log driver action
    logDriverAction(driverId, 'update_vehicle_type', {
      newVehicleType: vehicleType,
      previousVehicleType: req.body.previousVehicleType
    });
    
    console.log(`✅ Driver ${driverId} vehicle type updated to ${vehicleType}`);
    
    res.json({
      success: true,
      message: `Vehicle type updated to ${vehicleType}`,
      data: {
        driverId: updatedDriver._id,
        vehicleType: updatedDriver.vehicleType
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating vehicle type:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating vehicle type',
      error: error.message
    });
  }
});

// Get driver dashboard data
router.get('/dashboard', protect, async (req, res) => {
  try {
    const driverId = req.user.id;
    
    console.log('\n=== DRIVER DASHBOARD REQUEST ===');
    console.log('Driver ID:', driverId);
    
    // Get driver data
    const driver = await Driver.findById(driverId).select('-password');
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Get recent ride statistics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const RideRequest = require('../models/RideRequest');
    const recentRides = await RideRequest.find({
      driverId: driverId,
      timestamp: { $gte: thirtyDaysAgo }
    }).sort({ timestamp: -1 });
    
    // Calculate statistics
    const stats = {
      totalRides: driver.totalRides || 0,
      totalEarnings: driver.totalEarnings || 0,
      rating: driver.rating || 0,
      recentRides: recentRides.length,
      recentEarnings: recentRides.reduce((sum, ride) => sum + (ride.actualFare || ride.estimatedFare || 0), 0)
    };
    
    // Get current metro station info if online
    let currentStationInfo = null;
    if (driver.isOnline && driver.currentMetroBooth) {
      currentStationInfo = await MetroStation.findOne({ name: driver.currentMetroBooth });
    }
    
    const dashboardData = {
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        mobileNo: driver.mobileNo,
        vehicleType: driver.vehicleType,
        vehicleNo: driver.vehicleNo,
        isOnline: driver.isOnline,
        currentMetroBooth: driver.currentMetroBooth,
        isVerified: driver.isVerified,
        rating: driver.rating,
        lastActiveTime: driver.lastActiveTime
      },
      stats,
      currentStation: currentStationInfo ? {
        name: currentStationInfo.name,
        line: currentStationInfo.line,
        onlineDrivers: currentStationInfo.onlineDrivers
      } : null,
      recentRides: recentRides.slice(0, 5).map(ride => ({
        rideId: ride._id,
        uniqueRideId: ride.rideId,
        status: ride.status,
        fare: ride.actualFare || ride.estimatedFare,
        timestamp: ride.timestamp,
        pickupLocation: ride.pickupLocation,
        dropLocation: ride.dropLocation
      }))
    };
    
    console.log(`✅ Dashboard data retrieved for driver ${driverId}`);
    
    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('❌ Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting dashboard data',
      error: error.message
    });
  }
});

// Debug route to check token
router.get('/check-token', protect, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      res.json({
        success: true,
        decoded,
        hasRole: !!decoded.role,
        role: decoded.role || 'not set'
      });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  } else {
    res.json({ success: false, error: 'No token' });
  }
});

// @desc    Get all metro stations for driver metro booth selection
// @route   GET /api/drivers/metro-stations
// @access  Public (no auth required)
router.get('/metro-stations', async (req, res) => {
  try {
    console.log('\n=== GET METRO STATIONS FOR DRIVER ===');
    console.log('Request headers:', req.headers);
    console.log('Database connection state:', require('mongoose').connection.readyState);
    
    // Check database connection
    if (require('mongoose').connection.readyState !== 1) {
      console.error('❌ Database not connected');
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        error: 'Database not connected'
      });
    }
    
    // Test basic MetroStation model access
    const totalStations = await MetroStation.countDocuments();
    const activeStations = await MetroStation.countDocuments({ isActive: true });
    
    console.log(`📊 Database stats: ${totalStations} total stations, ${activeStations} active`);
    
    const stations = await MetroStation.find({ isActive: true })
      .select('id name line lat lng')
      .sort({ line: 1, name: 1 });
    
    // Group stations by line for better UX
    const stationsByLine = {};
    stations.forEach(station => {
      if (!stationsByLine[station.line]) {
        stationsByLine[station.line] = [];
      }
      stationsByLine[station.line].push({
        id: station.id,
        name: station.name,
        lat: station.lat,
        lng: station.lng
      });
    });
    
    console.log(`✅ Returning ${stations.length} metro stations for driver`);
    console.log(`📋 Lines available: ${Object.keys(stationsByLine).join(', ')}`);
    
    res.json({
      success: true,
      data: {
        stations: stations.map(s => ({
          id: s.id,
          name: s.name,
          line: s.line,
          lat: s.lat,
          lng: s.lng
        })),
        stationsByLine,
        totalStations: stations.length
      },
      meta: {
        totalInDb: totalStations,
        activeInDb: activeStations,
        returned: stations.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting metro stations for driver:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error getting metro stations',
      error: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to test metro station loading
router.get('/debug/metro-stations', async (req, res) => {
  try {
    console.log('\n=== DEBUG METRO STATIONS ===');
    
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    // Database connection info
    const dbInfo = {
      state: dbStates[dbState] || 'unknown',
      stateCode: dbState,
      name: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port
    };
    
    console.log('Database info:', dbInfo);
    
    // Try to get metro stations
    let stationsResult = null;
    let stationsError = null;
    
    try {
      const totalStations = await MetroStation.countDocuments();
      const activeStations = await MetroStation.countDocuments({ isActive: true });
      const sampleStations = await MetroStation.find({ isActive: true }).limit(3);
      
      stationsResult = {
        totalStations,
        activeStations,
        sampleStations: sampleStations.map(s => ({
          id: s.id,
          name: s.name,
          line: s.line,
          isActive: s.isActive
        }))
      };
      
    } catch (error) {
      stationsError = {
        message: error.message,
        name: error.name,
        stack: error.stack
      };
    }
    
    // Test MetroStation model directly
    let modelTest = null;
    try {
      const MetroStationModel = require('../models/MetroStation');
      modelTest = {
        modelExists: !!MetroStationModel,
        modelName: MetroStationModel.modelName || 'unknown',
        collection: MetroStationModel.collection?.name || 'unknown'
      };
    } catch (error) {
      modelTest = { error: error.message };
    }
    
    res.json({
      success: true,
      debug: {
        database: dbInfo,
        stations: stationsResult,
        stationsError: stationsError,
        model: modelTest,
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
        mongoUrl: process.env.MONGO_URL ? 'Set' : 'Not set'
      }
    });
    
  } catch (error) {
    console.error('❌ Debug metro stations error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// @desc    Collect payment for a completed ride
// @route   POST /api/drivers/collect-payment
// @access  Private (Driver only)
router.post('/collect-payment', protect, async (req, res) => {
  try {
    const { rideId, paymentMethod = 'cash' } = req.body;
    const driverId = req.user.id;
    
    console.log('\n=== PAYMENT COLLECTION ===');
    console.log('Driver ID:', driverId);
    console.log('Ride ID:', rideId);
    console.log('Payment Method:', paymentMethod);
    
    // Find the ride request
    const RideRequest = require('../models/RideRequest');
    const rideRequest = await RideRequest.findById(rideId);
    
    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }
    
    // Verify the driver owns this ride
    if (rideRequest.driverId.toString() !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to collect payment for this ride'
      });
    }
    
    // Check if ride is in the correct status
    if (rideRequest.status !== 'ride_ended') {
      return res.status(400).json({
        success: false,
        message: 'Ride must be ended before collecting payment'
      });
    }
    
    // Check if payment already collected
    if (rideRequest.paymentStatus === 'collected') {
      return res.status(400).json({
        success: false,
        message: 'Payment already collected for this ride'
      });
    }
    
    // Update payment status
    rideRequest.paymentStatus = 'collected';
    rideRequest.paymentCollectedAt = new Date();
    rideRequest.paymentMethod = paymentMethod;
    rideRequest.status = 'completed';
    rideRequest.completedAt = new Date();
    await rideRequest.save();
    
    // Log the payment collection
    logDriverAction(driverId, 'payment_collected', {
      rideId: rideRequest.rideId,
      boothRideNumber: rideRequest.boothRideNumber,
      amount: rideRequest.actualFare || rideRequest.estimatedFare,
      paymentMethod: paymentMethod
    });
    
    // Notify user via socket
    const io = require('../socket').getIO();
    io.to(`user_${rideRequest.userId}`).emit('paymentCollected', {
      rideId: rideRequest._id,
      uniqueRideId: rideRequest.rideId,
      boothRideNumber: rideRequest.boothRideNumber,
      amount: rideRequest.actualFare || rideRequest.estimatedFare,
      paymentMethod: paymentMethod,
      collectedAt: new Date().toISOString()
    });
    
    console.log(`✅ Payment collected for ride ${rideRequest.rideId}`);
    
    res.json({
      success: true,
      message: 'Payment collected successfully',
      data: {
        rideId: rideRequest._id,
        boothRideNumber: rideRequest.boothRideNumber,
        amount: rideRequest.actualFare || rideRequest.estimatedFare,
        paymentMethod: paymentMethod,
        status: 'completed'
      }
    });
    
  } catch (error) {
    console.error('❌ Error collecting payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error collecting payment',
      error: error.message
    });
  }
});

// @desc    Create a test driver for debugging
// @route   POST /api/drivers/create-test-driver
// @access  Public (for testing)
router.post('/create-test-driver', async (req, res) => {
  try {
    console.log('\n=== CREATING TEST DRIVER ===');
    
    // Check if test driver already exists
    const existingDriver = await Driver.findOne({ 
      mobileNo: '9999999999' 
    });
    
    if (existingDriver) {
      console.log('Test driver already exists:', existingDriver._id);
      
      // Generate JWT token for existing driver
      const token = jwt.sign(
        { 
          id: existingDriver._id,
          role: 'driver'
        },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '30d' }
      );
      
      return res.json({
        success: true,
        message: 'Test driver already exists',
        token,
        driver: {
          id: existingDriver._id,
          fullName: existingDriver.fullName,
          mobileNo: existingDriver.mobileNo,
          vehicleType: existingDriver.vehicleType,
          vehicleNo: existingDriver.vehicleNo,
          isVerified: existingDriver.isVerified,
          role: 'driver'
        }
      });
    }
    
    // Create new test driver
    const testDriverData = {
      fullName: 'Test Driver',
      mobileNo: '9999999999',
      aadhaarNo: '999999999999',
      vehicleNo: 'DL01AB9999',
      vehicleType: 'auto',
      drivingLicenseNo: 'DL999999999999',
      permitNo: 'PERMIT999999',
      fitnessCertificateNo: 'FITNESS999999',
      insurancePolicyNo: 'INSURANCE999999',
      bankDetails: {
        accountHolderName: 'Test Driver',
        accountNumber: '9999999999999999',
        ifscCode: 'TEST0009999',
        bankName: 'Test Bank'
      },
      password: await bcrypt.hash('testdriver123', 10),
      isVerified: true,
      isOnline: false
    };
    
    const testDriver = await Driver.create(testDriverData);
    
    console.log('✅ Test driver created:', testDriver._id);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: testDriver._id,
        role: 'driver'
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      message: 'Test driver created successfully',
      token,
      driver: {
        id: testDriver._id,
        fullName: testDriver.fullName,
        mobileNo: testDriver.mobileNo,
        vehicleType: testDriver.vehicleType,
        vehicleNo: testDriver.vehicleNo,
        isVerified: testDriver.isVerified,
        role: 'driver'
      },
      credentials: {
        mobile: '9999999999',
        password: 'testdriver123'
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating test driver:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test driver',
      message: error.message
    });
  }
});

// Debug endpoint to check driver online status and socket connections
router.get('/debug/status', async (req, res) => {
  try {
    console.log('\n=== DRIVER DEBUG STATUS CHECK ===');
    
    const io = getIO();
    if (!io) {
      return res.status(500).json({
        success: false,
        error: 'Socket.IO not initialized'
      });
    }
    
    // Get all drivers
    const allDrivers = await Driver.find({}).select('fullName mobileNo isOnline currentMetroBooth vehicleType lastActiveTime');
    const onlineDrivers = await Driver.find({ isOnline: true });
    
    // Get socket room information
    const driversRoom = io.sockets.adapter.rooms.get('drivers');
    const driversInRoom = driversRoom ? driversRoom.size : 0;
    
    // Get individual driver rooms
    const driverRooms = [];
    onlineDrivers.forEach(driver => {
      const roomName = `driver_${driver._id}`;
      const room = io.sockets.adapter.rooms.get(roomName);
      driverRooms.push({
        driverId: driver._id.toString(),
        driverName: driver.fullName,
        roomName: roomName,
        socketsInRoom: room ? room.size : 0,
        isOnline: driver.isOnline,
        currentMetroBooth: driver.currentMetroBooth,
        vehicleType: driver.vehicleType
      });
    });
    
    // Get all socket rooms for debugging
    const allRooms = {};
    io.sockets.adapter.rooms.forEach((sockets, roomName) => {
      if (!roomName.startsWith('/')) { // Skip internal socket.io rooms
        allRooms[roomName] = sockets.size;
      }
    });
    
    const debugInfo = {
      summary: {
        totalDrivers: allDrivers.length,
        onlineDrivers: onlineDrivers.length,
        driversInSocketRoom: driversInRoom,
        timestamp: new Date().toISOString()
      },
      onlineDriversDetail: onlineDrivers.map(driver => ({
        id: driver._id.toString(),
        name: driver.fullName,
        phone: driver.mobileNo,
        isOnline: driver.isOnline,
        currentMetroBooth: driver.currentMetroBooth,
        vehicleType: driver.vehicleType,
        lastActiveTime: driver.lastActiveTime
      })),
      socketRooms: {
        driversRoom: driversInRoom,
        individualDriverRooms: driverRooms,
        allRooms: allRooms
      },
      allDriversStatus: allDrivers.map(driver => ({
        id: driver._id.toString(),
        name: driver.fullName,
        phone: driver.mobileNo,
        isOnline: driver.isOnline,
        currentMetroBooth: driver.currentMetroBooth || 'Not set',
        vehicleType: driver.vehicleType,
        lastActiveTime: driver.lastActiveTime
      }))
    };
    
    console.log('Debug info generated:', {
      totalDrivers: debugInfo.summary.totalDrivers,
      onlineDrivers: debugInfo.summary.onlineDrivers,
      driversInRoom: debugInfo.summary.driversInSocketRoom
    });
    
    res.json({
      success: true,
      data: debugInfo
    });
    
  } catch (error) {
    console.error('❌ Error getting driver debug status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get driver debug status',
      message: error.message
    });
  }
});

// Debug endpoint to test ride request broadcast
router.post('/debug/test-broadcast', protect, async (req, res) => {
  try {
    console.log('\n=== TESTING RIDE REQUEST BROADCAST ===');
    console.log('Requester:', req.driver.fullName);
    
    const { pickupStation, vehicleType } = req.body;
    
    if (!pickupStation || !vehicleType) {
      return res.status(400).json({
        success: false,
        error: 'pickupStation and vehicleType are required'
      });
    }
    
    const io = getIO();
    if (!io) {
      return res.status(500).json({
        success: false,
        error: 'Socket.IO not initialized'
      });
    }
    
    // Create test ride request data
    const testRideData = {
      _id: 'test_' + Date.now(),
      rideId: 'TEST-' + Date.now(),
      userId: 'test_user_id',
      userName: 'Test User',
      userPhone: '9999999999',
      pickupLocation: {
        boothName: pickupStation,
        latitude: 28.6139,
        longitude: 77.2090
      },
      dropLocation: {
        address: 'Test Drop Location',
        latitude: 28.6239,
        longitude: 77.2190
      },
      vehicleType: vehicleType,
      fare: 50,
      estimatedFare: 50,
      distance: 5,
      status: 'pending',
      timestamp: new Date().toISOString(),
      requestNumber: 'TEST-' + Date.now(),
      boothRideNumber: 'TEST-BOOTH-001'
    };
    
    console.log('Broadcasting test ride request:', testRideData);
    
    // Broadcast to all drivers (test broadcast)
    io.to('drivers').emit('newRideRequest', testRideData);
    console.log('✅ Test broadcast sent to drivers room');
    
    // Also send to specific online drivers
    const onlineDrivers = await Driver.find({ isOnline: true });
    let specificBroadcasts = 0;
    
    onlineDrivers.forEach(driver => {
      const driverRoom = `driver_${driver._id}`;
      io.to(driverRoom).emit('newRideRequest', testRideData);
      console.log(`📤 Test broadcast sent to ${driverRoom} (${driver.fullName})`);
      specificBroadcasts++;
    });
    
    res.json({
      success: true,
      message: 'Test broadcast sent successfully',
      data: {
        testRideData: testRideData,
        onlineDriversTargeted: specificBroadcasts,
        broadcastTimestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing broadcast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test broadcast',
      message: error.message
    });
  }
});

// @desc    Get driver ride history
// @route   GET /api/drivers/ride-history
// @access  Private (Driver only)
router.get('/ride-history', protect, async (req, res) => {
  try {
    const driverId = req.user.id;
    const { page = 1, limit = 10, status = 'all', startDate, endDate } = req.query;
    
    console.log('\\n=== DRIVER RIDE HISTORY REQUEST ===');
    console.log('Driver ID:', driverId);
    console.log('Query params:', { page, limit, status, startDate, endDate });
    
    // Import RideHistory model
    const RideHistory = require('../models/RideHistory');
    
    // Build query filter
    const filter = { driverId: driverId };
    
    // Add status filter
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Add date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Get total count for pagination
    const totalRides = await RideHistory.countDocuments(filter);
    
    // Get ride history with user details
    const rideHistory = await RideHistory.find(filter)
      .populate('userId', 'name mobileNo email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // Calculate summary statistics
    const completedRides = await RideHistory.countDocuments({ ...filter, status: 'completed' });
    const cancelledRides = await RideHistory.countDocuments({ ...filter, status: 'cancelled' });
    const totalEarnings = await RideHistory.aggregate([
      { $match: { ...filter, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$actualFare' } } }
    ]);
    
    const analytics = {
      totalRides,
      completedRides,
      cancelledRides,
      totalEarnings: totalEarnings.length > 0 ? totalEarnings[0].total : 0,
      averageEarnings: completedRides > 0 ? (totalEarnings.length > 0 ? totalEarnings[0].total / completedRides : 0) : 0
    };
    
    console.log(`✅ Retrieved ${rideHistory.length} rides for driver ${driverId}`);
    
    res.json({
      success: true,
      data: {
        rideHistory,
        analytics,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalRides / limitNum),
          totalRides,
          hasNextPage: pageNum * limitNum < totalRides,
          hasPrevPage: pageNum > 1
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting driver ride history:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting ride history',
      error: error.message
    });
  }
});

// @desc    Get driver earnings summary
// @route   GET /api/drivers/earnings
// @access  Private (Driver only)
router.get('/earnings', protect, async (req, res) => {
  try {
    const driverId = req.user.id;
    const { period = 'week' } = req.query; // 'day', 'week', 'month', 'year'
    
    console.log('\\n=== DRIVER EARNINGS SUMMARY ===');
    console.log('Driver ID:', driverId);
    console.log('Period:', period);
    
    const RideHistory = require('../models/RideHistory');
    
    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7); // Default to week
    }
    
    // Get earnings data
    const earningsData = await RideHistory.aggregate([
      {
        $match: {
          driverId: require('mongoose').Types.ObjectId(driverId),
          status: 'completed',
          createdAt: { $gte: startDate, $lte: now }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalEarnings: { $sum: '$actualFare' },
          totalRides: { $sum: 1 },
          averageFare: { $avg: '$actualFare' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Calculate totals
    const summary = earningsData.reduce((acc, day) => {
      acc.totalEarnings += day.totalEarnings;
      acc.totalRides += day.totalRides;
      return acc;
    }, { totalEarnings: 0, totalRides: 0 });
    
    summary.averageEarningsPerRide = summary.totalRides > 0 ? summary.totalEarnings / summary.totalRides : 0;
    summary.averageRidesPerDay = earningsData.length > 0 ? summary.totalRides / earningsData.length : 0;
    
    console.log(`✅ Earnings summary calculated for driver ${driverId}`);
    
    res.json({
      success: true,
      data: {
        period,
        dateRange: { startDate, endDate: now },
        summary,
        dailyData: earningsData
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting driver earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting earnings data',
      error: error.message
    });
  }
});

// Export router
module.exports = router;