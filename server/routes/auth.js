// Update your server/routes/auth.js file with this improved token generation

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Admin = require('../models/Admin');

// User login
router.post('/user/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email and include password for validation
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password using matchPassword method
    const isMatch = await user.matchPassword(password);

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
    
    // Find driver by email and include password for validation
    const driver = await Driver.findOne({ email }).select('+password');
    if (!driver) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password using matchPassword method
    const isMatch = await driver.matchPassword(password);

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

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 [Admin Login] Attempting admin login:', { email });
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }
    
    // Find admin by email and include password for validation
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      console.log('🔐 [Admin Login] Admin not found:', { email });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Check password
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      console.log('🔐 [Admin Login] Password mismatch:', { email });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin._id.toString(),
        role: 'admin',
        name: admin.name,
        email: admin.email
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    
    console.log('🔐 [Admin Login] Login successful:', { 
      adminId: admin._id.toString(), 
      email: admin.email,
      role: admin.role 
    });
    
    res.json({
      success: true,
      token,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions || []
      }
    });
  } catch (error) {
    console.error('🔐 [Admin Login] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during admin login'
    });
  }
});

module.exports = router;