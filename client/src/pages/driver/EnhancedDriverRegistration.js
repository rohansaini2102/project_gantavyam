import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Save,
  Upload,
  AlertTriangle,
  Clock,
  Download,
  RotateCcw
} from 'lucide-react';

// Enhanced components
import EnhancedModernInput from '../../components/ui/EnhancedModernInput';
import SmartFileUpload from '../../components/ui/SmartFileUpload';
import ProgressTracker from '../../components/ui/ProgressTracker';
import ValidationTooltip from '../../components/ui/ValidationTooltip';

// Utilities and schemas
import {
  getStepSchema,
  completeDriverSchema,
  validationUtils,
  fileValidationRules,
  messages
} from '../../schemas/enhancedDriverValidation';
import { formatters } from '../../utils/enhancedFormatters';
import useDataPersistence from '../../hooks/useDataPersistence';

// API services (assuming these exist)
import { registerDriver } from '../../services/api';

const EnhancedDriverRegistration = () => {
  const navigate = useNavigate();

  // Step configuration
  const steps = [
    {
      key: 'personal',
      label: 'Personal Info',
      icon: '👤',
      description: 'Basic information and identification'
    },
    {
      key: 'vehicle',
      label: 'Vehicle Details',
      icon: '🚗',
      description: 'Vehicle information and specifications'
    },
    {
      key: 'banking',
      label: 'Banking & Licenses',
      icon: '💳',
      description: 'Banking details and license information'
    },
    {
      key: 'documents',
      label: 'Documents & Security',
      icon: '🔒',
      description: 'Document uploads and account security'
    }
  ];

  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepValidation, setStepValidation] = useState({});
  const [completedSteps, setCompletedSteps] = useState([]);
  const [fileData, setFileData] = useState({});
  const [apiValidationCache, setApiValidationCache] = useState({});

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
    isStepCompleted,
    markStepCompleted,
    getCompletionPercentage
  } = useDataPersistence('enhancedDriverRegistration');

  // Form setup with react-hook-form
  const currentStepSchema = getStepSchema(currentStep);

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

  // Load saved data on mount
  useEffect(() => {
    if (hasPersistedData() && Object.keys(savedData).length > 0) {
      reset(savedData);
      toast.success('Previous progress restored');
    }
  }, [hasPersistedData, savedData, reset]);

  // Auto-save form data when it changes
  useEffect(() => {
    if (isDirty && Object.keys(watchedValues).length > 0) {
      autoSave(watchedValues, currentStep);
    }
  }, [watchedValues, isDirty, autoSave, currentStep]);

  // Update step validation status
  useEffect(() => {
    const updateStepValidation = async () => {
      const isStepValid = await trigger();
      const errorCount = Object.keys(errors).length;
      const fieldCount = Object.keys(currentStepSchema.fields).length;
      const completion = Math.round(((fieldCount - errorCount) / fieldCount) * 100);

      setStepValidation(prev => ({
        ...prev,
        [currentStep]: {
          isValid: isStepValid && errorCount === 0,
          hasErrors: errorCount > 0,
          errorCount,
          completion
        }
      }));
    };

    updateStepValidation();
  }, [errors, currentStep, trigger, currentStepSchema]);

  // API validation for specific fields
  const validateWithAPI = useCallback(async (fieldName, value) => {
    if (!validationUtils.requiresApiValidation(fieldName)) {
      return { isValid: true };
    }

    // Check cache first
    const cacheKey = `${fieldName}:${value}`;
    if (apiValidationCache[cacheKey]) {
      return apiValidationCache[cacheKey];
    }

    try {
      // Simulate API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock validation logic
      const isDuplicate = false; // Replace with actual API check
      const result = { isValid: !isDuplicate, error: isDuplicate ? `This ${fieldName} is already registered` : null };

      // Cache result
      setApiValidationCache(prev => ({
        ...prev,
        [cacheKey]: result
      }));

      return result;
    } catch (error) {
      return { isValid: false, error: 'Validation failed. Please try again.' };
    }
  }, [apiValidationCache]);

  // Handle step navigation
  const goToStep = useCallback((stepIndex) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex);
    }
  }, [steps.length]);

  const goToNextStep = useCallback(async () => {
    const isStepValid = await trigger();

    if (isStepValid) {
      const formData = getValues();
      await saveNow(formData, currentStep);
      markStepCompleted(currentStep, formData);

      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }

      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      toast.error('Please fix the errors before continuing');
    }
  }, [trigger, getValues, saveNow, markStepCompleted, currentStep, completedSteps, steps.length]);

  const goToPrevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Handle file uploads
  const handleFileChange = useCallback((fieldName, file, error) => {
    setFileData(prev => ({
      ...prev,
      [fieldName]: error ? null : file
    }));

    if (error) {
      toast.error(error);
    }
  }, []);

  const handleFileRemove = useCallback((fieldName) => {
    setFileData(prev => {
      const newData = { ...prev };
      delete newData[fieldName];
      return newData;
    });
  }, []);

  // Handle form submission
  const onSubmit = useCallback(async (data) => {
    setIsSubmitting(true);

    try {
      // Validate all steps
      const allFormData = { ...savedData, ...data };
      await completeDriverSchema.validate(allFormData, { abortEarly: false });

      // Prepare form data with files
      const formData = new FormData();

      // Add text fields
      Object.entries(allFormData).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      // Add files
      Object.entries(fileData).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });

      // Submit to API
      await registerDriver(formData);

      // Clear saved data
      clearPersistedData();

      // Show success and redirect
      toast.success('Driver registered successfully!');
      setTimeout(() => {
        navigate('/admin/drivers', {
          state: {
            message: 'Driver registered successfully!',
            type: 'success'
          }
        });
      }, 2000);

    } catch (error) {
      console.error('Registration failed:', error);
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [savedData, fileData, clearPersistedData, navigate]);

  // Render form fields for each step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderPersonalInfo();
      case 1:
        return renderVehicleDetails();
      case 2:
        return renderBankingInfo();
      case 3:
        return renderDocumentsAndSecurity();
      default:
        return null;
    }
  };

  // Personal Information Step
  const renderPersonalInfo = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Controller
          name="fullName"
          control={control}
          render={({ field, fieldState }) => (
            <EnhancedModernInput
              {...field}
              label="Full Name"
              placeholder="Enter your complete name"
              error={fieldState.error?.message}
              suggestion={messages.fullName.suggestion}
              formatter={formatters.fullName}
              onValueChange={field.onChange}
              required
              maxLength={100}
              showCharCount
              autoComplete="name"
            />
          )}
        />

        <Controller
          name="mobileNo"
          control={control}
          render={({ field, fieldState }) => (
            <EnhancedModernInput
              {...field}
              label="Mobile Number"
              type="tel"
              placeholder="Enter 10-digit mobile number"
              error={fieldState.error?.message}
              suggestion={messages.mobileNo.suggestion}
              formatter={formatters.mobileNo}
              onValueChange={field.onChange}
              onApiValidate={(value) => validateWithAPI('mobileNo', value)}
              apiValidation
              required
              maxLength={10}
              autoComplete="tel"
            />
          )}
        />

        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <EnhancedModernInput
              {...field}
              label="Email Address"
              type="email"
              placeholder="Enter your email address"
              error={fieldState.error?.message}
              suggestion={messages.email.suggestion}
              formatter={formatters.email}
              onValueChange={field.onChange}
              onApiValidate={(value) => validateWithAPI('email', value)}
              apiValidation
              required
              maxLength={100}
              autoComplete="email"
            />
          )}
        />

        <Controller
          name="aadhaarNo"
          control={control}
          render={({ field, fieldState }) => (
            <EnhancedModernInput
              {...field}
              label="Aadhaar Number"
              placeholder="Enter 12-digit Aadhaar number"
              error={fieldState.error?.message}
              suggestion={messages.aadhaarNo.suggestion}
              formatter={formatters.aadhaarNo}
              onValueChange={field.onChange}
              onApiValidate={(value) => validateWithAPI('aadhaarNo', value)}
              apiValidation
              required
              maxLength={12}
              autoComplete="off"
            />
          )}
        />
      </div>
    </motion.div>
  );

  // Vehicle Details Step
  const renderVehicleDetails = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Controller
          name="vehicleNo"
          control={control}
          render={({ field, fieldState }) => (
            <EnhancedModernInput
              {...field}
              label="Vehicle Registration Number"
              placeholder="e.g., MH01AB1234"
              error={fieldState.error?.message}
              suggestion={messages.vehicleNo.suggestion}
              formatter={formatters.vehicleNo}
              onValueChange={field.onChange}
              onApiValidate={(value) => validateWithAPI('vehicleNo', value)}
              apiValidation
              required
              maxLength={10}
              autoComplete="off"
            />
          )}
        />

        <Controller
          name="vehicleType"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Vehicle Type <span className="text-red-500">*</span>
              </label>
              <select
                {...field}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldState.error ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select vehicle type</option>
                <option value="auto">Auto Rickshaw</option>
                <option value="taxi">Taxi</option>
                <option value="cab">Cab</option>
                <option value="bus">Bus</option>
              </select>
              {fieldState.error && (
                <p className="text-sm text-red-600">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />

        <Controller
          name="vehicleModel"
          control={control}
          render={({ field, fieldState }) => (
            <EnhancedModernInput
              {...field}
              label="Vehicle Model"
              placeholder="e.g., Bajaj RE Auto"
              error={fieldState.error?.message}
              suggestion={messages.vehicleModel.suggestion}
              formatter={formatters.vehicleModel}
              onValueChange={field.onChange}
              required
              maxLength={50}
            />
          )}
        />

        <Controller
          name="manufacturingYear"
          control={control}
          render={({ field, fieldState }) => (
            <EnhancedModernInput
              {...field}
              label="Manufacturing Year"
              type="number"
              placeholder="e.g., 2020"
              error={fieldState.error?.message}
              suggestion={messages.manufacturingYear.suggestion}
              formatter={formatters.manufacturingYear}
              onValueChange={field.onChange}
              required
              maxLength={4}
            />
          )}
        />

        <Controller
          name="color"
          control={control}
          render={({ field, fieldState }) => (
            <EnhancedModernInput
              {...field}
              label="Vehicle Color"
              placeholder="e.g., White, Black"
              error={fieldState.error?.message}
              suggestion={messages.color.suggestion}
              formatter={formatters.color}
              onValueChange={field.onChange}
              required
              maxLength={20}
            />
          )}
        />
      </div>
    </motion.div>
  );

  // Banking Information Step
  const renderBankingInfo = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      {/* Banking Details */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Banking Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Controller
            name="bankName"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Bank Name"
                placeholder="e.g., State Bank of India"
                error={fieldState.error?.message}
                suggestion={messages.bankName.suggestion}
                formatter={formatters.bankName}
                onValueChange={field.onChange}
                required
                maxLength={100}
              />
            )}
          />

          <Controller
            name="accountNumber"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Account Number"
                placeholder="Enter your bank account number"
                error={fieldState.error?.message}
                suggestion={messages.accountNumber.suggestion}
                formatter={formatters.accountNumber}
                onValueChange={field.onChange}
                required
                maxLength={18}
                autoComplete="off"
              />
            )}
          />

          <Controller
            name="accountHolderName"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Account Holder Name"
                placeholder="Name as per bank records"
                error={fieldState.error?.message}
                suggestion={messages.accountHolderName.suggestion}
                formatter={formatters.accountHolderName}
                onValueChange={field.onChange}
                required
                maxLength={100}
              />
            )}
          />

          <Controller
            name="ifscCode"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="IFSC Code"
                placeholder="e.g., SBIN0001234"
                error={fieldState.error?.message}
                suggestion={messages.ifscCode.suggestion}
                formatter={formatters.ifscCode}
                onValueChange={field.onChange}
                required
                maxLength={11}
                autoComplete="off"
              />
            )}
          />
        </div>
      </div>

      {/* License Information */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">License Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Controller
            name="drivingLicenseNo"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Driving License Number"
                placeholder="Enter your DL number"
                error={fieldState.error?.message}
                suggestion={messages.drivingLicenseNo.suggestion}
                formatter={formatters.drivingLicenseNo}
                onValueChange={field.onChange}
                onApiValidate={(value) => validateWithAPI('drivingLicenseNo', value)}
                apiValidation
                required
                maxLength={20}
                autoComplete="off"
              />
            )}
          />

          <Controller
            name="permitNo"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Commercial Permit Number"
                placeholder="Enter permit number"
                error={fieldState.error?.message}
                suggestion={messages.permitNo.suggestion}
                formatter={formatters.permitNo}
                onValueChange={field.onChange}
                required
                maxLength={30}
                autoComplete="off"
              />
            )}
          />

          <Controller
            name="fitnessNo"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Fitness Certificate Number"
                placeholder="Enter fitness certificate number"
                error={fieldState.error?.message}
                suggestion={messages.fitnessNo.suggestion}
                formatter={formatters.fitnessNo}
                onValueChange={field.onChange}
                required
                maxLength={30}
                autoComplete="off"
              />
            )}
          />

          <Controller
            name="insurancePolicyNo"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Insurance Policy Number"
                placeholder="Enter insurance policy number"
                error={fieldState.error?.message}
                suggestion={messages.insurancePolicyNo.suggestion}
                formatter={formatters.insurancePolicyNo}
                onValueChange={field.onChange}
                required
                maxLength={30}
                autoComplete="off"
              />
            )}
          />
        </div>
      </div>
    </motion.div>
  );

  // Documents and Security Step
  const renderDocumentsAndSecurity = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      {/* Security Section */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Account Security</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Controller
            name="password"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Password"
                type="password"
                placeholder="Create a strong password"
                error={fieldState.error?.message}
                suggestion={messages.password.suggestion}
                onValueChange={field.onChange}
                required
                maxLength={128}
                autoComplete="new-password"
              />
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            render={({ field, fieldState }) => (
              <EnhancedModernInput
                {...field}
                label="Confirm Password"
                type="password"
                placeholder="Re-enter your password"
                error={fieldState.error?.message}
                suggestion={messages.confirmPassword.suggestion}
                onValueChange={field.onChange}
                required
                maxLength={128}
                autoComplete="new-password"
              />
            )}
          />
        </div>
      </div>

      {/* Document Upload Section */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Document Upload</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { name: 'aadhaarPhotoFront', label: 'Aadhaar Front Photo' },
            { name: 'aadhaarPhotoBack', label: 'Aadhaar Back Photo' },
            { name: 'driverSelfie', label: 'Driver Selfie', allowCamera: true },
            { name: 'drivingLicensePhoto', label: 'Driving License Photo' },
            { name: 'registrationCertificatePhoto', label: 'Vehicle RC Photo' },
            { name: 'permitPhoto', label: 'Permit Photo' },
            { name: 'fitnessCertificatePhoto', label: 'Fitness Certificate Photo' },
            { name: 'insurancePolicyPhoto', label: 'Insurance Policy Photo' }
          ].map(({ name, label, allowCamera = false }) => (
            <SmartFileUpload
              key={name}
              name={name}
              label={label}
              file={fileData[name]}
              onFileChange={(file, error) => handleFileChange(name, file, error)}
              onRemove={() => handleFileRemove(name)}
              required
              allowCamera={allowCamera}
              showPreview
              maxSize={fileValidationRules.maxSize}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Enhanced Driver Registration</h1>
                <p className="text-blue-100 mt-1">Complete your profile with real-time validation</p>
              </div>
              <div className="text-right">
                <div className="text-white text-sm opacity-90">Progress</div>
                <div className="text-white text-xl font-bold">
                  {getCompletionPercentage()}%
                </div>
                {isAutoSaving && (
                  <div className="flex items-center space-x-1 text-blue-100 text-xs mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
                {lastSaved && !isAutoSaving && (
                  <div className="text-blue-200 text-xs mt-1">
                    {getLastSavedText()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Tracker */}
          <div className="border-b border-gray-200 px-6 py-6">
            <ProgressTracker
              currentStep={currentStep}
              steps={steps}
              completedSteps={completedSteps}
              stepValidation={stepValidation}
              onStepClick={goToStep}
              showPercentage={false}
              showDescriptions
            />
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            <div className="min-h-[600px]">
              <AnimatePresence mode="wait">
                {renderStepContent()}
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              {/* Previous Button */}
              <motion.button
                type="button"
                onClick={goToPrevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </motion.button>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                {/* Save Progress */}
                <ValidationTooltip
                  helpText="Save your progress to continue later"
                  trigger="hover"
                  position="top"
                >
                  <motion.button
                    type="button"
                    onClick={() => saveNow(getValues(), currentStep)}
                    disabled={isAutoSaving}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isAutoSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </motion.button>
                </ValidationTooltip>

                {/* Next/Submit Button */}
                {currentStep === steps.length - 1 ? (
                  <motion.button
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {isSubmitting ? 'Registering...' : 'Complete Registration'}
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={goToNextStep}
                    disabled={!isValid}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDriverRegistration;