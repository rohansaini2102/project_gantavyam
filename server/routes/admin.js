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
  verifyDriver,
  getDashboardStats,
  getBoothPerformance
} = require('../controllers/adminController');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Import specialized admin routes
const queueRoutes = require('./admin/queueRoutes');
const rideRoutes = require('./admin/rideRoutes');
const { router: rideManagementTools } = require('./admin/rideManagementTools');
const driverInfoRecoveryRoutes = require('./admin/driverInfoRecovery');
const manualBookingRoutes = require('./admin/manualBookingRoutes');
const fareManagementRoutes = require('./admin/fareManagement');

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

// Specialized admin routes
router.use('/queue', queueRoutes);
router.use('/rides', rideRoutes);
router.use('/ride-tools', rideManagementTools);
router.use('/driver-recovery', driverInfoRecoveryRoutes);
router.use('/fare', fareManagementRoutes);
router.use('/', manualBookingRoutes);

// Dashboard and statistics routes
router.get('/dashboard/stats', adminProtect, getDashboardStats);
router.get('/booths/performance', adminProtect, getBoothPerformance);

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
    console.log('Admin found:', { id: admin._id, email: admin.email, name: admin.name });
    
    // Ensure admin._id exists
    if (!admin._id) {
      console.error('Admin._id is undefined!', admin);
      return res.status(500).json({ success: false, error: 'Admin ID not found' });
    }
    
    const token = jwt.sign({ id: admin._id.toString(), role: 'admin' }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1d' });
    console.log('Token created with payload:', { id: admin._id.toString(), role: 'admin' });
    
    res.json({ success: true, token, admin: { id: admin._id, email: admin.email, name: admin.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Export router
module.exports = router;