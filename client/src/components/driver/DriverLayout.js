import React, { useState, useEffect, useRef } from 'react';
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
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const panelRef = useRef(null);
  const dragStartY = useRef(0);

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
    const navHeight = 80; // Bottom navigation height
    const safeAreaBuffer = 20; // Extra buffer for safe areas
    
    if (currentView === 'history') {
      return `max-h-[calc(100vh-${navHeight + safeAreaBuffer}px)] min-h-[70vh]`;
    }
    if (currentView === 'active') {
      return `max-h-[calc(100vh-${navHeight + safeAreaBuffer}px)] min-h-[60vh]`;
    }
    if (currentView === 'requests') {
      return `max-h-[calc(100vh-${navHeight + safeAreaBuffer}px)] min-h-[65vh]`;
    }
    // Dashboard view - increased to 70vh to ensure Go Online button is always visible
    return `max-h-[calc(100vh-${navHeight + safeAreaBuffer}px)] min-h-[70vh]`;
  };

  // Handle drag for mobile panel
  const handleDragStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    dragStartY.current = touch.clientY;
    setIsPanelDragging(true);
  };

  const handleDragMove = (e) => {
    if (!isPanelDragging || !panelRef.current) return;
    
    const touch = e.touches ? e.touches[0] : e;
    const deltaY = dragStartY.current - touch.clientY;
    const currentHeight = panelRef.current.offsetHeight;
    const newHeight = Math.max(200, Math.min(windowHeight * 0.85, currentHeight + deltaY));
    
    setPanelHeight(newHeight);
    dragStartY.current = touch.clientY;
  };

  const handleDragEnd = () => {
    setIsPanelDragging(false);
  };

  // Add event listeners for drag
  useEffect(() => {
    if (isPanelDragging) {
      const handleMove = (e) => handleDragMove(e);
      const handleEnd = () => handleDragEnd();
      
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      
      return () => {
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
      };
    }
  }, [isPanelDragging]);

  // Mobile Layout (< 768px) - Full screen with bottom tabs
  if (isMobile) {
    return (
      <div className={`h-screen w-full relative bg-gray-50 overflow-hidden ${className}`} 
        style={{ 
          touchAction: 'manipulation',
          height: '100dvh', // Dynamic viewport height for better mobile support
          minHeight: '100vh' // Fallback for browsers that don't support dvh
        }}>
        {/* Full Screen Map Background */}
        <div className="absolute inset-0">
          {map}
        </div>

        {/* Floating Content Panel */}
        <div className="relative z-20 h-full flex flex-col">
          {/* Top Safe Area */}
          <div className="h-safe-area-inset-top bg-transparent" 
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} />
          
          {/* Content Area */}
          <div className="flex-1 relative">
            {/* Content Panel - Dynamic height based on content */}
            <div 
              ref={panelRef}
              className={`
                absolute bottom-0 left-0 right-0 bg-white
                rounded-t-3xl shadow-2xl border-t border-gray-200
                transition-all duration-300 ease-in-out
                ${getMobileHeightClasses()}
                flex flex-col
                ${isPanelDragging ? 'transition-none' : ''}
              `}
              style={{
                height: panelHeight > 0 ? `${panelHeight}px` : undefined,
                willChange: 'transform',
                WebkitBackfaceVisibility: 'hidden',
                perspective: 1000
              }}>
              {/* Drag Handle */}
              <div 
                className="flex-shrink-0 pt-4 pb-2 cursor-grab active:cursor-grabbing"
                onTouchStart={handleDragStart}
                onMouseDown={handleDragStart}
                style={{ touchAction: 'none' }}
              >
                <div className="w-12 h-1.5 bg-gray-300 hover:bg-gray-400 rounded-full mx-auto transition-colors" />
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain mobile-scroll-fix" style={{
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'smooth',
                overscrollBehavior: 'contain',
                touchAction: 'pan-y'
              }}>
                <div className="pb-6 px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
                  {sidebar}
                </div>
              </div>
            </div>

            {/* Profile Overlay for profile view */}
            {currentView === 'profile' && (
              <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-end z-50">
                <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[calc(100vh-env(safe-area-inset-top)-40px)] overflow-hidden flex flex-col">
                  {/* Handle */}
                  <div className="pt-4 pb-2">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />
                  </div>
                  
                  {/* Profile Content */}
                  <div className="flex-1 overflow-y-auto overscroll-contain mobile-scroll-fix p-6" style={{
                    WebkitOverflowScrolling: 'touch'
                  }}>
                    <div className="text-center mb-6">
                      <div className="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                        <span className="text-white text-2xl font-bold">
                          {driver?.fullName?.charAt(0).toUpperCase() || 'D'}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">{driver?.fullName || 'Driver'}</h2>
                      <p className="text-gray-600">{driver?.mobileNo || ''}</p>
                      {driver?.vehicleNo && (
                        <p className="text-sm text-gray-500 mt-1">Vehicle: {driver.vehicleNo}</p>
                      )}
                    </div>
                    
                    {/* Profile Menu Items */}
                    <div className="space-y-2">
                      <button className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center space-x-3 transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium">Edit Profile</span>
                      </button>
                      
                      <button className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center space-x-3 transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium">Earnings Report</span>
                      </button>
                      
                      <button className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center space-x-3 transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-medium">Settings</span>
                      </button>
                      
                      <button 
                        onClick={onLogout}
                        className="w-full p-4 text-left bg-red-50 hover:bg-red-100 rounded-xl flex items-center space-x-3 text-red-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="font-medium">Sign Out</span>
                      </button>
                    </div>
                  </div>
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
            className="relative z-30"
          />
          
          {/* Bottom Safe Area */}
          <div className="h-safe-area-inset-bottom bg-white" 
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      </div>
    );
  }

  // Tablet Layout (768px - 1024px) - Split view
  if (isTablet) {
    return (
      <div className={`h-screen flex flex-col bg-gray-50 ${className}`}>
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
          <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-lg">
            <div className="flex-1 overflow-y-auto p-4">
              {sidebar}
            </div>
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
    <div className={`h-screen flex flex-col bg-gray-50 ${className}`}>
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
        <div className="w-[420px] bg-white border-r border-gray-200 flex flex-col shadow-lg">
          <div className="flex-1 overflow-y-auto p-6">
            {sidebar}
          </div>
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