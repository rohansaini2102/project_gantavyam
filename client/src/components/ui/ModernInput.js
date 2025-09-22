import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  HelpCircle,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';

const ModernInput = ({
  name,
  label,
  type = 'text',
  placeholder,
  value = '',
  error,
  apiValidation,
  isValidating = false,
  maxLength,
  helpText,
  autoFormat,
  showCharacterCount = false,
  showCopyButton = false,
  onValueChange,
  onBlur,
  onFocus,
  onRetry,
  className = '',
  disabled = false,
  required = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus effect
  useEffect(() => {
    if (props.autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [props.autoFocus]);

  // Handle input changes
  const handleChange = (e) => {
    let newValue = e.target.value;

    // Apply auto-formatting
    if (autoFormat) {
      newValue = autoFormat(newValue);
    }

    onValueChange?.(newValue);
  };

  // Handle focus
  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  // Handle blur
  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (value && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // Determine validation state
  const getValidationState = () => {
    if (isValidating) return 'validating';
    if (error) return 'error';
    if (apiValidation?.isValid === false) return 'error';
    if (apiValidation?.isValid === true && value) return 'success';
    if (value && !error) return 'success';
    return 'default';
  };

  const validationState = getValidationState();

  // Get border and background colors based on state
  const getStateClasses = () => {
    const baseClasses = 'transition-all duration-300 ease-in-out';

    switch (validationState) {
      case 'validating':
        return `${baseClasses} border-blue-400 bg-blue-50/50 ring-2 ring-blue-100`;
      case 'error':
        return `${baseClasses} border-red-400 bg-red-50/50 ring-2 ring-red-100`;
      case 'success':
        return `${baseClasses} border-green-400 bg-green-50/50 ring-2 ring-green-100`;
      default:
        return isFocused
          ? `${baseClasses} border-blue-500 bg-white ring-2 ring-blue-100`
          : `${baseClasses} border-gray-300 bg-white hover:border-gray-400`;
    }
  };

  // Character count display
  const characterCount = value?.length || 0;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <div className={`relative ${className}`}>
      {/* Label with floating animation */}
      <div className="relative">
        <motion.label
          htmlFor={name}
          className={`absolute left-3 transition-all duration-300 pointer-events-none select-none ${
            isFocused || value
              ? 'top-0 -translate-y-1/2 text-sm font-medium bg-white px-2 z-10'
              : 'top-1/2 -translate-y-1/2 text-gray-500'
          } ${
            validationState === 'error'
              ? 'text-red-600'
              : validationState === 'success'
              ? 'text-green-600'
              : isFocused
              ? 'text-blue-600'
              : 'text-gray-700'
          }`}
          initial={false}
          animate={{
            fontSize: isFocused || value ? '0.875rem' : '1rem',
            y: isFocused || value ? '-50%' : '-50%'
          }}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </motion.label>

        {/* Input field */}
        <div className="relative">
          <input
            ref={inputRef}
            id={name}
            name={name}
            type={type === 'password' && showPassword ? 'text' : type}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={isFocused ? placeholder : ''}
            maxLength={maxLength}
            disabled={disabled}
            className={`
              w-full h-14 px-4 pr-12 rounded-xl border-2 text-base
              placeholder-gray-400 focus:outline-none focus:placeholder-gray-300
              ${getStateClasses()}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
            `}
            {...props}
          />

          {/* Right side icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {/* Character count */}
            {showCharacterCount && maxLength && (
              <motion.span
                className={`text-xs tabular-nums ${
                  isOverLimit ? 'text-red-500' : 'text-gray-400'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {characterCount}/{maxLength}
              </motion.span>
            )}

            {/* Copy button */}
            {showCopyButton && value && (
              <motion.button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </motion.button>
            )}

            {/* Password toggle */}
            {type === 'password' && (
              <motion.button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </motion.button>
            )}

            {/* Validation state icon */}
            <AnimatePresence mode="wait">
              {isValidating && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                </motion.div>
              )}
              {validationState === 'success' && !isValidating && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </motion.div>
              )}
              {validationState === 'error' && !isValidating && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Help tooltip */}
            {helpText && (
              <div className="relative">
                <motion.button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  whileHover={{ scale: 1.1 }}
                >
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </motion.button>

                <AnimatePresence>
                  {showTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-50 w-64"
                    >
                      <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                      {helpText}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error messages and suggestions */}
      <AnimatePresence>
        {(error || apiValidation) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {/* Local validation error */}
              {error && (
                <motion.div
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`p-3 rounded-lg border text-sm ${
                    error.type === 'length'
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <div className="font-medium">{error.message}</div>
                  {error.suggestion && (
                    <div className="mt-1 text-xs flex items-start gap-1">
                      <span className="mt-0.5">💡</span>
                      <span>{error.suggestion}</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* API validation error */}
              {apiValidation?.isValid === false && (
                <motion.div
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="p-3 rounded-lg border bg-amber-50 border-amber-200 text-amber-800 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{apiValidation.message}</div>
                      {apiValidation.suggestion && (
                        <div className="mt-1 text-xs flex items-start gap-1">
                          <span className="mt-0.5">💡</span>
                          <span>{apiValidation.suggestion}</span>
                        </div>
                      )}
                    </div>
                    {onRetry && (
                      <motion.button
                        type="button"
                        onClick={() => onRetry(name)}
                        className="p-1 rounded-md hover:bg-amber-100 transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* API validation success */}
              {apiValidation?.isValid === true && (
                <motion.div
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="p-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{apiValidation.message}</span>
                  </div>
                </motion.div>
              )}

              {/* Network error with retry */}
              {apiValidation?.type === 'network' && (
                <motion.div
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{apiValidation.message}</div>
                      <div className="mt-1 text-xs">{apiValidation.suggestion}</div>
                    </div>
                    {onRetry && (
                      <motion.button
                        type="button"
                        onClick={() => onRetry(name)}
                        className="p-1 rounded-md hover:bg-blue-100 transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress indicator for certain fields */}
      {maxLength && value && (
        <motion.div
          className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className={`h-full transition-colors duration-300 ${
              isOverLimit
                ? 'bg-red-400'
                : characterCount / maxLength > 0.8
                ? 'bg-yellow-400'
                : 'bg-green-400'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((characterCount / maxLength) * 100, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      )}
    </div>
  );
};

export default ModernInput;