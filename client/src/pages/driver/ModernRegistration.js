import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Car,
  CreditCard,
  Shield,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2
} from 'lucide-react';

// Custom hooks and components
import {
  useFormData,
  useFileData,
  useFormState,
  useFormActions
} from '../../stores/driverRegistrationStore';
import ModernInput from '../../components/ui/ModernInput';
import ModernFileUpload from '../../components/ui/ModernFileUpload';
import ModernStepper from '../../components/ui/ModernStepper';
import { formatters } from '../../utils/formatters';

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

  // Form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    try {
      await actions.submitForm();

      // Show success message and redirect
      setTimeout(() => {
        navigate('/admin/drivers', {
          state: {
            message: 'Driver registered successfully!',
            type: 'success'
          }
        });
      }, 2000);

      // Registration successful - handled by redirect
    } catch (error) {
      console.error('Registration failed:', error);
    }
  }, [actions, navigate]);

  // Vehicle type options
  const vehicleTypes = [
    { value: 'auto', label: 'Auto Rickshaw' },
    { value: 'taxi', label: 'Taxi' },
    { value: 'bus', label: 'Bus' },
    { value: 'truck', label: 'Truck' }
  ];

  // Get field state helper
  const getFieldValue = (fieldName) => formData[fieldName] || '';
  const getFieldError = (fieldName) => formState.errors?.[fieldName];

  // Handle field change
  const handleFieldChange = useCallback((fieldName, value) => {
    const formatter = formatters[fieldName];
    const formattedValue = formatter ? formatter(value) : value;
    actions.setFieldValue(fieldName, formattedValue);
  }, [actions]);

  // Handle field blur
  const handleFieldBlur = useCallback((fieldName) => {
    actions.setFieldTouched(fieldName);
  }, [actions]);

  // Handle file change
  const handleFileChange = useCallback((fieldName, file, error) => {
    actions.setFileData(fieldName, file, error);
  }, [actions]);

  // Handle file remove
  const handleFileRemove = useCallback((fieldName) => {
    actions.removeFile(fieldName);
  }, [actions]);

  // Navigation handlers
  const handleNext = () => actions.nextStep();
  const handlePrevious = () => actions.prevStep();
  const handleStepClick = (stepIndex) => actions.goToStep(stepIndex);

  const renderPersonalInfo = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-blue-900">Personal Information</h3>
            <p className="text-sm text-blue-700">Please provide accurate personal details</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ModernInput
          name="fullName"
          label="Full Name"
          value={getFieldValue('fullName')}
          error={getFieldError('fullName')}
          placeholder="Enter your full name"
          maxLength={100}
          helpText="Enter your full name as it appears on official documents"
          onValueChange={(value) => handleFieldChange('fullName', value)}
          onBlur={() => handleFieldBlur('fullName')}
        />

        <ModernInput
          name="mobileNo"
          label="Mobile Number"
          type="tel"
          value={getFieldValue('mobileNo')}
          error={getFieldError('mobileNo')}
          placeholder="Enter 10-digit mobile number"
          maxLength={10}
          helpText="Used for booking alerts and communication"
          onValueChange={(value) => handleFieldChange('mobileNo', value)}
          onBlur={() => handleFieldBlur('mobileNo')}
        />

        <ModernInput
          name="email"
          label="Email Address"
          type="email"
          value={getFieldValue('email')}
          error={getFieldError('email')}
          placeholder="Enter your email address"
          helpText="Used for account notifications and updates"
          onValueChange={(value) => handleFieldChange('email', value)}
          onBlur={() => handleFieldBlur('email')}
        />

        <ModernInput
          name="aadhaarNo"
          label="Aadhaar Number"
          value={getFieldValue('aadhaarNo')}
          error={getFieldError('aadhaarNo')}
          placeholder="Enter 12-digit Aadhaar number"
          maxLength={12}
          helpText="Required for identity verification"
          onValueChange={(value) => handleFieldChange('aadhaarNo', value)}
          onBlur={() => handleFieldBlur('aadhaarNo')}
        />
      </div>
    </motion.div>
  );

  const renderVehicleDetails = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-green-600" />
          <div>
            <h3 className="font-medium text-green-900">Vehicle Information</h3>
            <p className="text-sm text-green-700">Provide details about your vehicle</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ModernInput
          name="vehicleNo"
          label="Vehicle Registration Number"
          value={getFieldValue('vehicleNo')}
          error={getFieldError('vehicleNo')}
          placeholder="e.g., MH01AB1234"
          helpText="Enter the registration number as shown on RC"
          onValueChange={(value) => handleFieldChange('vehicleNo', value)}
          onBlur={() => handleFieldBlur('vehicleNo')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vehicle Type <span className="text-red-500">*</span>
          </label>
          <select
            value={getFieldValue('vehicleType')}
            onChange={(e) => handleFieldChange('vehicleType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {vehicleTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <ModernInput
          name="vehicleModel"
          label="Vehicle Model"
          value={getFieldValue('vehicleModel')}
          error={getFieldError('vehicleModel')}
          placeholder="e.g., Bajaj RE Auto"
          onValueChange={(value) => handleFieldChange('vehicleModel', value)}
          onBlur={() => handleFieldBlur('vehicleModel')}
        />

        <ModernInput
          name="manufacturingYear"
          label="Manufacturing Year"
          type="number"
          value={getFieldValue('manufacturingYear')}
          error={getFieldError('manufacturingYear')}
          placeholder="e.g., 2020"
          min="2000"
          max="2024"
          onValueChange={(value) => handleFieldChange('manufacturingYear', value)}
          onBlur={() => handleFieldBlur('manufacturingYear')}
        />

        <ModernInput
          name="color"
          label="Vehicle Color"
          value={getFieldValue('color')}
          error={getFieldError('color')}
          placeholder="e.g., Yellow, Black"
          onValueChange={(value) => handleFieldChange('color', value)}
          onBlur={() => handleFieldBlur('color')}
        />
      </div>
    </motion.div>
  );

  const renderBankingAndLicenses = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="font-medium text-purple-900">Banking & License Information</h3>
            <p className="text-sm text-purple-700">Required for payments and legal compliance</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Banking Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ModernInput
            name="bankName"
            label="Bank Name"
            value={getFieldValue('bankName')}
            error={getFieldError('bankName')}
            placeholder="e.g., State Bank of India"
            onValueChange={(value) => handleFieldChange('bankName', value)}
            onBlur={() => handleFieldBlur('bankName')}
          />

          <ModernInput
            name="accountNumber"
            label="Account Number"
            value={getFieldValue('accountNumber')}
            error={getFieldError('accountNumber')}
            placeholder="Enter your bank account number"
            onValueChange={(value) => handleFieldChange('accountNumber', value)}
            onBlur={() => handleFieldBlur('accountNumber')}
          />

          <ModernInput
            name="accountHolderName"
            label="Account Holder Name"
            value={getFieldValue('accountHolderName')}
            error={getFieldError('accountHolderName')}
            placeholder="Name as per bank records"
            onValueChange={(value) => handleFieldChange('accountHolderName', value)}
            onBlur={() => handleFieldBlur('accountHolderName')}
          />

          <ModernInput
            name="ifscCode"
            label="IFSC Code"
            value={getFieldValue('ifscCode')}
            error={getFieldError('ifscCode')}
            placeholder="e.g., SBIN0001234"
            maxLength={11}
            onValueChange={(value) => handleFieldChange('ifscCode', value)}
            onBlur={() => handleFieldBlur('ifscCode')}
          />
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">License Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ModernInput
            name="drivingLicenseNo"
            label="Driving License Number"
            value={getFieldValue('drivingLicenseNo')}
            error={getFieldError('drivingLicenseNo')}
            placeholder="e.g., MH0120110012345"
            onValueChange={(value) => handleFieldChange('drivingLicenseNo', value)}
            onBlur={() => handleFieldBlur('drivingLicenseNo')}
          />

          <ModernInput
            name="permitNo"
            label="Commercial Permit Number"
            value={getFieldValue('permitNo')}
            error={getFieldError('permitNo')}
            placeholder="Enter permit number"
            onValueChange={(value) => handleFieldChange('permitNo', value)}
            onBlur={() => handleFieldBlur('permitNo')}
          />

          <ModernInput
            name="fitnessNo"
            label="Fitness Certificate Number"
            value={getFieldValue('fitnessNo')}
            error={getFieldError('fitnessNo')}
            placeholder="Enter fitness certificate number"
            onValueChange={(value) => handleFieldChange('fitnessNo', value)}
            onBlur={() => handleFieldBlur('fitnessNo')}
          />

          <ModernInput
            name="insurancePolicyNo"
            label="Insurance Policy Number"
            value={getFieldValue('insurancePolicyNo')}
            error={getFieldError('insurancePolicyNo')}
            placeholder="Enter insurance policy number"
            onValueChange={(value) => handleFieldChange('insurancePolicyNo', value)}
            onBlur={() => handleFieldBlur('insurancePolicyNo')}
          />
        </div>
      </div>
    </motion.div>
  );

  const renderSecurityAndDocuments = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="font-medium text-red-900">Security & Documents</h3>
            <p className="text-sm text-red-700">Set password and upload required documents</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Account Security</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ModernInput
            name="password"
            label="Password"
            type="password"
            value={getFieldValue('password')}
            error={getFieldError('password')}
            placeholder="Create a strong password"
            helpText="Minimum 8 characters with uppercase, lowercase, number and special character"
            onValueChange={(value) => handleFieldChange('password', value)}
            onBlur={() => handleFieldBlur('password')}
          />

          <ModernInput
            name="confirmPassword"
            label="Confirm Password"
            type="password"
            value={getFieldValue('confirmPassword')}
            error={getFieldError('confirmPassword')}
            placeholder="Re-enter your password"
            onValueChange={(value) => handleFieldChange('confirmPassword', value)}
            onBlur={() => handleFieldBlur('confirmPassword')}
          />
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Document Upload</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ModernFileUpload
            name="aadhaarPhotoFront"
            label="Aadhaar Front Photo"
            accept="image/*"
            file={fileData.aadhaarPhotoFront}
            error={getFieldError('aadhaarPhotoFront')}
            required
            onFileChange={(file, error) => handleFileChange('aadhaarPhotoFront', file, error)}
            onRemove={() => handleFileRemove('aadhaarPhotoFront')}
          />

          <ModernFileUpload
            name="aadhaarPhotoBack"
            label="Aadhaar Back Photo"
            accept="image/*"
            file={fileData.aadhaarPhotoBack}
            error={getFieldError('aadhaarPhotoBack')}
            required
            onFileChange={(file, error) => handleFileChange('aadhaarPhotoBack', file, error)}
            onRemove={() => handleFileRemove('aadhaarPhotoBack')}
          />

          <ModernFileUpload
            name="driverSelfie"
            label="Driver Selfie"
            accept="image/*"
            file={fileData.driverSelfie}
            error={getFieldError('driverSelfie')}
            required
            onFileChange={(file, error) => handleFileChange('driverSelfie', file, error)}
            onRemove={() => handleFileRemove('driverSelfie')}
          />

          <ModernFileUpload
            name="drivingLicensePhoto"
            label="Driving License Photo"
            accept="image/*"
            file={fileData.drivingLicensePhoto}
            error={getFieldError('drivingLicensePhoto')}
            required
            onFileChange={(file, error) => handleFileChange('drivingLicensePhoto', file, error)}
            onRemove={() => handleFileRemove('drivingLicensePhoto')}
          />

          <ModernFileUpload
            name="registrationCertificatePhoto"
            label="Vehicle RC Photo"
            accept="image/*"
            file={fileData.registrationCertificatePhoto}
            error={getFieldError('registrationCertificatePhoto')}
            required
            onFileChange={(file, error) => handleFileChange('registrationCertificatePhoto', file, error)}
            onRemove={() => handleFileRemove('registrationCertificatePhoto')}
          />

          <ModernFileUpload
            name="permitPhoto"
            label="Permit Photo"
            accept="image/*"
            file={fileData.permitPhoto}
            error={getFieldError('permitPhoto')}
            required
            onFileChange={(file, error) => handleFileChange('permitPhoto', file, error)}
            onRemove={() => handleFileRemove('permitPhoto')}
          />

          <ModernFileUpload
            name="fitnessCertificatePhoto"
            label="Fitness Certificate Photo"
            accept="image/*"
            file={fileData.fitnessCertificatePhoto}
            error={getFieldError('fitnessCertificatePhoto')}
            required
            onFileChange={(file, error) => handleFileChange('fitnessCertificatePhoto', file, error)}
            onRemove={() => handleFileRemove('fitnessCertificatePhoto')}
          />

          <ModernFileUpload
            name="insurancePolicyPhoto"
            label="Insurance Policy Photo"
            accept="image/*"
            file={fileData.insurancePolicyPhoto}
            error={getFieldError('insurancePolicyPhoto')}
            required
            onFileChange={(file, error) => handleFileChange('insurancePolicyPhoto', file, error)}
            onRemove={() => handleFileRemove('insurancePolicyPhoto')}
          />
        </div>
      </div>
    </motion.div>
  );

  const renderStepContent = () => {
    switch (formState.currentStep) {
      case 0:
        return renderPersonalInfo();
      case 1:
        return renderVehicleDetails();
      case 2:
        return renderBankingAndLicenses();
      case 3:
        return renderSecurityAndDocuments();
      default:
        return renderPersonalInfo();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Driver Registration</h1>
                <p className="text-blue-100 mt-1">Complete your profile to start earning</p>
              </div>
              <div className="text-right">
                <div className="text-white text-sm opacity-90">Progress</div>
                <div className="text-white text-xl font-bold">
                  {formState.completionPercentage || 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="border-b border-gray-200 px-6 py-4">
            <ModernStepper
              steps={steps}
              currentStep={formState.currentStep}
              completedSteps={formState.completedSteps}
              onStepClick={handleStepClick}
            />
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="min-h-[600px]">
              {renderStepContent()}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <motion.button
                type="button"
                onClick={handlePrevious}
                disabled={formState.currentStep === 0}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </motion.button>

              <div className="flex items-center gap-4">
                {formState.currentStep === steps.length - 1 ? (
                  <motion.button
                    type="submit"
                    disabled={formState.isSubmitting || !formState.isValid}
                    className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {formState.isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {formState.isSubmitting ? 'Registering...' : 'Complete Registration'}
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700"
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

export default ModernDriverRegistration;