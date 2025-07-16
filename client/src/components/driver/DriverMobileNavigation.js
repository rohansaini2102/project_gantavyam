import React, { useState } from 'react';
import { 
  FiHome, 
  FiInbox, 
  FiActivity, 
  FiClock, 
  FiUser,
  FiNavigation2
} from 'react-icons/fi';

const DriverMobileNavigation = ({ 
  currentView = 'dashboard',
  onViewChange,
  activeRide = null,
  rideRequestsCount = 0,
  className = ''
}) => {
  const [pressedTab, setPressedTab] = useState(null);
  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: FiHome,
      notification: null
    },
    {
      id: 'requests',
      label: 'Requests',
      icon: FiInbox,
      notification: rideRequestsCount > 0 ? rideRequestsCount : null
    },
    {
      id: 'active',
      label: 'Active',
      icon: activeRide ? FiNavigation2 : FiActivity,
      notification: activeRide ? '!' : null,
      isHighlighted: !!activeRide
    },
    {
      id: 'history',
      label: 'History',
      icon: FiClock,
      notification: null
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: FiUser,
      notification: null
    }
  ];

  const handleTabClick = (tabId) => {
    // Add haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
    
    if (onViewChange) {
      onViewChange(tabId);
    }
  };

  const handleTabPress = (tabId) => {
    setPressedTab(tabId);
    setTimeout(() => setPressedTab(null), 150);
  };

  return (
    <div className={`bg-white border-t border-gray-200 shadow-lg ${className}`}>
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          const isHighlighted = tab.isHighlighted;
          const isPressed = pressedTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              onTouchStart={() => handleTabPress(tab.id)}
              onMouseDown={() => handleTabPress(tab.id)}
              className={`
                driver-nav-tab relative flex flex-col items-center justify-center min-w-0 flex-1 p-3 rounded-lg
                min-h-[48px] transition-all duration-200 ease-in-out transform
                ${isActive 
                  ? 'bg-sky-100 text-sky-700 scale-105' 
                  : isHighlighted
                    ? 'bg-green-50 text-green-700 scale-105'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
                ${isPressed ? 'scale-95 bg-gray-100' : ''}
                touch-manipulation
              `}
            >
              {/* Icon */}
              <div className="relative">
                <Icon className={`w-5 h-5 ${isHighlighted ? 'animate-pulse' : ''}`} />
                
                {/* Notification Badge */}
                {tab.notification && (
                  <div className={`
                    driver-notification-badge
                    ${isHighlighted 
                      ? 'bg-green-500 animate-pulse' 
                      : tab.notification === '!' 
                        ? 'bg-red-500 animate-bounce' 
                        : 'bg-yellow-500 animate-pulse'
                    }
                    ${tab.notification === '!' ? 'px-1' : 'px-1.5'}
                    border-2 border-white
                  `}>
                    {tab.notification}
                  </div>
                )}
              </div>
              
              {/* Label */}
              <span className={`
                text-xs font-semibold mt-1 truncate max-w-full leading-tight
                ${isActive ? 'text-blue-700' : isHighlighted ? 'text-blue-700' : 'text-gray-600'}
              `}>
                {tab.label}
              </span>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Safe area for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-white" />
    </div>
  );
};

export default DriverMobileNavigation;