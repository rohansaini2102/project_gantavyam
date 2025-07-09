import React from 'react';

const StatsCard = ({ 
  title, 
  value, 
  change, 
  changeType = 'positive', 
  icon, 
  iconBg = 'bg-blue-500',
  subtitle,
  onClick,
  loading = false
}) => {
  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-green-600';
    if (changeType === 'negative') return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = () => {
    if (changeType === 'positive') return '↗';
    if (changeType === 'negative') return '↘';
    return '→';
  };

  return (
    <div
      className={`
        bg-white rounded-lg shadow-sm border border-gray-200 p-6 
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow duration-200' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            {icon && (
              <div className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center`}>
                <span className="text-white text-xl">{icon}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <div className="flex items-baseline space-x-2 mt-1">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 rounded h-8 w-16"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                )}
                {change && !loading && (
                  <div className={`flex items-center text-sm ${getChangeColor()}`}>
                    <span className="mr-1">{getChangeIcon()}</span>
                    <span>{change}</span>
                  </div>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;