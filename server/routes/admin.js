// routes/admin.js
const express = require('express');
const router = express.Router();
const { adminProtect } = require('../middleware/auth');
const { checkPermission, PERMISSIONS } = require('../middleware/permissions');
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
const twilioSmsService = require('../services/twilioSmsService');
const RideRequest = require('../models/RideRequest');

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
router.get('/drivers', adminProtect, checkPermission(PERMISSIONS.DRIVERS_VIEW), getAllDrivers);
router.get('/drivers/:id', adminProtect, checkPermission(PERMISSIONS.DRIVERS_VIEW), getDriverById);
router.post('/drivers', adminProtect, checkPermission(PERMISSIONS.DRIVERS_CREATE), driverDocumentUpload, registerDriver);

// Admin routes for user management
router.get('/users', adminProtect, checkPermission(PERMISSIONS.USERS_VIEW), getAllUsers);
router.get('/users/:id', adminProtect, checkPermission(PERMISSIONS.USERS_VIEW), getUserById);

// Approve/reject driver
router.put('/drivers/:id/verify', adminProtect, checkPermission(PERMISSIONS.DRIVERS_VERIFY), verifyDriver);

// Specialized admin routes
router.use('/queue', queueRoutes);
router.use('/rides', rideRoutes);
router.use('/ride-tools', rideManagementTools);
router.use('/driver-recovery', driverInfoRecoveryRoutes);
router.use('/fare', fareManagementRoutes);
router.use('/', manualBookingRoutes);

// Dashboard and statistics routes (accessible to all admins, but will hide financial data on frontend)
router.get('/dashboard/stats', adminProtect, getDashboardStats);
router.get('/booths/performance', adminProtect, getBoothPerformance);

// Delete driver (requires delete permission)
router.delete('/drivers/:id', adminProtect, checkPermission(PERMISSIONS.DRIVERS_DELETE), async (req, res) => {
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
    
    const config = require('../config/config');
    const token = jwt.sign({ id: admin._id.toString(), role: admin.role }, config.jwtSecret, { expiresIn: '1d' });
    console.log('Token created with payload:', { id: admin._id.toString(), role: admin.role });

    // Update last login time
    admin.lastLogin = new Date();
    await admin.save();

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Resend OTP SMS endpoint
router.post('/resend-otp/:rideId', adminProtect, async (req, res) => {
  try {
    const { rideId } = req.params;

    console.log(`📱 Admin requesting OTP resend for ride: ${rideId}`);

    // Find the ride request
    const rideRequest = await RideRequest.findById(rideId).populate('user', 'phone name');

    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    // Check if ride is in a valid state for OTP resend
    if (!['pending', 'driver_assigned', 'ride_started'].includes(rideRequest.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot resend OTP for ride with status: ${rideRequest.status}`
      });
    }

    // Check if customer phone number exists
    const customerPhone = rideRequest.userPhone || rideRequest.user?.phone;
    if (!customerPhone) {
      return res.status(400).json({
        success: false,
        error: 'Customer phone number not found'
      });
    }

    // Check if SMS service is configured
    if (!twilioSmsService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'SMS service not configured. Please check Twilio settings.',
        errorCode: 'SMS_NOT_CONFIGURED'
      });
    }

    // Send resend OTP SMS
    console.log(`📤 Sending resend OTP SMS to ${customerPhone}`);
    const smsResult = await twilioSmsService.sendResendOTP(
      customerPhone,
      rideRequest.startOTP,
      rideRequest.endOTP,
      {
        rideId: rideRequest._id,
        adminId: req.admin._id,
        adminName: req.admin.name
      }
    );

    // Log the attempt (success or failure)
    const { logRideEvent, logError } = require('../utils/rideLogger');

    if (smsResult.success) {
      console.log(`✅ Resend OTP SMS sent successfully to ${customerPhone}`);

      // Log successful resend
      logRideEvent(rideRequest._id, 'sms_otp_resent', {
        adminId: req.admin._id,
        adminName: req.admin.name,
        phone: customerPhone,
        messageId: smsResult.messageId,
        startOTP: rideRequest.startOTP,
        endOTP: rideRequest.endOTP
      });

      return res.json({
        success: true,
        message: 'OTP SMS sent successfully',
        data: {
          phone: customerPhone,
          messageId: smsResult.messageId,
          status: smsResult.status,
          timestamp: new Date().toISOString()
        }
      });

    } else {
      console.error(`❌ Failed to send resend OTP SMS to ${customerPhone}:`, smsResult.error);

      // Log failed resend
      logError(rideRequest._id, 'sms_otp_resend_failed', {
        adminId: req.admin._id,
        adminName: req.admin.name,
        phone: customerPhone,
        error: smsResult.error,
        errorCode: smsResult.errorCode
      });

      return res.status(400).json({
        success: false,
        error: smsResult.error,
        errorCode: smsResult.errorCode,
        data: {
          phone: customerPhone,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error('❌ Resend OTP error:', error.message);

    // Log system error
    const { logError } = require('../utils/rideLogger');
    logError(req.params.rideId, 'sms_resend_system_error', {
      adminId: req.admin?._id,
      adminName: req.admin?.name,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error while sending SMS',
      errorCode: 'SYSTEM_ERROR'
    });
  }
});

// SMS service status endpoint (for debugging)
router.get('/sms-status', adminProtect, (req, res) => {
  const configStatus = twilioSmsService.getConfigStatus();

  res.json({
    success: true,
    smsService: {
      configured: configStatus.isConfigured,
      details: configStatus
    }
  });
});

// Export router
module.exports = router;