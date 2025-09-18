import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiNavigation, FiMapPin, FiUser, FiDollarSign, FiCheckCircle } from 'react-icons/fi';
import '../styles/DriverTheme.css';

const ModernActiveRidePanel = ({
  activeRide,
  otpInput = '',
  showOTPInput = null,
  rideError = '',
  onOTPInputChange,
  onStartRide,
  onEndRide,
  onOTPVerification,
  onCancelOTP,
  onCollectPayment,
  className = ''
}) => {
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);

  if (!activeRide) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`driver-card p-6 text-center ${className}`}
      >
        <div className="text-gray-400">
          <div className="text-5xl mb-3">🚗</div>
          <p className="text-sm">No active ride</p>
        </div>
      </motion.div>
    );
  }

  const getRideStatusInfo = (status) => {
    switch (status) {
      case 'driver_assigned':
        return { label: 'Navigate to Pickup', color: 'blue', icon: '📍' };
      case 'ride_started':
        return { label: 'Ride in Progress', color: 'green', icon: '🚗' };
      case 'ride_ended':
        return { label: 'Collect Payment', color: 'yellow', icon: '💰' };
      case 'completed':
        return { label: 'Ride Completed', color: 'gray', icon: '✅' };
      default:
        return { label: status, color: 'gray', icon: '📋' };
    }
  };

  // Helper function to get driver's earnings (base fare only, no GST/commission)
  const getDriverEarnings = (ride) => {
    // Priority 1: Use driverFare field (most accurate - what driver actually earns)
    if (ride.driverFare && ride.driverFare > 0) {
      return ride.driverFare;
    }

    // TEMPORARY FALLBACK: For existing ride requests without driverFare field
    // This handles the transition period until all new requests have driverFare
    if (ride.fare && ride.fare > 0) {
      console.warn(`[ModernActiveRidePanel] Using fallback fare for ride ${ride._id} - driverFare missing`);
      return ride.fare;
    }

    if (ride.estimatedFare && ride.estimatedFare > 0) {
      console.warn(`[ModernActiveRidePanel] Using fallback estimatedFare for ride ${ride._id} - driverFare missing`);
      return ride.estimatedFare;
    }

    // Log warning if no fare data available
    if (ride && ride._id) {
      console.warn(`[ModernActiveRidePanel] No fare data available for ride ${ride._id}:`, {
        rideId: ride._id,
        driverFare: ride.driverFare,
        fare: ride.fare,
        estimatedFare: ride.estimatedFare,
        status: ride.status
      });
    }

    return 0;
  };

  const statusInfo = getRideStatusInfo(activeRide.status);

  // OTP Input Component
  const renderOTPInput = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
      onClick={onCancelOTP}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 driver-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-5xl mb-4"
          >
            🔢
          </motion.div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {showOTPInput.label}
          </h3>
          <p className="text-gray-500 text-sm">
            {showOTPInput.type === 'start' 
              ? `Ask ${activeRide.userName} for the 4-digit OTP`
              : 'Enter the OTP to complete the ride'
            }
          </p>
        </div>

        {/* OTP Input Boxes */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((index) => (
            <motion.input
              key={index}
              type="text"
              maxLength="1"
              value={otpInput[index] || ''}
              onChange={(e) => {
                const newOtp = otpInput.split('');
                newOtp[index] = e.target.value;
                onOTPInputChange({ target: { value: newOtp.join('') } });
                
                // Auto-focus next input
                if (e.target.value && index < 3) {
                  e.target.nextSibling?.focus();
                }
              }}
              className="w-14 h-14 text-2xl text-center font-bold border-2 border-gray-300 rounded-xl focus:border-sky-500 focus:outline-none transition-colors"
              whileFocus={{ scale: 1.05 }}
            />
          ))}
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {rideError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 text-center"
            >
              {rideError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={onCancelOTP}
            className="py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
            whileTap={{ scale: 0.95 }}
          >
            Cancel
          </motion.button>
          <motion.button
            onClick={onOTPVerification}
            className="py-3 driver-btn-primary rounded-xl font-medium"
            whileTap={{ scale: 0.95 }}
            disabled={otpInput.length !== 4}
          >
            Verify OTP
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`driver-card overflow-hidden ${className}`}
      >
        {/* Status Header */}
        <div className={`p-4 bg-gradient-to-r ${
          statusInfo.color === 'blue' ? 'from-sky-400 to-sky-600' :
          statusInfo.color === 'green' ? 'from-green-400 to-green-600' :
          statusInfo.color === 'yellow' ? 'from-yellow-400 to-yellow-600' :
          'from-gray-400 to-gray-600'
        } text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{statusInfo.icon}</span>
              <div>
                <h3 className="font-bold text-lg">{statusInfo.label}</h3>
                <p className="text-white/80 text-sm">
                  Ride #{activeRide.boothRideNumber || activeRide.rideId?.slice(-6)}
                </p>
              </div>
            </div>
            {activeRide.estimatedFare && (
              <div className="text-right">
                <p className="text-2xl font-bold">₹{getDriverEarnings(activeRide)}</p>
                <p className="text-xs text-white/80">Estimated</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer Info */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <FiUser className="text-gray-600 text-xl" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{activeRide.userName}</p>
                <motion.a
                  href={`tel:${activeRide.userPhone}`}
                  className="flex items-center gap-1 text-sky-500 text-sm"
                  whileTap={{ scale: 0.95 }}
                >
                  <FiPhone className="text-xs" />
                  {activeRide.userPhone}
                </motion.a>
              </div>
            </div>
            <motion.button
              onClick={() => setShowFullDetails(!showFullDetails)}
              className="text-gray-400 text-sm"
              whileTap={{ scale: 0.95 }}
            >
              {showFullDetails ? 'Less' : 'More'}
            </motion.button>
          </div>
        </div>

        {/* Location Details */}
        <div className="p-4 space-y-3">
          {/* Pickup */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
              >
                <FiMapPin className="text-white text-sm" />
              </motion.div>
              {showFullDetails && <div className="w-0.5 h-12 bg-gray-300 mt-2" />}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Pickup</p>
              <p className="font-medium text-gray-900">
                {activeRide.pickupLocation?.boothName || 'Location'}
              </p>
            </div>
          </div>

          {/* Drop (shown in expanded view) */}
          <AnimatePresence>
            {showFullDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-3"
              >
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <FiNavigation className="text-white text-sm" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Drop</p>
                  <p className="font-medium text-gray-900">
                    {activeRide.dropLocation?.address || 'Location'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-gray-50">
          {activeRide.status === 'driver_assigned' && (
            <motion.button
              onClick={() => onStartRide(activeRide)}
              className="w-full py-4 driver-btn-primary rounded-xl font-medium text-lg flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              <FiCheckCircle />
              Start Ride
            </motion.button>
          )}

          {activeRide.status === 'ride_started' && (
            <motion.button
              onClick={onEndRide}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-xl font-medium text-lg flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              <FiCheckCircle />
              End Ride
            </motion.button>
          )}

          {activeRide.status === 'ride_ended' && (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-sm font-medium text-center">
                  Collect ₹{getDriverEarnings(activeRide)} from customer
                </p>
              </div>
              <motion.button
                onClick={() => setShowPaymentConfirm(true)}
                className="w-full py-4 driver-btn-primary rounded-xl font-medium text-lg flex items-center justify-center gap-2"
                whileTap={{ scale: 0.98 }}
              >
                <FiDollarSign />
                Payment Collected
              </motion.button>
            </div>
          )}

          {activeRide.status === 'completed' && (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 200 }}
                className="text-5xl mb-3"
              >
                🎉
              </motion.div>
              <p className="text-gray-600 font-medium">Ride completed successfully!</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* OTP Input Modal */}
      <AnimatePresence>
        {showOTPInput && renderOTPInput()}
      </AnimatePresence>

      {/* Payment Confirmation Modal */}
      <AnimatePresence>
        {showPaymentConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaymentConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">💰</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Confirm Payment Collection
                </h3>
                <p className="text-gray-500">
                  Have you collected ₹{getDriverEarnings(activeRide)} from {activeRide.userName}?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => setShowPaymentConfirm(false)}
                  className="py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={() => {
                    onCollectPayment?.();
                    setShowPaymentConfirm(false);
                  }}
                  className="py-3 driver-btn-primary rounded-xl font-medium"
                  whileTap={{ scale: 0.95 }}
                >
                  Confirm
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ModernActiveRidePanel;