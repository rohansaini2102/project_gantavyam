const cloudinaryConfig = require('./cloudinary');
const localStorageConfig = require('./localStorage');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Dual storage strategy: Try Cloudinary first, fallback to local
class DualStorageManager {
  constructor() {
    this.useCloudinary = true; // Start with Cloudinary enabled
    this.cloudinaryFailures = 0;
    this.maxFailures = 3; // Switch to local after 3 consecutive failures
  }

  // Custom storage engine that handles both Cloudinary and local storage
  createDualStorage() {
    return multer.memoryStorage(); // Use memory storage to handle files manually
  }

  // Process uploaded files with dual storage strategy
  async processUploads(files, req) {
    const results = {};
    const errors = [];

    for (const [fieldName, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray[0]) {
        const file = fileArray[0];
        
        try {
          const result = await this.uploadFile(file, fieldName, req);
          results[fieldName] = result.url;
          console.log(`✅ [Dual Storage] ${fieldName} uploaded via ${result.storage}`);
        } catch (error) {
          console.error(`❌ [Dual Storage] Failed to upload ${fieldName}:`, error.message);
          errors.push({ fieldName, error: error.message });
          // Use placeholder for failed uploads
          results[fieldName] = `UPLOAD_FAILED_${fieldName}_${Date.now()}`;
        }
      }
    }

    return { results, errors };
  }

  // Upload a single file with fallback strategy
  async uploadFile(file, fieldName, req) {
    // Try Cloudinary first if enabled and not too many failures
    if (this.useCloudinary && this.cloudinaryFailures < this.maxFailures) {
      try {
        const cloudinaryResult = await this.uploadToCloudinary(file, fieldName);
        this.cloudinaryFailures = 0; // Reset failure count on success
        return {
          url: cloudinaryResult.secure_url || cloudinaryResult.url,
          storage: 'cloudinary',
          publicId: cloudinaryResult.public_id
        };
      } catch (cloudinaryError) {
        console.warn(`⚠️ [Dual Storage] Cloudinary upload failed for ${fieldName}:`, cloudinaryError.message);
        this.cloudinaryFailures++;
        
        if (this.cloudinaryFailures >= this.maxFailures) {
          console.warn(`⚠️ [Dual Storage] Disabling Cloudinary after ${this.maxFailures} consecutive failures`);
          this.useCloudinary = false;
        }
        
        // Fall through to local storage
      }
    }

    // Use local storage as fallback
    try {
      const localResult = await this.uploadToLocal(file, fieldName, req);
      return {
        url: localResult.url,
        storage: 'local',
        path: localResult.path
      };
    } catch (localError) {
      console.error(`❌ [Dual Storage] Local upload also failed for ${fieldName}:`, localError.message);
      throw new Error(`Both Cloudinary and local storage failed: ${localError.message}`);
    }
  }

  // Upload to Cloudinary
  async uploadToCloudinary(file, fieldName) {
    const cloudinary = cloudinaryConfig.cloudinary;
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: this.getCloudinaryFolder(fieldName),
          public_id: `${fieldName}-${Date.now()}`,
          resource_type: 'auto',
          timeout: 60000
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  // Upload to local storage
  async uploadToLocal(file, fieldName, req) {
    const uploadsDir = localStorageConfig.uploadsDir;
    const folder = this.getLocalFolder(fieldName);
    const filename = `${fieldName}-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const filePath = path.join(folder, filename);

    // Ensure directory exists
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    // Write file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    // Generate URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const relativePath = path.relative(uploadsDir, filePath).replace(/\\/g, '/');
    const url = `${baseUrl}/uploads/${relativePath}`;

    return { url, path: filePath };
  }

  // Get Cloudinary folder based on field name
  getCloudinaryFolder(fieldName) {
    let folder = 'gantavyam/driver-documents';
    
    if (fieldName === 'aadhaarPhotoFront' || fieldName === 'aadhaarPhotoBack') {
      folder += '/aadhaar';
    } else if (fieldName === 'driverSelfie') {
      folder += '/selfies';
    } else if (fieldName === 'drivingLicensePhoto') {
      folder += '/driving-license';
    } else if (fieldName === 'registrationCertificatePhoto') {
      folder += '/registration';
    } else if (fieldName === 'permitPhoto') {
      folder += '/permit';
    } else if (fieldName === 'fitnessCertificatePhoto') {
      folder += '/fitness';
    } else if (fieldName === 'insurancePolicyPhoto') {
      folder += '/insurance';
    }

    return folder;
  }

  // Get local folder based on field name
  getLocalFolder(fieldName) {
    const baseDir = path.join(localStorageConfig.driverDocsDir);
    
    if (fieldName === 'aadhaarPhotoFront' || fieldName === 'aadhaarPhotoBack') {
      return path.join(baseDir, 'aadhaar');
    } else if (fieldName === 'driverSelfie') {
      return path.join(baseDir, 'selfies');
    } else if (fieldName === 'drivingLicensePhoto') {
      return path.join(baseDir, 'driving-license');
    } else if (fieldName === 'registrationCertificatePhoto') {
      return path.join(baseDir, 'registration');
    } else if (fieldName === 'permitPhoto') {
      return path.join(baseDir, 'permit');
    } else if (fieldName === 'fitnessCertificatePhoto') {
      return path.join(baseDir, 'fitness');
    } else if (fieldName === 'insurancePolicyPhoto') {
      return path.join(baseDir, 'insurance');
    }

    return baseDir;
  }

  // Get storage status
  getStatus() {
    return {
      cloudinaryEnabled: this.useCloudinary,
      cloudinaryFailures: this.cloudinaryFailures,
      maxFailures: this.maxFailures
    };
  }

  // Reset Cloudinary (try enabling it again)
  resetCloudinary() {
    this.useCloudinary = true;
    this.cloudinaryFailures = 0;
    console.log('🔄 [Dual Storage] Cloudinary re-enabled');
  }

  // Force local storage mode
  forceLocalStorage() {
    this.useCloudinary = false;
    console.log('🏠 [Dual Storage] Forced to local storage mode');
  }
}

// Create dual storage instance
const dualStorageManager = new DualStorageManager();

// Create multer instance with dual storage
const dualUploadDriverDocuments = multer({
  storage: dualStorageManager.createDualStorage(),
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

// Configure multer fields
const dualUploadFields = dualUploadDriverDocuments.fields([
  { name: 'aadhaarPhotoFront', maxCount: 1 },
  { name: 'aadhaarPhotoBack', maxCount: 1 },
  { name: 'driverSelfie', maxCount: 1 },
  { name: 'drivingLicensePhoto', maxCount: 1 },
  { name: 'registrationCertificatePhoto', maxCount: 1 },
  { name: 'permitPhoto', maxCount: 1 },
  { name: 'fitnessCertificatePhoto', maxCount: 1 },
  { name: 'insurancePolicyPhoto', maxCount: 1 }
]);

module.exports = {
  dualStorageManager,
  dualUploadDriverDocuments,
  dualUploadFields
};