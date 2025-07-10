// routes/users.js
const express = require('express');
const router = express.Router();
const { registerUser, userLogin } = require('../controllers/userController');
const protectUser = require('../middleware/userAuth'); // Import user-specific auth
const { uploadProfileImage } = require('../config/cloudinary');
const User = require('../models/User');
const MetroStation = require('../models/MetroStation');
const RideRequest = require('../models/RideRequest');
const { calculateFareEstimates } = require('../utils/fareCalculator');
const { generateRideId, generateRideOTPs } = require('../utils/otpUtils');
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

// Get all metro stations for pickup selection
router.get('/metro-stations', async (req, res) => {
  try {
    console.log('\n=== GET METRO STATIONS FOR USER ===');
    
    const stations = await MetroStation.find({ isActive: true })
      .select('id name line lat lng')
      .sort({ line: 1, name: 1 });
    
    // Group stations by line
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
    
    console.log(`✅ Returning ${stations.length} metro stations grouped by line`);
    
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
    
    // Find pickup station details
    const station = await MetroStation.findOne({ name: pickupStation });
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Pickup station not found'
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
    
    // Find pickup station
    const station = await MetroStation.findOne({ name: pickupStation });
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Pickup station not found'
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