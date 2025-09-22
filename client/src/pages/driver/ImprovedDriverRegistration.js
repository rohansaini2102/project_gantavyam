import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FiUser, FiCreditCard, FiClipboard, FiLock, FiSave, FiLoader } from 'react-icons/fi';

// Existing components
import ModernUpload from '../../components/common/ModernUpload';
import CameraCapture from '../../components/common/CameraCapture';
import ModernCard from '../../components/admin/ModernCard';

// Enhanced utilities and schemas
import {
  getStepSchema,
  completeDriverSchema,
  validationUtils
} from '../../schemas/enhancedDriverValidation';
import { formatters } from '../../utils/enhancedFormatters';
import useDataPersistence from '../../hooks/useDataPersistence';

// API services
import { registerDriver } from '../../services/api';

const steps = [
  { key: 'personal', label: 'Personal Info', icon: <FiUser /> },
  { key: 'bank', label: 'Bank Details', icon: <FiCreditCard /> },
  { key: 'license', label: 'Licenses', icon: <FiClipboard /> },
  { key: 'security', label: 'Security', icon: <FiLock /> },
];

const ImprovedDriverRegistration = () => {
  const navigate = useNavigate();

  // State management
  const [activeSection, setActiveSection] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [completedSections, setCompletedSections] = useState([]);

  // Data persistence
  const {
    isAutoSaving,
    lastSaved,
    savedData,
    autoSave,
    saveNow,
    clearPersistedData,
    hasPersistedData,
    getLastSavedText,
    getCompletionPercentage
  } = useDataPersistence('improvedDriverRegistration');

  // Get current step index and schema
  const currentStepIndex = steps.findIndex(step => step.key === activeSection);
  const currentStepSchema = getStepSchema(activeSection);

  // Form setup with react-hook-form
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
    getValues,
    trigger,
    reset
  } = useForm({
    resolver: yupResolver(currentStepSchema),
    mode: 'onChange',
    defaultValues: savedData
  });

  // Watch all form values for auto-save
  const watchedValues = watch();

  // Files state
  const [files, setFiles] = useState({
    aadhaarPhotoFront: null,
    aadhaarPhotoBack: null,
    driverSelfie: null,
    registrationCertificatePhoto: null,
    drivingLicensePhoto: null,
    permitPhoto: null,
    fitnessCertificatePhoto: null,
    insurancePolicyPhoto: null
  });

  // Load saved data on mount
  useEffect(() => {
    if (hasPersistedData() && Object.keys(savedData).length > 0) {
      reset(savedData);
      toast.success('Previous progress restored!');
    }
  }, [hasPersistedData, savedData, reset]);

  // Auto-save form data when it changes
  useEffect(() => {
    if (isDirty && Object.keys(watchedValues).length > 0) {
      autoSave(watchedValues, currentStepIndex);
    }
  }, [watchedValues, isDirty, autoSave, currentStepIndex]);

  // Check admin token
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  // API validation cache to avoid duplicate calls
  const [validationCache, setValidationCache] = useState({});
  const [validationLoading, setValidationLoading] = useState({});

  // API validation for unique fields
  const validateWithAPI = useCallback(async (fieldName, value) => {
    if (!value || value.length < 2) return null;

    const cacheKey = `${fieldName}:${value}`;

    // Return cached result if available
    if (validationCache[cacheKey]) {
      return validationCache[cacheKey];
    }

    // Skip validation if already checking
    if (validationLoading[fieldName]) {
      return null;
    }

    try {
      setValidationLoading(prev => ({ ...prev, [fieldName]: true }));

      console.log(`Validating ${fieldName} with value:`, value);

      // Call actual API endpoint
      const response = await fetch(`/api/admin/validate/${fieldName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ value })
      });

      console.log(`API response for ${fieldName}:`, response.status, response.statusText);

      let result;
      if (response.ok) {
        const data = await response.json();
        result = {
          isValid: data.isUnique,
          error: data.isUnique ? null : data.message,
          message: data.message
        };
      } else {
        // Handle API errors
        const errorData = await response.json().catch(() => null);
        result = {
          isValid: false,
          error: errorData?.message || `Error validating ${fieldName}`,
          message: errorData?.message || 'Validation failed'
        };
      }

      // Cache the result
      setValidationCache(prev => ({ ...prev, [cacheKey]: result }));
      return result;

    } catch (error) {
      console.error('API validation error:', error);
      // On network error, allow validation to proceed with warning
      const result = {
        isValid: true,
        error: null,
        message: 'Unable to verify uniqueness - please ensure this value is not already registered',
        warning: true
      };
      setValidationCache(prev => ({ ...prev, [cacheKey]: result }));
      return result;
    } finally {
      setValidationLoading(prev => ({ ...prev, [fieldName]: false }));
    }
  }, [validationCache, validationLoading]);


  // Enhanced input change handler with formatting and real-time validation
  const handleChange = useCallback(async (e, fieldName = null) => {
    const { name, value } = e.target;
    const actualFieldName = fieldName || name;

    // Apply formatter if available
    const formatter = formatters[actualFieldName];
    const formattedValue = formatter ? formatter(value) : value;

    // Update form value
    setValue(actualFieldName, formattedValue);

    // Trigger local validation
    setTimeout(async () => {
      await trigger(actualFieldName);

      // Perform API validation for unique fields
      if (['mobileNo', 'aadhaarNo', 'vehicleNo', 'email', 'drivingLicenseNo'].includes(actualFieldName)) {
        const apiResult = await validateWithAPI(actualFieldName, formattedValue);
        if (apiResult) {
          if (!apiResult.isValid && !apiResult.warning) {
            toast.error(apiResult.error || apiResult.message);
          } else if (apiResult.isValid && !apiResult.warning && formattedValue.length > 3) {
            toast.success(`${getFriendlyFieldName(actualFieldName)} is available!`);
          } else if (apiResult.warning) {
            toast.loading(apiResult.message, { duration: 3000 });
          }
        }
      }
    }, 300);
  }, [setValue, trigger, validateWithAPI]);

  // File change handler
  const handleFileChange = useCallback((e) => {
    const { name, files: fileList } = e.target;
    const file = fileList[0];

    setFiles(prev => ({ ...prev, [name]: file }));

    // Basic file validation
    if (file) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPG, JPEG, or PNG files are allowed');
        setFiles(prev => ({ ...prev, [name]: null }));
        return;
      }

      if (file.size > maxSize) {
        toast.error('File size must be less than 5MB');
        setFiles(prev => ({ ...prev, [name]: null }));
        return;
      }

      toast.success(`${file.name} uploaded successfully!`);
    }
  }, []);

  // Camera capture handler
  const handleCameraCapture = useCallback((file) => {
    setFiles(prev => ({ ...prev, driverSelfie: file }));
    toast.success('Selfie captured successfully!');
  }, []);

  // Get detailed validation errors for current step
  const getStepValidationDetails = useCallback(() => {
    const stepErrors = Object.keys(errors).map(fieldName => ({
      field: fieldName,
      message: errors[fieldName]?.message,
      friendlyName: getFriendlyFieldName(fieldName)
    }));

    const requiredFields = getRequiredFieldsForStep(activeSection);
    const values = getValues();
    const missingFields = requiredFields.filter(field => !values[field] || values[field].toString().trim() === '');

    return {
      errors: stepErrors,
      missingFields: missingFields.map(field => ({
        field,
        friendlyName: getFriendlyFieldName(field)
      })),
      total: stepErrors.length + missingFields.length
    };
  }, [errors, activeSection, getValues]);

  // Get friendly field names for display
  const getFriendlyFieldName = (fieldName) => {
    const friendlyNames = {
      fullName: 'Full Name',
      mobileNo: 'Mobile Number',
      email: 'Email Address',
      aadhaarNo: 'Aadhaar Number',
      vehicleNo: 'Vehicle Number',
      bankName: 'Bank Name',
      ifscCode: 'IFSC Code',
      accountNumber: 'Account Number',
      accountHolderName: 'Account Holder Name',
      drivingLicenseNo: 'Driving License Number',
      permitNo: 'Permit Number',
      fitnessNo: 'Fitness Certificate Number',
      insurancePolicyNo: 'Insurance Policy Number',
      password: 'Password',
      confirmPassword: 'Confirm Password'
    };
    return friendlyNames[fieldName] || fieldName;
  };

  // Get required fields for each step
  const getRequiredFieldsForStep = (step) => {
    const stepFields = {
      personal: ['fullName', 'mobileNo', 'email', 'aadhaarNo', 'vehicleNo'],
      bank: ['bankName', 'ifscCode', 'accountNumber', 'accountHolderName'],
      license: ['drivingLicenseNo', 'permitNo', 'fitnessNo', 'insurancePolicyNo'],
      security: ['password', 'confirmPassword']
    };
    return stepFields[step] || [];
  };

  // Section navigation with enhanced validation feedback
  const changeSection = useCallback(async (section) => {
    const isCurrentValid = await trigger();
    const validationDetails = getStepValidationDetails();

    if (isCurrentValid || section === 'personal') {
      // Mark current section as completed if valid
      if (isCurrentValid && !completedSections.includes(activeSection)) {
        setCompletedSections(prev => [...prev, activeSection]);
        toast.success(`${steps.find(s => s.key === activeSection)?.label} completed!`);
      }

      setActiveSection(section);
      setError(null);

      // Save progress
      const currentData = getValues();
      await saveNow(currentData, currentStepIndex);
    } else {
      // Show detailed error message
      let errorMessage = `Cannot proceed to next step. Issues found:\n`;

      if (validationDetails.errors.length > 0) {
        errorMessage += `\n❌ Fix these errors:\n`;
        validationDetails.errors.forEach(error => {
          errorMessage += `• ${error.friendlyName}: ${error.message}\n`;
        });
      }

      if (validationDetails.missingFields.length > 0) {
        errorMessage += `\n⚠️ Fill these required fields:\n`;
        validationDetails.missingFields.forEach(field => {
          errorMessage += `• ${field.friendlyName}\n`;
        });
      }

      setError(errorMessage);
      toast.error(`Please complete all fields in ${steps.find(s => s.key === activeSection)?.label}`);
    }
  }, [trigger, activeSection, completedSections, getValues, saveNow, currentStepIndex, getStepValidationDetails, steps]);

  // Form submission
  const handleFormSubmit = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    setSuccess('');

    try {
      // Validate all steps
      await completeDriverSchema.validate(data, { abortEarly: false });

      // Prepare form data
      const submitData = new FormData();

      // Add text fields
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'bankDetails') {
          submitData.append('bankDetails', JSON.stringify(value));
        } else if (value) {
          submitData.append(key, value);
        }
      });

      // Add files
      Object.entries(files).forEach(([key, file]) => {
        if (file) {
          submitData.append(key, file);
        }
      });

      // Submit to API
      await registerDriver(submitData, { isAdmin: true });

      // Clear saved data
      clearPersistedData();

      setSuccess('Driver registration successful! Driver is now active.');
      toast.success('Driver registered successfully!');

      setTimeout(() => navigate('/admin/drivers'), 1500);

    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'Failed to register driver');
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [files, clearPersistedData, navigate]);

  // Get input class with validation state
  const getInputClass = useCallback((fieldName) => {
    const baseClass = "w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-lg transition-all duration-200";
    const hasError = errors[fieldName];
    const fieldValue = watch(fieldName);
    const isValid = !hasError && fieldValue;

    if (hasError) {
      return `${baseClass} border-red-300 focus:ring-red-400 bg-red-50`;
    } else if (isValid) {
      return `${baseClass} border-green-300 focus:ring-green-400 bg-green-50`;
    } else {
      return `${baseClass} border-gray-300 focus:ring-blue-400`;
    }
  }, [errors, watch]);

  // Render enhanced validation feedback with API status
  const renderValidationFeedback = useCallback((fieldName) => {
    const error = errors[fieldName];
    const fieldValue = watch(fieldName);
    const isValid = !error && fieldValue;
    const isLoading = validationLoading[fieldName];
    const isApiField = ['mobileNo', 'aadhaarNo', 'vehicleNo', 'email', 'drivingLicenseNo'].includes(fieldName);

    // Check if we have cached API validation result
    const cacheKey = `${fieldName}:${fieldValue}`;
    const apiResult = validationCache[cacheKey];

    // Show loading state for API validation
    if (isLoading && fieldValue) {
      return (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-blue-600 mt-1 flex items-center gap-1"
        >
          <FiLoader className="animate-spin" />
          Checking availability in database...
        </motion.p>
      );
    }

    // Show API validation error (database conflict)
    if (apiResult && !apiResult.isValid && !apiResult.warning) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1"
        >
          <p className="text-sm text-red-600 flex items-center gap-1">
            <span>❌</span>
            {apiResult.error || apiResult.message}
          </p>
        </motion.div>
      );
    }

    // Show API validation warning
    if (apiResult && apiResult.warning) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1"
        >
          <p className="text-sm text-orange-600 flex items-center gap-1">
            <span>⚠️</span>
            {apiResult.message}
          </p>
        </motion.div>
      );
    }

    // Show validation error (format/pattern issues)
    if (error) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1"
        >
          <p className="text-sm text-red-600 flex items-center gap-1">
            <span>⚠️</span>
            {error.message}
          </p>
          {/* Show suggestion for common errors */}
          {fieldName === 'mobileNo' && (
            <p className="text-xs text-gray-500 mt-1 italic">
              💡 Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9
            </p>
          )}
          {fieldName === 'email' && (
            <p className="text-xs text-gray-500 mt-1 italic">
              💡 Enter a valid email address (e.g., driver@example.com)
            </p>
          )}
          {fieldName === 'aadhaarNo' && (
            <p className="text-xs text-gray-500 mt-1 italic">
              💡 Enter exactly 12 digits as shown on your Aadhaar card
            </p>
          )}
          {fieldName === 'vehicleNo' && (
            <p className="text-xs text-gray-500 mt-1 italic">
              💡 Format: State code + District code + Series + Number (e.g., MH01AB1234)
            </p>
          )}
          {fieldName === 'ifscCode' && (
            <p className="text-xs text-gray-500 mt-1 italic">
              💡 11-character code: 4 letters + 0 + 6 alphanumeric (e.g., SBIN0001234)
            </p>
          )}
        </motion.div>
      );
    }

    // Show valid state with API confirmation
    if (isValid) {
      const validMessage = isApiField && apiResult && apiResult.isValid
        ? 'Available and valid ✓'
        : isApiField
          ? 'Format valid - checking database...'
          : 'Valid ✓';

      const textColor = isApiField && apiResult && apiResult.isValid
        ? 'text-green-600'
        : isApiField && !apiResult
          ? 'text-blue-600'
          : 'text-green-600';

      return (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-sm ${textColor} mt-1 flex items-center gap-1`}
        >
          <span>{isApiField && apiResult && apiResult.isValid ? '✅' : isApiField && !apiResult ? '🔄' : '✅'}</span>
          {validMessage}
        </motion.p>
      );
    }

    // Show field requirements when empty
    if (!fieldValue && fieldName) {
      const requirements = getFieldRequirements(fieldName);
      if (requirements) {
        return (
          <p className="text-xs text-gray-500 mt-1 italic">
            💡 {requirements}
          </p>
        );
      }
    }

    return null;
  }, [errors, watch, validationLoading, validationCache]);

  // Get field requirements/hints
  const getFieldRequirements = (fieldName) => {
    const requirements = {
      fullName: 'Enter your full name as on official documents',
      mobileNo: '10-digit number starting with 6, 7, 8, or 9',
      email: 'Valid email address for notifications and account access',
      aadhaarNo: '12-digit number from your Aadhaar card',
      vehicleNo: 'Registration number as shown on RC (e.g., MH01AB1234)',
      bankName: 'Full name of your bank',
      ifscCode: '11-character code from bank passbook/cheque',
      accountNumber: 'Bank account number (9-18 digits)',
      accountHolderName: 'Name as per bank records',
      drivingLicenseNo: 'License number from your DL card',
      permitNo: 'Commercial permit number',
      fitnessNo: 'Fitness certificate number',
      insurancePolicyNo: 'Insurance policy number',
      password: 'Minimum 8 characters with uppercase, lowercase, number, and special character',
      confirmPassword: 'Re-enter the same password'
    };
    return requirements[fieldName];
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Driver Registration</h1>
          <p className="text-gray-600 mt-1">Register a new driver with real-time validation</p>
          {lastSaved && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              {isAutoSaving ? (
                <>
                  <FiLoader className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FiSave />
                  {getLastSavedText()} • {getCompletionPercentage()}% complete
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => saveNow(getValues(), currentStepIndex)}
            disabled={isAutoSaving}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {isAutoSaving ? 'Saving...' : 'Save Progress'}
          </button>
          <button
            onClick={() => navigate('/admin/drivers')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View All Drivers
          </button>
        </div>
      </div>

      {/* Enhanced Error/Success Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-start space-x-3">
            <div className="text-red-500 mt-0.5">⚠️</div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800 mb-2">Unable to proceed</h4>
              <div className="text-sm text-red-700 whitespace-pre-line leading-relaxed">
                {error}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-green-800">{success}</span>
          </div>
        </motion.div>
      )}

      {/* Form Card */}
      <ModernCard>
        {/* Enhanced Stepper with Validation Status */}
        <div className="mb-8 px-6 pt-6">
          <div className="flex justify-between items-center mb-4">
            {steps.map((step, idx) => {
              const isActive = activeSection === step.key;
              const isCompleted = completedSections.includes(step.key);
              const stepValidation = getStepValidationDetails();
              const hasErrors = stepValidation.total > 0 && isActive;

              return (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  <button
                    type="button"
                    onClick={() => changeSection(step.key)}
                    className={`flex items-center justify-center w-12 h-12 rounded-full text-xl mb-2 border-2 transition-all cursor-pointer ${
                      isActive
                        ? hasErrors
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-blue-600 text-white border-blue-600'
                        : isCompleted
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-gray-100 text-gray-400 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {isCompleted ? '✓' : hasErrors ? '!' : step.icon}
                  </button>
                  <span className={`text-sm font-medium ${
                    isActive
                      ? hasErrors
                        ? 'text-red-600'
                        : 'text-blue-600'
                      : isCompleted
                        ? 'text-green-600'
                        : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                  {/* Error count indicator */}
                  {isActive && hasErrors && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {stepValidation.total}
                    </div>
                  )}
                  {/* Connection lines */}
                  {idx < steps.length - 1 && (
                    <div className={`absolute top-6 left-1/2 h-0.5 ${
                      isCompleted ? 'bg-green-300' : 'bg-gray-200'
                    }`} style={{ width: 'calc(100% - 3rem)' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Progress Summary */}
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-2">
              Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex]?.label}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6">
          {/* Real-time Validation Status Panel */}
          {(() => {
            const stepValidation = getStepValidationDetails();
            const hasIssues = stepValidation.total > 0;

            if (!hasIssues) {
              return (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">✅</span>
                    <span className="text-sm font-medium text-green-800">
                      All fields in this step are valid and ready to proceed!
                    </span>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4"
              >
                <div className="flex items-start space-x-3">
                  <div className="text-yellow-600 mt-0.5">⚠️</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 mb-3">
                      Complete the following to proceed:
                    </h4>

                    {/* Validation errors */}
                    {stepValidation.errors.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-yellow-700 mb-2">Fix these errors:</p>
                        <ul className="space-y-1">
                          {stepValidation.errors.map((error, index) => (
                            <li key={index} className="text-xs text-yellow-700 flex items-start space-x-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span><strong>{error.friendlyName}:</strong> {error.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missing fields */}
                    {stepValidation.missingFields.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-yellow-700 mb-2">Fill these required fields:</p>
                        <ul className="space-y-1">
                          {stepValidation.missingFields.map((field, index) => (
                            <li key={index} className="text-xs text-yellow-700 flex items-start space-x-2">
                              <span className="text-orange-500 mt-0.5">•</span>
                              <span>{field.friendlyName}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })()}

          {/* Personal Information Section */}
          <div className={activeSection === 'personal' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Full Name *</label>
                <Controller
                  name="fullName"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter full name"
                      className={getInputClass('fullName')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'fullName');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('fullName')}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Mobile Number *</label>
                <Controller
                  name="mobileNo"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      maxLength="10"
                      className={getInputClass('mobileNo')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'mobileNo');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('mobileNo')}
                <p className="text-sm text-gray-500 mt-1">Must be exactly 10 digits</p>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Email Address *</label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="email"
                      placeholder="Enter email address"
                      className={getInputClass('email')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'email');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('email')}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Aadhaar Number *</label>
                <Controller
                  name="aadhaarNo"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter 12-digit Aadhaar number"
                      maxLength="12"
                      className={getInputClass('aadhaarNo')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'aadhaarNo');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('aadhaarNo')}
              </div>

              <ModernUpload
                label="Aadhaar Photo (Front)"
                name="aadhaarPhotoFront"
                file={files.aadhaarPhotoFront}
                onChange={handleFileChange}
                required
              />

              <ModernUpload
                label="Aadhaar Photo (Back)"
                name="aadhaarPhotoBack"
                file={files.aadhaarPhotoBack}
                onChange={handleFileChange}
                required
              />

              <CameraCapture
                label="Live Photo (Selfie)"
                onCapture={handleCameraCapture}
                required
              />

              <div>
                <label className="block text-gray-700 font-medium mb-1">Vehicle Number *</label>
                <Controller
                  name="vehicleNo"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter vehicle number (e.g., MH01AB1234)"
                      className={getInputClass('vehicleNo')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'vehicleNo');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('vehicleNo')}
              </div>

              <ModernUpload
                label="Registration Certificate Photo"
                name="registrationCertificatePhoto"
                file={files.registrationCertificatePhoto}
                onChange={handleFileChange}
                required
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => changeSection('bank')}
                disabled={!isValid}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-gray-400"
              >
                Next: Bank Details
              </button>
            </div>
          </div>

          {/* Bank Details Section */}
          <div className={activeSection === 'bank' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Bank Name *</label>
                <Controller
                  name="bankName"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter bank name"
                      className={getInputClass('bankName')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'bankName');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('bankName')}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">IFSC Code *</label>
                <Controller
                  name="ifscCode"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter IFSC code (e.g., SBIN0001234)"
                      maxLength="11"
                      className={getInputClass('ifscCode')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'ifscCode');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('ifscCode')}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Account Number *</label>
                <Controller
                  name="accountNumber"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter account number"
                      className={getInputClass('accountNumber')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'accountNumber');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('accountNumber')}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Account Holder Name *</label>
                <Controller
                  name="accountHolderName"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter account holder name"
                      className={getInputClass('accountHolderName')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'accountHolderName');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('accountHolderName')}
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => changeSection('personal')}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => changeSection('license')}
                disabled={!isValid}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-gray-400"
              >
                Next: Licenses
              </button>
            </div>
          </div>

          {/* License and Certificates Section */}
          <div className={activeSection === 'license' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">License and Certificates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Driving License Number *</label>
                <Controller
                  name="drivingLicenseNo"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter driving license number"
                      className={getInputClass('drivingLicenseNo')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'drivingLicenseNo');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('drivingLicenseNo')}
              </div>

              <ModernUpload
                label="Driving License Photo"
                name="drivingLicensePhoto"
                file={files.drivingLicensePhoto}
                onChange={handleFileChange}
                required
              />

              <div>
                <label className="block text-gray-700 font-medium mb-1">Permit Number *</label>
                <Controller
                  name="permitNo"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter permit number"
                      className={getInputClass('permitNo')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'permitNo');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('permitNo')}
              </div>

              <ModernUpload
                label="Permit Photo"
                name="permitPhoto"
                file={files.permitPhoto}
                onChange={handleFileChange}
                required
              />

              <div>
                <label className="block text-gray-700 font-medium mb-1">Fitness Certificate Number *</label>
                <Controller
                  name="fitnessNo"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter fitness certificate number"
                      className={getInputClass('fitnessNo')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'fitnessNo');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('fitnessNo')}
              </div>

              <ModernUpload
                label="Fitness Certificate Photo"
                name="fitnessCertificatePhoto"
                file={files.fitnessCertificatePhoto}
                onChange={handleFileChange}
                required
              />

              <div>
                <label className="block text-gray-700 font-medium mb-1">Insurance Policy Number *</label>
                <Controller
                  name="insurancePolicyNo"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Enter insurance policy number"
                      className={getInputClass('insurancePolicyNo')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'insurancePolicyNo');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('insurancePolicyNo')}
              </div>

              <ModernUpload
                label="Insurance Policy Photo"
                name="insurancePolicyPhoto"
                file={files.insurancePolicyPhoto}
                onChange={handleFileChange}
                required
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => changeSection('bank')}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => changeSection('security')}
                disabled={!isValid}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-gray-400"
              >
                Next: Security
              </button>
            </div>
          </div>

          {/* Security Section */}
          <div className={activeSection === 'security' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Password *</label>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="password"
                      placeholder="Create a strong password"
                      className={getInputClass('password')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'password');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('password')}
                <p className="text-sm text-gray-500 mt-1">Minimum 8 characters with uppercase, lowercase, number and special character</p>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Confirm Password *</label>
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="password"
                      placeholder="Confirm password"
                      className={getInputClass('confirmPassword')}
                      onChange={(e) => {
                        field.onChange(e);
                        handleChange(e, 'confirmPassword');
                      }}
                    />
                  )}
                />
                {renderValidationFeedback('confirmPassword')}
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => changeSection('license')}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !isValid}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition disabled:bg-gray-400 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <FiLoader className="animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Register Driver'
                )}
              </button>
            </div>
          </div>
        </form>
      </ModernCard>
    </div>
  );
};

export default ImprovedDriverRegistration;