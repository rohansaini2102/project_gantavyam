const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
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

// Create multer instances
const uploadDriverDocuments = multer({ 
  storage: driverDocumentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const uploadProfileImage = multer({ 
  storage: profileImageStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  }
});

// Delete image from cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadDriverDocuments,
  uploadProfileImage,
  deleteFromCloudinary
};