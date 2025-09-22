// client/src/pages/driver/Registration.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerDriver } from '../../services/api';
import CameraCapture from '../../components/common/CameraCapture';

const DriverRegistration = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNo: '',
    aadhaarNo: '',
    vehicleNo: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    drivingLicenseNo: '',
    permitNo: '',
    fitnessCertificateNo: '',
    insurancePolicyNo: ''
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
  const [validationStatus, setValidationStatus] = useState({
    mobileNo: { isValid: null, isChecking: false, message: '' },
    aadhaarNo: { isValid: null, isChecking: false, message: '' },
    vehicleNo: { isValid: null, isChecking: false, message: '' },
    ifscCode: { isValid: null, isChecking: false, message: '', bankName: '' }
  });
  const [uploadStatus, setUploadStatus] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Step definitions matching the old 4-step UI
  const steps = [
    { key: 'personal', label: 'Personal Info', icon: '👤' },
    { key: 'bank', label: 'Bank Details', icon: '💳' },
    { key: 'license', label: 'Licenses', icon: '📄' },
    { key: 'security', label: 'Security', icon: '🔒' }
  ];

  // Major Indian banks for dropdown
  const majorBanks = [
    'State Bank of India (SBI)',
    'HDFC Bank',
    'ICICI Bank',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'IndusInd Bank',
    'YES Bank',
    'Bank of Baroda',
    'Canara Bank',
    'Punjab National Bank (PNB)',
    'Union Bank of India',
    'Bank of India',
    'Central Bank of India',
    'Indian Bank',
    'IDFC First Bank',
    'Federal Bank',
    'South Indian Bank',
    'Karur Vysya Bank',
    'Tamilnad Mercantile Bank',
    'City Union Bank'
  ];

  // Validation functions
  const validateUniqueness = async (field, value) => {
    if (!value) return;

    setValidationStatus(prev => ({
      ...prev,
      [field]: { ...prev[field], isChecking: true }
    }));

    try {
      const response = await fetch(`/api/admin/validate-driver-field`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({ field, value })
      });

      const result = await response.json();

      setValidationStatus(prev => ({
        ...prev,
        [field]: {
          isValid: result.isValid,
          isChecking: false,
          message: result.message || ''
        }
      }));
    } catch (error) {
      setValidationStatus(prev => ({
        ...prev,
        [field]: {
          isValid: null,
          isChecking: false,
          message: 'Validation failed. Please try again.'
        }
      }));
    }
  };

  const validateIFSC = async (ifscCode) => {
    if (!ifscCode || ifscCode.length !== 11) {
      setValidationStatus(prev => ({
        ...prev,
        ifscCode: { isValid: false, isChecking: false, message: 'IFSC code must be 11 characters', bankName: '' }
      }));
      return;
    }

    setValidationStatus(prev => ({
      ...prev,
      ifscCode: { ...prev.ifscCode, isChecking: true }
    }));

    try {
      // You can integrate with IFSC API here, for now basic validation
      const bankCode = ifscCode.substring(0, 4);
      const bankNames = {
        'SBIN': 'State Bank of India (SBI)',
        'HDFC': 'HDFC Bank',
        'ICIC': 'ICICI Bank',
        'UTIB': 'Axis Bank',
        'KKBK': 'Kotak Mahindra Bank',
        'INDB': 'IndusInd Bank',
        'YESB': 'YES Bank',
        'BARB': 'Bank of Baroda',
        'CNRB': 'Canara Bank',
        'PUNB': 'Punjab National Bank (PNB)'
      };

      const detectedBank = bankNames[bankCode] || '';

      setValidationStatus(prev => ({
        ...prev,
        ifscCode: {
          isValid: true,
          isChecking: false,
          message: detectedBank ? `Detected: ${detectedBank}` : 'Valid IFSC format',
          bankName: detectedBank
        }
      }));

      // Auto-fill bank name if detected
      if (detectedBank && !formData.bankName) {
        setFormData(prev => ({ ...prev, bankName: detectedBank }));
      }
    } catch (error) {
      setValidationStatus(prev => ({
        ...prev,
        ifscCode: { isValid: false, isChecking: false, message: 'IFSC validation failed', bankName: '' }
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Mobile number validation - only allow digits and max 10
    if (name === 'mobileNo') {
      const numbersOnly = value.replace(/[^0-9]/g, '');
      if (numbersOnly.length <= 10) {
        setFormData({ ...formData, [name]: numbersOnly });

        // Validate uniqueness when mobile number is complete
        if (numbersOnly.length === 10) {
          setTimeout(() => validateUniqueness('mobileNo', numbersOnly), 500);
        }
      }
    } else if (name === 'aadhaarNo') {
      // Aadhaar validation - only allow digits and max 12
      const numbersOnly = value.replace(/[^0-9]/g, '');
      if (numbersOnly.length <= 12) {
        setFormData({ ...formData, [name]: numbersOnly });

        // Validate uniqueness when Aadhaar number is complete
        if (numbersOnly.length === 12) {
          setTimeout(() => validateUniqueness('aadhaarNo', numbersOnly), 500);
        }
      }
    } else if (name === 'vehicleNo') {
      // Vehicle number validation - convert to uppercase
      const upperValue = value.toUpperCase();
      setFormData({ ...formData, [name]: upperValue });

      // Validate uniqueness with debouncing
      if (upperValue.length >= 4) {
        setTimeout(() => validateUniqueness('vehicleNo', upperValue), 1000);
      }
    } else if (name === 'ifscCode') {
      // IFSC code validation - convert to uppercase
      const upperValue = value.toUpperCase();
      setFormData({ ...formData, [name]: upperValue });

      // Validate IFSC when length is 11
      if (upperValue.length === 11) {
        setTimeout(() => validateIFSC(upperValue), 500);
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const fieldName = e.target.name;

    if (file) {
      // Validate file type and size
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        setError(`${fieldName}: Please upload only JPG, JPEG, or PNG files`);
        return;
      }

      if (file.size > maxSize) {
        setError(`${fieldName}: File size must be less than 5MB`);
        return;
      }

      // Clear any previous error
      setError(null);

      // Update file and upload status
      setFiles({ ...files, [fieldName]: file });
      setUploadStatus(prev => ({
        ...prev,
        [fieldName]: {
          status: 'selected',
          fileName: file.name,
          fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          progress: 0
        }
      }));

      // Simulate upload progress (in real implementation, this would be actual upload)
      setTimeout(() => {
        setUploadStatus(prev => ({
          ...prev,
          [fieldName]: { ...prev[fieldName], status: 'uploaded', progress: 100 }
        }));
      }, 1000);
    }
  };

  const handleCameraCapture = (file) => {
    setFiles({ ...files, driverSelfie: file });
  };

  // Form validation helpers
  const isFormValid = () => {
    const errors = getValidationErrors();
    return errors.length === 0;
  };

  const getValidationErrors = () => {
    const errors = [];

    // Check required text fields
    if (!formData.fullName) errors.push('Full name is required');
    if (!formData.mobileNo || formData.mobileNo.length !== 10) errors.push('Valid 10-digit mobile number is required');
    if (!formData.aadhaarNo || formData.aadhaarNo.length !== 12) errors.push('Valid 12-digit Aadhaar number is required');
    if (!formData.vehicleNo) errors.push('Vehicle number is required');
    if (!formData.drivingLicenseNo) errors.push('Driving license number is required');

    // Check bank details
    if (!formData.accountHolderName) errors.push('Account holder name is required');
    if (!formData.accountNumber) errors.push('Account number is required');
    if (!formData.ifscCode || formData.ifscCode.length !== 11) errors.push('Valid 11-character IFSC code is required');
    if (!formData.bankName) errors.push('Bank name is required');

    // Check uniqueness validations
    if (validationStatus.mobileNo.isValid === false) errors.push('Mobile number already exists');
    if (validationStatus.aadhaarNo.isValid === false) errors.push('Aadhaar number already exists');
    if (validationStatus.vehicleNo.isValid === false) errors.push('Vehicle number already exists');

    // Check required files
    const requiredFiles = ['aadhaarPhotoFront', 'aadhaarPhotoBack', 'driverSelfie', 'registrationCertificatePhoto', 'drivingLicensePhoto'];
    const missingFiles = requiredFiles.filter(field => !files[field]);
    if (missingFiles.length > 0) {
      errors.push(`Missing required documents: ${missingFiles.join(', ')}`);
    }

    return errors;
  };

  // Step-specific validation functions
  const validateStep = (stepIndex) => {
    const errors = [];

    switch (stepIndex) {
      case 0: // Personal Info
        if (!formData.fullName) errors.push('Full name is required');
        if (!formData.mobileNo || formData.mobileNo.length !== 10) errors.push('Valid 10-digit mobile number is required');
        if (!formData.aadhaarNo || formData.aadhaarNo.length !== 12) errors.push('Valid 12-digit Aadhaar number is required');
        if (!formData.vehicleNo) errors.push('Vehicle number is required');
        if (!formData.drivingLicenseNo) errors.push('Driving license number is required');

        // Check uniqueness validations
        if (validationStatus.mobileNo.isValid === false) errors.push('Mobile number already exists');
        if (validationStatus.aadhaarNo.isValid === false) errors.push('Aadhaar number already exists');
        if (validationStatus.vehicleNo.isValid === false) errors.push('Vehicle number already exists');

        // Check required files for step 1
        const step1Files = ['aadhaarPhotoFront', 'aadhaarPhotoBack', 'driverSelfie', 'registrationCertificatePhoto', 'drivingLicensePhoto'];
        const missingFiles = step1Files.filter(field => !files[field]);
        if (missingFiles.length > 0) {
          errors.push(`Missing required documents: ${missingFiles.join(', ')}`);
        }
        break;

      case 1: // Bank Details
        if (!formData.accountHolderName) errors.push('Account holder name is required');
        if (!formData.accountNumber) errors.push('Account number is required');
        if (!formData.ifscCode || formData.ifscCode.length !== 11) errors.push('Valid 11-character IFSC code is required');
        if (!formData.bankName) errors.push('Bank name is required');
        if (validationStatus.ifscCode.isValid === false) errors.push('Invalid IFSC code');
        break;

      case 2: // Licenses (all fields are optional, no validation needed)
        break;

      case 3: // Security
        if (!formData.password || formData.password.length < 6) errors.push('Password must be at least 6 characters');
        if (formData.password !== formData.confirmPassword) errors.push('Passwords do not match');
        break;

      default:
        break;
    }

    return errors;
  };

  const canProceedToNextStep = (stepIndex) => {
    const errors = validateStep(stepIndex);
    return errors.length === 0;
  };

  const handleNextStep = () => {
    if (canProceedToNextStep(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
      setError(null);
    } else {
      const errors = validateStep(currentStep);
      setError(errors.join('. '));
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setError(null);
  };

  const handleStepClick = (stepIndex) => {
    // Allow clicking on completed steps or the next immediate step
    if (completedSteps.includes(stepIndex) || stepIndex === currentStep || stepIndex === currentStep + 1) {
      if (stepIndex > currentStep && !canProceedToNextStep(currentStep)) {
        const errors = validateStep(currentStep);
        setError(errors.join('. '));
        return;
      }
      if (stepIndex < currentStep || canProceedToNextStep(currentStep)) {
        setCurrentStep(stepIndex);
        setError(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Comprehensive validation before submission
    const errors = [];

    // Check mobile number
    if (formData.mobileNo.length !== 10) {
      errors.push('Mobile number must be exactly 10 digits');
    } else if (validationStatus.mobileNo.isValid === false) {
      errors.push('Mobile number already exists in database');
    }

    // Check Aadhaar number
    if (formData.aadhaarNo.length !== 12) {
      errors.push('Aadhaar number must be exactly 12 digits');
    } else if (validationStatus.aadhaarNo.isValid === false) {
      errors.push('Aadhaar number already exists in database');
    }

    // Check vehicle number
    if (!formData.vehicleNo || formData.vehicleNo.length < 4) {
      errors.push('Vehicle number is required');
    } else if (validationStatus.vehicleNo.isValid === false) {
      errors.push('Vehicle number already exists in database');
    }

    // Check required files
    const requiredFiles = ['aadhaarPhotoFront', 'aadhaarPhotoBack', 'driverSelfie', 'registrationCertificatePhoto', 'drivingLicensePhoto'];
    const missingFiles = requiredFiles.filter(field => !files[field]);
    if (missingFiles.length > 0) {
      errors.push(`Please upload all required files: ${missingFiles.join(', ')}`);
    }

    // Check bank details
    if (!formData.accountHolderName || !formData.accountNumber || !formData.ifscCode || !formData.bankName) {
      errors.push('All bank details are required');
    }

    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        submitData.append(key, formData[key]);
      });
      Object.keys(files).forEach(key => {
        if (files[key]) {
          submitData.append(key, files[key]);
        }
      });
      const response = await registerDriver(submitData);
      setLoading(false);

      // Show success message with driver details
      alert(`Driver registered successfully!\nName: ${formData.fullName}\nMobile: ${formData.mobileNo}\nVehicle: ${formData.vehicleNo}`);

      // Reset form for next registration
      setFormData({
        fullName: '',
        mobileNo: '',
        aadhaarNo: '',
        vehicleNo: '',
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        drivingLicenseNo: '',
        permitNo: '',
        fitnessCertificateNo: '',
        insurancePolicyNo: ''
      });
      setFiles({
        aadhaarPhotoFront: null,
        aadhaarPhotoBack: null,
        driverSelfie: null,
        registrationCertificatePhoto: null,
        drivingLicensePhoto: null,
        permitPhoto: null,
        fitnessCertificatePhoto: null,
        insurancePolicyPhoto: null
      });

      // Ask if user wants to register another driver or go back to admin panel
      const continueRegistration = window.confirm('Driver registered successfully! Would you like to register another driver? Click Cancel to return to admin panel.');
      if (!continueRegistration) {
        navigate('/admin/drivers');
      }
    } catch (err) {
      setError(err.error || 'Failed to register driver');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 md:flex md:flex-col md:items-center md:justify-center">
      {/* Mobile: Full width with safe padding, Desktop: Centered */}
      <div className="w-full md:max-w-4xl bg-white md:rounded-lg md:shadow-lg md:mb-4">
        <div className="p-4 md:p-8 pb-safe-area-inset-bottom">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-700 mb-2">GANTAVYAM Admin</h1>
            <h2 className="text-xl font-semibold text-orange-500">Driver Registration</h2>
            <p className="mt-2 text-gray-600">Step {currentStep + 1} of {steps.length}</p>
          </div>

          {/* Step Indicator */}
          <div className="flex justify-between items-center mb-6 md:mb-8 overflow-x-auto">
            {steps.map((step, idx) => (
              <div
                key={step.key}
                className="flex-1 flex flex-col items-center min-w-0 px-1 cursor-pointer"
                onClick={() => handleStepClick(idx)}
              >
                <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-lg md:text-2xl mb-1 border-2 transition-all ${
                  currentStep === idx
                    ? 'bg-blue-500 text-white border-blue-500 scale-110'
                    : completedSteps.includes(idx)
                    ? 'bg-green-500 text-white border-green-500'
                    : currentStep > idx
                    ? 'bg-gray-300 text-gray-600 border-gray-300'
                    : 'bg-gray-100 text-gray-400 border-gray-300'
                }`}>
                  {completedSteps.includes(idx) ? '✓' : step.icon}
                </div>
                <span className={`text-xs font-semibold text-center ${
                  currentStep === idx
                    ? 'text-blue-600'
                    : completedSteps.includes(idx)
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
                {idx < steps.length - 1 && (
                  <div className={`hidden md:block w-full h-1 mt-2 ${
                    completedSteps.includes(idx) ? 'bg-green-300' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 border-l-4 border-red-500 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-4">
            {/* Step 1: Personal Information */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-blue-700 mb-4">Personal Information & Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Full Name *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              placeholder="Enter driver's full name"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="relative">
            <label className="block text-gray-700 font-medium mb-1">Mobile Number *</label>
            <div className="relative">
              <input
                type="tel"
                name="mobileNo"
                value={formData.mobileNo}
                onChange={handleChange}
                required
                placeholder="Enter 10-digit mobile number"
                pattern="[0-9]{10}"
                maxLength="10"
                className={`w-full px-4 py-2 pr-10 border rounded focus:outline-none focus:ring-2 ${
                  validationStatus.mobileNo.isValid === true
                    ? 'border-green-500 focus:ring-green-400'
                    : validationStatus.mobileNo.isValid === false
                    ? 'border-red-500 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-blue-400'
                }`}
              />
              {validationStatus.mobileNo.isChecking && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
              {validationStatus.mobileNo.isValid === true && (
                <div className="absolute right-3 top-3 text-green-500">✓</div>
              )}
              {validationStatus.mobileNo.isValid === false && (
                <div className="absolute right-3 top-3 text-red-500">✗</div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">Must be exactly 10 digits</p>
            {validationStatus.mobileNo.message && (
              <p className={`text-sm mt-1 ${validationStatus.mobileNo.isValid === false ? 'text-red-500' : 'text-green-500'}`}>
                {validationStatus.mobileNo.message}
              </p>
            )}
          </div>
          <div className="relative">
            <label className="block text-gray-700 font-medium mb-1">Aadhaar Number *</label>
            <div className="relative">
              <input
                type="text"
                name="aadhaarNo"
                value={formData.aadhaarNo}
                onChange={handleChange}
                required
                placeholder="Enter 12-digit Aadhaar number"
                maxLength="12"
                className={`w-full px-4 py-2 pr-10 border rounded focus:outline-none focus:ring-2 ${
                  validationStatus.aadhaarNo.isValid === true
                    ? 'border-green-500 focus:ring-green-400'
                    : validationStatus.aadhaarNo.isValid === false
                    ? 'border-red-500 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-blue-400'
                }`}
              />
              {validationStatus.aadhaarNo.isChecking && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
              {validationStatus.aadhaarNo.isValid === true && (
                <div className="absolute right-3 top-3 text-green-500">✓</div>
              )}
              {validationStatus.aadhaarNo.isValid === false && (
                <div className="absolute right-3 top-3 text-red-500">✗</div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">Must be exactly 12 digits</p>
            {validationStatus.aadhaarNo.message && (
              <p className={`text-sm mt-1 ${validationStatus.aadhaarNo.isValid === false ? 'text-red-500' : 'text-green-500'}`}>
                {validationStatus.aadhaarNo.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Aadhaar Photo (Front) *</label>
            <input
              type="file"
              name="aadhaarPhotoFront"
              onChange={handleFileChange}
              required
              accept="image/jpeg,image/jpg,image/png"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {uploadStatus.aadhaarPhotoFront && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{uploadStatus.aadhaarPhotoFront.fileName}</span>
                  <span className="text-gray-500">{uploadStatus.aadhaarPhotoFront.fileSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadStatus.aadhaarPhotoFront.status === 'uploaded' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${uploadStatus.aadhaarPhotoFront.progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center mt-1">
                  {uploadStatus.aadhaarPhotoFront.status === 'uploaded' && (
                    <span className="text-green-600 text-sm">✓ Uploaded successfully</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Aadhaar Photo (Back) *</label>
            <input
              type="file"
              name="aadhaarPhotoBack"
              onChange={handleFileChange}
              required
              accept="image/jpeg,image/jpg,image/png"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {uploadStatus.aadhaarPhotoBack && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{uploadStatus.aadhaarPhotoBack.fileName}</span>
                  <span className="text-gray-500">{uploadStatus.aadhaarPhotoBack.fileSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadStatus.aadhaarPhotoBack.status === 'uploaded' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${uploadStatus.aadhaarPhotoBack.progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center mt-1">
                  {uploadStatus.aadhaarPhotoBack.status === 'uploaded' && (
                    <span className="text-green-600 text-sm">✓ Uploaded successfully</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <CameraCapture
            label="Live Photo (Selfie)"
            onCapture={handleCameraCapture}
            required
          />
          <div className="relative">
            <label className="block text-gray-700 font-medium mb-1">Vehicle Number *</label>
            <div className="relative">
              <input
                type="text"
                name="vehicleNo"
                value={formData.vehicleNo}
                onChange={handleChange}
                required
                placeholder="e.g., DL01AB1234"
                className={`w-full px-4 py-2 pr-10 border rounded focus:outline-none focus:ring-2 ${
                  validationStatus.vehicleNo.isValid === true
                    ? 'border-green-500 focus:ring-green-400'
                    : validationStatus.vehicleNo.isValid === false
                    ? 'border-red-500 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-blue-400'
                }`}
              />
              {validationStatus.vehicleNo.isChecking && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
              {validationStatus.vehicleNo.isValid === true && (
                <div className="absolute right-3 top-3 text-green-500">✓</div>
              )}
              {validationStatus.vehicleNo.isValid === false && (
                <div className="absolute right-3 top-3 text-red-500">✗</div>
              )}
            </div>
            {validationStatus.vehicleNo.message && (
              <p className={`text-sm mt-1 ${validationStatus.vehicleNo.isValid === false ? 'text-red-500' : 'text-green-500'}`}>
                {validationStatus.vehicleNo.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Registration Certificate Photo *</label>
            <input
              type="file"
              name="registrationCertificatePhoto"
              onChange={handleFileChange}
              required
              accept="image/jpeg,image/jpg,image/png"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {uploadStatus.registrationCertificatePhoto && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{uploadStatus.registrationCertificatePhoto.fileName}</span>
                  <span className="text-gray-500">{uploadStatus.registrationCertificatePhoto.fileSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadStatus.registrationCertificatePhoto.status === 'uploaded' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${uploadStatus.registrationCertificatePhoto.progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center mt-1">
                  {uploadStatus.registrationCertificatePhoto.status === 'uploaded' && (
                    <span className="text-green-600 text-sm">✓ Uploaded successfully</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <h3 className="text-lg font-semibold text-blue-700 mt-6 mb-2">Bank Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Account Holder Name *</label>
            <input
              type="text"
              name="accountHolderName"
              value={formData.accountHolderName}
              onChange={handleChange}
              required
              placeholder="Enter account holder name"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Account Number *</label>
            <input
              type="text"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleChange}
              required
              placeholder="Enter account number"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="relative">
            <label className="block text-gray-700 font-medium mb-1">IFSC Code *</label>
            <div className="relative">
              <input
                type="text"
                name="ifscCode"
                value={formData.ifscCode}
                onChange={handleChange}
                required
                placeholder="e.g., SBIN0001234"
                maxLength="11"
                className={`w-full px-4 py-2 pr-10 border rounded focus:outline-none focus:ring-2 ${
                  validationStatus.ifscCode.isValid === true
                    ? 'border-green-500 focus:ring-green-400'
                    : validationStatus.ifscCode.isValid === false
                    ? 'border-red-500 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-blue-400'
                }`}
              />
              {validationStatus.ifscCode.isChecking && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
              {validationStatus.ifscCode.isValid === true && (
                <div className="absolute right-3 top-3 text-green-500">✓</div>
              )}
              {validationStatus.ifscCode.isValid === false && (
                <div className="absolute right-3 top-3 text-red-500">✗</div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">11-character bank IFSC code</p>
            {validationStatus.ifscCode.message && (
              <p className={`text-sm mt-1 ${validationStatus.ifscCode.isValid === false ? 'text-red-500' : 'text-green-500'}`}>
                {validationStatus.ifscCode.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Bank Name *</label>
            <select
              name="bankName"
              value={formData.bankName}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Select a bank</option>
              {majorBanks.map((bank, index) => (
                <option key={index} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">Or type manually if not in list</p>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-blue-700 mt-6 mb-2">License & Certificates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Driving License Number *</label>
            <input
              type="text"
              name="drivingLicenseNo"
              value={formData.drivingLicenseNo}
              onChange={handleChange}
              required
              placeholder="Enter driving license number"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Driving License Photo *</label>
            <input
              type="file"
              name="drivingLicensePhoto"
              onChange={handleFileChange}
              required
              accept="image/jpeg,image/jpg,image/png"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {uploadStatus.drivingLicensePhoto && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{uploadStatus.drivingLicensePhoto.fileName}</span>
                  <span className="text-gray-500">{uploadStatus.drivingLicensePhoto.fileSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadStatus.drivingLicensePhoto.status === 'uploaded' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${uploadStatus.drivingLicensePhoto.progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center mt-1">
                  {uploadStatus.drivingLicensePhoto.status === 'uploaded' && (
                    <span className="text-green-600 text-sm">✓ Uploaded successfully</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Permit Number <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              name="permitNo"
              value={formData.permitNo}
              onChange={handleChange}
              placeholder="Enter permit number if available"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Permit Photo <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded text-xs">(Optional)</span>
            </label>
            <input
              type="file"
              name="permitPhoto"
              onChange={handleFileChange}
              accept="image/jpeg,image/jpg,image/png"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {uploadStatus.permitPhoto && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{uploadStatus.permitPhoto.fileName}</span>
                  <span className="text-gray-500">{uploadStatus.permitPhoto.fileSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadStatus.permitPhoto.status === 'uploaded' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${uploadStatus.permitPhoto.progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center mt-1">
                  {uploadStatus.permitPhoto.status === 'uploaded' && (
                    <span className="text-green-600 text-sm">✓ Uploaded successfully</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Fitness Certificate Number <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              name="fitnessCertificateNo"
              value={formData.fitnessCertificateNo}
              onChange={handleChange}
              placeholder="Enter fitness certificate number if available"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Fitness Certificate Photo <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded text-xs">(Optional)</span>
            </label>
            <input
              type="file"
              name="fitnessCertificatePhoto"
              onChange={handleFileChange}
              accept="image/jpeg,image/jpg,image/png"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {uploadStatus.fitnessCertificatePhoto && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{uploadStatus.fitnessCertificatePhoto.fileName}</span>
                  <span className="text-gray-500">{uploadStatus.fitnessCertificatePhoto.fileSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadStatus.fitnessCertificatePhoto.status === 'uploaded' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${uploadStatus.fitnessCertificatePhoto.progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center mt-1">
                  {uploadStatus.fitnessCertificatePhoto.status === 'uploaded' && (
                    <span className="text-green-600 text-sm">✓ Uploaded successfully</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Insurance Policy Number <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded text-xs">(Optional)</span>
            </label>
            <input
              type="text"
              name="insurancePolicyNo"
              value={formData.insurancePolicyNo}
              onChange={handleChange}
              placeholder="Enter insurance policy number if available"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Insurance Policy Photo <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded text-xs">(Optional)</span>
            </label>
            <input
              type="file"
              name="insurancePolicyPhoto"
              onChange={handleFileChange}
              accept="image/jpeg,image/jpg,image/png"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {uploadStatus.insurancePolicyPhoto && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{uploadStatus.insurancePolicyPhoto.fileName}</span>
                  <span className="text-gray-500">{uploadStatus.insurancePolicyPhoto.fileSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadStatus.insurancePolicyPhoto.status === 'uploaded' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${uploadStatus.insurancePolicyPhoto.progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center mt-1">
                  {uploadStatus.insurancePolicyPhoto.status === 'uploaded' && (
                    <span className="text-green-600 text-sm">✓ Uploaded successfully</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !isFormValid()}
          className={`w-full font-semibold py-3 rounded transition mt-6 ${
            loading || !isFormValid()
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-800'
          }`}
        >
          {loading ? 'Registering...' : 'Register Driver'}
        </button>

        {/* Form validation summary */}
        {!isFormValid() && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-sm font-medium">Please complete all required fields:</p>
            <ul className="mt-2 text-yellow-700 text-sm">
              {getValidationErrors().map((error, index) => (
                <li key={index} className="flex items-center">
                  <span className="mr-2">•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
};

export default DriverRegistration;