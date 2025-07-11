// routes/admin.js
const express = require('express');
const router = express.Router();
const { adminProtect } = require('../middleware/auth');
const { uploadDriverDocuments } = require('../config/cloudinary');
const { registerDriver } = require('../controllers/driverController');
const { 
  getAllDrivers, 
  getDriverById,
  getAllUsers,
  getUserById,
  verifyDriver
} = require('../controllers/adminController');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Import queue routes
const queueRoutes = require('./admin/queueRoutes');

// Configure multer for multiple files
const driverDocumentUpload = uploadDriverDocuments.fields([
  { name: 'aadhaarPhotoFront', maxCount: 1 },
  { name: 'aadhaarPhotoBack', maxCount: 1 },
  { name: 'driverSelfie', maxCount: 1 },
  { name: 'drivingLicensePhoto', maxCount: 1 },
  { name: 'registrationCertificatePhoto', maxCount: 1 },
  { name: 'permitPhoto', maxCount: 1 },
  { name: 'fitnessCertificatePhoto', maxCount: 1 },
  { name: 'insurancePolicyPhoto', maxCount: 1 }
]);

// Admin routes for driver management
router.get('/drivers', adminProtect, getAllDrivers);
router.get('/drivers/:id', adminProtect, getDriverById);
router.post('/drivers', adminProtect, driverDocumentUpload, registerDriver);

// Admin routes for user management
router.get('/users', adminProtect, getAllUsers);
router.get('/users/:id', adminProtect, getUserById);

// Approve/reject driver
router.put('/drivers/:id/verify', adminProtect, verifyDriver);

// Queue management routes
router.use('/queue', queueRoutes);

// Delete driver
router.delete('/drivers/:id', adminProtect, async (req, res) => {
  try {
    const Driver = require('../models/Driver');
    const driver = await Driver.findByIdAndDelete(req.params.id);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }
    
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
});

// Admin login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1d' });
    res.json({ success: true, token, admin: { id: admin._id, email: admin.email, name: admin.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Export router
module.exports = router;