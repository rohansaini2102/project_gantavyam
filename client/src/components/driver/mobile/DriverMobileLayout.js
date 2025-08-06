import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/DriverTheme.css';

const DriverMobileLayout = ({ 
  children, 
  activeTab,
  onTabChange,
  driver,
  isOnline,
  socketConnected,
  todayEarnings = 0
}) => {
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: '🏠' },
    { id: 'assigned', label: 'Rides', icon: '🚗', badge: 0 },
    { id: 'earnings', label: 'Earnings', icon: '💰' },
    { id: 'profile', label: 'Profile', icon: '👤' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 20,
        stiffness: 100
      }
    }
  };

  return (
    <motion.div 
      className="driver-theme min-h-screen bg-gray-50 flex flex-col"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Status Bar Area - for notch safety */}
      <div className="driver-safe-top bg-gray-900" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Scrollable Content */}
        <div 
          className="flex-1 overflow-y-auto pb-20"
          style={{ maxHeight: `${windowHeight - 120}px` }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating Status Card */}
        <AnimatePresence>
          {isOnline && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-2 left-4 right-4 z-20"
            >
              <div className="driver-card driver-header-glass px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-white font-medium">Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 text-sm">Today:</span>
                  <span className="text-white font-bold">₹{todayEarnings}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <motion.nav 
        className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 driver-safe-bottom z-30"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        <div className="grid grid-cols-4 relative">
          {/* Active Tab Indicator */}
          <motion.div
            className="absolute top-0 h-1 bg-gradient-to-r from-sky-400 to-sky-600"
            layoutId="activeTab"
            initial={false}
            animate={{
              x: `${navItems.findIndex(item => item.id === activeTab) * 100}%`,
              width: '25%'
            }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          />

          {navItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative py-2 px-3 flex flex-col items-center justify-center transition-colors ${
                activeTab === item.id 
                  ? 'text-sky-400' 
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="text-2xl mb-1"
                animate={{
                  scale: activeTab === item.id ? 1.1 : 1,
                  y: activeTab === item.id ? -2 : 0
                }}
                transition={{ type: "spring", damping: 15, stiffness: 200 }}
              >
                {item.icon}
              </motion.div>
              <span className="text-xs font-medium">{item.label}</span>
              
              {/* Badge for notifications */}
              {item.badge > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1 right-4 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold"
                >
                  {item.badge}
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.nav>

      {/* Bottom Sheet for Additional Options */}
      <AnimatePresence>
        {showBottomSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setShowBottomSheet(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="driver-bottom-sheet z-50 max-h-[80vh]"
            >
              <div className="p-6">
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
                {/* Bottom sheet content goes here */}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Connection Status Indicator */}
      <AnimatePresence>
        {!socketConnected && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-20 flex items-center gap-2"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">Reconnecting to server...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DriverMobileLayout;