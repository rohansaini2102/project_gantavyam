// middleware/auth.js
const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');

// Try to import User model but don't crash if it doesn't exist
let User;
try {
  User = require('../models/User');
} catch (error) {
  console.warn('User model not found. User authentication will use Driver model instead.');
}

// Try to import Admin model but don't crash if it doesn't exist
let Admin;
try {
  Admin = require('../models/Admin');
} catch (error) {
  console.warn('Admin model not found. Admin authentication will be limited.');
}

// Generic authentication middleware that can be used for both users and drivers
// This maintains backward compatibility with code that expects 'auth' as a function
const auth = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

      // Try to find a user with that ID
      let user;
      
      if (User) {
        user = await User.findById(decoded.id).select('-password');
      }
      
      // If no user found, try to find a driver
      if (!user) {
        user = await Driver.findById(decoded.id).select('-password');
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Not authorized to access this route'
        });
      }

      // Add user to request object - for backward compatibility
      req.user = user;
      
      // Also add as driver if using driver routes
      req.driver = user;
      
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
};

// Protect routes - Middleware specifically for driver authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

      // Try to find a driver with that ID
      const driver = await Driver.findById(decoded.id).select('-password');

      if (!driver) {
        return res.status(401).json({
          success: false,
          error: 'Not authorized to access this route'
        });
      }

      // Add driver to request object
      req.driver = driver;
      
      // Also add as user for compatibility with code expecting req.user
      req.user = driver;
      
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
};

// Admin authentication middleware
const adminProtect = async (req, res, next) => {
  try {
    // Check if Admin model is available
    if (!Admin) {
      console.warn('Admin route accessed but Admin model is not available');
      return res.status(501).json({
        success: false,
        error: 'Admin functionality not implemented yet'
      });
    }

    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

      // Get admin from the token
      const admin = await Admin.findById(decoded.id).select('-password');

      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'Not authorized as admin'
        });
      }

      // Add admin to request object
      req.admin = admin;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
};

// Export both the named functions and the legacy auth function
module.exports = { 
  auth,           // For backward compatibility
  protect,        // For driver routes
  adminProtect    // For admin routes
};