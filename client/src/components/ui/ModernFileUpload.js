import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  File,
  CheckCircle2,
  AlertCircle,
  X,
  Camera,
  Image,
  RefreshCw,
  Download,
  HelpCircle
} from 'lucide-react';

const ModernFileUpload = ({
  name,
  label,
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024, // 5MB
  file,
  error,
  required = false,
  multiple = false,
  helpText,
  onFileChange,
  onRemove,
  className = '',
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFiles) => {
    if (!selectedFiles?.length) return;

    setIsProcessing(true);

    try {
      const file = selectedFiles[0];

      // Validate file
      const validation = validateFile(file, maxSize, accept);
      if (validation.error) {
        onFileChange?.(null, validation.error);
        return;
      }

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        setPreview(previewUrl);
      }

      onFileChange?.(file, null);
    } catch (error) {
      onFileChange?.(null, {
        message: 'Failed to process file',
        type: 'error',
        suggestion: 'Please try again with a different file'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [maxSize, accept, onFileChange]);

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
  }, [disabled, handleFileSelect]);

  // Handle input change
  const handleInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleFileSelect(files);
  };

  // Handle click to select
  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file removal
  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    onRemove?.(name);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get upload area state classes
  const getUploadAreaClasses = () => {
    if (disabled) {
      return 'border-gray-200 bg-gray-50 cursor-not-allowed';
    }

    if (error) {
      return 'border-red-300 bg-red-50 hover:border-red-400';
    }

    if (file) {
      return 'border-green-300 bg-green-50 hover:border-green-400';
    }

    if (isDragOver) {
      return 'border-blue-400 bg-blue-50 ring-2 ring-blue-200';
    }

    return 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100';
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {helpText && (
          <div className="group relative">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs p-2 rounded-lg w-64 z-50">
              {helpText}
              <div className="absolute top-full right-4 -mt-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <motion.div
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-all duration-300
          ${getUploadAreaClasses()}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={!disabled ? { scale: 1.01 } : {}}
        whileTap={!disabled ? { scale: 0.99 } : {}}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <AnimatePresence mode="wait">
          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-blue-600 font-medium">Processing file...</p>
            </motion.div>
          )}

          {!isProcessing && !file && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center cursor-pointer"
              onClick={handleClick}
            >
              <motion.div
                className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isDragOver ? 'bg-blue-100' : 'bg-gray-100'
                }`}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                {accept.includes('image') ? (
                  <Camera className={`w-6 h-6 ${isDragOver ? 'text-blue-600' : 'text-gray-500'}`} />
                ) : (
                  <Upload className={`w-6 h-6 ${isDragOver ? 'text-blue-600' : 'text-gray-500'}`} />
                )}
              </motion.div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {isDragOver ? 'Drop file here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-gray-500">
                  {accept.includes('image') ? 'PNG, JPG, JPEG' : 'PDF, DOC, DOCX'} up to {formatFileSize(maxSize)}
                </p>
              </div>
            </motion.div>
          )}

          {!isProcessing && file && (
            <motion.div
              key="uploaded"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4"
            >
              {/* Preview */}
              {preview ? (
                <div className="relative group">
                  <img
                    src={preview}
                    alt={`${label} preview`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                    <motion.button
                      type="button"
                      onClick={() => window.open(preview, '_blank')}
                      className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-2 shadow-lg transition-opacity"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Download className="w-4 h-4 text-gray-700" />
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center p-4 bg-white rounded-lg border">
                  <File className="w-8 h-8 text-gray-400 mr-3" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-48">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              )}

              {/* File info and actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Replace button */}
                  <motion.button
                    type="button"
                    onClick={handleClick}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Replace file"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </motion.button>

                  {/* Remove button */}
                  <motion.button
                    type="button"
                    onClick={handleRemove}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-red-800">{error.message}</div>
                  {error.suggestion && (
                    <div className="mt-1 text-xs text-red-600 flex items-start gap-1">
                      <span className="mt-0.5">💡</span>
                      <span>{error.suggestion}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Utility functions
const validateFile = (file, maxSize, accept) => {
  // Check file size
  if (file.size > maxSize) {
    return {
      error: {
        message: 'File too large',
        type: 'size',
        suggestion: `Please choose a file smaller than ${formatFileSize(maxSize)}. You can compress the image using online tools.`
      }
    };
  }

  // Check file type
  const acceptedTypes = accept.split(',').map(type => type.trim());
  const isValidType = acceptedTypes.some(type => {
    if (type === 'image/*') return file.type.startsWith('image/');
    if (type === 'application/*') return file.type.startsWith('application/');
    return file.type === type;
  });

  if (!isValidType) {
    return {
      error: {
        message: 'Invalid file type',
        type: 'format',
        suggestion: `Please upload files in these formats: ${acceptedTypes.join(', ')}. Make sure your file has the correct extension.`
      }
    };
  }

  return { error: null };
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default ModernFileUpload;