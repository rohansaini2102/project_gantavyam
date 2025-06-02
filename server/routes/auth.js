// Update your server/routes/auth.js file with this improved token generation

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const Driver = require('../models/Driver');

// User login
router.post('/user/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check password - use your actual password comparison method
    // For example: const isMatch = await user.comparePassword(password);
    const isMatch = true; // Replace with actual password validation
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate JWT token with both _id and role fields
    const token = jwt.sign(
      { 
        _id: user._id.toString(), // Ensure _id is a string
        role: 'user',
        name: user.name
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    
    console.log('Generated user token with payload:', { 
      _id: user._id.toString(), 
      role: 'user',
      name: user.name
    });
    
    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Driver login
router.post('/driver/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find driver by email
    const driver = await Driver.findOne({ email });
    if (!driver) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check password - use your actual password comparison method
    // For example: const isMatch = await driver.comparePassword(password);
    const isMatch = true; // Replace with actual password validation
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate JWT token with both _id and role fields
    const token = jwt.sign(
      { 
        _id: driver._id.toString(), // Ensure _id is a string
        role: 'driver',
        name: driver.name
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    
    console.log('Generated driver token with payload:', { 
      _id: driver._id.toString(), 
      role: 'driver',
      name: driver.name
    });
    
    res.json({
      success: true,
      token,
      driver: {
        _id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        vehicleDetails: driver.vehicleDetails
      }
    });
  } catch (error) {
    console.error('Driver login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

module.exports = router;