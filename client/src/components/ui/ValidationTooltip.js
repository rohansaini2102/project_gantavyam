import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  X,
  HelpCircle
} from 'lucide-react';

const ValidationTooltip = ({
  children,
  error,
  suggestion,
  helpText,
  type = 'error', // 'error', 'warning', 'info', 'success'
  position = 'top', // 'top', 'bottom', 'left', 'right'
  trigger = 'hover', // 'hover', 'click', 'focus', 'always'
  className = '',
  showIcon = true,
  maxWidth = 'max-w-xs',
  interactive = false,
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(trigger === 'always');
  const [isHovered, setIsHovered] = useState(false);

  // Don't show tooltip if disabled or no content
  if (disabled || (!error && !suggestion && !helpText)) {
    return children;
  }

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />;
    }
  };

  // Get tooltip colors based on type
  const getTooltipColors = () => {
    switch (type) {
      case 'error':
        return 'bg-red-600 text-white border-red-600';
      case 'warning':
        return 'bg-yellow-600 text-white border-yellow-600';
      case 'success':
        return 'bg-green-600 text-white border-green-600';
      case 'info':
        return 'bg-blue-600 text-white border-blue-600';
      default:
        return 'bg-gray-800 text-white border-gray-800';
    }
  };

  // Get arrow position classes
  const getArrowClasses = () => {
    const baseArrow = 'absolute w-2 h-2 transform rotate-45';
    const colors = getTooltipColors().replace('text-white', '');

    switch (position) {
      case 'top':
        return `${baseArrow} ${colors} -bottom-1 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseArrow} ${colors} -top-1 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseArrow} ${colors} -right-1 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseArrow} ${colors} -left-1 top-1/2 -translate-y-1/2`;
      default:
        return `${baseArrow} ${colors} -bottom-1 left-1/2 -translate-x-1/2`;
    }
  };

  // Get tooltip position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  // Handle mouse events
  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      setIsVisible(true);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover' && !interactive) {
      setIsVisible(false);
    }
    setIsHovered(false);
  };

  // Handle click events
  const handleClick = () => {
    if (trigger === 'click') {
      setIsVisible(!isVisible);
    }
  };

  // Handle focus events
  const handleFocus = () => {
    if (trigger === 'focus') {
      setIsVisible(true);
    }
  };

  const handleBlur = () => {
    if (trigger === 'focus') {
      setIsVisible(false);
    }
  };

  // Handle tooltip close
  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* Trigger element */}
      {children}

      {/* Tooltip */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 10 : -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`
              absolute z-50 ${getPositionClasses()} ${maxWidth}
              ${getTooltipColors()}
              rounded-lg shadow-lg border p-3 text-sm
              ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}
            `}
            onMouseEnter={() => interactive && setIsVisible(true)}
            onMouseLeave={() => interactive && !isHovered && setIsVisible(false)}
          >
            {/* Close button for interactive tooltips */}
            {interactive && (
              <button
                onClick={handleClose}
                className="absolute top-1 right-1 p-1 rounded hover:bg-black hover:bg-opacity-20 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Tooltip content */}
            <div className="space-y-2">
              {/* Error message */}
              {error && (
                <div className="flex items-start space-x-2">
                  {showIcon && getIcon()}
                  <div className="flex-1">
                    <p className="font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Suggestion */}
              {suggestion && (
                <div className="flex items-start space-x-2">
                  <Lightbulb className="w-4 h-4 text-yellow-300 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs opacity-90 italic">{suggestion}</p>
                  </div>
                </div>
              )}

              {/* Help text */}
              {helpText && !error && (
                <div className="flex items-start space-x-2">
                  {showIcon && <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-xs opacity-90">{helpText}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className={getArrowClasses()} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Wrapper component for form fields
export const FieldWithTooltip = ({
  children,
  error,
  suggestion,
  helpText,
  name,
  className = ''
}) => {
  if (!error && !suggestion && !helpText) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      <ValidationTooltip
        error={error}
        suggestion={suggestion}
        helpText={helpText}
        type={error ? 'error' : 'info'}
        trigger="hover"
        position="top"
        interactive={!!suggestion}
      >
        {children}
      </ValidationTooltip>
    </div>
  );
};

// Preset tooltip configurations
export const ErrorTooltip = ({ children, message, suggestion, ...props }) => (
  <ValidationTooltip
    error={message}
    suggestion={suggestion}
    type="error"
    trigger="hover"
    {...props}
  >
    {children}
  </ValidationTooltip>
);

export const SuccessTooltip = ({ children, message, ...props }) => (
  <ValidationTooltip
    helpText={message}
    type="success"
    trigger="hover"
    {...props}
  >
    {children}
  </ValidationTooltip>
);

export const InfoTooltip = ({ children, message, ...props }) => (
  <ValidationTooltip
    helpText={message}
    type="info"
    trigger="hover"
    {...props}
  >
    {children}
  </ValidationTooltip>
);

export const WarningTooltip = ({ children, message, suggestion, ...props }) => (
  <ValidationTooltip
    error={message}
    suggestion={suggestion}
    type="warning"
    trigger="hover"
    {...props}
  >
    {children}
  </ValidationTooltip>
);

export default ValidationTooltip;