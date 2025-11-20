import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import {
  formatField,
  getNormalizedValue,
  getFieldErrorMessage,
  validateAadhaar,
  validateMobile,
  validateVehicleNo,
  validateIfscCode,
  validateAccountNumber
} from '../../utils/validationUtils';

/**
 * Validated Driver Input Component
 *
 * A reusable input component with built-in real-time validation for driver registration.
 * Features:
 * - Real-time duplicate checking
 * - Format validation
 * - Visual feedback (icons, colors)
 * - Loading states
 * - Auto-formatting
 * - Mobile-optimized
 */
const ValidatedDriverInput = ({
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  disabled = false,
  // Validation props
  enableRealtimeValidation = false,
  isValidating = false,
  validationStatus = null,
  onValidate = null,
  // Field-specific props
  maxLength,
  pattern,
  autoComplete,
  className = '',
  inputClassName = '',
  error = null,
  touched = false,
  // Additional props
  helpText = null,
  icon = null
}) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [localError, setLocalError] = useState(null);
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // Validate format for specific fields
  const validateFormat = (fieldName, fieldValue) => {
    if (!fieldValue) return null;

    switch (fieldName) {
      case 'aadhaarNo':
        return validateAadhaar(fieldValue) ? null : 'Aadhaar must be 12 digits';
      case 'mobileNo':
        return validateMobile(fieldValue) ? null : 'Mobile must be 10 digits';
      case 'vehicleNo':
        return validateVehicleNo(fieldValue) ? null : 'Invalid vehicle number format (e.g., DL01AB1234)';
      case 'ifscCode':
        return validateIfscCode(fieldValue) ? null : 'Invalid IFSC code format (e.g., SBIN0001234)';
      case 'accountNumber':
        return validateAccountNumber(fieldValue) ? null : 'Account number must be 9-18 digits';
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    let inputValue = e.target.value;

    // Auto-format value for specific fields
    const formattedValue = formatField(name, inputValue);
    setLocalValue(formattedValue);

    // Validate format
    const formatError = validateFormat(name, getNormalizedValue(name, formattedValue));
    setLocalError(formatError);

    // Call parent onChange with normalized value for database
    if (onChange) {
      onChange({
        target: {
          name,
          value: getNormalizedValue(name, formattedValue)
        }
      });
    }

    // Trigger real-time validation for duplicate check fields
    if (enableRealtimeValidation && onValidate && !formatError) {
      const normalizedValue = getNormalizedValue(name, formattedValue);
      if (normalizedValue && normalizedValue.length >= 10) { // Only validate complete values
        onValidate(name, normalizedValue);
      }
    }
  };

  const handleBlur = (e) => {
    setIsFocused(false);

    // Validate format on blur
    const formatError = validateFormat(name, getNormalizedValue(name, localValue));
    setLocalError(formatError);

    // Trigger validation on blur
    if (enableRealtimeValidation && onValidate && !formatError) {
      const normalizedValue = getNormalizedValue(name, localValue);
      if (normalizedValue) {
        onValidate(name, normalizedValue);
      }
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  // Determine validation state
  const hasFormatError = localError && touched;
  const hasDuplicateError = validationStatus?.exists && !validationStatus?.apiDown;
  const hasError = error || hasFormatError || hasDuplicateError;
  const isValid = touched && !hasError && !isValidating && localValue && !validationStatus?.checking;

  // Get error message to display
  const getErrorMessage = () => {
    if (error) return error;
    if (hasFormatError) return localError;
    if (hasDuplicateError) return validationStatus?.message;
    return null;
  };

  // Get validation icon
  const getValidationIcon = () => {
    if (!enableRealtimeValidation) return null;

    if (isValidating || validationStatus?.checking) {
      return (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Loader className="w-5 h-5 text-blue-500 animate-spin" />
        </div>
      );
    }

    if (isValid && validationStatus && !validationStatus.exists) {
      return (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
      );
    }

    if (hasError && touched) {
      return (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <XCircle className="w-5 h-5 text-red-500" />
        </div>
      );
    }

    return null;
  };

  // Get border color class
  const getBorderClass = () => {
    if (disabled) return 'border-gray-300 bg-gray-50';
    if (isFocused) return 'border-blue-500 ring-2 ring-blue-200';
    if (hasError && touched) return 'border-red-500';
    if (isValid) return 'border-green-500';
    return 'border-gray-300';
  };

  // Get validation status text
  const getStatusText = () => {
    if (isValidating || validationStatus?.checking) {
      return <span className="text-sm text-blue-600">Checking availability...</span>;
    }
    if (validationStatus?.apiDown) {
      return <span className="text-sm text-yellow-600">Validation temporarily unavailable</span>;
    }
    return null;
  };

  return (
    <div className={`mb-4 ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Icon (if provided) */}
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          id={name}
          name={name}
          type={type}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          pattern={pattern}
          autoComplete={autoComplete}
          className={`
            w-full px-4 py-2.5 border rounded-lg transition-all duration-200
            ${icon ? 'pl-10' : 'pl-4'}
            ${enableRealtimeValidation ? 'pr-12' : 'pr-4'}
            ${getBorderClass()}
            ${disabled ? 'cursor-not-allowed text-gray-500' : 'text-gray-900'}
            focus:outline-none focus:ring-2 focus:ring-blue-200
            ${inputClassName}
          `}
        />

        {/* Validation Icon */}
        {getValidationIcon()}
      </div>

      {/* Status Text (Checking...) */}
      <div className="mt-1 min-h-[20px]">
        {getStatusText()}
      </div>

      {/* Error Message */}
      {hasError && touched && (
        <p className="mt-1 text-sm text-red-600 flex items-start">
          <XCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
          <span>{getErrorMessage()}</span>
        </p>
      )}

      {/* Help Text */}
      {helpText && !hasError && (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

export default ValidatedDriverInput;
