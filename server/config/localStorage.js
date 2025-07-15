const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const driverDocsDir = path.join(uploadsDir, 'driver-documents');

// Create directories if they don't exist
const createDirectories = () => {
  const directories = [
    uploadsDir,
    driverDocsDir,
    path.join(driverDocsDir, 'aadhaar'),
    path.join(driverDocsDir, 'selfies'),
    path.join(driverDocsDir, 'driving-license'),
    path.join(driverDocsDir, 'registration'),
    path.join(driverDocsDir, 'permit'),
    path.join(driverDocsDir, 'fitness'),
    path.join(driverDocsDir, 'insurance'),
    path.join(uploadsDir, 'profile-images')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};

// Initialize directories
createDirectories();

// Local storage configuration for driver documents
const localDriverDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = driverDocsDir;
    
    // Organize by document type
    if (file.fieldname === 'aadhaarPhotoFront' || file.fieldname === 'aadhaarPhotoBack') {
      folder = path.join(driverDocsDir, 'aadhaar');
    } else if (file.fieldname === 'driverSelfie') {
      folder = path.join(driverDocsDir, 'selfies');
    } else if (file.fieldname === 'drivingLicensePhoto') {
      folder = path.join(driverDocsDir, 'driving-license');
    } else if (file.fieldname === 'registrationCertificatePhoto') {
      folder = path.join(driverDocsDir, 'registration');
    } else if (file.fieldname === 'permitPhoto') {
      folder = path.join(driverDocsDir, 'permit');
    } else if (file.fieldname === 'fitnessCertificatePhoto') {
      folder = path.join(driverDocsDir, 'fitness');
    } else if (file.fieldname === 'insurancePolicyPhoto') {
      folder = path.join(driverDocsDir, 'insurance');
    }
    
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
    cb(null, fileName);
  }
});

// Local storage configuration for profile images
const localProfileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadsDir, 'profile-images'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${fileExtension}`);
  }
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  // Accept only images and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image files and PDFs are allowed'), false);
  }
};

// Create multer instances for local storage
const localUploadDriverDocuments = multer({
  storage: localDriverDocumentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter
});

const localUploadProfileImage = multer({
  storage: localProfileImageStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter
});

// Helper function to get local file URL
const getLocalFileUrl = (req, filename, category = 'driver-documents') => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${category}/${filename}`;
};

// Helper function to delete local file
const deleteLocalFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted local file: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting local file:', error);
    return false;
  }
};

// Helper function to move file from temp to permanent location
const moveFile = (tempPath, permanentPath) => {
  return new Promise((resolve, reject) => {
    fs.rename(tempPath, permanentPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(permanentPath);
      }
    });
  });
};

// Check if file exists locally
const fileExists = (filePath) => {
  return fs.existsSync(filePath);
};

module.exports = {
  localUploadDriverDocuments,
  localUploadProfileImage,
  getLocalFileUrl,
  deleteLocalFile,
  moveFile,
  fileExists,
  uploadsDir,
  driverDocsDir,
  createDirectories
};