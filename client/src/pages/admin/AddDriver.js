import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverSignup } from '../../services/api';
import ModernUpload from '../../components/common/ModernUpload';
import CameraCapture from '../../components/common/CameraCapture';
import HybridDocumentUpload from '../../components/common/HybridDocumentUpload';
import ModernCard from '../../components/admin/ModernCard';
import { FiUser, FiCreditCard, FiClipboard, FiLock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import useRealtimeValidation from '../../hooks/useRealtimeValidation';
import toast, { Toaster } from 'react-hot-toast';
import { compressMultipleImages, validateImageFile, getReadableFileSize } from '../../utils/imageCompression';
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

const AddDriver = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNo: '',
    aadhaarNo: '',
    vehicleNo: '',
    vehicleType: 'auto', // Added vehicleType with default 'auto'
    bankName: '',
    ifscCode: '',
    accountNumber: '',
    accountHolderName: '',
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
  const [success, setSuccess] = useState('');
  const [activeSection, setActiveSection] = useState('personal');

  // New validation states
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [stepValidation, setStepValidation] = useState({
    personal: false,
    bank: false,
    license: false,
    security: false
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  // Use real-time validation hook
  const {
    validationStatus,
    isValidating,
    validateField,
    validateAllFields,
    clearFieldValidation
  } = useRealtimeValidation(500);

  // Input formatters - use validation utilities
  const formatters = {
    mobileNo: normalizeMobile,
    aadhaarNo: formatAadhaarDisplay, // Keep hyphenated for display
    vehicleNo: normalizeVehicleNo,
    accountNumber: normalizeAccountNumber,
    ifscCode: normalizeIfscCode
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Apply formatters if available
    const formattedValue = formatters[name] ? formatters[name](value) : value;

    setFormData({ ...formData, [name]: formattedValue });

    // Clear field error on change
    if (fieldErrors[name]) {
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

  // Handle field blur for duplicate checking
  const handleFieldBlur = useCallback(async (fieldName) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));

    const value = formData[fieldName];

    if (!value) {
      // Clear error if field is empty (will be caught by required validation)
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
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
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const handleCameraCapture = (file) => {
    setFiles({ ...files, driverSelfie: file });
  };

  // Validate current step
  const validateStep = useCallback((step) => {
    const errors = {};

    // CRITICAL FIX: Check for existing duplicate errors first
    const stepFieldMapping = {
      personal: ['fullName', 'mobileNo', 'aadhaarNo', 'vehicleNo', 'vehicleType'],
      bank: ['bankName', 'ifscCode', 'accountNumber', 'accountHolderName'],
      license: ['drivingLicenseNo'],
      security: ['password', 'confirmPassword']
    };

    // Check if any field in current step has duplicate errors
    const currentStepFields = stepFieldMapping[step] || [];
    let hasExistingErrors = false;
    for (const field of currentStepFields) {
      if (fieldErrors[field]) {
        errors[field] = fieldErrors[field];
        hasExistingErrors = true;
        console.log(`[ValidateStep] Found existing error for ${field}: ${fieldErrors[field]}`);
      }
    }

    // Also check validation status for duplicates (but not if API is down)
    if (step === 'personal') {
      // Only block if we have confirmed duplicates, not on API errors
      if (validationStatus.mobileNo?.exists && !validationStatus.mobileNo?.apiDown) {
        errors.mobileNo = validationStatus.mobileNo.message || 'This mobile number is already registered';
        hasExistingErrors = true;
      }
      if (validationStatus.aadhaarNo?.exists && !validationStatus.aadhaarNo?.apiDown) {
        errors.aadhaarNo = validationStatus.aadhaarNo.message || 'This Aadhaar number is already registered';
        hasExistingErrors = true;
      }
      if (validationStatus.vehicleNo?.exists && !validationStatus.vehicleNo?.apiDown) {
        errors.vehicleNo = validationStatus.vehicleNo.message || 'This vehicle number is already registered';
        hasExistingErrors = true;
      }
    }

    // Check if validation is still in progress for any field
    if (step === 'personal') {
      if (isValidating.mobileNo || isValidating.aadhaarNo || isValidating.vehicleNo) {
        toast.error('Please wait for validation to complete');
        return false;
      }
    }

    switch(step) {
      case 'personal':
        if (!formData.fullName && !errors.fullName) errors.fullName = 'Full name is required';
        if (!formData.mobileNo && !errors.mobileNo) {
          errors.mobileNo = 'Mobile number is required';
        } else if (formData.mobileNo.length !== 10 && !errors.mobileNo) {
          errors.mobileNo = 'Mobile number must be 10 digits';
        }
        if (!formData.aadhaarNo && !errors.aadhaarNo) {
          errors.aadhaarNo = 'Aadhaar number is required';
        } else if (!errors.aadhaarNo) {
          const cleanAadhaar = formData.aadhaarNo.replace(/-/g, '');
          if (cleanAadhaar.length !== 12) {
            errors.aadhaarNo = 'Aadhaar must be 12 digits';
          }
        }
        if (!formData.vehicleNo && !errors.vehicleNo) errors.vehicleNo = 'Vehicle number is required';
        if (!formData.vehicleType && !errors.vehicleType) errors.vehicleType = 'Vehicle type is required';
        if (!files.aadhaarPhotoFront) errors.aadhaarPhotoFront = 'Aadhaar front photo is required';
        if (!files.aadhaarPhotoBack) errors.aadhaarPhotoBack = 'Aadhaar back photo is required';
        if (!files.driverSelfie) errors.driverSelfie = 'Driver selfie is required';
        if (!files.registrationCertificatePhoto) errors.registrationCertificatePhoto = 'Registration certificate is required';
        break;

      case 'bank':
        if (!formData.bankName) errors.bankName = 'Bank name is required';
        if (!formData.ifscCode) {
          errors.ifscCode = 'IFSC code is required';
        } else if (formData.ifscCode.length !== 11) {
          errors.ifscCode = 'IFSC code must be 11 characters';
        }
        if (!formData.accountNumber) errors.accountNumber = 'Account number is required';
        if (!formData.accountHolderName) errors.accountHolderName = 'Account holder name is required';
        break;

      case 'license':
        if (!formData.drivingLicenseNo) errors.drivingLicenseNo = 'Driving license number is required';
        if (!files.drivingLicensePhoto) errors.drivingLicensePhoto = 'Driving license photo is required';
        break;

      case 'security':
        if (!formData.password) {
          errors.password = 'Password is required';
        } else if (formData.password.length < 6) {
          errors.password = 'Password must be at least 6 characters';
        }
        if (!formData.confirmPassword) {
          errors.confirmPassword = 'Please confirm password';
        } else if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match';
        }
        break;

      default:
        break;
    }

    setFieldErrors(errors);
    const isValid = Object.keys(errors).length === 0;

    setStepValidation(prev => ({
      ...prev,
      [step]: isValid
    }));

    return isValid;
  }, [formData, files, fieldErrors, validationStatus, isValidating]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all steps first
    const personalValid = validateStep('personal');
    const bankValid = validateStep('bank');
    const licenseValid = validateStep('license');
    const securityValid = validateStep('security');

    // Find the first invalid step
    if (!personalValid) {
      setActiveSection('personal');
      toast.error('Please complete personal information');
      return;
    }
    if (!bankValid) {
      setActiveSection('bank');
      toast.error('Please complete bank details');
      return;
    }
    if (!licenseValid) {
      setActiveSection('license');
      toast.error('Please complete license information');
      return;
    }
    if (!securityValid) {
      setActiveSection('security');
      toast.error('Please complete security information');
      return;
    }

    // Check for duplicates before submission - use normalized values
    setCurrentStep('Validating data...');
    const duplicateCheck = await validateAllFields({
      mobileNo: normalizeMobile(formData.mobileNo),
      aadhaarNo: normalizeAadhaar(formData.aadhaarNo), // Use normalized value
      vehicleNo: normalizeVehicleNo(formData.vehicleNo)
    });

    if (!duplicateCheck.isValid) {
      const errorFields = Object.keys(duplicateCheck.errors);
      if (errorFields.length > 0) {
        // Set active section to first error field
        if (errorFields.includes('mobileNo') || errorFields.includes('aadhaarNo') || errorFields.includes('vehicleNo')) {
          setActiveSection('personal');
        }
        setFieldErrors(duplicateCheck.errors);
        toast.error('Please fix duplicate entries');
        setCurrentStep('');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccess('');

    try {
      // Compress images if they exist
      if (Object.keys(files).some(key => files[key])) {
        setCurrentStep('Compressing images...');
        setCompressing(true);

        const filesToCompress = {};
        Object.keys(files).forEach(key => {
          if (files[key]) {
            filesToCompress[key] = [files[key]];
          }
        });

        const compressedFiles = await compressMultipleImages(filesToCompress, (progress) => {
          setCompressionProgress(progress);
        });

        // Update files with compressed versions
        Object.keys(compressedFiles).forEach(key => {
          if (compressedFiles[key] && compressedFiles[key][0]) {
            files[key] = compressedFiles[key][0];
          }
        });

        setCompressing(false);
      }

      setCurrentStep('Uploading driver information...');

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

      Object.keys(files).forEach(key => {
        if (files[key]) {
          submitData.append(key, files[key]);
        }
      });

      // Call the API with admin flag for immediate approval
      await driverSignup(submitData, { isAdmin: true });

      setLoading(false);
      setCurrentStep('');
      setSuccess('Driver registration successful! Driver is now active.');
      toast.success('Driver registered successfully!');
      setTimeout(() => navigate('/admin/drivers'), 1500);
    } catch (err) {
      setError(err.error || 'Failed to register driver');
      setLoading(false);
      setCurrentStep('');
      toast.error(err.error || 'Failed to register driver');
    }
  };

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

  const changeSection = (section) => {
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

    // Validate current section before moving
    const isCurrentValid = validateStep(activeSection);

    if (!isCurrentValid) {
      toast.error(`Please complete all required fields before proceeding`);
      return;
    }

    setActiveSection(section);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Register New Driver</h1>
          <p className="text-gray-600 mt-1">Add a new driver to the system</p>
        </div>
        <button
          onClick={() => navigate('/admin/drivers')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          View All Drivers
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-red-800">{error}</span>
          </div>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-green-800">{success}</span>
          </div>
        </div>
      )}

      {/* Form Card */}
      <ModernCard>
        {/* Stepper */}
        <div className="flex justify-between items-center mb-8 px-6 pt-6">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex-1 flex flex-col items-center">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full text-xl mb-2 border-2 transition-all ${
                activeSection === step.key 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-gray-100 text-gray-400 border-gray-300'
              }`}>
                {step.icon}
              </div>
              <span className={`text-sm font-medium ${
                activeSection === step.key ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <div className="absolute top-6 left-1/2 w-full h-0.5 bg-gray-200" style={{ width: 'calc(100% - 3rem)' }} />
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="p-6" noValidate>
          {/* Personal Information Section */}
          <div className={activeSection === 'personal' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('fullName')}
                  required
                  placeholder="Enter full name"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                    fieldErrors.fullName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.fullName && touchedFields.fullName && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.fullName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Mobile Number</label>
                <div className="relative">
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
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                      fieldErrors.mobileNo ? 'border-red-500' :
                      validationStatus.mobileNo && validationStatus.mobileNo.apiDown && formData.mobileNo.length === 10 ? 'border-yellow-500' :
                      validationStatus.mobileNo && !validationStatus.mobileNo.exists && !validationStatus.mobileNo.apiDown && formData.mobileNo.length === 10 ? 'border-green-500' : 'border-gray-300'
                    }`}
                  />
                  {isValidating.mobileNo && (
                    <span className="absolute right-3 top-4 text-blue-600 text-sm font-medium flex items-center">
                      <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Checking...
                    </span>
                  )}
                  {!isValidating.mobileNo && validationStatus.mobileNo && validationStatus.mobileNo.apiDown && formData.mobileNo.length === 10 && (
                    <span className="absolute right-3 top-4 flex items-center" title="Could not verify - API unavailable">
                      <FiAlertCircle className="text-yellow-500 w-5 h-5" />
                    </span>
                  )}
                  {!isValidating.mobileNo && validationStatus.mobileNo && !validationStatus.mobileNo.exists && !validationStatus.mobileNo.apiDown && formData.mobileNo.length === 10 && (
                    <FiCheckCircle className="absolute right-3 top-4 text-green-500 w-5 h-5" />
                  )}
                </div>
                {fieldErrors.mobileNo && touchedFields.mobileNo && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.mobileNo}
                  </p>
                )}
                {!fieldErrors.mobileNo && (
                  <p className="text-sm text-gray-500 mt-1">Must be exactly 10 digits</p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Aadhaar Number</label>
                <div className="relative">
                  <input
                    type="text"
                    name="aadhaarNo"
                    value={formData.aadhaarNo}
                    onChange={handleChange}
                    onBlur={() => handleFieldBlur('aadhaarNo')}
                    required
                    placeholder="XXXX-XXXX-XXXX"
                    maxLength="14"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                      fieldErrors.aadhaarNo ? 'border-red-500' :
                      validationStatus.aadhaarNo && validationStatus.aadhaarNo.apiDown && formData.aadhaarNo.replace(/-/g, '').length === 12 ? 'border-yellow-500' :
                      validationStatus.aadhaarNo && !validationStatus.aadhaarNo.exists && !validationStatus.aadhaarNo.apiDown && formData.aadhaarNo.replace(/-/g, '').length === 12 ? 'border-green-500' : 'border-gray-300'
                    }`}
                  />
                  {isValidating.aadhaarNo && (
                    <span className="absolute right-3 top-4 text-blue-600 text-sm font-medium flex items-center">
                      <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Checking...
                    </span>
                  )}
                  {!isValidating.aadhaarNo && validationStatus.aadhaarNo && validationStatus.aadhaarNo.apiDown && formData.aadhaarNo.replace(/-/g, '').length === 12 && (
                    <span className="absolute right-3 top-4 flex items-center" title="Could not verify - API unavailable">
                      <FiAlertCircle className="text-yellow-500 w-5 h-5" />
                    </span>
                  )}
                  {!isValidating.aadhaarNo && validationStatus.aadhaarNo && !validationStatus.aadhaarNo.exists && !validationStatus.aadhaarNo.apiDown && formData.aadhaarNo.replace(/-/g, '').length === 12 && (
                    <FiCheckCircle className="absolute right-3 top-4 text-green-500 w-5 h-5" />
                  )}
                </div>
                {fieldErrors.aadhaarNo && touchedFields.aadhaarNo && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.aadhaarNo}
                  </p>
                )}
              </div>
              <HybridDocumentUpload
                label="Aadhaar Photo (Front)"
                name="aadhaarPhotoFront"
                file={files.aadhaarPhotoFront}
                onChange={handleFileChange}
                documentType="aadhaar-front"
                required
              />
              <HybridDocumentUpload
                label="Aadhaar Photo (Back)"
                name="aadhaarPhotoBack"
                file={files.aadhaarPhotoBack}
                onChange={handleFileChange}
                documentType="aadhaar-back"
                required
              />
              <CameraCapture
                label="Live Photo (Selfie)"
                onCapture={handleCameraCapture}
                required
              />
              <div>
                <label className="block text-gray-700 font-medium mb-1">Vehicle Number</label>
                <div className="relative">
                  <input
                    type="text"
                    name="vehicleNo"
                    value={formData.vehicleNo}
                    onChange={handleChange}
                    onBlur={() => handleFieldBlur('vehicleNo')}
                    required
                    placeholder="MH12AB1234"
                    maxLength="10"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                      fieldErrors.vehicleNo ? 'border-red-500' :
                      validationStatus.vehicleNo && validationStatus.vehicleNo.apiDown && formData.vehicleNo ? 'border-yellow-500' :
                      validationStatus.vehicleNo && !validationStatus.vehicleNo.exists && !validationStatus.vehicleNo.apiDown && formData.vehicleNo ? 'border-green-500' : 'border-gray-300'
                    }`}
                  />
                  {isValidating.vehicleNo && (
                    <span className="absolute right-3 top-4 text-blue-600 text-sm font-medium flex items-center">
                      <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Checking...
                    </span>
                  )}
                  {!isValidating.vehicleNo && validationStatus.vehicleNo && validationStatus.vehicleNo.apiDown && formData.vehicleNo && (
                    <span className="absolute right-3 top-4 flex items-center" title="Could not verify - API unavailable">
                      <FiAlertCircle className="text-yellow-500 w-5 h-5" />
                    </span>
                  )}
                  {!isValidating.vehicleNo && validationStatus.vehicleNo && !validationStatus.vehicleNo.exists && !validationStatus.vehicleNo.apiDown && formData.vehicleNo && (
                    <FiCheckCircle className="absolute right-3 top-4 text-green-500 w-5 h-5" />
                  )}
                </div>
                {fieldErrors.vehicleNo && touchedFields.vehicleNo && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.vehicleNo}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Vehicle Type</label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('vehicleType')}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg bg-white ${
                    fieldErrors.vehicleType ? 'border-red-500' : 'border-gray-300'
                  }`}
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
              <HybridDocumentUpload
                label="Registration Certificate Photo"
                name="registrationCertificatePhoto"
                file={files.registrationCertificatePhoto}
                onChange={handleFileChange}
                documentType="registration-certificate"
                required
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => changeSection('bank')}
                disabled={isNextButtonDisabled('personal')}
                className={`px-6 py-2 font-medium transition rounded-lg ${
                  isNextButtonDisabled('personal')
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isValidating.mobileNo || isValidating.aadhaarNo || isValidating.vehicleNo ? 'Validating...' : 'Next'}
              </button>
            </div>
          </div>
          {/* Bank Details Section */}
          <div className={activeSection === 'bank' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('bankName')}
                  required
                  placeholder="Enter bank name"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                    fieldErrors.bankName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.bankName && touchedFields.bankName && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.bankName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">IFSC Code</label>
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('ifscCode')}
                  required
                  placeholder="SBIN0001234"
                  maxLength="11"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                    fieldErrors.ifscCode ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                <label className="block text-gray-700 font-medium mb-1">Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('accountNumber')}
                  required
                  placeholder="Enter account number"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                    fieldErrors.accountNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.accountNumber && touchedFields.accountNumber && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.accountNumber}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Account Holder Name</label>
                <input
                  type="text"
                  name="accountHolderName"
                  value={formData.accountHolderName}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('accountHolderName')}
                  required
                  placeholder="Enter account holder name"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                    fieldErrors.accountHolderName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.accountHolderName && touchedFields.accountHolderName && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.accountHolderName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('personal')} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition">Back</button>
              <button
                type="button"
                onClick={() => changeSection('license')}
                disabled={isNextButtonDisabled('bank')}
                className={`px-6 py-2 font-medium transition rounded-lg ${
                  isNextButtonDisabled('bank')
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Next
              </button>
            </div>
          </div>
          {/* License and Certificates Section */}
          <div className={activeSection === 'license' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">License and Certificates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Driving License */}
              <div>
                <label className="block text-gray-700 font-medium mb-1">Driving License Number</label>
                <input
                  type="text"
                  name="drivingLicenseNo"
                  value={formData.drivingLicenseNo}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('drivingLicenseNo')}
                  required
                  placeholder="Enter driving license number"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg ${
                    fieldErrors.drivingLicenseNo ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.drivingLicenseNo && touchedFields.drivingLicenseNo && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.drivingLicenseNo}
                  </p>
                )}
              </div>
              <HybridDocumentUpload
                label="Driving License Photo"
                name="drivingLicensePhoto"
                file={files.drivingLicensePhoto}
                onChange={handleFileChange}
                documentType="driving-license"
                required
              />
              {/* Permit */}
              <div>
                <label className="block text-gray-700 font-medium mb-1">Permit Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="permitNo" value={formData.permitNo} onChange={handleChange} placeholder="Enter permit number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <HybridDocumentUpload
                label="Permit Photo (Optional)"
                name="permitPhoto"
                file={files.permitPhoto}
                onChange={handleFileChange}
                documentType="permit"
                required={false}
              />
              {/* Fitness Certificate */}
              <div>
                <label className="block text-gray-700 font-medium mb-1">Fitness Certificate Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="fitnessCertificateNo" value={formData.fitnessCertificateNo} onChange={handleChange} placeholder="Enter fitness certificate number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <HybridDocumentUpload
                label="Fitness Certificate Photo (Optional)"
                name="fitnessCertificatePhoto"
                file={files.fitnessCertificatePhoto}
                onChange={handleFileChange}
                documentType="fitness-certificate"
                required={false}
              />
              {/* Insurance Policy */}
              <div>
                <label className="block text-gray-700 font-medium mb-1">Insurance Policy Number <span className="text-gray-500">(Optional)</span></label>
                <input type="text" name="insurancePolicyNo" value={formData.insurancePolicyNo} onChange={handleChange} placeholder="Enter insurance policy number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg" />
              </div>
              <HybridDocumentUpload
                label="Insurance Policy Photo (Optional)"
                name="insurancePolicyPhoto"
                file={files.insurancePolicyPhoto}
                onChange={handleFileChange}
                documentType="insurance-policy"
                required={false}
              />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('bank')} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition">Back</button>
              <button
                type="button"
                onClick={() => changeSection('security')}
                disabled={isNextButtonDisabled('license')}
                className={`px-6 py-2 font-medium transition rounded-lg ${
                  isNextButtonDisabled('license')
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Next
              </button>
            </div>
          </div>
          {/* Security Section */}
          <div className={activeSection === 'security' ? '' : 'hidden'}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className="block text-gray-700 font-medium mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('password')}
                  required
                  minLength="6"
                  placeholder="Create a password (min. 6 characters)"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg pr-10 ${
                    fieldErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.password && touchedFields.password && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.password}
                  </p>
                )}
              </div>
              <div className="relative">
                <label className="block text-gray-700 font-medium mb-1">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => handleFieldBlur('confirmPassword')}
                  required
                  minLength="6"
                  placeholder="Confirm password"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 text-lg pr-10 ${
                    fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.confirmPassword && touchedFields.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <FiAlertCircle className="mr-1" /> {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button type="button" onClick={() => changeSection('license')} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium transition">Back</button>
              <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-gray-400">
                {loading ? 'Registering...' : 'Register Driver'}
              </button>
            </div>
          </div>
        </form>
      </ModernCard>

      {/* Progress indicator */}
      {currentStep && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 max-w-xs">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm font-medium">{currentStep}</span>
          </div>
          {compressing && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${compressionProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Compressing images: {compressionProgress}%</p>
            </div>
          )}
        </div>
      )}

      {/* Toast container */}
      <Toaster position="top-right" />
    </div>
  );
};

export default AddDriver; 