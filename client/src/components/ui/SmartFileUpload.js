import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  FileImage,
  AlertCircle,
  CheckCircle2,
  Camera,
  Loader2,
  ZoomIn,
  RotateCw,
  Download,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

const SmartFileUpload = ({
  name,
  label,
  file,
  error,
  required = false,
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024, // 5MB
  onFileChange,
  onRemove,
  disabled = false,
  className = '',
  allowCamera = false,
  showPreview = true,
  compressionQuality = 0.8
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // File compression utility
  const compressImage = useCallback((file, quality = compressionQuality) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions (max 1920x1080)
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }, [compressionQuality]);

  // File validation
  const validateFile = useCallback((file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Only JPG, JPEG, or PNG files are allowed',
        suggestion: 'Please select an image file in the correct format'
      };
    }

    if (file.size > maxSize) {
      const sizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      return {
        isValid: false,
        error: `File size must be less than ${sizeMB}MB`,
        suggestion: 'Please compress your image or select a smaller file'
      };
    }

    if (file.size < 10 * 1024) { // 10KB minimum
      return {
        isValid: false,
        error: 'File size is too small (minimum 10KB)',
        suggestion: 'Please select a higher quality image'
      };
    }

    return { isValid: true };
  }, [maxSize]);

  // Process file with compression and validation
  const processFile = useCallback(async (file) => {
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        onFileChange?.(null, validation.error);
        toast.error(validation.error);
        return;
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Compress image if it's large
      let processedFile = file;
      if (file.size > 1024 * 1024) { // 1MB threshold
        processedFile = await compressImage(file);
        processedFile = new File([processedFile], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
      }

      // Create preview URL
      const url = URL.createObjectURL(processedFile);
      setPreviewUrl(url);

      // Complete upload
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Call onChange with processed file
      onFileChange?.(processedFile, null);
      toast.success('File uploaded successfully!');

      setTimeout(() => {
        setUploadProgress(0);
        setIsProcessing(false);
      }, 500);

    } catch (err) {
      console.error('File processing error:', err);
      onFileChange?.(null, 'Failed to process file');
      toast.error('Failed to process file');
      setIsProcessing(false);
      setUploadProgress(0);
    }
  }, [validateFile, onFileChange, compressImage]);

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
    setIsDragActive(false);
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png'] },
    maxFiles: 1,
    disabled: disabled || isProcessing,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false)
  });

  // Handle camera capture
  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Handle file remove
  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onRemove?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Get file info display
  const getFileInfo = () => {
    if (!file) return null;

    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const displaySize = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

    return {
      name: file.name,
      size: displaySize,
      type: file.type
    };
  };

  const fileInfo = getFileInfo();
  const hasFile = file && !error;
  const hasError = !!error;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Upload Area */}
      <AnimatePresence mode="wait">
        {!hasFile ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div
              {...getRootProps()}
              className={`
                relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200
                ${isDragActive || dropzoneActive
                  ? 'border-blue-400 bg-blue-50'
                  : hasError
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                }
                ${disabled ? 'cursor-not-allowed opacity-50' : ''}
              `}
            >
              <input {...getInputProps()} ref={fileInputRef} />

              {isProcessing ? (
                <div className="space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-500 mx-auto animate-spin" />
                  <p className="text-sm text-gray-600">Processing image...</p>
                  {uploadProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        className="bg-blue-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <Upload className={`w-8 h-8 mx-auto ${
                      isDragActive ? 'text-blue-500' : hasError ? 'text-red-500' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {isDragActive ? 'Drop image here' : 'Upload image'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Drag & drop or click to browse
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        PNG, JPG up to {(maxSize / (1024 * 1024)).toFixed(1)}MB
                      </p>
                    </div>
                  </div>

                  {allowCamera && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleCameraCapture}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800"
                        disabled={disabled}
                      >
                        <Camera className="w-4 h-4" />
                        <span>Take photo</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="border border-gray-200 rounded-lg p-4 bg-white"
          >
            <div className="flex items-start space-x-4">
              {/* Preview Image */}
              {showPreview && (previewUrl || file) && (
                <div className="relative flex-shrink-0">
                  <img
                    src={previewUrl || URL.createObjectURL(file)}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImageModal(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 rounded-lg transition-all duration-200"
                  >
                    <Eye className="w-4 h-4 text-white opacity-0 hover:opacity-100" />
                  </button>
                </div>
              )}

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileInfo?.name || 'Uploaded file'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {fileInfo?.size} • {fileInfo?.type}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      disabled={disabled}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-start space-x-2 text-sm text-red-600"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Modal */}
      <AnimatePresence>
        {showImageModal && (previewUrl || file) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
            onClick={() => setShowImageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl max-h-screen p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewUrl || URL.createObjectURL(file)}
                alt="Full size preview"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartFileUpload;