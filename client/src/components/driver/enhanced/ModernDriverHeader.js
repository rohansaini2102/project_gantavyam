import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLogOut, FiWifi, FiWifiOff, FiTrendingUp } from 'react-icons/fi';
import '../styles/DriverTheme.css';

const ModernDriverHeader = ({
  driver,
  isOnline,
  onToggleStatus,
  vehicleType,
  onVehicleChange,
  socketConnected,
  todayEarnings = 0,
  todayTrips = 0,
  onLogout,
  className = ''
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [animatedEarnings, setAnimatedEarnings] = useState(0);

  // Animate earnings counter
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedEarnings(todayEarnings);
    }, 500);
    return () => clearTimeout(timer);
  }, [todayEarnings]);

  const vehicleOptions = [
    { type: 'bike', icon: '🏍️', label: 'Bike' },
    { type: 'auto', icon: '🛺', label: 'Auto' },
    { type: 'car', icon: '🚗', label: 'Car' }
  ];

  const handleStatusToggle = () => {
    if (!isOnline && !vehicleType) {
      // Show vehicle selection first
      return;
    }
    onToggleStatus();
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`driver-header-glass sticky top-0 z-40 ${className}`}
    >
      <div className="driver-safe-top" />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left Section - Profile & Status */}
          <div className="flex items-center gap-3">
            {/* Profile Avatar */}
            <motion.button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="relative"
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold shadow-lg">
                {driver?.fullName?.charAt(0).toUpperCase() || 'D'}
              </div>
              {isOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse" />
              )}
            </motion.button>

            {/* Driver Info */}
            <div>
              <h3 className="text-white font-semibold text-sm">
                {driver?.fullName || 'Driver'}
              </h3>
              <div className="flex items-center gap-2">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={isOnline ? 'online' : 'offline'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`text-xs font-medium ${
                      isOnline ? 'text-sky-400' : 'text-gray-400'
                    }`}
                  >
                    {isOnline ? 'Online' : 'Offline'}
                  </motion.span>
                </AnimatePresence>
                {isOnline && vehicleType && (
                  <span className="text-gray-400 text-xs">
                    • {vehicleOptions.find(v => v.type === vehicleType)?.icon}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center Section - Online/Offline Toggle */}
          <motion.div
            className="flex-1 mx-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={handleStatusToggle}
              className={`w-full py-2 px-4 rounded-full font-medium text-sm transition-all ${
                isOnline
                  ? 'driver-status-online'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              disabled={!socketConnected}
            >
              <motion.div
                className="flex items-center justify-center gap-2"
                animate={{
                  scale: isOnline ? [1, 1.05, 1] : 1
                }}
                transition={{
                  duration: 2,
                  repeat: isOnline ? Infinity : 0,
                  repeatType: "loop"
                }}
              >
                {!socketConnected ? (
                  <>
                    <FiWifiOff className="text-lg" />
                    <span>Reconnecting...</span>
                  </>
                ) : isOnline ? (
                  <>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span>Go Offline</span>
                  </>
                ) : (
                  <>
                    <span>Go Online</span>
                  </>
                )}
              </motion.div>
            </button>
          </motion.div>

          {/* Right Section - Earnings */}
          <motion.div
            className="text-right"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-1 text-sky-400">
              <FiTrendingUp className="text-sm" />
              <motion.span
                className="text-lg font-bold"
                animate={{
                  scale: todayEarnings > animatedEarnings ? [1, 1.2, 1] : 1
                }}
                transition={{ duration: 0.3 }}
              >
                ₹{animatedEarnings}
              </motion.span>
            </div>
            <p className="text-gray-400 text-xs">
              {todayTrips} trips today
            </p>
          </motion.div>
        </div>

        {/* Vehicle Selection (when offline) */}
        <AnimatePresence>
          {!isOnline && !vehicleType && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 overflow-hidden"
            >
              <p className="text-gray-400 text-sm mb-2">Select vehicle type:</p>
              <div className="grid grid-cols-3 gap-2">
                {vehicleOptions.map((option) => (
                  <motion.button
                    key={option.type}
                    onClick={() => onVehicleChange(option.type)}
                    className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-sky-400 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="text-2xl mb-1">{option.icon}</div>
                    <p className="text-xs text-gray-300">{option.label}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile Menu Dropdown */}
      <AnimatePresence>
        {showProfileMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30"
              onClick={() => setShowProfileMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-full left-4 mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden z-40"
            >
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-gray-300 hover:text-white w-full text-left"
              >
                <FiLogOut />
                <span>Logout</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Connection Status Bar */}
      <AnimatePresence>
        {!socketConnected && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="bg-red-500 text-white text-xs text-center py-1 overflow-hidden"
          >
            <div className="flex items-center justify-center gap-2">
              <FiWifiOff />
              <span>No connection. Trying to reconnect...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default ModernDriverHeader;