// routes/users.js
const express = require('express');
const router = express.Router();
const { registerUser, userLogin } = require('../controllers/userController');
const protectUser = require('../middleware/userAuth'); // Import user-specific auth
const { uploadProfileImage } = require('../config/cloudinary');
const User = require('../models/User');
const MetroStation = require('../models/MetroStation');
const PickupLocation = require('../models/PickupLocation');
const RideRequest = require('../models/RideRequest');
const { calculateFareEstimates } = require('../utils/fareCalculator');
const { generateRideId, generateRideOTPs, generateBoothRideNumber } = require('../utils/otpUtils');
const { logRideEvent, logUserAction } = require('../utils/rideLogger');
const { getIO } = require('../socket');

router.post('/register', registerUser);
router.post('/login', userLogin);

// Upload profile image
router.post('/profile-image', protectUser, uploadProfileImage.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get the user using proper authentication
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile image from Cloudinary if it exists
    if (user.profileImage && user.profileImage.includes('cloudinary.com')) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = user.profileImage.split('/');
        const publicIdWithExt = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExt.split('.')[0];
        const folder = urlParts.slice(-3, -1).join('/');
        await require('../config/cloudinary').deleteFromCloudinary(`${folder}/${publicId}`);
        console.log('Old profile image deleted from Cloudinary');
      } catch (error) {
        console.error('Error deleting old profile image from Cloudinary:', error);
      }
    }

    // Get Cloudinary URL
    const cloudinaryUrl = req.file.path || req.file.secure_url;

    // Update user profile with new image URL
    user.profileImage = cloudinaryUrl;
    await user.save();

    console.log('Profile image updated successfully:', {
      cloudinaryUrl,
      publicId: req.file.public_id
    });

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: cloudinaryUrl,
      imageUrl: cloudinaryUrl
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading profile image'
    });
  }
});

// Get user profile
router.get('/profile', protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('rideHistory');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
});

// Update user profile
router.put('/profile', protectUser, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        phone: user.phone,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user profile'
    });
  }
});

// Get all pickup locations (metro, railway, airport, bus terminals)
router.get('/pickup-locations', async (req, res) => {
  try {
    console.log('\n=== GET PICKUP LOCATIONS FOR USER ===');
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
    
    // Get statistics from PickupLocation model
    const totalLocations = await PickupLocation.countDocuments();
    const activeLocations = await PickupLocation.countDocuments({ isActive: true });
    
    console.log(`📊 Database stats: ${totalLocations} total locations, ${activeLocations} active`);
    
    // Get all active pickup locations
    const locations = await PickupLocation.find({ isActive: true })
      .select('id name type subType line lat lng address priority')
      .sort({ priority: -1, type: 1, name: 1 });
    
    // Group locations by type
    const locationsByType = {};
    const stationsByLine = {}; // For backward compatibility with metro stations
    
    locations.forEach(location => {
      // Group by type
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
        priority: location.priority
      });
      
      // Group metro stations by line for backward compatibility
      if (location.type === 'metro' && location.line) {
        if (!stationsByLine[location.line]) {
          stationsByLine[location.line] = [];
        }
        stationsByLine[location.line].push({
          id: location.id,
          name: location.name,
          lat: location.lat,
          lng: location.lng
        });
      }
    });
    
    // Get type statistics
    const typeStats = await PickupLocation.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log(`✅ Returning ${locations.length} pickup locations across ${Object.keys(locationsByType).length} types`);
    console.log(`📋 Types available: ${Object.keys(locationsByType).join(', ')}`);
    
    res.json({
      success: true,
      data: {
        // All locations in a flat array (new standard format)
        locations: locations.map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          subType: l.subType,
          line: l.line, // For metro stations
          lat: l.lat,
          lng: l.lng,
          address: l.address,
          priority: l.priority
        })),
        
        // Backward compatibility - same data as locations
        stations: locations.map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          subType: l.subType,
          line: l.line, // For metro stations
          lat: l.lat,
          lng: l.lng,
          address: l.address,
          priority: l.priority
        })),
        
        // Grouped by type (metro, railway, airport, bus_terminal)
        locationsByType,
        
        // Metro stations grouped by line (for backward compatibility)
        stationsByLine,
        
        // Summary counts
        totalLocations: locations.length,
        typeStats: typeStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
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
    console.error('❌ Error getting pickup locations:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error getting pickup locations',
      error: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString()
    });
  }
});

// Backward compatibility route 
router.get('/metro-stations', async (req, res) => {
  try {
    console.log('\n=== GET METRO STATIONS (BACKWARD COMPATIBILITY) ===');
    
    // Get all active pickup locations
    const locations = await PickupLocation.find({ isActive: true })
      .select('id name type subType line lat lng address priority')
      .sort({ priority: -1, type: 1, name: 1 });
    
    // Group locations by type
    const locationsByType = {};
    const stationsByLine = {};
    
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
        priority: location.priority
      });
      
      if (location.type === 'metro' && location.line) {
        if (!stationsByLine[location.line]) {
          stationsByLine[location.line] = [];
        }
        stationsByLine[location.line].push({
          id: location.id,
          name: location.name,
          lat: location.lat,
          lng: location.lng
        });
      }
    });
    
    res.json({
      success: true,
      data: {
        // Backward compatibility
        stations: locations.map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          subType: l.subType,
          line: l.line,
          lat: l.lat,
          lng: l.lng,
          address: l.address,
          priority: l.priority
        })),
        // New standard format
        locations: locations.map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          subType: l.subType,
          line: l.line,
          lat: l.lat,
          lng: l.lng,
          address: l.address,
          priority: l.priority
        })),
        locationsByType,
        stationsByLine,
        totalLocations: locations.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting metro stations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting metro stations',
      error: error.message
    });
  }
});

// Get fare estimates for a trip
router.post('/fare-estimate', protectUser, async (req, res) => {
  try {
    const { pickupStation, dropLat, dropLng } = req.body;
    const userId = req.user.id;
    
    console.log('\n=== USER FARE ESTIMATE REQUEST ===');
    console.log('User ID:', userId);
    console.log('Pickup Station:', pickupStation);
    console.log('Drop Location:', dropLat, dropLng);
    
    // Validate input
    if (!pickupStation || !dropLat || !dropLng) {
      return res.status(400).json({
        success: false,
        message: 'Pickup station and drop location are required'
      });
    }
    
    // Find pickup location details (try new model first, fallback to old model)
    let station = await PickupLocation.findOne({ name: pickupStation, isActive: true });
    
    if (!station) {
      // Fallback to MetroStation model for backward compatibility
      const oldStation = await MetroStation.findOne({ name: pickupStation });
      if (oldStation) {
        station = {
          name: oldStation.name,
          lat: oldStation.lat,
          lng: oldStation.lng,
          line: oldStation.line,
          type: 'metro'
        };
      }
    }
    
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Pickup location not found'
      });
    }
    
    // Calculate fare estimates
    const fareEstimates = calculateFareEstimates(
      station.lat, station.lng,
      dropLat, dropLng
    );
    
    // Log user action
    logUserAction(userId, 'fare_estimate_requested', {
      pickupStation,
      dropLocation: { lat: dropLat, lng: dropLng },
      distance: fareEstimates.distance
    });
    
    console.log(`✅ Fare estimates calculated for ${fareEstimates.distance}km trip`);
    
    res.json({
      success: true,
      data: {
        pickupStation: {
          name: station.name,
          line: station.line,
          lat: station.lat,
          lng: station.lng
        },
        dropLocation: { lat: dropLat, lng: dropLng },
        distance: fareEstimates.distance,
        estimates: fareEstimates.estimates,
        surgeFactor: fareEstimates.surgeFactor
      }
    });
    
  } catch (error) {
    console.error('❌ Error calculating fare estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating fare estimate',
      error: error.message
    });
  }
});

// Create a ride request
router.post('/book-ride', protectUser, async (req, res) => {
  try {
    const { pickupStation, dropLocation, vehicleType, estimatedFare } = req.body;
    const userId = req.user.id;
    
    console.log('\n=== USER RIDE BOOKING REQUEST ===');
    console.log('User ID:', userId);
    console.log('Pickup Station:', pickupStation);
    console.log('Vehicle Type:', vehicleType);
    console.log('Drop Location:', dropLocation);
    console.log('Estimated Fare:', estimatedFare);
    
    // Validate input
    if (!pickupStation || !dropLocation || !vehicleType || !estimatedFare) {
      return res.status(400).json({
        success: false,
        message: 'All booking details are required'
      });
    }
    
    // Validate vehicle type
    if (!['bike', 'auto', 'car'].includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle type'
      });
    }
    
    // Find pickup location (try new model first, fallback to old model)
    let station = await PickupLocation.findOne({ name: pickupStation, isActive: true });
    
    if (!station) {
      // Fallback to MetroStation model for backward compatibility
      const oldStation = await MetroStation.findOne({ name: pickupStation });
      if (oldStation) {
        station = {
          name: oldStation.name,
          lat: oldStation.lat,
          lng: oldStation.lng,
          line: oldStation.line,
          type: 'metro'
        };
      }
    }
    
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Pickup location not found'
      });
    }
    
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('✅ User found:', {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email
    });
    
    // Generate unique ride ID and OTPs
    const rideId = generateRideId();
    const { startOTP, endOTP } = generateRideOTPs();
    
    // Generate booth-specific ride number
    const boothRideNumber = await generateBoothRideNumber(pickupStation);
    
    // Calculate distance for database storage
    const { calculateDistance } = require('../utils/fareCalculator');
    const distance = calculateDistance(
      station.lat, station.lng,
      dropLocation.lat, dropLocation.lng
    );
    
    // Create ride request
    const rideRequest = await RideRequest.create({
      userId: userId,
      userName: user.name, // Fixed: Use 'name' instead of 'fullName'
      userPhone: user.phone,
      pickupLocation: {
        boothName: pickupStation,
        latitude: station.lat,
        longitude: station.lng
      },
      dropLocation: {
        address: dropLocation.address,
        latitude: dropLocation.lat,
        longitude: dropLocation.lng
      },
      vehicleType: vehicleType,
      distance: distance,
      fare: estimatedFare,
      estimatedFare: estimatedFare,
      rideId: rideId,
      boothRideNumber: boothRideNumber,
      startOTP: startOTP,
      endOTP: endOTP,
      status: 'pending'
    });
    
    console.log(`✅ Ride request created: ${rideRequest._id}`);
    console.log(`🔐 Generated OTPs - Start: ${startOTP}, End: ${endOTP}`);
    
    // Log ride event
    logRideEvent(rideId, 'ride_request_created', {
      userId,
      userName: user.name, // Fixed: Use 'name' instead of 'fullName'
      pickupStation,
      vehicleType,
      estimatedFare,
      distance
    });
    
    // Log user action
    logUserAction(userId, 'ride_booked', {
      rideId,
      pickupStation,
      vehicleType,
      estimatedFare
    });
    
    // Broadcast ride request to matching drivers via Socket.IO
    try {
      // Use the broadcastRideRequest function from socket.js
      // This will find matching drivers and send them the ride request
      const broadcastData = {
        rideId: rideRequest._id.toString(),
        pickupStation: pickupStation,
        vehicleType: vehicleType,
        userName: user.name,
        userPhone: user.phone
      };
      
      console.log(`📡 Broadcasting ride request to matching drivers:`, broadcastData);
      
      // Call the socket handler directly
      const { broadcastRideRequest } = require('../socket');
      const broadcastResult = await broadcastRideRequest(broadcastData);
      
      if (broadcastResult.success) {
        console.log(`✅ Socket broadcast completed for ride ${rideId} - ${broadcastResult.driversNotified} drivers notified`);
      } else {
        console.error(`❌ Socket broadcast failed for ride ${rideId}:`, broadcastResult.error);
      }
      
    } catch (socketError) {
      console.error('❌ Socket broadcast failed:', socketError);
      // Don't fail the API call if socket fails
    }
    
    res.json({
      success: true,
      message: 'Ride request created successfully',
      data: {
        rideId: rideRequest._id,
        uniqueRideId: rideId,
        boothRideNumber: boothRideNumber,
        status: 'pending',
        pickupStation: pickupStation,
        dropLocation: dropLocation,
        vehicleType: vehicleType,
        estimatedFare: estimatedFare,
        distance: distance,
        startOTP: startOTP, // Show to user for driver verification
        // endOTP will be shown after ride starts
        timestamp: rideRequest.timestamp
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating ride request:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating ride request',
      error: error.message
    });
  }
});

// Get user's active rides
router.get('/active-rides', protectUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('\n=== GET USER ACTIVE RIDES ===');
    console.log('User ID:', userId);
    
    const activeRides = await RideRequest.find({
      userId: userId,
      status: { $in: ['pending', 'driver_assigned', 'ride_started'] }
    })
    .populate('driverId', 'fullName mobileNo vehicleNo vehicleType rating')
    .sort({ timestamp: -1 });
    
    console.log(`📋 Found ${activeRides.length} active rides for user`);
    
    const ridesData = activeRides.map(ride => ({
      rideId: ride._id,
      uniqueRideId: ride.rideId,
      status: ride.status,
      pickupLocation: ride.pickupLocation,
      dropLocation: ride.dropLocation,
      vehicleType: ride.vehicleType,
      estimatedFare: ride.estimatedFare,
      actualFare: ride.actualFare,
      driver: ride.driverId ? {
        name: ride.driverId.fullName,
        phone: ride.driverId.mobileNo,
        vehicleNo: ride.driverId.vehicleNo,
        vehicleType: ride.driverId.vehicleType,
        rating: ride.driverId.rating
      } : null,
      startOTP: ['driver_assigned', 'ride_started'].includes(ride.status) ? ride.startOTP : null,
      endOTP: ride.status === 'ride_started' ? ride.endOTP : null,
      timestamps: {
        created: ride.timestamp,
        accepted: ride.acceptedAt,
        started: ride.rideStartedAt
      }
    }));
    
    res.json({
      success: true,
      data: {
        activeRides: ridesData,
        count: ridesData.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting active rides:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting active rides',
      error: error.message
    });
  }
});

// Get user's ride history
router.get('/ride-history', protectUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    console.log('\n=== GET USER RIDE HISTORY ===');
    console.log('User ID:', userId);
    
    const rideHistory = await RideRequest.find({
      userId: userId,
      status: { $in: ['completed', 'cancelled', 'ride_ended'] }
    })
    .populate('driverId', 'fullName mobileNo vehicleNo vehicleType rating')
    .sort({ timestamp: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    const totalRides = await RideRequest.countDocuments({
      userId: userId,
      status: { $in: ['completed', 'cancelled', 'ride_ended'] }
    });
    
    console.log(`📋 Found ${rideHistory.length} ride history entries`);
    
    const historyData = rideHistory.map(ride => ({
      rideId: ride._id,
      uniqueRideId: ride.rideId,
      status: ride.status,
      pickupLocation: ride.pickupLocation,
      dropLocation: ride.dropLocation,
      vehicleType: ride.vehicleType,
      estimatedFare: ride.estimatedFare,
      actualFare: ride.actualFare,
      driver: ride.driverId ? {
        name: ride.driverId.fullName,
        vehicleNo: ride.driverId.vehicleNo,
        vehicleType: ride.driverId.vehicleType,
        rating: ride.driverId.rating
      } : null,
      timestamps: {
        created: ride.timestamp,
        accepted: ride.acceptedAt,
        started: ride.rideStartedAt,
        ended: ride.rideEndedAt,
        cancelled: ride.cancelledAt
      },
      cancellationReason: ride.cancellationReason
    }));
    
    res.json({
      success: true,
      data: {
        rideHistory: historyData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRides / limit),
          totalRides: totalRides,
          hasNextPage: page < Math.ceil(totalRides / limit),
          hasPrevPage: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting ride history:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting ride history',
      error: error.message
    });
  }
});

module.exports = router;