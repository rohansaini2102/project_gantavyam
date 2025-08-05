const express = require('express');
const router = express.Router();
const RideHistory = require('../models/RideHistory');
const { auth } = require('../middleware/auth');

// Get ride history for a user
router.get('/user-rides', auth, async (req, res) => {
  try {
    // Get pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log(`[RideHistory] Fetching rides for user ${req.user.id}, page ${page}, limit ${limit}`);

    // Get total count for pagination
    const totalRides = await RideHistory.countDocuments({ userId: req.user.id });
    
    // Get rides with pagination
    const rides = await RideHistory.find({ userId: req.user.id })
      .sort({ createdAt: -1 }) // Sort by newest first using createdAt
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalRides / limit);
    const hasMore = page < totalPages;

    console.log(`[RideHistory] Found ${rides.length} rides out of ${totalRides} total`);
    
    res.json({
      success: true,
      data: {
        rideHistory: rides,
        pagination: {
          currentPage: page,
          totalPages,
          totalRides,
          hasMore,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching ride history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ride history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add a new ride to history
router.post('/add-ride', auth, async (req, res) => {
  try {
    const {
      pickupLocation,
      dropLocation,
      fare,
      distance,
      status,
      driverName,
      driverPhone
    } = req.body;

    const newRide = new RideHistory({
      userId: req.user.id,
      pickupLocation,
      dropLocation,
      fare,
      distance,
      status,
      driverName,
      driverPhone
    });

    await newRide.save();

    res.json({
      success: true,
      message: 'Ride added to history',
      ride: newRide
    });
  } catch (error) {
    console.error('Error adding ride to history:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding ride to history'
    });
  }
});

module.exports = router;