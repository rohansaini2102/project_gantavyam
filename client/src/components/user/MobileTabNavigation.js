import React from 'react';

const MobileTabNavigation = ({ 
  currentView, 
  onViewChange, 
  activeRide = null,
  className = '' 
}) => {
  const tabs = [
    {
      id: 'booking',
      label: 'Book',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'active',
      label: activeRide ? 'Active' : 'Track',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      badge: activeRide ? true : false
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    }
  ];

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 
      z-50 ${className}
    `}
    style={{
      paddingBottom: 'env(safe-area-inset-bottom, 0px)'
    }}>
      <div className="flex items-center justify-around px-4 py-3">
        {tabs.map((tab) => {
          const isActive = currentView === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={`
                relative flex flex-col items-center justify-center px-3 py-2 min-w-0 flex-1
                transition-all duration-200 ease-in-out rounded-xl
                ${isActive 
                  ? `${tab.color} ${tab.bgColor} transform scale-105` 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }
              `}
              style={{
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {/* Badge for active ride */}
              {tab.badge && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
              
              {/* Icon */}
              <div className={`
                transition-all duration-200 ease-in-out
                ${isActive ? 'scale-110 -translate-y-0.5' : 'scale-100'}
              `}>
                {tab.icon}
              </div>
              
              {/* Label */}
              <span className={`
                text-xs font-medium mt-1 transition-all duration-200 ease-in-out
                ${isActive ? 'opacity-100 font-semibold' : 'opacity-70'}
              `}>
                {tab.label}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-current rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileTabNavigation;