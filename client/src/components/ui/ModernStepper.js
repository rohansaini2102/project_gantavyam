import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, AlertCircle, Clock } from 'lucide-react';

const ModernStepper = ({
  steps = [],
  currentStep = 0,
  completedSteps = [],
  errorSteps = [],
  onStepClick,
  className = '',
  orientation = 'horizontal' // 'horizontal' or 'vertical'
}) => {
  const getStepState = (stepIndex) => {
    if (completedSteps.includes(stepIndex)) return 'completed';
    if (errorSteps.includes(stepIndex)) return 'error';
    if (stepIndex === currentStep) return 'active';
    if (stepIndex < currentStep) return 'completed';
    return 'upcoming';
  };

  const getStepIcon = (step, stepIndex, state) => {
    const iconProps = { className: 'w-5 h-5' };

    switch (state) {
      case 'completed':
        return <CheckCircle2 {...iconProps} />;
      case 'error':
        return <AlertCircle {...iconProps} />;
      case 'active':
        return <Clock {...iconProps} />;
      default:
        return (
          <span className="w-5 h-5 flex items-center justify-center text-sm font-semibold">
            {stepIndex + 1}
          </span>
        );
    }
  };

  const getStepColors = (state) => {
    switch (state) {
      case 'completed':
        return {
          bg: 'bg-green-500',
          border: 'border-green-500',
          text: 'text-white',
          labelText: 'text-green-700',
          description: 'text-green-600'
        };
      case 'error':
        return {
          bg: 'bg-red-500',
          border: 'border-red-500',
          text: 'text-white',
          labelText: 'text-red-700',
          description: 'text-red-600'
        };
      case 'active':
        return {
          bg: 'bg-blue-500',
          border: 'border-blue-500',
          text: 'text-white',
          labelText: 'text-blue-700',
          description: 'text-blue-600'
        };
      default:
        return {
          bg: 'bg-gray-200',
          border: 'border-gray-300',
          text: 'text-gray-600',
          labelText: 'text-gray-500',
          description: 'text-gray-400'
        };
    }
  };

  const getConnectorColors = (fromState, toState) => {
    if (fromState === 'completed' && (toState === 'completed' || toState === 'active')) {
      return 'bg-green-500';
    }
    if (fromState === 'completed' || fromState === 'active') {
      return 'bg-blue-500';
    }
    return 'bg-gray-300';
  };

  if (orientation === 'vertical') {
    return (
      <div className={`space-y-6 ${className}`}>
        {steps.map((step, index) => {
          const state = getStepState(index);
          const colors = getStepColors(state);
          const isClickable = onStepClick && (state === 'completed' || state === 'active');

          return (
            <div key={step.key || index} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute left-6 top-12 w-0.5 h-6 transition-colors duration-300">
                  <motion.div
                    className={`w-full h-full ${getConnectorColors(
                      state,
                      getStepState(index + 1)
                    )}`}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: state === 'completed' ? 1 : 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </div>
              )}

              {/* Step content */}
              <motion.div
                className={`flex items-start gap-4 ${
                  isClickable ? 'cursor-pointer' : ''
                }`}
                onClick={isClickable ? () => onStepClick(index) : undefined}
                whileHover={isClickable ? { x: 4 } : {}}
                transition={{ duration: 0.2 }}
              >
                {/* Step circle */}
                <motion.div
                  className={`
                    relative w-12 h-12 rounded-full border-2 flex items-center justify-center
                    transition-all duration-300 ${colors.bg} ${colors.border} ${colors.text}
                  `}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  whileHover={isClickable ? { scale: 1.05 } : {}}
                >
                  {getStepIcon(step, index, state)}

                  {/* Pulse animation for active step */}
                  {state === 'active' && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-blue-400"
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </motion.div>

                {/* Step details */}
                <div className="flex-1 min-w-0">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 + 0.1 }}
                  >
                    <h3 className={`font-semibold ${colors.labelText}`}>
                      {step.label}
                    </h3>
                    {step.description && (
                      <p className={`text-sm mt-1 ${colors.description}`}>
                        {step.description}
                      </p>
                    )}
                    {step.substeps && state !== 'upcoming' && (
                      <div className="mt-2 space-y-1">
                        {step.substeps.map((substep, subIndex) => (
                          <div
                            key={subIndex}
                            className="flex items-center gap-2 text-xs"
                          >
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            <span className="text-gray-600">{substep}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const state = getStepState(index);
          const colors = getStepColors(state);
          const isClickable = onStepClick && (state === 'completed' || state === 'active');

          return (
            <React.Fragment key={step.key || index}>
              {/* Step */}
              <motion.div
                className={`flex flex-col items-center ${
                  isClickable ? 'cursor-pointer' : ''
                }`}
                onClick={isClickable ? () => onStepClick(index) : undefined}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={isClickable ? { y: -2 } : {}}
              >
                {/* Step circle */}
                <motion.div
                  className={`
                    relative w-12 h-12 rounded-full border-2 flex items-center justify-center
                    transition-all duration-300 ${colors.bg} ${colors.border} ${colors.text}
                    shadow-lg
                  `}
                  whileHover={isClickable ? { scale: 1.05 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                >
                  {getStepIcon(step, index, state)}

                  {/* Pulse animation for active step */}
                  {state === 'active' && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-blue-400"
                      animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}

                  {/* Completion animation */}
                  {state === 'completed' && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-green-400"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, type: 'spring' }}
                    />
                  )}
                </motion.div>

                {/* Step label */}
                <motion.div
                  className="mt-3 text-center max-w-24"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 + 0.2 }}
                >
                  <h3 className={`text-sm font-medium ${colors.labelText}`}>
                    {step.label}
                  </h3>
                  {step.icon && (
                    <div className="mt-1 text-lg">{step.icon}</div>
                  )}
                </motion.div>
              </motion.div>

              {/* Connector */}
              {index < steps.length - 1 && (
                <div className="flex-1 px-4">
                  <div className="relative h-0.5 bg-gray-300 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${getConnectorColors(
                        state,
                        getStepState(index + 1)
                      )} rounded-full`}
                      initial={{ scaleX: 0 }}
                      animate={{
                        scaleX: state === 'completed' ? 1 : 0
                      }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      style={{ originX: 0 }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress bar (optional) */}
      <div className="mt-8">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Progress</span>
          <span>
            {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* Step descriptions */}
      <AnimatePresence mode="wait">
        {steps[currentStep]?.description && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-6 text-center"
          >
            <p className="text-gray-600 max-w-2xl mx-auto">
              {steps[currentStep].description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModernStepper;