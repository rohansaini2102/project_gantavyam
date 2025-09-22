import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Car,
  CreditCard,
  Shield,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';

// Custom hooks and components
import {
  useFormData,
  useFileData,
  useFormState,
  useFieldState,
  useFormActions
} from '../../stores/driverRegistrationStore';
import ModernInput from '../../components/ui/ModernInput';
import ModernFileUpload from '../../components/ui/ModernFileUpload';
import ModernStepper from '../../components/ui/ModernStepper';
import { formatters, smartPaste } from '../../utils/formatters';

const ModernDriverRegistration = () => {
  const navigate = useNavigate();

  // Zustand store hooks
  const formData = useFormData();
  const fileData = useFileData();
  const formState = useFormState();
  const actions = useFormActions();

  // Step configuration
  const steps = useMemo(() => [
    {
      key: 'personal',
      label: 'Personal Info',
      icon: '👤',
      description: 'Enter your personal details and identification'
    },
    {
      key: 'vehicle',
      label: 'Vehicle Details',
      icon: '🚗',
      description: 'Provide information about your vehicle'
    },
    {
      key: 'banking',
      label: 'Banking & Licenses',
      icon: '📄',
      description: 'Add banking details and license information'
    },
    {
      key: 'security',
      label: 'Security & Documents',
      icon: '🔒',
      description: 'Set password and upload required documents'
    }
  ], []);

  // Auto-formatters for different fields
  const getAutoFormatter = useCallback((fieldName) => {
    const formatMap = {
      mobileNo: formatters.mobileNo,
      aadhaarNo: formatters.aadhaarNo,
      vehicleNo: formatters.vehicleNo,
      fullName: formatters.name,
      accountHolderName: formatters.name,
      ifscCode: formatters.ifscCode,
      accountNumber: formatters.accountNumber,
      drivingLicenseNo: formatters.licenseNo,
      permitNo: formatters.licenseNo,
      fitnessNo: formatters.licenseNo,
      insurancePolicyNo: formatters.licenseNo,
      manufacturingYear: formatters.year
    };
    return formatMap[fieldName];
  }, []);

  // Handle field changes with smart formatting
  const handleFieldChange = useCallback((fieldName, value) => {
    // Auto-format value
    const formatter = getAutoFormatter(fieldName);
    const formattedValue = formatter ? formatter(value) : value;

    actions.setFieldValue(fieldName, formattedValue);
  }, [actions, getAutoFormatter]);

  // Handle field blur events
  const handleFieldBlur = useCallback((fieldName) => {
    actions.setFieldTouched(fieldName);
  }, [actions]);

  // Handle paste events with smart formatting
  const handlePaste = useCallback((fieldName, event) => {
    const pastedText = event.clipboardData.getData('text');
    const smartFormatted = smartPaste(fieldName, pastedText);

    event.preventDefault();
    actions.setFieldValue(fieldName, smartFormatted);
  }, [actions]);

  // Handle file uploads
  const handleFileChange = useCallback((fieldName, file, error) => {
    actions.setFileData(fieldName, file, error);
  }, [actions]);

  const handleFileRemove = useCallback((fieldName) => {
    actions.removeFile(fieldName);
  }, [actions]);

  // Navigation functions
  const nextStep = useCallback(() => {
    actions.nextStep();
  }, [actions]);

  const prevStep = useCallback(() => {
    actions.prevStep();
  }, [actions]);

  const goToStep = useCallback((stepIndex) => {
    actions.goToStep(stepIndex);
  }, [actions]);

  // Form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    try {
      const result = await actions.submitForm();

      // Success! Show success message and navigate
      navigate('/driver/dashboard', {
        state: {
          message: 'Registration successful! Welcome to the platform.',
          type: 'success'
        }
      });
    } catch (error) {
      // Error is already handled in the store
      console.error('Registration failed:', error);
    }
  }, [actions, navigate]);

  // Create a field component with validation
  const FormField = useCallback(({ name, label, type = 'text', ...props }) => {
    const fieldState = useFieldState(name);

    return (
      <ModernInput
        name={name}
        label={label}
        type={type}
        value={fieldState.value}
        error={fieldState.error}
        apiValidation={fieldState.apiValidation}
        isValidating={fieldState.isValidating}
        required={fieldState.fieldContext?.required}
        autoFormat={getAutoFormatter(name)}
        onValueChange={(value) => handleFieldChange(name, value)}
        onBlur={() => handleFieldBlur(name)}
        onPaste={(e) => handlePaste(name, e)}
        {...props}
      />
    );
  }, [handleFieldChange, handleFieldBlur, handlePaste, getAutoFormatter]);

  // Create a file upload component
  const FileField = useCallback(({ name, label, accept, ...props }) => {
    const fieldState = useFieldState(name);

    return (
      <ModernFileUpload
        name={name}
        label={label}
        accept={accept}
        file={fileData[name]}
        error={fieldState.error}
        required={fieldState.fieldContext?.required}
        onFileChange={(file, error) => handleFileChange(name, file, error)}
        onRemove={() => handleFileRemove(name)}
        {...props}
      />
    );
  }, [fileData, handleFileChange, handleFileRemove]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Driver Registration
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Complete all steps to register a new driver with enhanced validation and modern interface
          </p>
        </motion.div>

        {/* Stepper */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <ModernStepper
            steps={steps}
            currentStep={formState.currentStep}
            completedSteps={formState.completedSteps}
            onStepClick={goToStep}
          />
        </motion.div>

        {/* Form Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {/* Step 0: Personal Information */}
              {formState.currentStep === 0 && (
                <motion.div
                  key="personal"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
                      <p className="text-gray-600">Enter your personal details and identification</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      name="fullName"
                      label="Full Name"
                      placeholder="Enter your full name"
                      maxLength={100}
                      helpText="Enter your full name as it appears on official documents"
                    />

                    <FormField
                      name="mobileNo"
                      label="Mobile Number"
                      type="tel"
                      placeholder="9876543210"
                      maxLength={10}
                      showCharacterCount
                      helpText="10-digit Indian mobile number. +91 prefix will be auto-removed"
                      onRetry={() => actions.retryValidation('mobileNo')}
                    />

                    <FormField
                      name="email"
                      label="Email Address"
                      type="email"
                      placeholder="your.email@example.com"
                      value={validation.getFieldState('email').value}
                      error={validation.getFieldState('email').error}
                      maxLength={100}
                      required
                      helpText="Valid email address for notifications and communication"
                      onValueChange={(value) => handleFieldChange('email', value)}
                      onBlur={() => validation.setFieldTouched('email')}
                    />

                    <ModernInput
                      name="aadhaarNo"
                      label="Aadhaar Number"
                      placeholder="123456789012"
                      value={validation.getFieldState('aadhaarNo').value}
                      error={validation.getFieldState('aadhaarNo').error}
                      apiValidation={validation.getFieldState('aadhaarNo').apiValidation}
                      isValidating={validation.getFieldState('aadhaarNo').isValidating}
                      maxLength={12}
                      required
                      autoFormat={getAutoFormatter('aadhaarNo')}
                      showCharacterCount
                      helpText="12-digit Aadhaar number from your Aadhaar card"
                      onValueChange={(value) => handleFieldChange('aadhaarNo', value)}
                      onBlur={() => validation.setFieldTouched('aadhaarNo')}
                      onPaste={(e) => handlePaste('aadhaarNo', e)}
                      onRetry={validation.retryValidation}
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 1: Vehicle Information */}
              {currentStep === 1 && (
                <motion.div
                  key="vehicle"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Car className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Vehicle Details</h2>
                      <p className="text-gray-600">Provide information about your vehicle</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ModernInput
                      name="vehicleNo"
                      label="Vehicle Number"
                      placeholder="MH01AB1234"
                      value={validation.getFieldState('vehicleNo').value}
                      error={validation.getFieldState('vehicleNo').error}
                      apiValidation={validation.getFieldState('vehicleNo').apiValidation}
                      isValidating={validation.getFieldState('vehicleNo').isValidating}
                      maxLength={10}
                      required
                      autoFormat={getAutoFormatter('vehicleNo')}
                      helpText="Vehicle registration number as shown on RC book"
                      onValueChange={(value) => handleFieldChange('vehicleNo', value)}
                      onBlur={() => validation.setFieldTouched('vehicleNo')}
                      onPaste={(e) => handlePaste('vehicleNo', e)}
                      onRetry={validation.retryValidation}
                    />

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Vehicle Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="vehicleType"
                        value={validation.getFieldState('vehicleType').value}
                        onChange={(e) => handleFieldChange('vehicleType', e.target.value)}
                        className="w-full h-14 px-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                        required
                      >
                        <option value="auto">Auto Rickshaw</option>
                        <option value="taxi">Taxi</option>
                        <option value="cab">Cab</option>
                        <option value="bus">Bus</option>
                      </select>
                    </div>

                    <ModernInput
                      name="vehicleModel"
                      label="Vehicle Model"
                      placeholder="e.g., Maruti Swift, Tata Indica"
                      value={validation.getFieldState('vehicleModel').value}
                      error={validation.getFieldState('vehicleModel').error}
                      maxLength={50}
                      required
                      helpText="Make and model of your vehicle"
                      onValueChange={(value) => handleFieldChange('vehicleModel', value)}
                      onBlur={() => validation.setFieldTouched('vehicleModel')}
                    />

                    <ModernInput
                      name="manufacturingYear"
                      label="Manufacturing Year"
                      placeholder="2020"
                      value={validation.getFieldState('manufacturingYear').value}
                      error={validation.getFieldState('manufacturingYear').error}
                      maxLength={4}
                      required
                      autoFormat={getAutoFormatter('manufacturingYear')}
                      helpText="Year when your vehicle was manufactured"
                      onValueChange={(value) => handleFieldChange('manufacturingYear', value)}
                      onBlur={() => validation.setFieldTouched('manufacturingYear')}
                    />

                    <ModernInput
                      name="color"
                      label="Vehicle Color"
                      placeholder="e.g., White, Red, Blue"
                      value={validation.getFieldState('color').value}
                      error={validation.getFieldState('color').error}
                      maxLength={20}
                      required
                      helpText="Primary color of your vehicle"
                      onValueChange={(value) => handleFieldChange('color', value)}
                      onBlur={() => validation.setFieldTouched('color')}
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 2: Banking & License Information */}
              {currentStep === 2 && (
                <motion.div
                  key="banking"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Banking & License Details</h2>
                      <p className="text-gray-600">Add banking information and license details</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Banking Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Banking Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ModernInput
                          name="bankName"
                          label="Bank Name"
                          placeholder="e.g., State Bank of India"
                          value={validation.getFieldState('bankName').value}
                          error={validation.getFieldState('bankName').error}
                          maxLength={100}
                          required
                          helpText="Full name of your bank"
                          onValueChange={(value) => handleFieldChange('bankName', value)}
                          onBlur={() => validation.setFieldTouched('bankName')}
                        />

                        <ModernInput
                          name="accountNumber"
                          label="Account Number"
                          placeholder="Account number"
                          value={validation.getFieldState('accountNumber').value}
                          error={validation.getFieldState('accountNumber').error}
                          maxLength={18}
                          required
                          autoFormat={getAutoFormatter('accountNumber')}
                          helpText="Your bank account number (9-18 digits)"
                          onValueChange={(value) => handleFieldChange('accountNumber', value)}
                          onBlur={() => validation.setFieldTouched('accountNumber')}
                        />

                        <ModernInput
                          name="accountHolderName"
                          label="Account Holder Name"
                          placeholder="Name as per bank records"
                          value={validation.getFieldState('accountHolderName').value}
                          error={validation.getFieldState('accountHolderName').error}
                          maxLength={100}
                          required
                          autoFormat={getAutoFormatter('accountHolderName')}
                          helpText="Name as it appears in your bank account"
                          onValueChange={(value) => handleFieldChange('accountHolderName', value)}
                          onBlur={() => validation.setFieldTouched('accountHolderName')}
                        />

                        <ModernInput
                          name="ifscCode"
                          label="IFSC Code"
                          placeholder="SBIN0001234"
                          value={validation.getFieldState('ifscCode').value}
                          error={validation.getFieldState('ifscCode').error}
                          maxLength={11}
                          required
                          autoFormat={getAutoFormatter('ifscCode')}
                          showCharacterCount
                          helpText="11-character IFSC code from your bank"
                          onValueChange={(value) => handleFieldChange('ifscCode', value)}
                          onBlur={() => validation.setFieldTouched('ifscCode')}
                        />
                      </div>
                    </div>

                    {/* License Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">License Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ModernInput
                          name="drivingLicenseNo"
                          label="Driving License Number"
                          placeholder="License number"
                          value={validation.getFieldState('drivingLicenseNo').value}
                          error={validation.getFieldState('drivingLicenseNo').error}
                          maxLength={20}
                          required
                          autoFormat={getAutoFormatter('drivingLicenseNo')}
                          helpText="Your valid driving license number"
                          onValueChange={(value) => handleFieldChange('drivingLicenseNo', value)}
                          onBlur={() => validation.setFieldTouched('drivingLicenseNo')}
                        />

                        <ModernInput
                          name="permitNo"
                          label="Permit Number"
                          placeholder="Permit number"
                          value={validation.getFieldState('permitNo').value}
                          error={validation.getFieldState('permitNo').error}
                          maxLength={30}
                          required
                          helpText="Commercial vehicle permit number"
                          onValueChange={(value) => handleFieldChange('permitNo', value)}
                          onBlur={() => validation.setFieldTouched('permitNo')}
                        />

                        <ModernInput
                          name="fitnessNo"
                          label="Fitness Certificate Number"
                          placeholder="Fitness certificate number"
                          value={validation.getFieldState('fitnessNo').value}
                          error={validation.getFieldState('fitnessNo').error}
                          maxLength={30}
                          required
                          helpText="Vehicle fitness certificate number"
                          onValueChange={(value) => handleFieldChange('fitnessNo', value)}
                          onBlur={() => validation.setFieldTouched('fitnessNo')}
                        />

                        <ModernInput
                          name="insurancePolicyNo"
                          label="Insurance Policy Number"
                          placeholder="Insurance policy number"
                          value={validation.getFieldState('insurancePolicyNo').value}
                          error={validation.getFieldState('insurancePolicyNo').error}
                          maxLength={30}
                          required
                          helpText="Current vehicle insurance policy number"
                          onValueChange={(value) => handleFieldChange('insurancePolicyNo', value)}
                          onBlur={() => validation.setFieldTouched('insurancePolicyNo')}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Security & Document Upload */}
              {currentStep === 3 && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <Shield className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Security & Documents</h2>
                      <p className="text-gray-600">Set password and upload required documents</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Password Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Security Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ModernInput
                          name="password"
                          label="Password"
                          type="password"
                          placeholder="Create a strong password"
                          value={validation.getFieldState('password').value}
                          error={validation.getFieldState('password').error}
                          required
                          helpText="Minimum 8 characters with uppercase, lowercase, numbers, and special characters"
                          onValueChange={(value) => handleFieldChange('password', value)}
                          onBlur={() => validation.setFieldTouched('password')}
                        />

                        <ModernInput
                          name="confirmPassword"
                          label="Confirm Password"
                          type="password"
                          placeholder="Re-enter your password"
                          value={validation.getFieldState('confirmPassword').value}
                          error={validation.getFieldState('confirmPassword').error}
                          required
                          helpText="Must match the password entered above"
                          onValueChange={(value) => handleFieldChange('confirmPassword', value)}
                          onBlur={() => validation.setFieldTouched('confirmPassword')}
                        />
                      </div>
                    </div>

                    {/* Document Upload Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Required Documents</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <ModernFileUpload
                          name="aadhaarPhotoFront"
                          label="Aadhaar Front Photo"
                          file={files.aadhaarPhotoFront}
                          required
                          helpText="Clear photo of Aadhaar card front side with all details visible"
                          onFileChange={handleFileChange}
                          onRemove={handleFileRemove}
                        />

                        <ModernFileUpload
                          name="aadhaarPhotoBack"
                          label="Aadhaar Back Photo"
                          file={files.aadhaarPhotoBack}
                          required
                          helpText="Clear photo of Aadhaar card back side with address details"
                          onFileChange={handleFileChange}
                          onRemove={handleFileRemove}
                        />

                        <ModernFileUpload
                          name="driverSelfie"
                          label="Driver Selfie"
                          file={files.driverSelfie}
                          required
                          helpText="Recent selfie photo for identity verification"
                          onFileChange={handleFileChange}
                          onRemove={handleFileRemove}
                        />

                        <ModernFileUpload
                          name="drivingLicensePhoto"
                          label="Driving License Photo"
                          file={files.drivingLicensePhoto}
                          required
                          helpText="Clear photo of valid driving license"
                          onFileChange={handleFileChange}
                          onRemove={handleFileRemove}
                        />

                        <ModernFileUpload
                          name="registrationCertificatePhoto"
                          label="RC Photo"
                          file={files.registrationCertificatePhoto}
                          required
                          helpText="Vehicle registration certificate photo"
                          onFileChange={handleFileChange}
                          onRemove={handleFileRemove}
                        />

                        <ModernFileUpload
                          name="permitPhoto"
                          label="Permit Photo"
                          file={files.permitPhoto}
                          required
                          helpText="Commercial vehicle permit document photo"
                          onFileChange={handleFileChange}
                          onRemove={handleFileRemove}
                        />

                        <ModernFileUpload
                          name="fitnessCertificatePhoto"
                          label="Fitness Certificate Photo"
                          file={files.fitnessCertificatePhoto}
                          required
                          helpText="Valid vehicle fitness certificate"
                          onFileChange={handleFileChange}
                          onRemove={handleFileRemove}
                        />

                        <ModernFileUpload
                          name="insurancePolicyPhoto"
                          label="Insurance Policy Photo"
                          file={files.insurancePolicyPhoto}
                          required
                          helpText="Current vehicle insurance policy document"
                          onFileChange={handleFileChange}
                          onRemove={handleFileRemove}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Error Display */}
            <AnimatePresence>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-red-800">{submitError.message}</div>
                      <div className="text-sm text-red-600 mt-1">{submitError.suggestion}</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 border-t mt-8">
              <motion.button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 0}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                  ${currentStep === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-md'
                  }
                `}
                whileHover={currentStep > 0 ? { scale: 1.02 } : {}}
                whileTap={currentStep > 0 ? { scale: 0.98 } : {}}
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </motion.button>

              {currentStep < steps.length - 1 ? (
                <motion.button
                  type="button"
                  onClick={nextStep}
                  disabled={!isCurrentStepValid}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                    ${isCurrentStepValid
                      ? 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                  whileHover={isCurrentStepValid ? { scale: 1.02 } : {}}
                  whileTap={isCurrentStepValid ? { scale: 0.98 } : {}}
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={isSubmitting || !isCurrentStepValid}
                  className={`
                    flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all
                    ${isSubmitting
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : isCurrentStepValid
                      ? 'bg-green-500 text-white hover:bg-green-600 hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                  whileHover={!isSubmitting && isCurrentStepValid ? { scale: 1.02 } : {}}
                  whileTap={!isSubmitting && isCurrentStepValid ? { scale: 0.98 } : {}}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Registration
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default ModernDriverRegistration;