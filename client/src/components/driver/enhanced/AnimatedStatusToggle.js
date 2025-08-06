import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPower, FiWifi, FiWifiOff } from 'react-icons/fi';
import '../styles/DriverTheme.css';

const AnimatedStatusToggle = ({
  isOnline,
  onToggle,
  vehicleType,
  socketConnected,
  disabled = false,
  className = ''
}) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (disabled || isToggling) return;
    
    setIsToggling(true);
    await onToggle();
    
    // Simulate async operation
    setTimeout(() => {
      setIsToggling(false);
    }, 1000);
  };

  const toggleVariants = {
    offline: {
      backgroundColor: '#1F2937', // gray-800
      x: 0
    },
    online: {
      backgroundColor: '#38BDF8', // sky-400
      x: 0
    }
  };

  const knobVariants = {
    offline: {
      x: 4,
      backgroundColor: '#6B7280' // gray-500
    },
    online: {
      x: 52,
      backgroundColor: '#FFFFFF'
    }
  };

  const pulseVariants = {
    initial: { scale: 0, opacity: 0 },
    animate: {
      scale: [1, 1.5, 2],
      opacity: [0.5, 0.3, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Toggle Container */}
      <motion.button
        onClick={handleToggle}
        disabled={disabled || !socketConnected}
        className={`relative w-full max-w-sm mx-auto p-4 rounded-2xl shadow-lg overflow-hidden ${
          disabled || !socketConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        animate={isOnline ? 'online' : 'offline'}
        variants={toggleVariants}
        transition={{ duration: 0.3 }}
        whileHover={!disabled && socketConnected ? { scale: 1.02 } : {}}
        whileTap={!disabled && socketConnected ? { scale: 0.98 } : {}}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white to-transparent" />
        </div>

        {/* Status Text */}
        <div className="relative z-10 flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={isOnline ? 'online' : 'offline'}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                {socketConnected ? (
                  <FiWifi className="text-2xl text-white" />
                ) : (
                  <FiWifiOff className="text-2xl text-gray-400" />
                )}
              </motion.div>
            </AnimatePresence>
            
            <div>
              <h3 className="text-white font-semibold text-lg">
                {!socketConnected ? 'Disconnected' : isOnline ? 'Online' : 'Offline'}
              </h3>
              {vehicleType && isOnline && (
                <p className="text-white/70 text-sm">
                  {vehicleType === 'bike' ? '🏍️ Bike' : vehicleType === 'auto' ? '🛺 Auto' : '🚗 Car'}
                </p>
              )}
            </div>
          </div>

          <motion.div
            animate={{ rotate: isToggling ? 360 : 0 }}
            transition={{ duration: 1, ease: "linear" }}
          >
            <FiPower className={`text-2xl ${isOnline ? 'text-white' : 'text-gray-400'}`} />
          </motion.div>
        </div>

        {/* Toggle Switch */}
        <div className="relative">
          <motion.div
            className="relative w-20 h-8 bg-black/20 rounded-full p-1"
            animate={isOnline ? 'online' : 'offline'}
          >
            {/* Toggle Knob */}
            <motion.div
              className="w-6 h-6 rounded-full shadow-md relative z-10"
              variants={knobVariants}
              animate={isOnline ? 'online' : 'offline'}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {isOnline && (
                <motion.div
                  className="absolute inset-0 bg-green-400 rounded-full"
                  animate={{ scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>

            {/* Active Glow */}
            {isOnline && (
              <motion.div
                className="absolute inset-0 bg-white/20 rounded-full blur-md"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.div>
        </div>

        {/* Status Message */}
        <AnimatePresence mode="wait">
          <motion.p
            key={!socketConnected ? 'disconnected' : isOnline ? 'online' : 'offline'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-white/70 text-sm text-center mt-3"
          >
            {!socketConnected 
              ? 'Waiting for connection...'
              : isOnline 
                ? 'Receiving ride requests'
                : 'Tap to go online'
            }
          </motion.p>
        </AnimatePresence>

        {/* Loading Overlay */}
        <AnimatePresence>
          {isToggling && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center z-20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-3 border-white border-t-transparent rounded-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Pulse Effect for Online Status */}
      {isOnline && socketConnected && (
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-2xl bg-sky-400"
            variants={pulseVariants}
            initial="initial"
            animate="animate"
          />
        </div>
      )}

      {/* Connection Error */}
      <AnimatePresence>
        {!socketConnected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-12 left-0 right-0 bg-red-500 text-white text-xs py-2 px-3 rounded-lg text-center"
          >
            No connection to server
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnimatedStatusToggle;