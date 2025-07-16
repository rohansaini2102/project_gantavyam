import React, { useState, useEffect } from 'react';
import MobileTabNavigation from './MobileTabNavigation';

const ResponsiveLayout = ({ 
  children, 
  sidebar, 
  map, 
  currentView = 'booking',
  onViewChange,
  activeRide = null,
  user = null,
  className = '',
  bookingStep = 1
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
  
  // Dynamic mobile panel height based on view and booking step
  // Account for navigation height (~80px) and safe areas
  const getMobileHeightClasses = () => {
    if (currentView === 'history') {
      return 'h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-160px)] min-h-[65vh]';
    }
    if (currentView === 'active') {
      return 'h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-200px)] min-h-[45vh]';
    }
    // Booking view - adjust height based on step, accounting for navigation
    if (currentView === 'booking') {
      if (bookingStep === 3) {
        // Step 3 (confirmation) needs more height for content
        return 'h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-160px)] min-h-[75vh]';
      }
      if (bookingStep === 2) {
        // Step 2 (vehicle selection) needs medium height
        return 'h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-160px)] min-h-[65vh]';
      }
      // Step 1 (locations) can use standard height
      return 'h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-160px)] min-h-[55vh]';
    }
    // Default fallback - account for navigation
    return 'h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-180px)] min-h-[60vh]';
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
              pb-20
            `}>
              {/* Handle */}
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-4 mb-2 flex-shrink-0" />
              
              {/* Content - with proper padding for scrolling */}
              <div className="flex-1 overflow-y-auto overscroll-contain" style={{
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'smooth'
              }}>
                {sidebar}
              </div>
            </div>

            {/* Profile Overlay for profile view */}
            {currentView === 'profile' && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end">
                <div className="w-full bg-white rounded-t-3xl p-6 max-h-[calc(100vh-env(safe-area-inset-top)-40px)] overflow-y-auto overscroll-contain" style={{
                  WebkitOverflowScrolling: 'touch'
                }}>
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{user?.name || 'User'}</h2>
                    <p className="text-gray-600">{user?.phone || user?.email || ''}</p>
                  </div>
                  
                  {/* Profile Menu Items */}
                  <div className="space-y-2">
                    <button className="w-full p-4 text-left bg-gray-50 rounded-xl flex items-center space-x-3">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium">Edit Profile</span>
                    </button>
                    
                    <button className="w-full p-4 text-left bg-gray-50 rounded-xl flex items-center space-x-3">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="font-medium">Wallet</span>
                    </button>
                    
                    <button className="w-full p-4 text-left bg-gray-50 rounded-xl flex items-center space-x-3">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium">Settings</span>
                    </button>
                    
                    <button className="w-full p-4 text-left bg-red-50 rounded-xl flex items-center space-x-3 text-red-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom Tab Navigation */}
          <MobileTabNavigation
            currentView={currentView}
            onViewChange={onViewChange}
            activeRide={activeRide}
          />
        </div>
        
        {children}
      </div>
    );
  }

  // Tablet Layout (768px - 1024px) - Split view
  if (isTablet) {
    return (
      <div className={`h-screen w-full flex bg-gray-50 ${className}`}>
        {/* Left Panel */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-lg">
          {/* Header with tabs */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Gantavyam</h1>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { id: 'booking', label: 'Book', icon: '🏠' },
                { id: 'active', label: 'Active', icon: '⚡' },
                { id: 'history', label: 'History', icon: '📋' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onViewChange(tab.id)}
                  className={`
                    flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${currentView === tab.id 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'}
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content with proper scrolling */}
          <div className="flex-1 overflow-y-auto">
            <div className="pb-4">
              {sidebar}
            </div>
          </div>

          {/* Profile Section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{user?.name || 'User'}</div>
                <div className="text-sm text-gray-600">{user?.phone || ''}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Map */}
        <div className="flex-1">
          {map}
        </div>
        
        {children}
      </div>
    );
  }

  // Desktop Layout (> 1024px) - Sidebar + Map
  return (
    <div className={`h-screen w-full flex bg-gray-50 ${className}`}>
      {/* Left Sidebar */}
      <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col shadow-lg">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">G</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gantavyam</h1>
              <p className="text-sm text-gray-600">Book your ride</p>
            </div>
          </div>
          
          {/* Desktop Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'booking', label: 'Book Ride', icon: '🚗' },
              { id: 'active', label: 'Active', icon: '⚡' },
              { id: 'history', label: 'History', icon: '📋' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                className={`
                  flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all
                  ${currentView === tab.id 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'}
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {sidebar}
        </div>

        {/* User Profile Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{user?.name || 'User'}</div>
              <div className="text-sm text-gray-600">{user?.phone || ''}</div>
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1">
        {map}
      </div>
      
      {children}
    </div>
  );
};

export default ResponsiveLayout;