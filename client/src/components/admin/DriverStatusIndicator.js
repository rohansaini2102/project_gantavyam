import React from 'react';

const DriverStatusIndicator = ({ driver, showDetails = true, size = 'medium' }) => {
  if (!driver) {
    return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        No Driver
      </div>
    );
  }

  const getStatusColor = () => {
    if (!driver.isOnline) return 'bg-red-100 text-red-800 border-red-200';
    if (driver.currentRide) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (driver.queuePosition === 1) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const getStatusText = () => {
    if (!driver.isOnline) return 'Offline';
    if (driver.currentRide) return 'On Ride';
    if (driver.queuePosition === 1) return 'Next in Queue';
    if (driver.queuePosition) return `Queue #${driver.queuePosition}`;
    return 'Available';
  };

  const getStatusIcon = () => {
    if (!driver.isOnline) return '🔴';
    if (driver.currentRide) return '🚗';
    if (driver.queuePosition === 1) return '🥇';
    return '🟢';
  };

  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-2 text-base'
  };

  return (
    <div className="space-y-2">
      {/* Status Badge */}
      <div className={`inline-flex items-center rounded-full font-medium border ${getStatusColor()} ${sizeClasses[size]}`}>
        <span className="mr-1">{getStatusIcon()}</span>
        {getStatusText()}
      </div>

      {/* Driver Details */}
      {showDetails && (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-900">{driver.fullName || driver.name}</span>
            {driver.rating && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                ⭐ {driver.rating.toFixed(1)}
              </span>
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            📞 {driver.mobileNo || driver.phone}
          </div>
          
          {driver.vehicleNo && (
            <div className="text-sm text-gray-600">
              🚗 {driver.vehicleType?.toUpperCase()} - {driver.vehicleNo}
            </div>
          )}
          
          {driver.currentMetroBooth && (
            <div className="text-sm text-blue-600">
              📍 {driver.currentMetroBooth}
            </div>
          )}
          
          {driver.totalRides && (
            <div className="text-xs text-gray-500">
              Total Rides: {driver.totalRides}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverStatusIndicator;