import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLogOut, FiSettings, FiActivity, FiWifi, FiWifiOff } from 'react-icons/fi';

const DriverHeader = ({ 
  driver, 
  socketConnected = false,
  isOnline = false,
  onLogout,
  onViewChange,
  currentView = 'dashboard',
  onMobileMenuToggle,
  isMobile = false,
  className = ''
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('driverToken');
      localStorage.removeItem('driver');
      navigate('/driver/login');
    }
  };

  const getStatusColor = () => {
    if (!socketConnected) return 'bg-red-500';
    return isOnline ? 'bg-green-500' : 'bg-yellow-500';
  };

  const getStatusText = () => {
    if (!socketConnected) return 'Disconnected';
    return isOnline ? 'Online' : 'Offline';
  };

  return (
    <header className={`bg-white border-b border-gray-200 ${className}`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-4">
            {isMobile && onMobileMenuToggle && (
              <button
                onClick={onMobileMenuToggle}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors lg:hidden"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Gantavyam Driver</h1>
            </div>

            {/* Connection & Status Indicators */}
            <div className="flex items-center space-x-3">
              {/* Socket Connection Status */}
              <div className="flex items-center space-x-2">
                {socketConnected ? (
                  <FiWifi className="w-4 h-4 text-green-500" />
                ) : (
                  <FiWifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  socketConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {socketConnected ? 'Connected' : 'Offline'}
                </span>
              </div>

              {/* Driver Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isOnline 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {getStatusText()}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation - Desktop Only */}
          {!isMobile && (
            <nav className="hidden lg:flex items-center space-x-6">
              <button
                onClick={() => onViewChange && onViewChange('dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-sky-100 text-sky-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onViewChange && onViewChange('requests')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'requests'
                    ? 'bg-sky-100 text-sky-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Ride Requests
              </button>
              <button
                onClick={() => onViewChange && onViewChange('active')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'active'
                    ? 'bg-sky-100 text-sky-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Active Ride
              </button>
              <button
                onClick={() => onViewChange && onViewChange('history')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'history'
                    ? 'bg-sky-100 text-sky-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                History
              </button>
            </nav>
          )}

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-4">
            {/* Driver Info */}
            {driver && (
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{driver.fullName}</p>
                <p className="text-xs text-gray-500">{driver.vehicleNo}</p>
              </div>
            )}

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center">
                  <FiUser className="w-4 h-4 text-white" />
                </div>
                {!isMobile && (
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onViewChange && onViewChange('profile');
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <FiUser className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onViewChange && onViewChange('settings');
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <FiSettings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <FiLogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DriverHeader;