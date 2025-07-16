import React from 'react';
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
    if (onViewChange) {
      onViewChange(tabId);
    }
  };

  return (
    <div className={`bg-white border-t border-gray-200 ${className}`}>
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          const isHighlighted = tab.isHighlighted;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`
                relative flex flex-col items-center justify-center min-w-0 flex-1 p-2 rounded-lg
                transition-all duration-200 ease-in-out
                ${isActive 
                  ? 'bg-sky-100 text-sky-700' 
                  : isHighlighted
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              {/* Icon */}
              <div className="relative">
                <Icon className={`w-5 h-5 ${isHighlighted ? 'animate-pulse' : ''}`} />
                
                {/* Notification Badge */}
                {tab.notification && (
                  <div className={`
                    absolute -top-1 -right-1 min-w-[18px] h-5 flex items-center justify-center
                    text-xs font-bold text-white rounded-full shadow-lg
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
                text-xs font-medium mt-1 truncate max-w-full
                ${isActive ? 'text-sky-700' : isHighlighted ? 'text-green-700' : 'text-gray-600'}
              `}>
                {tab.label}
              </span>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-sky-500 rounded-full" />
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