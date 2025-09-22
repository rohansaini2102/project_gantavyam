import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import debounce from 'lodash.debounce';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2
} from 'lucide-react';

const EnhancedModernInput = ({
  name,
  label,
  type = 'text',
  value = '',
  error,
  placeholder,
  maxLength,
  helpText,
  suggestion,
  required = false,
  disabled = false,
  onValueChange,
  onBlur,
  onFocus,
  validationFn,
  formatter,
  autoComplete = 'off',
  className = '',
  showCharCount = false,
  realTimeValidation = true,
  apiValidation = false,
  onApiValidate,
  loading = false
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationState, setValidationState] = useState({
    isValid: null,
    error: null,
    isValidating: false
  });
  const [showTooltip, setShowTooltip] = useState(false);

  // Debounced validation function
  const debouncedValidation = useCallback(
    debounce(async (fieldValue) => {
      if (!fieldValue || !realTimeValidation) {
        setValidationState({ isValid: null, error: null, isValidating: false });
        return;
      }

      setValidationState(prev => ({ ...prev, isValidating: true }));

      try {
        // Local validation first
        if (validationFn) {
          const localResult = validationFn(fieldValue);
          if (localResult && !localResult.isValid) {
            setValidationState({
              isValid: false,
              error: localResult.error,
              isValidating: false
            });
            return;
          }
        }

        // API validation if needed
        if (apiValidation && onApiValidate) {
          const apiResult = await onApiValidate(fieldValue);
          setValidationState({
            isValid: apiResult.isValid,
            error: apiResult.error,
            isValidating: false
          });
        } else {
          setValidationState({
            isValid: true,
            error: null,
            isValidating: false
          });
        }
      } catch (err) {
        setValidationState({
          isValid: false,
          error: 'Validation error occurred',
          isValidating: false
        });
      }
    }, 500),
    [validationFn, apiValidation, onApiValidate, realTimeValidation]
  );

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Trigger validation when local value changes
  useEffect(() => {
    if (localValue && realTimeValidation) {
      debouncedValidation(localValue);
    }
  }, [localValue, debouncedValidation, realTimeValidation]);

  const handleInputChange = (e) => {
    let newValue = e.target.value;

    // Apply formatter if provided
    if (formatter) {
      newValue = formatter(newValue);
    }

    // Apply max length constraint
    if (maxLength && newValue.length > maxLength) {
      newValue = newValue.slice(0, maxLength);
    }

    setLocalValue(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  const handleFocus = () => {
    setFocused(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setFocused(false);
    if (onBlur) onBlur();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Determine input state
  const hasError = error || validationState.error;
  const isValid = !hasError && validationState.isValid && localValue;
  const isValidating = validationState.isValidating || loading;

  // Get border color based on state
  const getBorderColor = () => {
    if (focused) {
      if (hasError) return 'border-red-500 ring-2 ring-red-200';
      if (isValid) return 'border-green-500 ring-2 ring-green-200';
      return 'border-blue-500 ring-2 ring-blue-200';
    }
    if (hasError) return 'border-red-300';
    if (isValid) return 'border-green-300';
    return 'border-gray-300';
  };

  // Get icon based on state
  const getStatusIcon = () => {
    if (isValidating) {
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    if (hasError) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    if (isValid) {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    return null;
  };

  // Get progress percentage for character-based fields
  const getProgress = () => {
    if (!maxLength || !localValue) return 0;
    return Math.min((localValue.length / maxLength) * 100, 100);
  };

  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label with help icon */}
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
          {helpText && (
            <button
              type="button"
              className="ml-2 inline-flex items-center"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <HelpCircle className="w-3 h-3 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </label>
        {showCharCount && maxLength && (
          <span className={`text-xs ${
            localValue.length > maxLength * 0.8 ? 'text-orange-500' : 'text-gray-400'
          }`}>
            {localValue.length}/{maxLength}
          </span>
        )}
      </div>

      {/* Input wrapper */}
      <div className="relative">
        <input
          id={name}
          name={name}
          type={inputType}
          value={localValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`
            w-full px-3 py-2 pr-10 border rounded-lg transition-all duration-200
            ${getBorderColor()}
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
            focus:outline-none
            placeholder-gray-400
          `}
        />

        {/* Right side icons */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
          {type === 'password' && (
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
          {getStatusIcon()}
        </div>

        {/* Progress bar for certain field types */}
        {(['mobileNo', 'aadhaarNo', 'ifscCode'].includes(name) && localValue) && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-gray-200 w-full">
            <motion.div
              className={`h-full ${
                hasError ? 'bg-red-500' : isValid ? 'bg-green-500' : 'bg-blue-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${getProgress()}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-start space-x-2 text-sm text-red-600"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p>{error || validationState.error}</p>
              {suggestion && (
                <p className="text-xs text-red-500 mt-1 italic">
                  💡 {suggestion}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success message */}
      <AnimatePresence>
        {isValid && !hasError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-center space-x-2 text-sm text-green-600"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Valid {label.toLowerCase()}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help text */}
      {helpText && !hasError && !isValid && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && helpText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-10 p-2 mt-1 text-xs bg-gray-800 text-white rounded-md shadow-lg max-w-xs"
          >
            {helpText}
            <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-800 rotate-45"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedModernInput;