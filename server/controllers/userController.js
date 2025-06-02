// controllers/userController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/config');

exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Create new user
    const user = await User.create({ 
      name, 
      email, 
      phone, 
      password // Password will be hashed by the pre-save hook in User model
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully'
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to register user'
    });
  }
};

exports.userLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    console.log(`[LOGIN ATTEMPT] Phone: ${phone}`);
    
    // Find the user by phone - explicitly select password field
    const user = await User.findOne({ phone }).select('+password');

    if (!user) {
      console.log(`[LOGIN FAILED] User with phone ${phone} not found`);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid phone number or password. Please try again.' 
      });
    }

    console.log(`[USER FOUND] ID: ${user._id}, Name: ${user.name}`);

    // Check password
    let isMatch = false;
    
    // First try bcrypt comparison
    try {
      isMatch = await bcrypt.compare(password, user.password);
      console.log(`[BCRYPT COMPARISON] Result: ${isMatch}`);
    } catch (bcryptError) {
      // If bcrypt fails, try plain text comparison (for development only)
      console.log(`[BCRYPT FAILED] Trying plain text comparison`);
      isMatch = (password === user.password);
      console.log(`[PLAIN TEXT COMPARISON] Result: ${isMatch}`);
    }
    
    if (!isMatch) {
      console.log(`[LOGIN FAILED] Password mismatch for phone ${phone}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid phone number or password. Please try again.' 
      });
    }

    // Create token with 24 hour expiration - INCLUDE ROLE!
    const token = jwt.sign(
      { 
        id: user._id, 
        role: 'user' // ✅ Added role field
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Update last login timestamp
    user.lastLogin = Date.now();
    await user.save();
    
    console.log(`[LOGIN SUCCESS] User ${user._id} (${user.name}) logged in successfully`);

    // Prepare user data to return (excluding password)
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      role: user.role
    };

    res.status(200).json({
      success: true,
      token,
      user: userData
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed due to server error' 
    });
  }
};