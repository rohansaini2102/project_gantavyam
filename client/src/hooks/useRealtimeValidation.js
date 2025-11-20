import { useState, useCallback, useRef, useEffect } from 'react';
import debounce from 'lodash/debounce';
import axios from 'axios';
import { API_URL } from '../config';

// API base URL - Uses centralized config for environment-aware URL selection
const API_BASE_URL = API_URL;
console.log('[Validation] Using API URL:', API_BASE_URL);

/**
 * Hook for real-time validation with debouncing and caching
 * @param {number} debounceDelay - Delay in ms before validation (default: 500ms)
 */
const useRealtimeValidation = (debounceDelay = 500) => {
  const [validationStatus, setValidationStatus] = useState({});
  const [isValidating, setIsValidating] = useState({});
  const validationCache = useRef({});

  // Check duplicate for a specific field
  const checkDuplicate = useCallback(async (field, value) => {
    if (!field || !value) {
      console.log('[Validation] Skipping - empty field or value');
      return { exists: false, message: null };
    }

    // Check cache first (with 5-minute expiration)
    const cacheKey = `${field}:${value}`;
    const cached = validationCache.current[cacheKey];
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log('[Validation] Using cached result for:', cacheKey);
      return cached.data;
    }

    console.log('[Validation] Checking duplicate for:', { field, value });

    try {
      const response = await axios.get(`${API_BASE_URL}/drivers/check-duplicate`, {
        params: { field, value }
      });

      console.log('[Validation] Response:', response.data);

      const result = {
        exists: response.data.exists,
        message: response.data.message,
        isVerified: response.data.data?.isVerified
      };

      // Cache the result with timestamp
      validationCache.current[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };
      console.log('[Validation] Cached result for:', cacheKey, result);

      return result;
    } catch (error) {
      console.error('[Validation] Error checking duplicate:', error);
      // Don't block on API errors - allow user to proceed
      return {
        exists: false,
        message: null, // Don't show error message for API failures
        error: true,
        apiDown: true
      };
    }
  }, []);

  // Batch check for multiple fields
  const batchCheckDuplicates = useCallback(async (checks) => {
    if (!checks || checks.length === 0) {
      return { hasAnyDuplicate: false, results: [] };
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/drivers/check-duplicates`, {
        checks
      });

      // Cache individual results with timestamp
      checks.forEach((check, index) => {
        const result = response.data.results[index];
        const cacheKey = `${check.field}:${check.value}`;
        validationCache.current[cacheKey] = {
          data: {
            exists: result.exists,
            message: result.exists ? `This ${check.field} is already registered` : null
          },
          timestamp: Date.now()
        };
      });

      return response.data;
    } catch (error) {
      console.error('[Validation] Error batch checking duplicates:', error);
      return {
        hasAnyDuplicate: false,
        results: [],
        error: true
      };
    }
  }, []);

  // Debounced validation function
  const debouncedValidate = useRef(
    debounce(async (field, value, callback) => {
      try {
        const result = await checkDuplicate(field, value);

        setValidationStatus(prev => ({
          ...prev,
          [field]: result
        }));

        // ALWAYS clear validating state
        setIsValidating(prev => ({ ...prev, [field]: false }));

        if (callback) {
          callback(result);
        }
      } catch (error) {
        console.error('[Validation] Error in debounced validate:', error);
        // Clear validating state even on error
        setIsValidating(prev => ({ ...prev, [field]: false }));
        setValidationStatus(prev => ({
          ...prev,
          [field]: { error: true, message: 'Validation failed' }
        }));
        if (callback) {
          callback({ error: true, message: 'Validation failed' });
        }
      }
    }, debounceDelay)
  ).current;

  // Validate a single field with debouncing
  const validateField = useCallback((field, value, callback) => {
    // Don't validate empty values
    if (!value) {
      setIsValidating(prev => ({ ...prev, [field]: false }));
      setValidationStatus(prev => ({
        ...prev,
        [field]: null
      }));
      if (callback) {
        callback({ exists: false, message: null });
      }
      return;
    }

    // Set validating state IMMEDIATELY
    setIsValidating(prev => ({ ...prev, [field]: true }));

    // Clear previous validation status
    setValidationStatus(prev => ({
      ...prev,
      [field]: { checking: true }
    }));

    // Call debounced validation
    debouncedValidate(field, value, callback);
  }, [debouncedValidate]);

  // Clear validation for a field
  const clearFieldValidation = useCallback((field) => {
    setValidationStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[field];
      return newStatus;
    });
    setIsValidating(prev => {
      const newValidating = { ...prev };
      delete newValidating[field];
      return newValidating;
    });
  }, []);

  // Clear all validation
  const clearAllValidation = useCallback(() => {
    setValidationStatus({});
    setIsValidating({});
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    validationCache.current = {};
  }, []);

  // Validate all fields at once (for final submission)
  const validateAllFields = useCallback(async (fieldsToValidate) => {
    const checks = [];
    const validationFields = ['mobileNo', 'aadhaarNo', 'vehicleNo'];

    Object.entries(fieldsToValidate).forEach(([field, value]) => {
      if (validationFields.includes(field) && value) {
        checks.push({ field, value });
      }
    });

    if (checks.length === 0) {
      return { isValid: true, errors: {} };
    }

    setIsValidating({
      mobileNo: true,
      aadhaarNo: true,
      vehicleNo: true
    });

    const result = await batchCheckDuplicates(checks);

    const errors = {};
    result.results?.forEach(r => {
      if (r.exists) {
        errors[r.field] = `This ${r.field} is already registered`;
      }
    });

    setIsValidating({});

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      hasAnyDuplicate: result.hasAnyDuplicate
    };
  }, [batchCheckDuplicates]);

  // Cleanup on unmount - cancel pending debounced calls
  useEffect(() => {
    return () => {
      console.log('[Validation] Cleaning up - canceling debounced calls');
      debouncedValidate.cancel();
      clearCache();
    };
  }, [clearCache]);

  return {
    validationStatus,
    isValidating,
    validateField,
    validateAllFields,
    clearFieldValidation,
    clearAllValidation,
    clearCache,
    checkDuplicate,
    batchCheckDuplicates
  };
};

export default useRealtimeValidation;