// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up disk storage for uploaded files
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Create unique filename with timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
  }
});

// Check file type and size
const fileFilter = (req, file, cb) => {
  // Allow only images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Initialize multer with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Define the required file fields for driver registration
const driverFileFields = [
  { name: 'aadhaarPhoto', maxCount: 1 },
  { name: 'registrationCertificatePhoto', maxCount: 1 },
  { name: 'drivingLicensePhoto', maxCount: 1 },
  { name: 'permitPhoto', maxCount: 1 },
  { name: 'fitnessCertificatePhoto', maxCount: 1 },
  { name: 'insurancePolicyPhoto', maxCount: 1 }
];

// Middleware for handling driver file uploads
const driverFileUpload = (req, res, next) => {
  const uploadMiddleware = upload.fields(driverFileFields);
  
  uploadMiddleware(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred (e.g., file too large)
      console.error(`[Upload Error] ${err.message}`);
      return res.status(400).json({
        success: false,
        error: `File upload error: ${err.message}`
      });
    } else if (err) {
      // Other errors (e.g., file type not allowed)
      console.error(`[Upload Error] ${err.message}`);
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    
    // Log received files for debugging
    console.log('[Files Received]', req.files ? Object.keys(req.files) : 'No files');
    
    // Continue to next middleware/controller
    next();
  });
};

module.exports = { 
  upload,
  driverFileUpload
};