import React, { useState, useEffect } from 'react';
import DriverMobileNavigation from './DriverMobileNavigation';
import DriverHeader from './DriverHeader';

const DriverLayout = ({ 
  children, 
  sidebar, 
  map, 
  currentView = 'dashboard',
  onViewChange,
  activeRide = null,
  driver = null,
  className = '',
  rideRequestsCount = 0,
  socketConnected = false,
  isOnline = false,
  onLogout
}) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive breakpoints
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024;
  
  // Dynamic mobile panel height based on current view
  const getMobileHeightClasses = () => {
    if (currentView === 'history') {
      return 'max-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-160px)] min-h-[65vh]';
    }
    if (currentView === 'active') {
      return 'max-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-200px)] min-h-[45vh]';
    }
    if (currentView === 'requests') {
      return 'max-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-180px)] min-h-[60vh]';
    }
    // Dashboard view
    return 'max-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-220px)] min-h-[50vh]';
  };

  // Mobile Layout (< 768px) - Full screen with bottom tabs
  if (isMobile) {
    return (
      <div className={`h-screen w-full relative bg-gray-50 ${className}`}>
        {/* Full Screen Map Background */}
        <div className="absolute inset-0">
          {map}
        </div>

        {/* Floating Content Panel */}
        <div className="relative z-10 h-full flex flex-col">
          {/* Top Safe Area */}
          <div className="h-safe-area-inset-top bg-transparent" />
          
          {/* Content Area */}
          <div className="flex-1 relative">
            {/* Content Panel - Dynamic height based on content */}
            <div className={`
              absolute bottom-0 left-0 right-0 bg-white
              rounded-t-3xl shadow-2xl border-t border-gray-200
              transition-all duration-300 ease-in-out
              ${getMobileHeightClasses()}
              flex flex-col
            `}>
              {/* Handle */}
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-4 mb-2 flex-shrink-0" />
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain" style={{
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'smooth'
              }}>
                <div className="pb-24">
                  {sidebar}
                </div>
              </div>
            </div>

            {/* Profile Overlay for profile view */}
            {currentView === 'profile' && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end">
                <div className="w-full bg-white rounded-t-3xl p-6 max-h-[calc(100vh-env(safe-area-inset-top)-40px)] overflow-y-auto overscroll-contain" style={{
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {children}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Bottom Navigation */}
          <DriverMobileNavigation 
            currentView={currentView}
            onViewChange={onViewChange}
            activeRide={activeRide}
            rideRequestsCount={rideRequestsCount}
            className="relative z-20"
          />
          
          {/* Bottom Safe Area */}
          <div className="h-safe-area-inset-bottom bg-white" />
        </div>
      </div>
    );
  }

  // Tablet Layout (768px - 1024px) - Collapsible sidebar
  if (isTablet) {
    return (
      <div className={`h-screen flex flex-col ${className}`}>
        {/* Header */}
        <DriverHeader
          driver={driver}
          socketConnected={socketConnected}
          isOnline={isOnline}
          onLogout={onLogout}
          onViewChange={onViewChange}
          currentView={currentView}
          isMobile={false}
        />
        
        <div className="flex-1 flex">
          {/* Sidebar */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
            {sidebar}
          </div>
          
          {/* Map Area */}
          <div className="flex-1 relative">
            {map}
            {children && (
              <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop Layout (>= 1024px) - Fixed sidebar
  return (
    <div className={`h-screen flex flex-col ${className}`}>
      {/* Header */}
      <DriverHeader
        driver={driver}
        socketConnected={socketConnected}
        isOnline={isOnline}
        onLogout={onLogout}
        onViewChange={onViewChange}
        currentView={currentView}
        isMobile={false}
      />
      
      <div className="flex-1 flex">
        {/* Fixed Sidebar */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-lg">
          {sidebar}
        </div>
        
        {/* Map Area */}
        <div className="flex-1 relative">
          {map}
          {children && (
            <div className="absolute top-6 right-6 bg-white rounded-xl shadow-lg p-6 max-w-md">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverLayout;