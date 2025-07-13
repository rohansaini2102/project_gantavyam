// controllers/userController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('UserController');

exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    logger.info('User registration attempt', { 
      email, 
      phone, 
      name,
      timestamp: new Date().toISOString()
    });

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      logger.warn('Registration failed - duplicate user', { 
        email, 
        phone, 
        existingUserId: existingUser._id 
      });
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

    logger.info('User registered successfully', { 
      userId: user._id, 
      email, 
      phone, 
      name 
    });

    // Notify admins of new user registration
    try {
      const { notifyAdmins } = require('../socket');
      notifyAdmins('userRegistered', {
        userId: user._id,
        name,
        email,
        phone,
        registeredAt: new Date().toISOString()
      });
    } catch (socketError) {
      logger.warn('Failed to notify admins of user registration', { error: socketError.message });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully'
    });
  } catch (err) {
    logger.error('Registration error', { 
      error: err.message, 
      stack: err.stack,
      body: req.body 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to register user'
    });
  }
};

exports.userLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    logger.info('User login attempt', { phone });
    
    // Find the user by phone - explicitly select password field
    const user = await User.findOne({ phone }).select('+password');

    if (!user) {
      logger.warn('Login failed - user not found', { phone });
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid phone number or password. Please try again.' 
      });
    }

    logger.debug('User found for login', { userId: user._id, name: user.name });

    // Check password
    let isMatch = false;
    
    // First try bcrypt comparison
    try {
      isMatch = await bcrypt.compare(password, user.password);
      logger.debug('Password comparison result', { isMatch, method: 'bcrypt' });
    } catch (bcryptError) {
      // If bcrypt fails, try plain text comparison (for development only)
      logger.warn('Bcrypt comparison failed, trying plain text', { error: bcryptError.message });
      isMatch = (password === user.password);
      logger.debug('Password comparison result', { isMatch, method: 'plaintext' });
    }
    
    if (!isMatch) {
      logger.warn('Login failed - password mismatch', { phone, userId: user._id });
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
    
    logger.info('User login successful', { 
      userId: user._id, 
      name: user.name, 
      phone 
    });

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
    logger.error('Login error', { 
      error: err.message, 
      stack: err.stack,
      body: req.body 
    });
    res.status(500).json({ 
      success: false, 
      message: 'Login failed due to server error' 
    });
  }
};