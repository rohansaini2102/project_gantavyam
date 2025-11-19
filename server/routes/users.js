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
    
    // Return only the fixed pickup location - Hauz Khas Metro Gate No 1
    const fixedLocation = {
      id: 'M-Y-024-GATE1',
      name: 'Hauz Khas Metro Gate No 1',
      type: 'metro',
      subType: 'Yellow Line',
      address: 'Hauz Khas Metro Station Gate No 1, Outer Ring Road, Hauz Khas, New Delhi',
      lat: 28.5433,
      lng: 77.2066,
      line: 'yellow',
      isActive: true,
      priority: 10,
      metadata: {
        description: 'Fixed pickup location - Hauz Khas Metro Station Gate No 1',
        facilities: ['parking', 'waiting_area'],
        gateNumber: 1
      }
    };
    
    console.log('✅ Returning fixed pickup location: Hauz Khas Metro Gate No 1');
    
    // Return only the fixed pickup location array
    const locations = [fixedLocation];
    
    // Group locations by type
    const locationsByType = {
      metro: [fixedLocation]
    };
    
    // Group metro stations by line for backward compatibility
    const stationsByLine = {
      yellow: [fixedLocation]
    };
    
    // Type statistics for the fixed location
    const typeStats = [{ _id: 'metro', count: 1 }];
    
    console.log(`✅ Returning ${locations.length} pickup locations across ${Object.keys(locationsByType).length} types`);
    console.log(`📋 Types available: ${Object.keys(locationsByType).join(', ')}`);
    
    res.json({
      success: true,
      data: {
        // All locations in a flat array (new standard format)
        locations: locations,
        
        // Backward compatibility - same data as locations
        stations: locations,
        
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
        totalInDb: 1,
        activeInDb: 1,
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
    
    // Handle fixed pickup location - Hauz Khas Metro Gate No 1
    let station;
    if (pickupStation === 'Hauz Khas Metro Gate No 1') {
      // Use the fixed location directly
      station = {
        name: 'Hauz Khas Metro Gate No 1',
        lat: 28.5433,
        lng: 77.2066,
        line: 'yellow',
        type: 'metro'
      };
      console.log('✅ Using fixed pickup location for fare estimation: Hauz Khas Metro Gate No 1');
    } else {
      // Fallback to database lookup for other stations (backward compatibility)
      station = await PickupLocation.findOne({ name: pickupStation, isActive: true });
      
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
    }
    
    // Calculate fare estimates
    const fareEstimates = await calculateFareEstimates(
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

// Create a ride request (supports both regular and manual bookings)
router.post('/book-ride', protectUser, async (req, res) => {
  try {
    const { 
      pickupStation, 
      dropLocation, 
      vehicleType, 
      estimatedFare,
      // Manual booking specific fields
      bookingSource,
      adminBooked,
      customerPhone,
      customerName,
      existingUserId,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng
    } = req.body;
    
    // Determine user ID based on booking type
    let userId, user;
    if (adminBooked && bookingSource === 'manual') {
      // Manual booking by admin
      if (existingUserId) {
        user = await User.findById(existingUserId);
        userId = existingUserId;
      } else {
        // Create new user for manual booking
        user = await User.findOne({ phone: customerPhone });
        if (!user) {
          user = new User({
            name: customerName,
            phone: customerPhone,
            password: customerPhone, // Default password
            isPhoneVerified: true,
            createdBy: 'admin'
          });
          await user.save();
        }
        userId = user._id;
      }
    } else {
      // Regular online booking
      userId = req.user.id;
    }
    
    console.log('\n=== USER RIDE BOOKING REQUEST ===');
    console.log('User ID:', userId);
    console.log('Pickup Station:', pickupStation);
    console.log('Vehicle Type:', vehicleType);
    console.log('Drop Location:', dropLocation);
    console.log('Estimated Fare:', estimatedFare);
    
    // Validate input
    if (!pickupStation || !dropLocation || !vehicleType || estimatedFare === undefined || estimatedFare === null) {
      return res.status(400).json({
        success: false,
        message: 'All booking details are required'
      });
    }
    
    // Handle drop location for manual bookings
    let processedDropLocation;
    if (adminBooked && bookingSource === 'manual') {
      // For manual bookings, construct drop location from coordinates
      processedDropLocation = {
        address: dropLocation,
        lat: dropLat,
        lng: dropLng
      };
    } else {
      // Regular booking validation
      processedDropLocation = dropLocation;
    }
    
    // Validate drop location structure
    if (!processedDropLocation.address || typeof processedDropLocation.lat !== 'number' || typeof processedDropLocation.lng !== 'number') {
      console.error('❌ Invalid drop location structure:', processedDropLocation);
      return res.status(400).json({
        success: false,
        message: 'Drop location must include address, lat, and lng coordinates'
      });
    }
    
    // Validate coordinates range
    if (processedDropLocation.lat < -90 || processedDropLocation.lat > 90 || processedDropLocation.lng < -180 || processedDropLocation.lng > 180) {
      console.error('❌ Invalid coordinates range:', { lat: processedDropLocation.lat, lng: processedDropLocation.lng });
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinate values. Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }
    
    // Validate vehicle type
    if (!['bike', 'auto', 'car'].includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle type'
      });
    }
    
    // Validate fare (allow 0 fare and calculate fallback later)
    if (typeof estimatedFare !== 'number' || estimatedFare < 0) {
      return res.status(400).json({
        success: false,
        message: 'Estimated fare must be a non-negative number'
      });
    }
    
    // Handle pickup location for both regular and manual bookings
    let station;
    if (adminBooked && bookingSource === 'manual' && pickupLat && pickupLng) {
      // For manual bookings, use provided coordinates
      station = {
        id: 'M-Y-024-GATE1',
        name: pickupStation,
        lat: pickupLat,
        lng: pickupLng,
        line: 'yellow',
        type: 'metro'
      };
      console.log('✅ Using manual booking pickup location:', station);
    } else if (pickupStation === 'Hauz Khas Metro Gate No 1') {
      // Use the fixed location directly
      station = {
        id: 'M-Y-024-GATE1',
        name: 'Hauz Khas Metro Gate No 1',
        lat: 28.5433,
        lng: 77.2066,
        line: 'yellow',
        type: 'metro'
      };
      console.log('✅ Using fixed pickup location: Hauz Khas Metro Gate No 1');
    } else {
      // Fallback to database lookup for other stations (backward compatibility)
      station = await PickupLocation.findOne({ name: pickupStation, isActive: true });
      
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
    }
    
    // Get user details (already retrieved for manual bookings)
    if (!user) {
      user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }
    
    console.log('✅ User found:', {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email
    });
    
    // Calculate final fare with new commission structure
    let finalFare = estimatedFare;
    let customerFare = estimatedFare;
    let fareBreakdown = null;
    let gstAmount = 0;
    let commissionAmount = 0;
    let nightChargeAmount = 0;

    // Always recalculate fare to get proper breakdown
    try {
      const { calculateDistance, calculateFare } = require('../utils/fareCalculator');
      const distance = calculateDistance(
        station.lat, station.lng,
        processedDropLocation.lat, processedDropLocation.lng
      );

      const fareCalculation = await calculateFare(vehicleType, distance, true, 0);

      // Driver fare (base amount)
      finalFare = fareCalculation.driverFare || fareCalculation.totalFare;

      // Customer fare (with GST, commission, night charge)
      customerFare = fareCalculation.customerTotalFare || fareCalculation.totalFare;

      // Store breakdown
      fareBreakdown = fareCalculation.breakdown;
      gstAmount = fareCalculation.gstAmount || 0;
      commissionAmount = fareCalculation.commissionAmount || 0;
      nightChargeAmount = fareCalculation.nightChargeAmount || 0;

      console.log(`✅ Calculated fare breakdown:`, {
        driverFare: finalFare,
        customerFare: customerFare,
        gst: gstAmount,
        commission: commissionAmount,
        nightCharge: nightChargeAmount,
        distance: `${distance}km`
      });
    } catch (fareError) {
      console.error('❌ Fare calculation failed:', fareError);
      // Use provided fare as fallback
      finalFare = estimatedFare || (vehicleType === 'bike' ? 30 : vehicleType === 'auto' ? 40 : 60);
      customerFare = estimatedFare || finalFare;
    }
    
    // Generate unique ride ID and OTPs
    const rideId = generateRideId();
    const { startOTP, endOTP } = generateRideOTPs();
    
    // Generate booth-specific ride number
    const boothRideNumber = await generateBoothRideNumber(pickupStation);
    
    // Calculate distance for database storage
    const { calculateDistance } = require('../utils/fareCalculator');
    const distance = calculateDistance(
      station.lat, station.lng,
      processedDropLocation.lat, processedDropLocation.lng
    );
    
    // Create ride request
    console.log('📝 Creating ride request with data:', {
      userId,
      userName: user.name,
      userPhone: user.phone,
      pickupStation,
      dropLocation: dropLocation,
      vehicleType,
      distance,
      estimatedFare,
      rideId,
      boothRideNumber
    });
    
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
        address: processedDropLocation.address,
        latitude: processedDropLocation.lat,
        longitude: processedDropLocation.lng
      },
      vehicleType: vehicleType,
      distance: distance,
      fare: finalFare, // Driver fare (backward compatible)
      estimatedFare: finalFare, // Driver fare (backward compatible)
      // New fare fields
      driverFare: finalFare, // FIXED: Add missing driverFare field for driver earnings
      customerFare: customerFare,
      baseFare: finalFare,
      gstAmount: gstAmount,
      commissionAmount: commissionAmount,
      nightChargeAmount: nightChargeAmount,
      fareBreakdown: fareBreakdown,
      rideId: rideId,
      boothRideNumber: boothRideNumber,
      startOTP: startOTP,
      endOTP: endOTP,
      status: 'pending',
      // Mark booking source
      bookingSource: adminBooked && bookingSource === 'manual' ? 'manual' : 'app'
    });
    
    console.log(`✅ Ride request created successfully:`, {
      _id: rideRequest._id,
      rideId: rideRequest.rideId,
      status: rideRequest.status,
      boothRideNumber: rideRequest.boothRideNumber
    });
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
      console.log(`📡 Broadcasting ride request to matching drivers`);
      console.log('Ride request object:', {
        _id: rideRequest._id,
        pickupLocation: rideRequest.pickupLocation,
        dropLocation: rideRequest.dropLocation,
        vehicleType: rideRequest.vehicleType
      });
      
      // Call the socket handler directly
      const { broadcastRideRequest, notifyAdmins } = require('../socket');
      
      // Validate that the socket service is available
      const { getIO } = require('../socket');
      const io = getIO();
      if (!io) {
        console.error('❌ Socket.IO not initialized - drivers will not be notified');
      } else {
        console.log('✅ Socket.IO is available for broadcasting');
        
        // Pass the complete rideRequest object to broadcastRideRequest
        const broadcastResult = await broadcastRideRequest(rideRequest);
        
        if (broadcastResult && broadcastResult.success) {
          console.log(`✅ Socket broadcast completed for ride ${rideId} - ${broadcastResult.driversNotified} drivers notified`);
        } else {
          console.error(`❌ Socket broadcast failed for ride ${rideId}:`, broadcastResult?.error || 'Unknown error');
        }
        
        // IMPORTANT FIX: Notify admins of new ride creation
        try {
          console.log(`📢 Notifying admins of new ride request: ${rideId}`);
          notifyAdmins('newRideRequest', {
            rideId: rideRequest._id.toString(),
            uniqueRideId: rideId,
            userName: user.name,
            userPhone: user.phone,
            pickupLocation: rideRequest.pickupLocation,
            dropLocation: rideRequest.dropLocation,
            vehicleType: vehicleType,
            estimatedFare: finalFare,
            distance: distance,
            status: 'pending',
            boothRideNumber: boothRideNumber,
            createdAt: rideRequest.createdAt || rideRequest.timestamp,
            timestamp: new Date().toISOString()
          });
          console.log(`✅ Admin notification sent for ride ${rideId}`);
        } catch (adminNotifyError) {
          console.error('❌ Failed to notify admins:', adminNotifyError);
          // Don't fail the request if admin notification fails
        }
      }
      
    } catch (socketError) {
      console.error('❌ Socket broadcast exception:', socketError.message);
      console.error('Stack trace:', socketError.stack);
      // Don't fail the API call if socket fails - ride is still created
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
        estimatedFare: finalFare,
        distance: distance,
        startOTP: startOTP, // Show to user for driver verification
        endOTP: endOTP, // Show both OTPs to user for convenience
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
      startOTP: ride.startOTP, // Always show start OTP to user
      endOTP: ride.endOTP, // Always show end OTP to user for convenience
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
    console.log('Fetching from RideHistory collection...');
    
    // Import RideHistory model
    const RideHistory = require('../models/RideHistory');
    
    // Get ride history from RideHistory collection (properly completed/cancelled rides)
    const rideHistory = await RideHistory.find({
      userId: userId
    })
    .populate('driverId', 'fullName mobileNo vehicleNo vehicleType rating')
    .sort({ createdAt: -1 }) // Sort by creation date in RideHistory
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    // Get total count from RideHistory collection
    const totalRides = await RideHistory.countDocuments({
      userId: userId
    });
    
    console.log(`📋 Found ${rideHistory.length} ride history entries from RideHistory collection`);
    
    const historyData = rideHistory.map(ride => ({
      rideId: ride._id,
      uniqueRideId: ride.rideId,
      status: ride.status, // This will correctly show 'completed' or 'cancelled' from RideHistory
      pickupLocation: ride.pickupLocation,
      dropLocation: ride.dropLocation,
      vehicleType: ride.vehicleType,
      estimatedFare: ride.estimatedFare,
      actualFare: ride.actualFare,
      driver: ride.driverId ? {
        name: ride.driverId.fullName || ride.driverName,
        vehicleNo: ride.driverId.vehicleNo || ride.driverVehicleNo,
        vehicleType: ride.driverId.vehicleType || ride.vehicleType,
        rating: ride.driverId.rating || ride.driverRating
      } : (ride.driverName ? {
        name: ride.driverName,
        vehicleNo: ride.driverVehicleNo,
        vehicleType: ride.vehicleType,
        rating: ride.driverRating
      } : null),
      timestamps: {
        created: ride.timestamps?.requested || ride.createdAt,
        accepted: ride.timestamps?.driverAssigned,
        started: ride.timestamps?.rideStarted,
        ended: ride.timestamps?.rideEnded,
        completed: ride.timestamps?.completed,
        cancelled: ride.timestamps?.cancelled
      },
      cancellationReason: ride.cancellationReason,
      cancelledBy: ride.cancelledBy,
      paymentStatus: ride.paymentStatus,
      paymentMethod: ride.paymentMethod,
      journeyStats: ride.journeyStats,
      // Include OTPs for completed rides
      startOTP: ride.status === 'completed' ? ride.startOTP : null,
      endOTP: ride.status === 'completed' ? ride.endOTP : null
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