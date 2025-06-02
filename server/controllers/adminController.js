// controllers/adminController.js
const Driver = require('../models/Driver');
const User = require('../models/User');

// @desc    Get all drivers
// @route   GET /api/admin/drivers
// @access  Private (Admin only)
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().select('-password');
    
    res.status(200).json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching drivers'
    });
  }
};

// @desc    Get driver by ID
// @route   GET /api/admin/drivers/:id
// @access  Private (Admin only)
exports.getDriverById = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).select('-password');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error('Error fetching driver:', error);
    
    // Check if error is due to invalid ID format
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Invalid driver ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error while fetching driver'
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching users'
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    
    // Check if error is due to invalid ID format
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user'
    });
  }
};

// @desc    Update driver verification status
// @route   PUT /api/admin/drivers/:id/verify
// @access  Private (Admin only)
exports.verifyDriver = async (req, res) => {
  try {
    const { isVerified } = req.body;
    
    if (isVerified === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Please provide isVerified field'
      });
    }
    
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: isVerified,
        $set: { 
          lastRenewalDate: isVerified ? Date.now() : undefined 
        }
      },
      { new: true }
    );
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Driver ${isVerified ? 'verified' : 'unverified'} successfully`,
      data: driver
    });
  } catch (error) {
    console.error('Error updating driver verification status:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating driver verification status'
    });
  }
};

// @desc    Delete driver
// @route   DELETE /api/admin/drivers/:id
// @access  Private (Admin only)
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
    await Driver.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Driver deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting driver'
    });
  }
};