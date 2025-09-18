import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { FiMapPin, FiNavigation, FiClock, FiUser, FiPhone } from 'react-icons/fi';
import '../styles/DriverTheme.css';

const SwipeableRideCard = ({
  ride,
  onAccept,
  onReject,
  isAccepting = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const cardRef = useRef(null);
  const controls = useAnimation();
  const x = useMotionValue(0);
  
  // Transform values for visual feedback
  const background = useTransform(
    x,
    [-200, 0, 200],
    [
      'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', // Red for reject
      'linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)', // Default white
      'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)'  // Blue for accept
    ]
  );
  
  const scale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  // Handle swipe end
  const handleDragEnd = (event, info) => {
    const threshold = 100;
    
    if (info.offset.x > threshold) {
      // Swipe right - Accept
      controls.start({ x: 300, opacity: 0 });
      setTimeout(() => onAccept(ride), 300);
    } else if (info.offset.x < -threshold) {
      // Swipe left - Reject
      controls.start({ x: -300, opacity: 0 });
      setTimeout(() => onReject(ride), 300);
    } else {
      // Snap back
      controls.start({ x: 0 });
    }
  };

  // Auto-dismiss timer
  const [timeLeft, setTimeLeft] = useState(30);
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReject(ride);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [ride, onReject]);

  const getVehicleIcon = (type) => {
    switch(type?.toLowerCase()) {
      case 'bike': return '🏍️';
      case 'auto': return '🛺';
      case 'car': return '🚗';
      default: return '🚗';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
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
      console.warn(`[SwipeableRideCard] Using fallback fare for ride ${ride._id} - driverFare missing`);
      return ride.fare;
    }

    if (ride.estimatedFare && ride.estimatedFare > 0) {
      console.warn(`[SwipeableRideCard] Using fallback estimatedFare for ride ${ride._id} - driverFare missing`);
      return ride.estimatedFare;
    }

    // Log warning if no fare data available
    if (ride && ride._id) {
      console.warn(`[SwipeableRideCard] No fare data available for ride ${ride._id}:`, {
        rideId: ride._id,
        driverFare: ride.driverFare,
        fare: ride.fare,
        estimatedFare: ride.estimatedFare,
        status: ride.status
      });
    }

    return 0;
  };

  return (
    <motion.div
      ref={cardRef}
      drag="x"
      dragConstraints={{ left: -200, right: 200 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      animate={controls}
      style={{ x, scale, opacity }}
      className={`relative ${className}`}
    >
      {/* Background indicator */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{ background }}
      />
      
      {/* Card Content */}
      <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-sky-400 to-sky-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-3xl"
              >
                {getVehicleIcon(ride.vehicleType)}
              </motion.div>
              <div>
                <h3 className="font-bold text-lg">New Ride Request</h3>
                <p className="text-sky-100 text-sm">
                  {ride.isManualBooking ? 'Manual Booking' : 'Customer Request'}
                </p>
              </div>
            </div>
            
            {/* Timer */}
            <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full">
              <FiClock className="text-sm" />
              <span className="font-mono text-sm">{timeLeft}s</span>
            </div>
          </div>
          
          {/* Queue info if available */}
          {ride.queueNumber && (
            <div className="mt-2 flex items-center gap-2 text-sm bg-black/20 px-3 py-1 rounded-full w-fit">
              <span>Queue #{ride.queueNumber}</span>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-4">
          {/* Customer Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <FiUser className="text-gray-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{ride.userName}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <FiPhone className="text-xs" />
                  {ride.userPhone}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">₹{getDriverEarnings(ride)}</p>
              <p className="text-xs text-gray-500">{ride.distance || '2.5'} km</p>
            </div>
          </div>

          {/* Location Details */}
          <div className="space-y-3">
            {/* Pickup */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <FiMapPin className="text-white text-xs" />
                </div>
                <div className="w-0.5 h-8 bg-gray-300 mt-1" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Pickup</p>
                <p className="font-medium text-gray-900">{ride.pickupLocation?.boothName}</p>
              </div>
            </div>

            {/* Drop */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <FiNavigation className="text-white text-xs" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Drop</p>
                <p className="font-medium text-gray-900">{ride.dropLocation?.address}</p>
              </div>
            </div>
          </div>

          {/* Swipe Instructions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-between text-sm pt-2"
          >
            <motion.div
              animate={{ x: [-5, 0, -5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-2 text-red-500"
            >
              <span>←</span>
              <span>Reject</span>
            </motion.div>
            
            <span className="text-gray-400">Swipe to respond</span>
            
            <motion.div
              animate={{ x: [5, 0, 5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-2 text-sky-500"
            >
              <span>Accept</span>
              <span>→</span>
            </motion.div>
          </motion.div>

          {/* Quick Action Buttons (Alternative to swipe) */}
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: showActions ? 'auto' : 0, opacity: showActions ? 1 : 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 pt-3">
              <motion.button
                onClick={() => onReject(ride)}
                className="py-3 px-4 bg-gray-900 text-white rounded-xl font-medium"
                whileTap={{ scale: 0.95 }}
              >
                Reject
              </motion.button>
              <motion.button
                onClick={() => onAccept(ride)}
                className="py-3 px-4 driver-btn-primary rounded-xl font-medium"
                whileTap={{ scale: 0.95 }}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mx-auto"
                  />
                ) : (
                  'Accept'
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* Toggle Actions Button */}
          <button
            onClick={() => setShowActions(!showActions)}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showActions ? 'Hide buttons' : 'Show buttons'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeableRideCard;