import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Lock,
  User,
  Car,
  CreditCard,
  Shield,
  ChevronRight
} from 'lucide-react';

const ProgressTracker = ({
  currentStep = 0,
  steps = [],
  completedSteps = [],
  stepValidation = {},
  onStepClick,
  showPercentage = true,
  showLabels = true,
  showDescriptions = false,
  compact = false,
  disabled = false,
  className = ''
}) => {
  // Default step icons
  const defaultIcons = {
    0: User,
    1: Car,
    2: CreditCard,
    3: Shield
  };

  // Get step icon
  const getStepIcon = (step, index) => {
    if (step.icon) {
      if (typeof step.icon === 'string') {
        return step.icon;
      }
      return step.icon;
    }
    const IconComponent = defaultIcons[index];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : <Circle className="w-4 h-4" />;
  };

  // Get step status
  const getStepStatus = (stepIndex) => {
    if (completedSteps.includes(stepIndex)) {
      return 'completed';
    }
    if (stepIndex === currentStep) {
      const validation = stepValidation[stepIndex];
      if (validation?.hasErrors) {
        return 'error';
      }
      return 'current';
    }
    if (stepIndex < currentStep) {
      return 'completed';
    }
    return 'upcoming';
  };

  // Get step color classes
  const getStepColors = (status) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-green-600',
          border: 'border-green-600',
          text: 'text-green-600',
          icon: 'text-white'
        };
      case 'current':
        return {
          bg: 'bg-blue-600',
          border: 'border-blue-600',
          text: 'text-blue-600',
          icon: 'text-white'
        };
      case 'error':
        return {
          bg: 'bg-red-600',
          border: 'border-red-600',
          text: 'text-red-600',
          icon: 'text-white'
        };
      case 'upcoming':
        return {
          bg: 'bg-gray-200',
          border: 'border-gray-300',
          text: 'text-gray-400',
          icon: 'text-gray-500'
        };
      default:
        return {
          bg: 'bg-gray-200',
          border: 'border-gray-300',
          text: 'text-gray-400',
          icon: 'text-gray-500'
        };
    }
  };

  // Calculate completion percentage
  const completionPercentage = Math.round((completedSteps.length / steps.length) * 100);

  // Handle step click
  const handleStepClick = (stepIndex, step) => {
    if (disabled || !onStepClick) return;

    const status = getStepStatus(stepIndex);

    // Allow clicking on completed steps and current step
    if (status === 'completed' || status === 'current' || status === 'error') {
      onStepClick(stepIndex, step);
    }
  };

  // Render step indicator
  const renderStepIndicator = (step, stepIndex) => {
    const status = getStepStatus(stepIndex);
    const colors = getStepColors(status);
    const isClickable = (status === 'completed' || status === 'current' || status === 'error') && onStepClick && !disabled;

    return (
      <motion.div
        key={stepIndex}
        className={`relative ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => handleStepClick(stepIndex, step)}
        whileHover={isClickable ? { scale: 1.05 } : {}}
        whileTap={isClickable ? { scale: 0.95 } : {}}
      >
        {/* Step Circle */}
        <div
          className={`
            relative z-10 flex items-center justify-center
            ${compact ? 'w-8 h-8' : 'w-10 h-10'}
            rounded-full border-2 transition-all duration-200
            ${colors.bg} ${colors.border}
            ${isClickable ? 'hover:shadow-lg' : ''}
          `}
        >
          {status === 'completed' ? (
            <CheckCircle2 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${colors.icon}`} />
          ) : status === 'error' ? (
            <AlertCircle className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${colors.icon}`} />
          ) : status === 'current' ? (
            <div className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} bg-white rounded-full`} />
          ) : status === 'upcoming' ? (
            stepIndex > currentStep ? (
              <Lock className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${colors.icon}`} />
            ) : (
              typeof getStepIcon(step, stepIndex) === 'string' ? (
                <span className={`${compact ? 'text-xs' : 'text-sm'} ${colors.icon}`}>
                  {getStepIcon(step, stepIndex)}
                </span>
              ) : (
                <div className={colors.icon}>
                  {getStepIcon(step, stepIndex)}
                </div>
              )
            )
          ) : (
            <Circle className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${colors.icon}`} />
          )}
        </div>

        {/* Step Number Badge (for very compact mode) */}
        {compact && !showLabels && (
          <div className={`
            absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs font-medium
            flex items-center justify-center bg-white shadow-sm border
            ${colors.text}
          `}>
            {stepIndex + 1}
          </div>
        )}

        {/* Step Labels */}
        {showLabels && !compact && (
          <div className="mt-3 text-center max-w-24">
            <p className={`text-sm font-medium ${colors.text} truncate`}>
              {step.label || `Step ${stepIndex + 1}`}
            </p>
            {showDescriptions && step.description && (
              <p className="text-xs text-gray-500 mt-1 leading-tight">
                {step.description}
              </p>
            )}
            {status === 'current' && stepValidation[stepIndex] && (
              <div className="flex items-center justify-center mt-1">
                {stepValidation[stepIndex].isValid ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : stepValidation[stepIndex].hasErrors ? (
                  <AlertCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <Clock className="w-3 h-3 text-gray-400" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Connection Line to Next Step */}
        {stepIndex < steps.length - 1 && (
          <div
            className={`
              absolute top-1/2 transform -translate-y-1/2
              ${compact ? 'left-8 w-8 h-0.5' : 'left-10 w-16 h-0.5'}
              ${status === 'completed' || (status === 'current' && stepIndex < currentStep)
                ? 'bg-green-400'
                : 'bg-gray-300'
              }
              transition-colors duration-300
            `}
          />
        )}
      </motion.div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Progress Percentage */}
      {showPercentage && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Registration Progress
            </span>
            <span className="text-sm font-medium text-blue-600">
              {completionPercentage}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${completionPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </div>
        </div>
      )}

      {/* Step Indicators */}
      <div className={`
        flex items-start
        ${compact ? 'justify-center space-x-4' : 'justify-between'}
        ${!showLabels ? 'items-center' : ''}
      `}>
        {steps.map((step, index) => renderStepIndicator(step, index))}
      </div>

      {/* Compact Mode Labels */}
      {compact && showLabels && (
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-900">
            {steps[currentStep]?.label || `Step ${currentStep + 1}`}
          </p>
          {steps[currentStep]?.description && (
            <p className="text-xs text-gray-500 mt-1">
              {steps[currentStep].description}
            </p>
          )}
        </div>
      )}

      {/* Current Step Status */}
      {!compact && stepValidation[currentStep] && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-lg bg-gray-50 border"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {stepValidation[currentStep].isValid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-700">Step completed successfully</span>
                </>
              ) : stepValidation[currentStep].hasErrors ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">
                    {stepValidation[currentStep].errorCount} field(s) need attention
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Complete this step to continue</span>
                </>
              )}
            </div>
            {stepValidation[currentStep].completion && (
              <span className="text-xs text-gray-500">
                {stepValidation[currentStep].completion}% complete
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Navigation Hints */}
      {!compact && onStepClick && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">
            Click on completed steps to review or edit information
          </p>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;