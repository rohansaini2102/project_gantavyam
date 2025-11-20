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

  // Process uploaded files with dual storage strategy (PARALLEL)
  async processUploads(files, req) {
    const results = {};
    const errors = [];
    const uploadPromises = [];
    const fieldNames = [];

    // Prepare all upload promises
    for (const [fieldName, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray[0]) {
        const file = fileArray[0];
        fieldNames.push(fieldName);

        // Create upload promise with progress tracking
        const uploadPromise = this.uploadFile(file, fieldName, req)
          .then(result => {
            console.log(`✅ [Dual Storage] ${fieldName} uploaded via ${result.storage}`);
            return { fieldName, success: true, result };
          })
          .catch(error => {
            console.error(`❌ [Dual Storage] Failed to upload ${fieldName}:`, error.message);
            return { fieldName, success: false, error: error.message };
          });

        uploadPromises.push(uploadPromise);
      }
    }

    // Execute all uploads in parallel
    console.log(`[Dual Storage] Starting parallel upload of ${uploadPromises.length} files...`);
    const startTime = Date.now();

    const uploadResults = await Promise.allSettled(uploadPromises);

    const endTime = Date.now();
    console.log(`[Dual Storage] Parallel upload completed in ${endTime - startTime}ms`);

    // Process results
    uploadResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const uploadResult = result.value;
        if (uploadResult.success) {
          results[uploadResult.fieldName] = uploadResult.result.url;
        } else {
          errors.push({
            fieldName: uploadResult.fieldName,
            error: uploadResult.error
          });
          // Use placeholder for failed uploads
          results[uploadResult.fieldName] = `UPLOAD_FAILED_${uploadResult.fieldName}_${Date.now()}`;
        }
      } else {
        // Promise rejected (should not happen with our catch above, but just in case)
        const fieldName = fieldNames[index];
        errors.push({
          fieldName,
          error: result.reason?.message || 'Unknown error'
        });
        results[fieldName] = `UPLOAD_FAILED_${fieldName}_${Date.now()}`;
      }
    });

    console.log(`[Dual Storage] Upload summary: ${Object.keys(results).length - errors.length} succeeded, ${errors.length} failed`);

    return { results, errors };
  }

  // Upload a single file with fallback strategy and retry mechanism
  async uploadFile(file, fieldName, req, maxRetries = 3) {
    let lastError = null;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      // Try Cloudinary first if enabled and not too many failures
      if (this.useCloudinary && this.cloudinaryFailures < this.maxFailures) {
        try {
          const cloudinaryResult = await this.uploadToCloudinaryWithRetry(file, fieldName, 2);
          this.cloudinaryFailures = 0; // Reset failure count on success
          return {
            url: cloudinaryResult.secure_url || cloudinaryResult.url,
            storage: 'cloudinary',
            publicId: cloudinaryResult.public_id
          };
        } catch (cloudinaryError) {
          lastError = cloudinaryError;
          console.warn(`⚠️ [Dual Storage] Cloudinary upload failed for ${fieldName} (attempt ${retryCount + 1}/${maxRetries}):`, cloudinaryError.message);
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
        lastError = localError;
        console.error(`❌ [Dual Storage] Local upload also failed for ${fieldName} (attempt ${retryCount + 1}/${maxRetries}):`, localError.message);
        retryCount++;

        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`[Dual Storage] Retrying ${fieldName} upload in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to upload ${fieldName} after ${maxRetries} attempts: ${lastError?.message}`);
  }

  // Upload to Cloudinary with retry
  async uploadToCloudinaryWithRetry(file, fieldName, maxRetries = 2) {
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.uploadToCloudinary(file, fieldName);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          const delay = Math.min(500 * Math.pow(2, attempt), 2000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
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