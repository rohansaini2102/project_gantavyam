import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Initial form data
const initialFormData = {
  fullName: '',
  mobileNo: '',
  email: '',
  aadhaarNo: '',
  vehicleNo: '',
  vehicleType: 'auto',
  vehicleModel: '',
  manufacturingYear: '',
  color: '',
  bankName: '',
  accountNumber: '',
  accountHolderName: '',
  ifscCode: '',
  drivingLicenseNo: '',
  permitNo: '',
  fitnessNo: '',
  insurancePolicyNo: '',
  password: '',
  confirmPassword: ''
};

const initialFileData = {
  aadhaarPhotoFront: null,
  aadhaarPhotoBack: null,
  driverSelfie: null,
  drivingLicensePhoto: null,
  registrationCertificatePhoto: null,
  permitPhoto: null,
  fitnessCertificatePhoto: null,
  insurancePolicyPhoto: null
};

// ULTRA SIMPLE STORE - NO COMPUTED PROPERTIES, NO SELECTORS, NO COMPLEXITY
const useDriverRegistrationStore = create(
  persist(
    (set, get) => ({
      // RAW STATE ONLY
      formData: { ...initialFormData },
      fileData: { ...initialFileData },
      errors: {},
      currentStep: 0,
      completedSteps: [],
      isSubmitting: false,
      isDirty: false,

      // SIMPLE ACTIONS ONLY
      setFieldValue: (fieldName, value) => {
        set((state) => ({
          ...state,
          formData: { ...state.formData, [fieldName]: value },
          isDirty: true
        }));
      },

      setFieldTouched: (fieldName) => {
        // Simple touch action - no complex logic
      },

      setFileData: (fieldName, file, error = null) => {
        set((state) => ({
          ...state,
          fileData: { ...state.fileData, [fieldName]: file },
          isDirty: true
        }));
      },

      removeFile: (fieldName) => {
        set((state) => ({
          ...state,
          fileData: { ...state.fileData, [fieldName]: null },
          isDirty: true
        }));
      },

      nextStep: () => {
        set((state) => ({
          ...state,
          currentStep: Math.min(state.currentStep + 1, 3),
          completedSteps: [...state.completedSteps, state.currentStep]
        }));
      },

      prevStep: () => {
        set((state) => ({
          ...state,
          currentStep: Math.max(state.currentStep - 1, 0)
        }));
      },

      goToStep: (stepIndex) => {
        set((state) => ({
          ...state,
          currentStep: stepIndex
        }));
      },

      submitForm: async () => {
        set((state) => ({ ...state, isSubmitting: true }));

        try {
          // Simple submission logic
          const state = get();
          const formDataToSend = new FormData();

          Object.entries(state.formData).forEach(([key, value]) => {
            if (key !== 'confirmPassword') {
              formDataToSend.append(key, value);
            }
          });

          Object.entries(state.fileData).forEach(([key, file]) => {
            if (file) {
              formDataToSend.append(key, file);
            }
          });

          const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
          const response = await fetch('/api/admin/drivers', {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: formDataToSend
          });

          if (!response.ok) {
            throw new Error('Registration failed');
          }

          // Reset form on success
          set(() => ({
            formData: { ...initialFormData },
            fileData: { ...initialFileData },
            errors: {},
            currentStep: 0,
            completedSteps: [],
            isSubmitting: false,
            isDirty: false
          }));

          return await response.json();
        } catch (error) {
          set((state) => ({ ...state, isSubmitting: false }));
          throw error;
        }
      },

      resetForm: () => {
        set(() => ({
          formData: { ...initialFormData },
          fileData: { ...initialFileData },
          errors: {},
          currentStep: 0,
          completedSteps: [],
          isSubmitting: false,
          isDirty: false
        }));
      }
    }),
    {
      name: 'driver-registration-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        formData: state.formData,
        currentStep: state.currentStep,
        isDirty: state.isDirty
      }),
      version: 1
    }
  )
);

// ULTRA SIMPLE SELECTORS - NO COMPUTATION, NO DEPENDENCIES
export const useFormData = () => useDriverRegistrationStore(state => state.formData);
export const useFileData = () => useDriverRegistrationStore(state => state.fileData);

// SIMPLE STATE SELECTOR
export const useFormState = () => useDriverRegistrationStore(state => ({
  currentStep: state.currentStep,
  completedSteps: state.completedSteps,
  isSubmitting: state.isSubmitting,
  isDirty: state.isDirty,
  errors: state.errors,
  isValid: true, // Always true for now
  hasErrors: false,
  completionPercentage: 50 // Static for now
}));

// SIMPLE ACTIONS
export const useFormActions = () => useDriverRegistrationStore(state => ({
  setFieldValue: state.setFieldValue,
  setFieldTouched: state.setFieldTouched,
  setFileData: state.setFileData,
  removeFile: state.removeFile,
  nextStep: state.nextStep,
  prevStep: state.prevStep,
  goToStep: state.goToStep,
  submitForm: state.submitForm,
  resetForm: state.resetForm
}));

export { useDriverRegistrationStore };
export default useDriverRegistrationStore;