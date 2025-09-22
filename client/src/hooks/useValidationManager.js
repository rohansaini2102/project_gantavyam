import { useReducer, useCallback, useRef, useMemo } from 'react';
import { validateField, stepSchemas, validationUtils } from '../schemas/driverValidation';

// Validation states
const VALIDATION_STATES = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  SUCCESS: 'success',
  ERROR: 'error',
  RETRYING: 'retrying'
};

// Action types
const ACTIONS = {
  SET_FIELD_VALUE: 'SET_FIELD_VALUE',
  SET_FIELD_VALIDATION: 'SET_FIELD_VALIDATION',
  SET_FIELD_API_VALIDATION: 'SET_FIELD_API_VALIDATION',
  START_FIELD_VALIDATION: 'START_FIELD_VALIDATION',
  CLEAR_FIELD_ERROR: 'CLEAR_FIELD_ERROR',
  SET_STEP_VALIDATION: 'SET_STEP_VALIDATION',
  RESET_VALIDATION: 'RESET_VALIDATION',
  SET_TOUCHED: 'SET_TOUCHED',
  INCREMENT_RETRY_COUNT: 'INCREMENT_RETRY_COUNT',
  RESET_RETRY_COUNT: 'RESET_RETRY_COUNT'
};

// Initial state
const initialState = {
  values: {},
  errors: {},
  apiValidation: {},
  touched: {},
  validating: {},
  retryCount: {},
  isValid: false,
  isDirty: false
};

// Reducer function
const validationReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_FIELD_VALUE:
      return {
        ...state,
        values: {
          ...state.values,
          [action.field]: action.value
        },
        isDirty: true
      };

    case ACTIONS.SET_FIELD_VALIDATION:
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.field]: action.error
        }
      };

    case ACTIONS.SET_FIELD_API_VALIDATION:
      return {
        ...state,
        apiValidation: {
          ...state.apiValidation,
          [action.field]: action.validation
        },
        validating: {
          ...state.validating,
          [action.field]: false
        }
      };

    case ACTIONS.START_FIELD_VALIDATION:
      return {
        ...state,
        validating: {
          ...state.validating,
          [action.field]: true
        },
        apiValidation: {
          ...state.apiValidation,
          [action.field]: null
        }
      };

    case ACTIONS.CLEAR_FIELD_ERROR:
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.field]: null
        },
        apiValidation: {
          ...state.apiValidation,
          [action.field]: null
        }
      };

    case ACTIONS.SET_TOUCHED:
      return {
        ...state,
        touched: {
          ...state.touched,
          [action.field]: true
        }
      };

    case ACTIONS.INCREMENT_RETRY_COUNT:
      return {
        ...state,
        retryCount: {
          ...state.retryCount,
          [action.field]: (state.retryCount[action.field] || 0) + 1
        }
      };

    case ACTIONS.RESET_RETRY_COUNT:
      return {
        ...state,
        retryCount: {
          ...state.retryCount,
          [action.field]: 0
        }
      };

    case ACTIONS.SET_STEP_VALIDATION:
      return {
        ...state,
        isValid: action.isValid
      };

    case ACTIONS.RESET_VALIDATION:
      return initialState;

    default:
      return state;
  }
};

// API validation service with retry logic
class ApiValidationService {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  async validateField(field, value, retryCount = 0) {
    const cacheKey = `${field}_${value}`;

    // Return cached result if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Return existing promise if request is already in flight
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Create new validation request
    const validationPromise = this._makeValidationRequest(field, value, retryCount);
    this.pendingRequests.set(cacheKey, validationPromise);

    try {
      const result = await validationPromise;

      // Cache successful results
      if (result.isValid !== null) {
        this.cache.set(cacheKey, result);

        // Auto-expire cache after 5 minutes
        setTimeout(() => {
          this.cache.delete(cacheKey);
        }, 5 * 60 * 1000);
      }

      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async _makeValidationRequest(field, value, retryCount) {
    const maxRetries = 3;
    const baseDelay = 1000;

    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const response = await fetch('/api/admin/validate-driver-field', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ field, value }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        isValid: result.isValid,
        message: result.message,
        type: result.isValid ? 'success' : 'duplicate',
        suggestion: result.isValid
          ? 'This value is available'
          : 'This value is already registered. Please use a different one.'
      };

    } catch (error) {
      // Retry logic with exponential backoff
      if (retryCount < maxRetries && !error.name === 'AbortError') {
        const delay = baseDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._makeValidationRequest(field, value, retryCount + 1);
      }

      // Return error state
      return {
        isValid: null,
        message: 'Validation temporarily unavailable',
        type: 'network',
        suggestion: 'Please check your connection and try again'
      };
    }
  }

  clearCache() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Main validation hook
export const useValidationManager = (initialValues = {}) => {
  const [state, dispatch] = useReducer(validationReducer, {
    ...initialState,
    values: initialValues
  });

  const apiService = useRef(new ApiValidationService()).current;
  const debounceTimeouts = useRef({}).current;

  // Memoized validation functions
  const validateLocalField = useCallback((fieldName, value) => {
    const error = validateField(fieldName, value, state.values);
    dispatch({
      type: ACTIONS.SET_FIELD_VALIDATION,
      field: fieldName,
      error
    });
    return error;
  }, [state.values]);

  const validateApiField = useCallback(async (fieldName, value) => {
    // Only validate specific fields via API
    const apiFields = ['mobileNo', 'aadhaarNo', 'vehicleNo'];
    if (!apiFields.includes(fieldName) || !value) return;

    dispatch({ type: ACTIONS.START_FIELD_VALIDATION, field: fieldName });

    try {
      const result = await apiService.validateField(
        fieldName,
        value,
        state.retryCount[fieldName] || 0
      );

      dispatch({
        type: ACTIONS.SET_FIELD_API_VALIDATION,
        field: fieldName,
        validation: result
      });

      if (result.isValid === null) {
        dispatch({ type: ACTIONS.INCREMENT_RETRY_COUNT, field: fieldName });
      } else {
        dispatch({ type: ACTIONS.RESET_RETRY_COUNT, field: fieldName });
      }

    } catch (error) {
      dispatch({
        type: ACTIONS.SET_FIELD_API_VALIDATION,
        field: fieldName,
        validation: {
          isValid: null,
          message: 'Validation failed',
          type: 'error',
          suggestion: 'Please try again'
        }
      });
    }
  }, [apiService, state.retryCount]);

  // Debounced validation
  const debouncedValidateField = useCallback((fieldName, value, delay = 300) => {
    // Clear existing timeout
    if (debounceTimeouts[fieldName]) {
      clearTimeout(debounceTimeouts[fieldName]);
    }

    // Set new timeout
    debounceTimeouts[fieldName] = setTimeout(() => {
      validateApiField(fieldName, value);
    }, delay);
  }, [validateApiField]);

  // Field value setter with enhanced validation
  const setFieldValue = useCallback((fieldName, value, shouldValidate = true) => {
    // Update field value
    dispatch({
      type: ACTIONS.SET_FIELD_VALUE,
      field: fieldName,
      value
    });

    // Clear previous errors when user starts typing
    dispatch({
      type: ACTIONS.CLEAR_FIELD_ERROR,
      field: fieldName
    });

    if (shouldValidate) {
      // Get updated values for validation context
      const updatedValues = { ...state.values, [fieldName]: value };

      // Immediate local validation
      const error = validateField(fieldName, value, updatedValues);

      dispatch({
        type: ACTIONS.SET_FIELD_VALIDATION,
        field: fieldName,
        error
      });

      // Debounced API validation if local validation passes and field requires API validation
      if (!error && validationUtils.requiresApiValidation(fieldName) && value && value.length > 0) {
        debouncedValidateField(fieldName, value);
      }
    }
  }, [state.values, debouncedValidateField, validationUtils]);

  // Mark field as touched
  const setFieldTouched = useCallback((fieldName) => {
    dispatch({
      type: ACTIONS.SET_TOUCHED,
      field: fieldName
    });
  }, []);

  // Enhanced step validation with better error handling
  const validateStep = useCallback((stepIndex) => {
    const stepSchema = stepSchemas[stepIndex];
    if (!stepSchema) return true;

    try {
      stepSchema.parse(state.values);
      dispatch({ type: ACTIONS.SET_STEP_VALIDATION, isValid: true });
      return true;
    } catch (error) {
      let hasErrors = false;

      // Set errors for all fields in the step
      if (error.errors && Array.isArray(error.errors)) {
        error.errors.forEach(err => {
          if (err.path && err.path.length > 0) {
            const fieldName = err.path[0];
            dispatch({
              type: ACTIONS.SET_FIELD_VALIDATION,
              field: fieldName,
              error: {
                message: err.message,
                type: getErrorType(err.code),
                suggestion: getErrorSuggestion(fieldName, err.message),
                severity: 'error'
              }
            });
            hasErrors = true;
          }
        });
      }

      dispatch({ type: ACTIONS.SET_STEP_VALIDATION, isValid: !hasErrors });
      return !hasErrors;
    }
  }, [state.values]);

  // Enhanced field state with comprehensive information
  const getFieldState = useCallback((fieldName) => {
    const localError = state.errors[fieldName];
    const apiValidation = state.apiValidation[fieldName];
    const isValidating = state.validating[fieldName];
    const isTouched = state.touched[fieldName];
    const value = state.values[fieldName] || '';
    const initialValue = initialValues[fieldName] || '';

    // Determine overall validity
    const hasLocalError = localError !== null && localError !== undefined;
    const hasApiError = apiValidation?.isValid === false;
    const isFieldValid = !hasLocalError && !hasApiError && !isValidating;

    // Get field completion percentage
    const completionPercentage = validationUtils.getCompletionStatus(fieldName, value);

    // Check dependencies
    const dependenciesMet = validationUtils.validateDependencies(fieldName, value, state.values);

    return {
      value,
      error: localError,
      apiValidation,
      isValidating,
      isTouched,
      isValid: isFieldValid,
      isDirty: value !== initialValue,
      isEmpty: !value || value.trim().length === 0,
      completionPercentage,
      dependenciesMet,
      requiresApiValidation: validationUtils.requiresApiValidation(fieldName),
      fieldContext: validationUtils.getFieldContext(fieldName)
    };
  }, [state, initialValues, validationUtils]);

  // Retry API validation
  const retryValidation = useCallback((fieldName) => {
    const value = state.values[fieldName];
    if (value) {
      validateApiField(fieldName, value);
    }
  }, [state.values, validateApiField]);

  // Clear all validation
  const clearValidation = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_VALIDATION });
    apiService.clearCache();
  }, [apiService]);

  // Enhanced validation methods
  const validateAllFields = useCallback(() => {
    const allErrors = {};
    let hasAnyError = false;

    // Validate each field individually
    Object.keys(state.values).forEach(fieldName => {
      const value = state.values[fieldName];
      const error = validateField(fieldName, value, state.values);

      if (error) {
        allErrors[fieldName] = error;
        hasAnyError = true;

        dispatch({
          type: ACTIONS.SET_FIELD_VALIDATION,
          field: fieldName,
          error
        });
      } else {
        dispatch({
          type: ACTIONS.CLEAR_FIELD_ERROR,
          field: fieldName
        });
      }
    });

    return !hasAnyError;
  }, [state.values]);

  // Memoized computed values with enhanced information
  const computedState = useMemo(() => {
    const errors = state.errors || {};
    const apiValidation = state.apiValidation || {};
    const validating = state.validating || {};

    const hasLocalErrors = Object.values(errors).some(error => error !== null && error !== undefined);
    const hasApiErrors = Object.values(apiValidation).some(
      validation => validation?.isValid === false
    );
    const isValidating = Object.values(validating).some(Boolean);

    // Calculate completion statistics
    const totalFields = Object.keys(state.values).length;
    const completedFields = Object.values(state.values).filter(value =>
      value && value.toString().trim().length > 0
    ).length;
    const completionPercentage = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;

    // Calculate validation statistics
    const validFields = Object.keys(state.values).filter(fieldName => {
      const fieldState = getFieldState(fieldName);
      return fieldState.isValid && !fieldState.isEmpty;
    }).length;

    return {
      isValid: !hasLocalErrors && !hasApiErrors && !isValidating,
      hasErrors: hasLocalErrors || hasApiErrors,
      isValidating,
      isDirty: state.isDirty,
      values: state.values,
      errors,
      apiValidation,
      completionPercentage: Math.round(completionPercentage),
      validFields,
      totalFields,
      validationProgress: totalFields > 0 ? Math.round((validFields / totalFields) * 100) : 0
    };
  }, [state, getFieldState]);

  return {
    ...computedState,
    setFieldValue,
    setFieldTouched,
    validateStep,
    validateAllFields,
    getFieldState,
    retryValidation,
    clearValidation,
    validateLocalField,
    validateApiField
  };
};

// Helper functions
const getErrorType = (zodCode) => {
  switch (zodCode) {
    case 'too_small': return 'length';
    case 'too_big': return 'length';
    case 'invalid_string': return 'format';
    case 'custom': return 'validation';
    default: return 'error';
  }
};

const getErrorSuggestion = (fieldName, errorMessage) => {
  const suggestions = {
    fullName: 'Enter your complete name as it appears on official documents',
    mobileNo: 'Use a 10-digit number starting with 6, 7, 8, or 9',
    email: 'Use format: yourname@example.com',
    aadhaarNo: 'Enter the 12-digit number from your Aadhaar card',
    vehicleNo: 'Use format: STATE + DISTRICT + SERIES + NUMBER (e.g., MH01AB1234)',
    ifscCode: 'Find this 11-character code on your bank passbook or cheque',
    accountNumber: 'Use the account number from your bank passbook',
    password: 'Mix uppercase, lowercase, numbers, and special characters'
  };

  return suggestions[fieldName] || 'Please check and correct the entered value';
};

export default useValidationManager;