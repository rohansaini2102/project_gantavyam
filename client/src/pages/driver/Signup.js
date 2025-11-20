// client/src/pages/DriverSignup.js
import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { driverSignup } from '../../services/api';
import ModernUpload from '../../components/common/ModernUpload';
import CameraCapture from '../../components/common/CameraCapture';
import { FiUser, FiCreditCard, FiClipboard, FiLock, FiCheckCircle, FiAlertCircle, FiCheck, FiXCircle } from 'react-icons/fi';
import { compressMultipleImages, validateImageFile, getReadableFileSize } from '../../utils/imageCompression';
import useRealtimeValidation from '../../hooks/useRealtimeValidation';
import toast, { Toaster } from 'react-hot-toast';
import {
  normalizeAadhaar,
  formatAadhaarDisplay,
  validateAadhaar,
  normalizeMobile,
  validateMobile,
  normalizeVehicleNo,
  validateVehicleNo,
  normalizeIfscCode,
  validateIfscCode,
  normalizeAccountNumber,
  validateAccountNumber,
  validateDrivingLicense,
  validateName,
  formatField,
  getNormalizedValue,
  getFieldErrorMessage
} from '../../utils/validationUtils';

const steps = [
  { key: 'personal', label: 'Personal Info', icon: <FiUser /> },
  { key: 'bank', label: 'Bank Details', icon: <FiCreditCard /> },
  { key: 'license', label: 'Licenses', icon: <FiClipboard /> },
  { key: 'security', label: 'Security', icon: <FiLock /> },
];

const DriverSignup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNo: '',
    aadhaarNo: '',
    vehicleNo: '',
    vehicleType: 'auto', // Added vehicleType with default 'auto'
    // Bank Details
    bankName: '',
    ifscCode: '',
    accountNumber: '',
    accountHolderName: '',
    // License and Certificates
    drivingLicenseNo: '',
    permitNo: '',
    fitnessCertificateNo: '',
    insurancePolicyNo: '',
    password: '',
    confirmPassword: ''
  });
  
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
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('personal');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(''); // Track current processing step

  // New validation states
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [stepValidation, setStepValidation] = useState({
    personal: false,
    bank: false,
    license: false,
    security: false
  });

  // Real-time validation hook
  const {
    validationStatus,
    isValidating,
    validateField,
    validateAllFields,
    clearFieldValidation
  } = useRealtimeValidation(500); // 500ms debounce

  // Format helpers for inputs - use validation utilities
  const formatters = {
    mobileNo: normalizeMobile,
    aadhaarNo: formatAadhaarDisplay, // Keep hyphenated for display
    vehicleNo: normalizeVehicleNo,
    accountNumber: normalizeAccountNumber,
    ifscCode: normalizeIfscCode
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Apply formatter if exists
    const formattedValue = formatters[name] ? formatters[name](value) : value;
    setFormData({ ...formData, [name]: formattedValue });

    // Clear error on change if field was touched
    if (touchedFields[name] && fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // INSTANT VALIDATION for critical fields (mobile, aadhaar, vehicle)
    if (['mobileNo', 'aadhaarNo', 'vehicleNo'].includes(name)) {
      // Mark as touched for instant feedback
      setTouchedFields(prev => ({ ...prev, [name]: true }));

      // Check format first
      let formatError = null;
      if (name === 'mobileNo' && formattedValue && formattedValue.length === 10 && !validateMobile(formattedValue)) {
        formatError = getFieldErrorMessage('mobileNo');
      } else if (name === 'aadhaarNo' && formattedValue && normalizeAadhaar(formattedValue).length === 12 && !validateAadhaar(formattedValue)) {
        formatError = getFieldErrorMessage('aadhaarNo');
      } else if (name === 'vehicleNo' && formattedValue && formattedValue.length >= 8) {
        // Check vehicle number format (Indian format: DL01AB1234)
        const normalizedVehicle = normalizeVehicleNo(formattedValue);
        if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{1,4}$/.test(normalizedVehicle)) {
          formatError = getFieldErrorMessage('vehicleNo');
        }
      }

      if (formatError) {
        setFieldErrors(prev => ({ ...prev, [name]: formatError }));
        return;
      }

      // Trigger instant duplicate check if value is complete
      const shouldCheck =
        (name === 'mobileNo' && formattedValue.length === 10) ||
        (name === 'aadhaarNo' && normalizeAadhaar(formattedValue).length === 12) ||
        (name === 'vehicleNo' && formattedValue.length >= 4);

      if (shouldCheck && formattedValue) {
        const normalizedValue = getNormalizedValue(name, formattedValue);
        console.log(`[Instant Validation] Checking ${name}: ${formattedValue} -> ${normalizedValue}`);

        // Clear any existing error first
        setFieldErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });

        // Trigger validation
        validateField(name, normalizedValue, (result) => {
          if (result.exists) {
            setFieldErrors(prev => ({
              ...prev,
              [name]: result.message
            }));
            // Don't show toast on every keystroke, just show field error
          } else {
            // Clear error if no duplicate
            setFieldErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors[name];
              return newErrors;
            });
          }
        });
      }
    }
  };

  // Handle field blur for duplicate checking and validation
  const handleFieldBlur = useCallback(async (fieldName) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));

    const value = formData[fieldName];

    // Skip if empty
    if (!value) {
      setFieldErrors(prev => ({
        ...prev,
        [fieldName]: 'This field is required'
      }));
      return;
    }

    // Field-specific validation
    const errors = {};

    // Validate formats using validation utilities
    if (fieldName === 'mobileNo' && !validateMobile(value)) {
      errors[fieldName] = getFieldErrorMessage('mobileNo');
    } else if (fieldName === 'aadhaarNo' && !validateAadhaar(value)) {
      errors[fieldName] = getFieldErrorMessage('aadhaarNo');
    } else if (fieldName === 'vehicleNo' && !validateVehicleNo(value)) {
      errors[fieldName] = getFieldErrorMessage('vehicleNo');
    } else if (fieldName === 'ifscCode' && !validateIfscCode(value)) {
      errors[fieldName] = getFieldErrorMessage('ifscCode');
    } else if (fieldName === 'accountNumber' && !validateAccountNumber(value)) {
      errors[fieldName] = getFieldErrorMessage('accountNumber');
    } else if (fieldName === 'drivingLicenseNo' && !validateDrivingLicense(value)) {
      errors[fieldName] = getFieldErrorMessage('drivingLicenseNo');
    } else if (['fullName', 'bankName', 'accountHolderName'].includes(fieldName) && !validateName(value)) {
      errors[fieldName] = getFieldErrorMessage(fieldName);
    }

    // Check for duplicates - ALWAYS use normalized value
    if (['mobileNo', 'aadhaarNo', 'vehicleNo'].includes(fieldName) && value) {
      // Normalize the value for duplicate checking
      const normalizedValue = getNormalizedValue(fieldName, value);

      console.log(`[Field Blur] Checking duplicate for ${fieldName}: ${value} -> ${normalizedValue}`);

      validateField(fieldName, normalizedValue, async (result) => {
        if (result.exists) {
          setFieldErrors(prev => ({
            ...prev,
            [fieldName]: result.message
          }));
          toast.error(result.message);
        } else if (!errors[fieldName]) {
          // Clear error if no duplicate and no format error
          setFieldErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[fieldName];
            return newErrors;
          });
        }
      });
    } else if (errors[fieldName]) {
      setFieldErrors(prev => ({ ...prev, ...errors }));
    } else {
      // Clear error if validation passes
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [formData, validateField]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const fieldName = e.target.name;
    
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setFiles({ ...files, [fieldName]: file });
    
    // Mark as uploaded (pre-upload)
    setUploadedFiles(prev => ({ ...prev, [fieldName]: false }));
    
    // Show file size
    console.log(`[File Upload] ${fieldName}: ${getReadableFileSize(file.size)}`);
  };

  const handleCameraCapture = (file) => {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setFiles({ ...files, driverSelfie: file });
    setUploadedFiles(prev => ({ ...prev, driverSelfie: false }));
    console.log(`[Camera Capture] driverSelfie: ${getReadableFileSize(file.size)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate all steps first
    const stepsToValidate = ['personal', 'bank', 'license', 'security'];
    let allStepsValid = true;

    for (const step of stepsToValidate) {
      const isValid = await validateStep(step);
      if (!isValid) {
        allStepsValid = false;
        // Switch to first invalid step
        setActiveSection(step);
        break;
      }
    }

    if (!allStepsValid) {
      setError('Please fix all errors before submitting');
      toast.error('Please complete all required fields correctly');
      return;
    }

    // Batch duplicate check for all unique fields - use normalized values
    try {
      const duplicateCheck = await validateAllFields({
        mobileNo: normalizeMobile(formData.mobileNo),
        aadhaarNo: normalizeAadhaar(formData.aadhaarNo), // Use normalized value
        vehicleNo: normalizeVehicleNo(formData.vehicleNo)
      });

      if (!duplicateCheck.isValid) {
        const errorMessages = Object.entries(duplicateCheck.errors)
          .map(([field, message]) => message)
          .join(', ');
        setError(errorMessages);
        toast.error('Duplicate values found');

        // Set field errors for duplicate fields
        setFieldErrors(prev => ({ ...prev, ...duplicateCheck.errors }));

        // Navigate to first step with duplicate
        if (duplicateCheck.errors.mobileNo || duplicateCheck.errors.aadhaarNo || duplicateCheck.errors.vehicleNo) {
          setActiveSection('personal');
        }
        return;
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
      setError('Unable to verify duplicate values. Please try again.');
      return;
    }

    // Check if required files are selected
    const requiredFiles = ['aadhaarPhotoFront', 'aadhaarPhotoBack', 'driverSelfie', 'registrationCertificatePhoto', 'drivingLicensePhoto'];
    const missingFiles = requiredFiles.filter(field => !files[field]);
    if (missingFiles.length > 0) {
      setError(`Please upload all required files: ${missingFiles.join(', ')}`);
      setActiveSection('personal'); // Files are in personal section
      return;
    }
    
    setLoading(true);
    setError(null);
    setCompressing(true);
    setCompressionProgress(0);
    setUploadProgress(0);
    setCurrentStep('Preparing files for upload...');
    
    try {
      // Compress images before upload
      console.log('[Registration] Starting image compression...');
      setCurrentStep('Compressing images...');

      // Wrap files in arrays to match compressMultipleImages expected format
      const filesToCompress = {};
      Object.keys(files).forEach(key => {
        if (files[key]) {
          filesToCompress[key] = [files[key]];
        }
      });

      const compressedFiles = await compressMultipleImages(filesToCompress, (progress) => {
        setCompressionProgress(progress);
        console.log(`[Compression Progress] ${progress}%`);
      });
      
      console.log('[Registration] Image compression complete');
      setCompressing(false);
      setCurrentStep('Uploading files to server...');
      
      // Create form data with compressed images - use normalized values
      const submitData = new FormData();
      submitData.append('fullName', formData.fullName.trim());
      submitData.append('mobileNo', normalizeMobile(formData.mobileNo));
      submitData.append('aadhaarNo', normalizeAadhaar(formData.aadhaarNo)); // Always send normalized
      submitData.append('vehicleNo', normalizeVehicleNo(formData.vehicleNo));
      submitData.append('vehicleType', formData.vehicleType); // Add vehicleType
      const bankDetails = {
        bankName: formData.bankName.trim(),
        ifscCode: normalizeIfscCode(formData.ifscCode),
        accountNumber: normalizeAccountNumber(formData.accountNumber),
        accountHolderName: formData.accountHolderName.trim()
      };
      submitData.append('bankDetails', JSON.stringify(bankDetails));
      submitData.append('drivingLicenseNo', formData.drivingLicenseNo.toUpperCase().trim());
      submitData.append('permitNo', formData.permitNo ? formData.permitNo.toUpperCase().trim() : '');
      submitData.append('fitnessCertificateNo', formData.fitnessCertificateNo ? formData.fitnessCertificateNo.toUpperCase().trim() : '');
      submitData.append('insurancePolicyNo', formData.insurancePolicyNo ? formData.insurancePolicyNo.toUpperCase().trim() : '');
      submitData.append('password', formData.password);
      
      // Add compressed files
      let totalCompressedSize = 0;
      Object.keys(compressedFiles).forEach(key => {
        if (compressedFiles[key] && compressedFiles[key][0]) {
          const file = compressedFiles[key][0];
          submitData.append(key, file);
          totalCompressedSize += file.size;
          console.log(`[Form Data] Adding ${key}: ${getReadableFileSize(file.size)}`);
        }
      });
      
      console.log(`[Form Data] Total compressed size: ${getReadableFileSize(totalCompressedSize)}`);
      
      // Submit with progress tracking
      await driverSignup(submitData, (progress) => {
        setUploadProgress(progress);
        
        // Update current step based on progress
        if (progress < 50) {
          setCurrentStep('Uploading files to server...');
        } else if (progress < 90) {
          setCurrentStep('Processing documents...');
        } else {
          setCurrentStep('Finalizing registration...');
        }
        
        // Mark files as uploaded based on progress
        if (progress > 0) {
          const filesCount = Object.keys(compressedFiles).length;
          const uploadedCount = Math.floor((progress / 100) * filesCount);
          const fileKeys = Object.keys(compressedFiles);
          
          const newUploadedFiles = {};
          fileKeys.forEach((key, index) => {
            newUploadedFiles[key] = index < uploadedCount;
          });
          setUploadedFiles(newUploadedFiles);
        }
      });
      
      // Mark all files as uploaded on success
      const allUploaded = {};
      Object.keys(files).forEach(key => {
        if (files[key]) allUploaded[key] = true;
      });
      setUploadedFiles(allUploaded);
      
      setCurrentStep('Registration complete!');
      setLoading(false);
      alert('Registration successful! Your account is pending admin approval.');
      navigate('/driver/login');
    } catch (err) {
      console.error('[Registration] Error:', err);
      setError(err.error || 'Failed to register. Please try again.');
      setLoading(false);
      setCompressing(false);
      setCurrentStep('');
    }
  };

  // Validate current step before navigation
  const validateStep = useCallback(async (stepKey) => {
    const errors = {};
    let hasErrors = false;
    const fieldsToTouch = [];

    // CRITICAL FIX: Check for existing duplicate errors first
    const stepFieldMapping = {
      personal: ['fullName', 'mobileNo', 'aadhaarNo', 'vehicleNo', 'vehicleType'],
      bank: ['bankName', 'ifscCode', 'accountNumber', 'accountHolderName'],
      license: ['drivingLicenseNo'],
      security: ['password', 'confirmPassword']
    };

    // Check if any field in current step has duplicate errors
    const currentStepFields = stepFieldMapping[stepKey] || [];
    for (const field of currentStepFields) {
      if (fieldErrors[field]) {
        errors[field] = fieldErrors[field];
        hasErrors = true;
        console.log(`[ValidateStep] Found existing error for ${field}: ${fieldErrors[field]}`);
      }
    }

    // Also check validation status for duplicates (but not if API is down)
    if (stepKey === 'personal') {
      // Only block if we have confirmed duplicates, not on API errors
      if (validationStatus.mobileNo?.exists && !validationStatus.mobileNo?.apiDown) {
        errors.mobileNo = validationStatus.mobileNo.message || 'This mobile number is already registered';
        hasErrors = true;
      }
      if (validationStatus.aadhaarNo?.exists && !validationStatus.aadhaarNo?.apiDown) {
        errors.aadhaarNo = validationStatus.aadhaarNo.message || 'This Aadhaar number is already registered';
        hasErrors = true;
      }
      if (validationStatus.vehicleNo?.exists && !validationStatus.vehicleNo?.apiDown) {
        errors.vehicleNo = validationStatus.vehicleNo.message || 'This vehicle number is already registered';
        hasErrors = true;
      }
    }

    // Check if validation is still in progress for any field
    if (stepKey === 'personal') {
      if (isValidating.mobileNo || isValidating.aadhaarNo || isValidating.vehicleNo) {
        toast.error('Please wait for validation to complete');
        return false;
      }
    }

    switch(stepKey) {
      case 'personal':
        // Validate personal info fields
        const personalFields = ['fullName', 'mobileNo', 'aadhaarNo', 'vehicleNo', 'vehicleType'];
        personalFields.forEach(field => {
          fieldsToTouch.push(field);
          if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
            if (!errors[field]) { // Don't overwrite existing errors
              errors[field] = field === 'vehicleType' ? 'Vehicle type is required' : getFieldErrorMessage(field);
              hasErrors = true;
            }
          }
        });

        // Check specific validations using utilities
        if (formData.mobileNo && !validateMobile(formData.mobileNo) && !errors.mobileNo) {
          errors.mobileNo = getFieldErrorMessage('mobileNo');
          hasErrors = true;
        }
        if (formData.aadhaarNo && !validateAadhaar(formData.aadhaarNo) && !errors.aadhaarNo) {
          errors.aadhaarNo = getFieldErrorMessage('aadhaarNo');
          hasErrors = true;
        }

        // Check required files
        if (!files.aadhaarPhotoFront) {
          errors.aadhaarPhotoFront = 'Aadhaar front photo is required';
          hasErrors = true;
        }
        if (!files.aadhaarPhotoBack) {
          errors.aadhaarPhotoBack = 'Aadhaar back photo is required';
          hasErrors = true;
        }
        if (!files.driverSelfie) {
          errors.driverSelfie = 'Driver selfie is required';
          hasErrors = true;
        }
        if (!files.registrationCertificatePhoto) {
          errors.registrationCertificatePhoto = 'Registration certificate is required';
          hasErrors = true;
        }
        break;

      case 'bank':
        // Validate bank details
        const bankFields = ['bankName', 'ifscCode', 'accountNumber', 'accountHolderName'];
        bankFields.forEach(field => {
          fieldsToTouch.push(field);
          if (!formData[field] || formData[field].trim() === '') {
            errors[field] = getFieldErrorMessage(field);
            hasErrors = true;
          }
        });

        if (formData.ifscCode && !validateIfscCode(formData.ifscCode)) {
          errors.ifscCode = getFieldErrorMessage('ifscCode');
          hasErrors = true;
        }
        if (formData.accountNumber && !validateAccountNumber(formData.accountNumber)) {
          errors.accountNumber = getFieldErrorMessage('accountNumber');
          hasErrors = true;
        }
        break;

      case 'license':
        // Validate license details
        if (!formData.drivingLicenseNo || formData.drivingLicenseNo.trim() === '') {
          errors.drivingLicenseNo = getFieldErrorMessage('drivingLicenseNo');
          hasErrors = true;
        }
        if (!files.drivingLicensePhoto) {
          errors.drivingLicensePhoto = 'Driving license photo is required';
          hasErrors = true;
        }
        break;

      case 'security':
        // Validate password
        fieldsToTouch.push('password', 'confirmPassword');
        if (!formData.password) {
          errors.password = 'Password is required';
          hasErrors = true;
        } else if (formData.password.length < 6) {
          errors.password = getFieldErrorMessage('password');
          hasErrors = true;
        }
        if (!formData.confirmPassword) {
          errors.confirmPassword = 'Please confirm password';
          hasErrors = true;
        } else if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = getFieldErrorMessage('confirmPassword');
          hasErrors = true;
        }
        break;
    }

    // Mark all fields in this step as touched
    setTouchedFields(prev => {
      const newTouched = { ...prev };
      fieldsToTouch.forEach(field => {
        newTouched[field] = true;
      });
      return newTouched;
    });

    // Set field errors
    setFieldErrors(prev => ({ ...prev, ...errors }));
    setStepValidation(prev => ({ ...prev, [stepKey]: !hasErrors }));

    // Show toast with specific errors if validation fails
    if (hasErrors) {
      const errorFields = Object.keys(errors);
      const errorMessage = errorFields.length === 1
        ? errors[errorFields[0]]
        : `Please fix ${errorFields.length} field(s): ${errorFields.slice(0, 3).join(', ')}${errorFields.length > 3 ? '...' : ''}`;
      toast.error(errorMessage);
    }

    return !hasErrors;
  }, [formData, files, fieldErrors, validationStatus, isValidating]);

  // Helper to check if Next button should be disabled
  const isNextButtonDisabled = useCallback((stepKey) => {
    // Check if validation is in progress
    const anyValidating = Object.values(isValidating).some(v => v);
    if (anyValidating) return true;

    // Check for field errors in current step
    const stepFieldMapping = {
      personal: ['fullName', 'mobileNo', 'aadhaarNo', 'vehicleNo', 'vehicleType'],
      bank: ['bankName', 'ifscCode', 'accountNumber', 'accountHolderName'],
      license: ['drivingLicenseNo'],
      security: ['password', 'confirmPassword']
    };

    const currentStepFields = stepFieldMapping[stepKey] || [];
    const hasFieldErrors = currentStepFields.some(field => fieldErrors[field]);

    // Check validation status for duplicates (but not if API is down)
    if (stepKey === 'personal') {
      const hasDuplicates =
        (validationStatus.mobileNo?.exists && !validationStatus.mobileNo?.apiDown) ||
        (validationStatus.aadhaarNo?.exists && !validationStatus.aadhaarNo?.apiDown) ||
        (validationStatus.vehicleNo?.exists && !validationStatus.vehicleNo?.apiDown);
      return hasFieldErrors || hasDuplicates;
    }

    return hasFieldErrors;
  }, [fieldErrors, isValidating, validationStatus]);

  const changeSection = async (section) => {
    // Check if any validation is in progress
    const anyValidating = Object.values(isValidating).some(v => v);
    if (anyValidating) {
      toast.error('Please wait for validation to complete');
      return;
    }

    // Check for any existing field errors in current step
    const stepFieldMapping = {
      personal: ['fullName', 'mobileNo', 'aadhaarNo', 'vehicleNo', 'vehicleType'],
      bank: ['bankName', 'ifscCode', 'accountNumber', 'accountHolderName'],
      license: ['drivingLicenseNo'],
      security: ['password', 'confirmPassword']
    };

    const currentStepFields = stepFieldMapping[activeSection] || [];
    const hasFieldErrors = currentStepFields.some(field => fieldErrors[field]);

    if (hasFieldErrors) {
      const errorField = currentStepFields.find(field => fieldErrors[field]);
      toast.error(fieldErrors[errorField] || 'Please fix errors before proceeding');
      return;
    }

    // Validate current step before moving
    const currentStepValid = await validateStep(activeSection);

    if (!currentStepValid) {
      toast.error('Please complete all required fields before proceeding');
      return;
    }

    setActiveSection(section);
  };

  return (
    <div className="min-h-screen bg-gray-100 md:flex md:flex-col md:items-center md:justify-center">
      {/* Mobile: Full width with safe padding, Desktop: Centered */}
      <div className="w-full md:max-w-2xl bg-white md:rounded-lg md:shadow-lg md:mb-4">
        <div className="p-4 md:p-8 pb-safe-area-inset-bottom">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">Welcome to GANTAVYAM</h1>
          <h2 className="text-xl font-semibold text-orange-500">Driver Signup</h2>
          <p className="mt-2 text-blue-600 font-semibold">
            <Link to="/driver/login" className="hover:underline">Already registered? Login</Link>
          </p>
        </div>
        {/* Stepper */}
        <div className="flex justify-between items-center mb-6 md:mb-8 overflow-x-auto">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex-1 flex flex-col items-center min-w-0 px-1">
              <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-lg md:text-2xl mb-1 border-2 ${activeSection === step.key ? 'bg-sky-400 text-white border-sky-400' : 'bg-gray-200 text-gray-400 border-gray-300'}`}>{step.icon}</div>
              <span className={`text-xs font-semibold text-center ${activeSection === step.key ? 'text-sky-600' : 'text-gray-400'}`}>{step.label}</span>
              {idx < steps.length - 1 && <div className="hidden md:block w-full h-1 bg-gray-200 mt-2" />}
            </div>
          ))}
        </div>
        {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 border-l-4 border-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="mt-4" noValidate>
          {/* Personal Information Section */}
          <div className={activeSection === 'personal' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('fullName')}
                  required
                  placeholder="Enter your full name"
                  className={`w-full px-4 py-3 border ${fieldErrors.fullName ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.fullName ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {fieldErrors.fullName && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.fullName}
                  </p>
                )}
                {!fieldErrors.fullName && touchedFields.fullName && formData.fullName && (
                  <p className="text-green-500 text-sm mt-1 flex items-center">
                    <FiCheck className="mr-1" /> Valid
                  </p>
                )}
              </div>
              <div className="relative">
                <label className="block text-gray-700 font-medium mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="mobileNo"
                  value={formData.mobileNo}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('mobileNo')}
                  required
                  placeholder="Enter 10-digit mobile number"
                  pattern="[0-9]{10}"
                  maxLength="10"
                  className={`w-full px-4 py-3 border ${
                    fieldErrors.mobileNo ? 'border-red-500' :
                    validationStatus.mobileNo && validationStatus.mobileNo.apiDown && formData.mobileNo.length === 10 ? 'border-yellow-500' :
                    validationStatus.mobileNo && !validationStatus.mobileNo.exists && !validationStatus.mobileNo.apiDown && formData.mobileNo.length === 10 ? 'border-green-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.mobileNo ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {/* Inline validation icons */}
                {!isValidating.mobileNo && validationStatus.mobileNo && !validationStatus.mobileNo.exists && !validationStatus.mobileNo.apiDown && formData.mobileNo.length === 10 && (
                  <FiCheckCircle className="absolute right-3 top-11 text-green-500 w-5 h-5" />
                )}
                {!isValidating.mobileNo && validationStatus.mobileNo && validationStatus.mobileNo.apiDown && formData.mobileNo.length === 10 && (
                  <FiAlertCircle className="absolute right-3 top-11 text-yellow-500 w-5 h-5" />
                )}
                {!isValidating.mobileNo && fieldErrors.mobileNo && (
                  <FiXCircle className="absolute right-3 top-11 text-red-500 w-5 h-5" />
                )}
                {isValidating.mobileNo && (
                  <p className="text-blue-600 text-sm mt-1 font-medium flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Checking mobile number...
                  </p>
                )}
                {fieldErrors.mobileNo && !isValidating.mobileNo && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.mobileNo}
                  </p>
                )}
                {!fieldErrors.mobileNo && !isValidating.mobileNo && touchedFields.mobileNo && formData.mobileNo && formData.mobileNo.length === 10 && validationStatus.mobileNo && validationStatus.mobileNo.apiDown && (
                  <p className="text-yellow-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> Could not verify - API unavailable
                  </p>
                )}
                {!fieldErrors.mobileNo && !isValidating.mobileNo && touchedFields.mobileNo && formData.mobileNo && formData.mobileNo.length === 10 && validationStatus.mobileNo && !validationStatus.mobileNo.apiDown && !validationStatus.mobileNo.exists && (
                  <p className="text-green-500 text-sm mt-1 flex items-center">
                    <FiCheck className="mr-1" /> Available
                  </p>
                )}
                {!fieldErrors.mobileNo && !touchedFields.mobileNo && (
                  <p className="text-sm text-gray-500 mt-1">Must be exactly 10 digits</p>
                )}
              </div>
              <div className="relative">
                <label className="block text-gray-700 font-medium mb-1">
                  Aadhaar Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="aadhaarNo"
                  value={formData.aadhaarNo}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('aadhaarNo')}
                  required
                  placeholder="XXXX-XXXX-XXXX"
                  maxLength="14"
                  className={`w-full px-4 py-3 border ${
                    fieldErrors.aadhaarNo ? 'border-red-500' :
                    validationStatus.aadhaarNo && validationStatus.aadhaarNo.apiDown && formData.aadhaarNo.replace(/-/g, '').length === 12 ? 'border-yellow-500' :
                    validationStatus.aadhaarNo && !validationStatus.aadhaarNo.exists && !validationStatus.aadhaarNo.apiDown && formData.aadhaarNo.replace(/-/g, '').length === 12 ? 'border-green-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.aadhaarNo ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {/* Inline validation icons */}
                {!isValidating.aadhaarNo && validationStatus.aadhaarNo && !validationStatus.aadhaarNo.exists && !validationStatus.aadhaarNo.apiDown && formData.aadhaarNo.replace(/-/g, '').length === 12 && (
                  <FiCheckCircle className="absolute right-3 top-11 text-green-500 w-5 h-5" />
                )}
                {!isValidating.aadhaarNo && validationStatus.aadhaarNo && validationStatus.aadhaarNo.apiDown && formData.aadhaarNo.replace(/-/g, '').length === 12 && (
                  <FiAlertCircle className="absolute right-3 top-11 text-yellow-500 w-5 h-5" />
                )}
                {!isValidating.aadhaarNo && fieldErrors.aadhaarNo && (
                  <FiXCircle className="absolute right-3 top-11 text-red-500 w-5 h-5" />
                )}
                {isValidating.aadhaarNo && (
                  <p className="text-blue-600 text-sm mt-1 font-medium flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Checking Aadhaar number...
                  </p>
                )}
                {fieldErrors.aadhaarNo && !isValidating.aadhaarNo && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.aadhaarNo}
                  </p>
                )}
                {!fieldErrors.aadhaarNo && !isValidating.aadhaarNo && touchedFields.aadhaarNo && formData.aadhaarNo && formData.aadhaarNo.replace(/-/g, '').length === 12 && validationStatus.aadhaarNo && validationStatus.aadhaarNo.apiDown && (
                  <p className="text-yellow-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> Could not verify - API unavailable
                  </p>
                )}
                {!fieldErrors.aadhaarNo && !isValidating.aadhaarNo && touchedFields.aadhaarNo && formData.aadhaarNo && formData.aadhaarNo.replace(/-/g, '').length === 12 && validationStatus.aadhaarNo && !validationStatus.aadhaarNo.apiDown && !validationStatus.aadhaarNo.exists && (
                  <p className="text-green-500 text-sm mt-1 flex items-center">
                    <FiCheck className="mr-1" /> Available
                  </p>
                )}
              </div>
              <ModernUpload
                label="Aadhaar Photo (Front)"
                name="aadhaarPhotoFront"
                file={files.aadhaarPhotoFront}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.aadhaarPhotoFront}
                required
              />
              <ModernUpload
                label="Aadhaar Photo (Back)"
                name="aadhaarPhotoBack"
                file={files.aadhaarPhotoBack}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.aadhaarPhotoBack}
                required
              />
              <CameraCapture
                label="Live Photo (Selfie)"
                onCapture={handleCameraCapture}
                required
              />
              <div className="relative">
                <label className="block text-gray-700 font-medium mb-1">
                  Vehicle Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="vehicleNo"
                  value={formData.vehicleNo}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('vehicleNo')}
                  required
                  placeholder="DL01AB1234"
                  maxLength="10"
                  className={`w-full px-4 py-3 border ${
                    fieldErrors.vehicleNo ? 'border-red-500' :
                    validationStatus.vehicleNo && validationStatus.vehicleNo.apiDown && formData.vehicleNo ? 'border-yellow-500' :
                    validationStatus.vehicleNo && !validationStatus.vehicleNo.exists && !validationStatus.vehicleNo.apiDown && formData.vehicleNo ? 'border-green-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.vehicleNo ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {/* Inline validation icons */}
                {!isValidating.vehicleNo && validationStatus.vehicleNo && !validationStatus.vehicleNo.exists && !validationStatus.vehicleNo.apiDown && formData.vehicleNo && (
                  <FiCheckCircle className="absolute right-3 top-11 text-green-500 w-5 h-5" />
                )}
                {!isValidating.vehicleNo && validationStatus.vehicleNo && validationStatus.vehicleNo.apiDown && formData.vehicleNo && (
                  <FiAlertCircle className="absolute right-3 top-11 text-yellow-500 w-5 h-5" />
                )}
                {!isValidating.vehicleNo && fieldErrors.vehicleNo && (
                  <FiXCircle className="absolute right-3 top-11 text-red-500 w-5 h-5" />
                )}
                {isValidating.vehicleNo && (
                  <p className="text-blue-600 text-sm mt-1 font-medium flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Checking vehicle number...
                  </p>
                )}
                {fieldErrors.vehicleNo && !isValidating.vehicleNo && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.vehicleNo}
                  </p>
                )}
                {!fieldErrors.vehicleNo && !isValidating.vehicleNo && touchedFields.vehicleNo && formData.vehicleNo && validationStatus.vehicleNo && validationStatus.vehicleNo.apiDown && (
                  <p className="text-yellow-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> Could not verify - API unavailable
                  </p>
                )}
                {!fieldErrors.vehicleNo && !isValidating.vehicleNo && touchedFields.vehicleNo && formData.vehicleNo && validationStatus.vehicleNo && !validationStatus.vehicleNo.apiDown && !validationStatus.vehicleNo.exists && (
                  <p className="text-green-500 text-sm mt-1 flex items-center">
                    <FiCheck className="mr-1" /> Available
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('vehicleType')}
                  required
                  className={`w-full px-4 py-3 border ${fieldErrors.vehicleType ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.vehicleType ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg bg-white`}
                >
                  <option value="">Select Vehicle Type</option>
                  <option value="bike">Bike</option>
                  <option value="auto">Auto Rickshaw</option>
                  <option value="car">Car</option>
                </select>
                {fieldErrors.vehicleType && touchedFields.vehicleType && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.vehicleType}
                  </p>
                )}
              </div>
              <ModernUpload
                label="Registration Certificate Photo"
                name="registrationCertificatePhoto"
                file={files.registrationCertificatePhoto}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.registrationCertificatePhoto}
                required
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => changeSection('bank')}
                disabled={isNextButtonDisabled('personal')}
                className={`w-full md:w-auto px-8 py-3 font-semibold text-lg transition rounded-lg ${
                  isNextButtonDisabled('personal')
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-sky-400 text-black hover:bg-black hover:text-white'
                }`}
              >
                {isValidating.mobileNo || isValidating.aadhaarNo || isValidating.vehicleNo ? 'Validating...' : 'Next'}
              </button>
            </div>
          </div>
          {/* Bank Details Section */}
          <div className={activeSection === 'bank' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">Bank Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('bankName')}
                  required
                  placeholder="Enter your bank name"
                  className={`w-full px-4 py-3 border ${fieldErrors.bankName ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.bankName ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {fieldErrors.bankName && touchedFields.bankName && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.bankName}
                  </p>
                )}
                {!fieldErrors.bankName && (
                  <p className="text-sm text-gray-500 mt-1">Letters and spaces only, minimum 2 characters</p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('ifscCode')}
                  required
                  placeholder="SBIN0001234"
                  maxLength="11"
                  className={`w-full px-4 py-3 border ${fieldErrors.ifscCode ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.ifscCode ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {fieldErrors.ifscCode && touchedFields.ifscCode && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.ifscCode}
                  </p>
                )}
                {!fieldErrors.ifscCode && (
                  <p className="text-sm text-gray-500 mt-1">
                    Format: <code className="bg-gray-100 px-1 rounded text-xs">XXXX0XXXXXX</code>
                    <span className="ml-2">(4 letters, then 0, then 6 alphanumeric)</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('accountNumber')}
                  required
                  placeholder="Enter account number (9-18 digits)"
                  className={`w-full px-4 py-3 border ${fieldErrors.accountNumber ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.accountNumber ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {fieldErrors.accountNumber && touchedFields.accountNumber && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.accountNumber}
                  </p>
                )}
                {!fieldErrors.accountNumber && (
                  <p className="text-sm text-gray-500 mt-1">Must be 9-18 digits</p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Account Holder Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountHolderName"
                  value={formData.accountHolderName}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('accountHolderName')}
                  required
                  placeholder="Enter account holder name"
                  className={`w-full px-4 py-3 border ${fieldErrors.accountHolderName ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.accountHolderName ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {fieldErrors.accountHolderName && touchedFields.accountHolderName && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.accountHolderName}
                  </p>
                )}
                {!fieldErrors.accountHolderName && (
                  <p className="text-sm text-gray-500 mt-1">Letters and spaces only, minimum 2 characters</p>
                )}
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('personal')} className="w-full md:w-auto px-8 py-3 bg-sky-400 text-black rounded-lg hover:bg-black hover:text-white font-semibold text-lg transition">Back</button>
              <button
                type="button"
                onClick={() => changeSection('license')}
                disabled={isNextButtonDisabled('bank')}
                className={`w-full md:w-auto px-8 py-3 font-semibold text-lg transition rounded-lg ${
                  isNextButtonDisabled('bank')
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-sky-400 hover:text-black'
                }`}
              >
                Next
              </button>
            </div>
          </div>
          {/* License and Certificates Section */}
          <div className={activeSection === 'license' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">License and Certificates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Driving License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="drivingLicenseNo"
                  value={formData.drivingLicenseNo}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('drivingLicenseNo')}
                  required
                  placeholder="DL0120230012345"
                  maxLength="15"
                  className={`w-full px-4 py-3 border ${fieldErrors.drivingLicenseNo ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.drivingLicenseNo ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {fieldErrors.drivingLicenseNo && touchedFields.drivingLicenseNo && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.drivingLicenseNo}
                  </p>
                )}
                {!fieldErrors.drivingLicenseNo && (
                  <p className="text-sm text-gray-500 mt-1">
                    Format: <code className="bg-gray-100 px-1 rounded text-xs">XX0000000000000</code>
                    <span className="ml-2">(2 letters + 13 digits)</span>
                  </p>
                )}
              </div>
              <ModernUpload
                label="Driving License Photo"
                name="drivingLicensePhoto"
                file={files.drivingLicensePhoto}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.drivingLicensePhoto}
                required
              />
              <div>
                <label className="block text-gray-700 font-medium mb-1">Permit Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="permitNo" value={formData.permitNo} onChange={handleChange} placeholder="Enter permit number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Permit Photo (Optional)"
                name="permitPhoto"
                file={files.permitPhoto}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.permitPhoto}
                required={false}
              />
              <div>
                <label className="block text-gray-700 font-medium mb-1">Fitness Certificate Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="fitnessCertificateNo" value={formData.fitnessCertificateNo} onChange={handleChange} placeholder="Enter fitness certificate number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Fitness Certificate Photo (Optional)"
                name="fitnessCertificatePhoto"
                file={files.fitnessCertificatePhoto}
                onChange={handleFileChange}
                isUploaded={uploadedFiles.fitnessCertificatePhoto}
                required={false}
              />
              <div>
                <label className="block text-gray-700 font-medium mb-1">Insurance Policy Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="insurancePolicyNo" value={formData.insurancePolicyNo} onChange={handleChange} placeholder="Enter insurance policy number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <ModernUpload
                label="Insurance Policy Photo (Optional)"
                name="insurancePolicyPhoto"
                file={files.insurancePolicyPhoto}
                isUploaded={uploadedFiles.insurancePolicyPhoto}
                onChange={handleFileChange}
                required={false}
              />
            </div>
            <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('bank')} className="w-full md:w-auto px-8 py-3 bg-sky-400 text-black rounded-lg hover:bg-black hover:text-white font-semibold text-lg transition">Back</button>
              <button
                type="button"
                onClick={() => changeSection('security')}
                disabled={isNextButtonDisabled('license')}
                className={`w-full md:w-auto px-8 py-3 font-semibold text-lg transition rounded-lg ${
                  isNextButtonDisabled('license')
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-sky-400 hover:text-black'
                }`}
              >
                Next
              </button>
            </div>
          </div>
          {/* Security Section */}
          <div className={activeSection === 'security' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">Security</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('password')}
                  required
                  minLength="6"
                  placeholder="Create a password (min. 6 characters)"
                  className={`w-full px-4 py-3 border ${fieldErrors.password ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.password ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {fieldErrors.password && touchedFields.password && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.password}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('confirmPassword')}
                  required
                  minLength="6"
                  placeholder="Confirm your password"
                  className={`w-full px-4 py-3 border ${fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.confirmPassword ? 'focus:ring-red-500' : 'focus:ring-sky-400'} text-lg`}
                />
                {fieldErrors.confirmPassword && touchedFields.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </div>
            {(compressing || loading) && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
                <div className="text-center">
                  {compressing && (
                    <>
                      <div className="text-blue-700 font-medium mb-2">🗜️ Compressing images...</div>
                      {compressionProgress > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${compressionProgress}%` }}
                          ></div>
                        </div>
                      )}
                      <div className="text-sm text-blue-600">{compressionProgress}% compressed</div>
                    </>
                  )}
                  {loading && !compressing && (
                    <>
                      <div className="text-blue-700 font-medium mb-2">📤 {currentStep}</div>
                      {uploadProgress > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      )}
                      <div className="text-sm text-blue-600">{uploadProgress}% complete</div>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Please wait while we process your documents...
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('license')} className="w-full md:w-auto px-8 py-3 bg-sky-400 text-black rounded-lg hover:bg-black hover:text-white font-semibold text-lg transition">Back</button>
              <button type="submit" disabled={loading || compressing} className="w-full md:w-auto px-8 py-3 bg-black text-white rounded-lg hover:bg-sky-400 hover:text-black font-semibold text-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                {compressing ? `Compressing... (${compressionProgress}%)` : loading ? `Uploading... (${uploadProgress}%)` : 'Sign Up'}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
      <div className="text-center text-gray-500 text-xs p-4 md:mt-2">&copy; 2025 GANTAVYAM. All rights reserved.</div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: 'green',
            },
          },
          error: {
            duration: 4000,
            style: {
              background: 'red',
            },
          },
        }}
      />
    </div>
  );
};

export default DriverSignup;