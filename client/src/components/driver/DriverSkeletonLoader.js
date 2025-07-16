import React from 'react';

export const DriverRideCardSkeleton = ({ className = '' }) => (
  <div className={`driver-skeleton-card ${className}`}>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 driver-skeleton rounded-full"></div>
          <div className="space-y-2">
            <div className="driver-skeleton-text w-24"></div>
            <div className="driver-skeleton-text w-16"></div>
          </div>
        </div>
        <div className="text-right">
          <div className="driver-skeleton-text w-16 mb-1"></div>
          <div className="driver-skeleton-text w-12"></div>
        </div>
      </div>

      {/* Trip Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 driver-skeleton rounded-full"></div>
          <div className="driver-skeleton-text w-32"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 driver-skeleton rounded-full"></div>
          <div className="driver-skeleton-text w-40"></div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <div className="flex-1 h-12 driver-skeleton rounded-lg"></div>
        <div className="flex-1 h-12 driver-skeleton rounded-lg"></div>
      </div>
    </div>
  </div>
);

export const DriverStatusSkeleton = ({ className = '' }) => (
  <div className={`driver-skeleton-card ${className}`}>
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="driver-skeleton-text w-24"></div>
        <div className="w-16 h-8 driver-skeleton rounded-full"></div>
      </div>

      {/* Vehicle Selection */}
      <div className="space-y-2">
        <div className="driver-skeleton-text w-20"></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 driver-skeleton rounded-lg"></div>
          <div className="h-16 driver-skeleton rounded-lg"></div>
          <div className="h-16 driver-skeleton rounded-lg"></div>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <div className="driver-skeleton-text w-28"></div>
        <div className="h-12 driver-skeleton rounded-lg"></div>
      </div>

      {/* Go Online Button */}
      <div className="h-12 driver-skeleton rounded-lg"></div>
    </div>
  </div>
);

export const DriverHistorySkeleton = ({ count = 3, className = '' }) => (
  <div className={`space-y-4 ${className}`}>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="driver-skeleton-card">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="driver-skeleton-text w-20"></div>
            <div className="driver-skeleton-text w-16"></div>
          </div>

          {/* Trip Details */}
          <div className="space-y-2">
            <div className="driver-skeleton-text w-full"></div>
            <div className="driver-skeleton-text w-3/4"></div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="driver-skeleton-text w-12 mx-auto mb-1"></div>
              <div className="driver-skeleton-text w-8 mx-auto"></div>
            </div>
            <div className="text-center">
              <div className="driver-skeleton-text w-12 mx-auto mb-1"></div>
              <div className="driver-skeleton-text w-8 mx-auto"></div>
            </div>
            <div className="text-center">
              <div className="driver-skeleton-text w-12 mx-auto mb-1"></div>
              <div className="driver-skeleton-text w-8 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const DriverStatsSkeleton = ({ className = '' }) => (
  <div className={`driver-skeleton-card ${className}`}>
    <div className="space-y-4">
      {/* Title */}
      <div className="driver-skeleton-text w-32"></div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="driver-skeleton-text w-16 mx-auto mb-2"></div>
          <div className="driver-skeleton-text w-12 mx-auto"></div>
        </div>
        <div className="text-center">
          <div className="driver-skeleton-text w-16 mx-auto mb-2"></div>
          <div className="driver-skeleton-text w-12 mx-auto"></div>
        </div>
        <div className="text-center">
          <div className="driver-skeleton-text w-16 mx-auto mb-2"></div>
          <div className="driver-skeleton-text w-12 mx-auto"></div>
        </div>
        <div className="text-center">
          <div className="driver-skeleton-text w-16 mx-auto mb-2"></div>
          <div className="driver-skeleton-text w-12 mx-auto"></div>
        </div>
      </div>
    </div>
  </div>
);

export const DriverDashboardSkeleton = ({ className = '' }) => (
  <div className={`space-y-6 ${className}`}>
    <DriverStatusSkeleton />
    <DriverStatsSkeleton />
    <div className="driver-skeleton-card">
      <div className="space-y-3">
        <div className="driver-skeleton-text w-40"></div>
        <div className="driver-skeleton-text w-full"></div>
        <div className="driver-skeleton-text w-3/4"></div>
      </div>
    </div>
  </div>
);

export const DriverLoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  return (
    <div className={`${sizeClasses[size]} border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin ${className}`} />
  );
};

export const DriverEmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  actionText,
  onAction,
  className = '' 
}) => (
  <div className={`text-center py-12 ${className}`}>
    <div className="text-gray-400 mb-4">
      {Icon && <Icon className="w-16 h-16 mx-auto mb-4" />}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 max-w-sm mx-auto">{description}</p>
    </div>
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="mt-6 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
      >
        {actionText}
      </button>
    )}
  </div>
);

export const DriverConnectionStatus = ({ 
  isConnected, 
  isOnline, 
  className = '' 
}) => (
  <div className={`flex items-center gap-2 text-sm ${className}`}>
    <div className={`w-2 h-2 rounded-full ${
      isConnected ? 'bg-green-500' : 'bg-red-500'
    }`} />
    <span className={`font-medium ${
      isConnected ? 'text-green-600' : 'text-red-600'
    }`}>
      {isConnected ? 'Connected' : 'Disconnected'}
    </span>
    {isConnected && (
      <>
        <span className="text-gray-400">•</span>
        <span className={`font-medium ${
          isOnline ? 'text-blue-600' : 'text-gray-600'
        }`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </>
    )}
  </div>
);

export default {
  DriverRideCardSkeleton,
  DriverStatusSkeleton,
  DriverHistorySkeleton,
  DriverStatsSkeleton,
  DriverDashboardSkeleton,
  DriverLoadingSpinner,
  DriverEmptyState,
  DriverConnectionStatus
};