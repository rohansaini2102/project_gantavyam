// routes/drivers.js
const express = require('express');
const router = express.Router();
const { uploadDriverDocuments } = require('../config/cloudinary');
const { protect } = require('../middleware/auth');
const {
  registerDriver,
  loginDriver,
  getDriverProfile,
  updateDriverLocation
} = require('../controllers/driverController');
const Driver = require('../models/Driver');
const MetroStation = require('../models/MetroStation');
const { logDriverAction } = require('../utils/rideLogger');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Configure multer for multiple files
const driverDocumentUpload = uploadDriverDocuments.fields([
  { name: 'aadhaarPhotoFront', maxCount: 1 },
  { name: 'aadhaarPhotoBack', maxCount: 1 },
  { name: 'driverSelfie', maxCount: 1 },
  { name: 'drivingLicensePhoto', maxCount: 1 },
  { name: 'registrationCertificatePhoto', maxCount: 1 },
  { name: 'permitPhoto', maxCount: 1 },
  { name: 'fitnessCertificatePhoto', maxCount: 1 },
  { name: 'insurancePolicyPhoto', maxCount: 1 }
]);

// Public routes
router.post('/register', driverDocumentUpload, registerDriver);
router.post('/login', loginDriver);

// Protected routes
router.get('/profile', protect, getDriverProfile);
router.put('/location', protect, updateDriverLocation);

// Go online at a specific metro booth
router.post('/go-online', protect, async (req, res) => {
  try {
    const { metroBoothName, vehicleType, location } = req.body;
    const driverId = req.user.id;
    
    console.log('\n=== DRIVER GO ONLINE REQUEST ===');
    console.log('Driver ID:', driverId);
    console.log('Metro Booth:', metroBoothName);
    console.log('Vehicle Type:', vehicleType);
    console.log('Location:', location);
    
    // Validate input
    if (!metroBoothName || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: 'Metro booth name and vehicle type are required'
      });
    }
    
    // Check if metro booth exists
    const metroStation = await MetroStation.findOne({ name: metroBoothName });
    if (!metroStation) {
      return res.status(404).json({
        success: false,
        message: 'Metro station not found'
      });
    }
    
    // Update driver status
    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      {
        isOnline: true,
        currentMetroBooth: metroBoothName,
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
    
    // Update metro station driver count
    await metroStation.incrementOnlineDrivers();
    
    // Log driver action
    logDriverAction(driverId, 'go_online', {
      metroBoothName,
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
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting metro stations for driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting metro stations',
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

// Export router
module.exports = router;