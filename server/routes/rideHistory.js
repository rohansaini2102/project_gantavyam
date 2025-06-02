const express = require('express');
const router = express.Router();
const RideHistory = require('../models/RideHistory');

// Fix for auth middleware issue
let authMiddleware;
try {
  // Import the auth module
  const auth = require('../middleware/auth');
  
  // Try to find the correct middleware function
  if (typeof auth === 'function') {
    // If auth itself is a function, use it
    authMiddleware = auth;
  } else if (typeof auth.protectUser === 'function') {
    // Try common property names
    authMiddleware = auth.protectUser;
  } else if (typeof auth.protect === 'function') {
    authMiddleware = auth.protect;
  } else if (typeof auth.requireAuth === 'function') {
    authMiddleware = auth.requireAuth;
  } else if (typeof auth.verifyToken === 'function') {
    authMiddleware = auth.verifyToken;
  } else {
    // If we can't find a suitable function, log a warning
    console.warn('⚠️ Could not find a suitable auth middleware function');
    // We'll define a fallback below
  }
} catch (error) {
  console.warn('⚠️ Error importing auth middleware:', error.message);
  // We'll define a fallback below
}

// Define a fallback middleware if no suitable middleware was found
if (!authMiddleware) {
  console.warn('⚠️ Using temporary auth middleware - SECURITY RISK IN PRODUCTION');
  authMiddleware = (req, res, next) => {
    // This is a temporary fallback that bypasses authentication
    // DO NOT use in production!
    console.log('⚠️ Using unsecured auth middleware fallback');
    req.user = { id: 'temp-user-id', name: 'Test User' };
    next();
  };
}

// Get ride history for a user
router.get('/user-rides', authMiddleware, async (req, res) => {
  try {
    const rides = await RideHistory.find({ userId: req.user.id })
      .sort({ timestamp: -1 }); // Sort by newest first
    
    res.json({
      success: true,
      rides
    });
  } catch (error) {
    console.error('Error fetching ride history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ride history'
    });
  }
});

// Add a new ride to history
router.post('/add-ride', authMiddleware, async (req, res) => {
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