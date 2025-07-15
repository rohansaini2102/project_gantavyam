const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure cloudinary with timeout and retry settings
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000, // 60 second timeout
  secure: true // Use HTTPS
});

// Create storage for driver documents
const driverDocumentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'gantavyam/driver-documents';
    
    // Organize by document type
    if (file.fieldname === 'aadhaarPhotoFront' || file.fieldname === 'aadhaarPhotoBack') folder += '/aadhaar';
    else if (file.fieldname === 'driverSelfie') folder += '/selfies';
    else if (file.fieldname === 'drivingLicensePhoto') folder += '/driving-license';
    else if (file.fieldname === 'registrationCertificatePhoto') folder += '/registration';
    else if (file.fieldname === 'permitPhoto') folder += '/permit';
    else if (file.fieldname === 'fitnessCertificatePhoto') folder += '/fitness';
    else if (file.fieldname === 'insurancePolicyPhoto') folder += '/insurance';
    
    return {
      folder: folder,
      allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
      public_id: `${file.fieldname}-${Date.now()}`,
      resource_type: 'auto'
    };
  }
});

// Create storage for profile images
const profileImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gantavyam/profile-images',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 500, height: 500, crop: 'fill' }],
    public_id: (req, file) => `profile-${Date.now()}`
  }
});

// Create multer instances with enhanced error handling
const uploadDriverDocuments = multer({ 
  storage: driverDocumentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image files and PDFs are allowed'), false);
    }
  }
});

const uploadProfileImage = multer({ 
  storage: profileImageStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  }
});

// Retry function for Cloudinary operations
const retryCloudinaryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Cloudinary operation attempt ${i + 1} failed:`, error.message);
      
      if (i === maxRetries - 1) {
        throw error; // Last attempt failed, throw the error
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

// Upload file to cloudinary with retry
const uploadToCloudinary = async (filePath, options = {}) => {
  return retryCloudinaryOperation(async () => {
    return await cloudinary.uploader.upload(filePath, {
      timeout: 60000,
      ...options
    });
  });
};

// Delete image from cloudinary with retry
const deleteFromCloudinary = async (publicId) => {
  return retryCloudinaryOperation(async () => {
    return await cloudinary.uploader.destroy(publicId);
  });
};

module.exports = {
  cloudinary,
  uploadDriverDocuments,
  uploadProfileImage,
  deleteFromCloudinary,
  uploadToCloudinary,
  retryCloudinaryOperation
};