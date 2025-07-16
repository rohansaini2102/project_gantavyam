import React, { useState, useEffect } from 'react';

const UserLayout = ({ children, sidebar, map, isMobile = false, hideHeader = false, className = '' }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTabletOrMobile = windowWidth < 1024;
  const isMobileView = windowWidth < 768;

  if (isMobileView) {
    return (
      <div className="h-screen w-full flex flex-col relative bg-gray-50">
        {!hideHeader && (
          <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-gray-900">Gantavyam</h1>
            </div>
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}

        {/* Map Area */}
        <div className="flex-1 relative">
          {map}
        </div>

        {/* Bottom Sheet */}
        <div className={`
          absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transform transition-transform duration-300 ease-in-out
          ${showMobileSidebar ? 'translate-y-0' : 'translate-y-1/2'}
        `}>
          {/* Handle */}
          <div 
            className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 cursor-pointer"
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          />
          
          {/* Content */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {sidebar}
          </div>
        </div>

        {/* Overlay */}
        {showMobileSidebar && (
          <div 
            className="absolute inset-0 bg-black bg-opacity-25 z-10"
            onClick={() => setShowMobileSidebar(false)}
          />
        )}
      </div>
    );
  }

  if (isTabletOrMobile) {
    return (
      <div className="h-screen w-full flex flex-col bg-gray-50">
        {!hideHeader && (
          <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Gantavyam</h1>
          </div>
        )}

        <div className="flex-1 flex">
          {/* Sidebar */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {sidebar}
          </div>

          {/* Map */}
          <div className="flex-1">
            {map}
          </div>
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className={`h-screen w-full flex bg-gray-50 ${className}`}>
      {/* Desktop Sidebar */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        {!hideHeader && (
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Gantavyam</h1>
            <p className="text-sm text-gray-600 mt-1">Book your ride in seconds</p>
          </div>
        )}

        {/* Sidebar Content */}
        <div className={`flex-1 overflow-y-auto ${hideHeader ? '' : ''}`}>
          {sidebar}
        </div>
      </div>

      {/* Desktop Map */}
      <div className="flex-1">
        {map}
      </div>
    </div>
  );
};

export default UserLayout;