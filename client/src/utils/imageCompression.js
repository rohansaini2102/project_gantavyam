import imageCompression from 'browser-image-compression';

// Default compression options - OPTIMIZED FOR MAXIMUM SPEED
const DEFAULT_OPTIONS = {
  maxSizeMB: 0.5, // Reduced to 500KB for faster uploads
  maxWidthOrHeight: 1280, // Reduced max dimension for faster processing
  useWebWorker: true, // Use web worker for better performance
  initialQuality: 0.6, // Lower quality for much faster processing
  alwaysKeepResolution: false,
  fileType: 'image/jpeg', // Force JPEG for smaller file size
  maxIteration: 5, // Limit iterations for faster processing
  exifOrientation: true, // Maintain proper orientation
  preserveExif: false // Remove EXIF data to reduce size
};

// Document-specific compression options - AGGRESSIVE OPTIMIZATION for upload speed
const DOCUMENT_OPTIONS = {
  aadhaar: {
    maxSizeMB: 0.4, // Reduced from 0.6MB - still readable for Aadhaar
    maxWidthOrHeight: 1200, // Reduced from 1600px - adequate for text documents
    initialQuality: 0.6, // Reduced from 0.75 - text is still clear at this quality
    fileType: 'image/jpeg',
    maxIteration: 3 // Fewer iterations for speed
  },
  license: {
    maxSizeMB: 0.4, // Reduced from 0.6MB
    maxWidthOrHeight: 1200, // Reduced from 1600px
    initialQuality: 0.6, // Reduced from 0.75
    fileType: 'image/jpeg',
    maxIteration: 3
  },
  selfie: {
    maxSizeMB: 0.3, // Reduced from 0.4MB - faces are recognizable at this size
    maxWidthOrHeight: 800, // Reduced from 1080px - sufficient for face recognition
    initialQuality: 0.65, // Reduced from 0.8 - still clear enough for selfies
    fileType: 'image/jpeg',
    maxIteration: 3
  },
  document: {
    maxSizeMB: 0.5, // Reduced from 0.8MB
    maxWidthOrHeight: 1400, // Reduced from 1800px
    initialQuality: 0.6, // Reduced from 0.75
    fileType: 'image/jpeg',
    maxIteration: 4
  },
  // Preview quality for instant feedback (very fast)
  preview: {
    maxSizeMB: 0.1, // 100KB for previews
    maxWidthOrHeight: 400, // Small preview size
    initialQuality: 0.5, // Low quality for preview
    fileType: 'image/jpeg',
    maxIteration: 1 // Single iteration for speed
  }
};

/**
 * Compress an image file
 * @param {File} imageFile - The image file to compress
 * @param {string} documentType - Type of document (aadhaar, license, selfie, document)
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<File>} - Compressed image file
 */
export const compressImage = async (imageFile, documentType = 'document', onProgress = null) => {
  const startTime = performance.now();
  
  try {
    // Validate file first
    const validation = validateImageFile(imageFile);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const fileSizeMB = imageFile.size / 1024 / 1024;
    console.log(`[Image Compression] ${imageFile.name}: ${fileSizeMB.toFixed(2)}MB`);

    // Dynamic skip threshold based on document type
    const skipThresholds = {
      aadhaar: 0.2, // Skip if under 200KB
      license: 0.2,
      selfie: 0.15, // Skip if under 150KB
      document: 0.25,
      preview: 0.05 // Skip if under 50KB for previews
    };

    const skipThreshold = skipThresholds[documentType] || 0.2;

    // Skip compression for files already smaller than threshold
    if (fileSizeMB <= skipThreshold) {
      console.log(`[Image Compression] File already optimal (${fileSizeMB.toFixed(2)}MB < ${skipThreshold}MB), skipping compression`);
      if (onProgress) onProgress(100);
      return imageFile;
    }

    // Get appropriate compression options
    const options = {
      ...DEFAULT_OPTIONS,
      ...(DOCUMENT_OPTIONS[documentType] || DOCUMENT_OPTIONS.document),
      onProgress: onProgress ? (progress) => {
        try {
          onProgress(Math.round(Math.min(100, Math.max(0, progress))));
        } catch (error) {
          console.error('[Image Compression] Progress callback error:', error);
        }
      } : undefined
    };

    console.log(`[Image Compression] Compressing ${imageFile.name} with options:`, {
      maxSizeMB: options.maxSizeMB,
      maxWidthOrHeight: options.maxWidthOrHeight,
      initialQuality: options.initialQuality,
      documentType
    });

    // Compress the image
    const compressedFile = await imageCompression(imageFile, options);
    
    const compressedSizeMB = compressedFile.size / 1024 / 1024;
    const compressionRatio = ((1 - compressedFile.size / imageFile.size) * 100).toFixed(1);
    const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
    
    console.log(`[Image Compression] ${imageFile.name}: ${compressedSizeMB.toFixed(2)}MB (${compressionRatio}% reduction) in ${processingTime}s`);
    
    return compressedFile;
  } catch (error) {
    const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(`[Image Compression] Failed to compress ${imageFile.name} after ${processingTime}s:`, error);
    
    // Return original file if compression fails
    if (onProgress) onProgress(100);
    return imageFile;
  }
};

/**
 * Compress multiple images in parallel
 * @param {Object} files - Object with file arrays (e.g., { aadhaarPhotoFront: [File], ... })
 * @param {function} onProgress - Progress callback for overall progress
 * @returns {Promise<Object>} - Object with compressed files
 */
export const compressMultipleImages = async (files, onProgress = null) => {
  const compressedFiles = {};
  const fileEntries = Object.entries(files).filter(([, fileArray]) => fileArray && fileArray.length > 0);
  const totalFiles = fileEntries.length;
  
  if (totalFiles === 0) {
    console.log('[Image Compression] No files to compress');
    return compressedFiles;
  }

  console.log(`[Image Compression] Starting compression of ${totalFiles} files`);
  const completedFiles = new Set();
  
  // Safely call progress callback with validation
  const safeProgressCallback = (progress) => {
    if (typeof onProgress === 'function') {
      try {
        onProgress(Math.min(100, Math.max(0, Math.round(progress))));
      } catch (error) {
        console.error('[Image Compression] Progress callback error:', error);
      }
    }
  };

  // Initial progress
  safeProgressCallback(0);

  const compressionPromises = fileEntries.map(([fieldName, fileArray]) => {
    const file = fileArray[0];
    let documentType = 'document';

    // Determine document type for optimal compression
    if (fieldName.toLowerCase().includes('aadhaar')) {
      documentType = 'aadhaar';
    } else if (fieldName.toLowerCase().includes('license')) {
      documentType = 'license';
    } else if (fieldName.toLowerCase().includes('selfie')) {
      documentType = 'selfie';
    }

    console.log(`[Image Compression] Starting ${fieldName} (${documentType})`);

    return compressImage(file, documentType, (fileProgress) => {
      // Update overall progress based on completed files + current file progress
      const overallProgress = ((completedFiles.size + fileProgress / 100) / totalFiles) * 100;
      safeProgressCallback(overallProgress);
    }).then(compressedFile => {
      compressedFiles[fieldName] = [compressedFile];
      completedFiles.add(fieldName);
      
      // Update progress for completed file
      const overallProgress = (completedFiles.size / totalFiles) * 100;
      safeProgressCallback(overallProgress);
      
      console.log(`[Image Compression] Completed ${fieldName} (${completedFiles.size}/${totalFiles})`);
      return compressedFile;
    }).catch(error => {
      console.error(`[Image Compression] Failed to compress ${fieldName}:`, error);
      // Use original file if compression fails
      compressedFiles[fieldName] = [file];
      completedFiles.add(fieldName);
      
      const overallProgress = (completedFiles.size / totalFiles) * 100;
      safeProgressCallback(overallProgress);
      
      return file;
    });
  });

  await Promise.all(compressionPromises);
  
  // Ensure 100% progress is reported
  safeProgressCallback(100);
  console.log(`[Image Compression] All ${totalFiles} files compressed successfully`);
  
  return compressedFiles;
};

/**
 * Validate file before compression
 * @param {File} file - File to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateImageFile = (file) => {
  const MAX_SIZE_MB = 10;
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' };
  }

  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > MAX_SIZE_MB) {
    return { valid: false, error: `File too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_SIZE_MB}MB.` };
  }

  return { valid: true, error: null };
};

/**
 * Get file size in readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Readable file size
 */
export const getReadableFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};