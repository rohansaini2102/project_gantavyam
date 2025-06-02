// routes/drivers.js
const express = require('express');
const router = express.Router();
const { uploadDriverDocuments } = require('../config/cloudinary');
const { protect } = require('../middleware/auth');
const {
  registerDriver,
  loginDriver,
  getDriverProfile,
  updateDriverLocation
} = require('../controllers/driverController');
const jwt = require('jsonwebtoken');

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

// Public routes
router.post('/register', driverDocumentUpload, registerDriver);
router.post('/login', loginDriver);

// Protected routes
router.get('/profile', protect, getDriverProfile);
router.put('/location', protect, updateDriverLocation);

// Debug route to check token
router.get('/check-token', protect, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      res.json({
        success: true,
        decoded,
        hasRole: !!decoded.role,
        role: decoded.role || 'not set'
      });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  } else {
    res.json({ success: false, error: 'No token' });
  }
});

// Export router
module.exports = router;