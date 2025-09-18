import React, { useState } from 'react';
import { 
  FiUser, 
  FiMapPin, 
  FiTruck, 
  FiDollarSign,
  FiPlay,
  FiSquare,
  FiList,
  FiChevronUp
} from 'react-icons/fi';
import DriverBottomSheet from './DriverBottomSheet';

const ActiveRidePanel = ({
  activeRide,
  otpInput = '',
  showOTPInput = null,
  rideError = '',
  onOTPInputChange,
  onStartRide,
  onEndRide,
  onOTPVerification,
  onCancelOTP,
  onCollectPayment,
  className = ''
}) => {
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  console.log('🔄 [ActiveRidePanel] Rendering with props:', {
    activeRide: activeRide ? {
      id: activeRide._id,
      status: activeRide.status,
      rideId: activeRide.rideId
    } : null,
    showOTPInput: showOTPInput,
    otpInput: otpInput,
    rideError: rideError,
    onStartRide: !!onStartRide
  });

  // Additional debug for OTP input visibility
  if (showOTPInput) {
    console.log('✅ [ActiveRidePanel] OTP Input SHOULD BE VISIBLE:', {
      showOTPInput: showOTPInput,
      type: showOTPInput.type,
      label: showOTPInput.label
    });
  } else {
    console.log('❌ [ActiveRidePanel] OTP Input is HIDDEN (showOTPInput is null/false)');
  }

  
  if (!activeRide) {
    return (
      <div className={`bg-white rounded-xl shadow-lg border border-gray-200 p-4 text-center ${className}`}>
        <div className="text-gray-500">
          <FiTruck className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">No active ride</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'driver_assigned': return 'bg-blue-500';
      case 'ride_started': return 'bg-green-500';
      case 'ride_ended': return 'bg-yellow-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status) => {
    return status?.replace('_', ' ').toUpperCase() || 'UNKNOWN';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVehicleIcon = (vehicleType) => {
    switch(vehicleType?.toLowerCase()) {
      case 'bike': return '🏍️';
      case 'auto': return '🛺';
      case 'car': return '🚗';
      default: return '🚗';
    }
  };

  // Helper function to get driver's earnings (base fare only, no GST/commission)
  const getDriverEarnings = (ride) => {
    // Priority 1: Use driverFare field (most accurate - what driver actually earns)
    if (ride.driverFare && ride.driverFare > 0) {
      return ride.driverFare;
    }

    // TEMPORARY FALLBACK: For existing ride requests without driverFare field
    // This handles the transition period until all new requests have driverFare
    if (ride.fare && ride.fare > 0) {
      console.warn(`[ActiveRidePanel] Using fallback fare for ride ${ride._id} - driverFare missing`);
      return ride.fare;
    }

    if (ride.estimatedFare && ride.estimatedFare > 0) {
      console.warn(`[ActiveRidePanel] Using fallback estimatedFare for ride ${ride._id} - driverFare missing`);
      return ride.estimatedFare;
    }

    // Log warning if no fare data available
    if (ride && ride._id) {
      console.warn(`[ActiveRidePanel] No fare data available for ride ${ride._id}:`, {
        rideId: ride._id,
        driverFare: ride.driverFare,
        fare: ride.fare,
        estimatedFare: ride.estimatedFare,
        status: ride.status
      });
    }

    return 0;
  };

  const handleMoreDetails = () => {
    setShowBottomSheet(true);
  };

  const renderQuickActions = () => {
    const status = activeRide.status;
    
    if (status === 'driver_assigned') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => {
              console.log('🚀 [ActiveRidePanel] Start Ride button clicked!', {
                activeRide: activeRide,
                onStartRide: onStartRide,
                showOTPInput: showOTPInput,
                timestamp: new Date().toISOString()
              });
              if (onStartRide) {
                console.log('📞 [ActiveRidePanel] Calling onStartRide callback...');
                onStartRide();
              } else {
                console.error('❌ [ActiveRidePanel] onStartRide callback is not defined!');
              }
            }}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white min-h-[40px] px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            <FiPlay className="w-4 h-4" />
            <span>Start Ride</span>
          </button>
          <button
            onClick={handleMoreDetails}
            className="min-h-[40px] min-w-[40px] bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 flex items-center justify-center"
          >
            <FiChevronUp className="w-4 h-4" />
          </button>
        </div>
      );
    } else if (status === 'ride_started') {
      return (
        <div className="flex gap-2">
          <button
            onClick={onEndRide}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white min-h-[40px] px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            <FiSquare className="w-4 h-4" />
            <span>End Ride</span>
          </button>
          <button
            onClick={handleMoreDetails}
            className="min-h-[40px] min-w-[40px] bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 flex items-center justify-center"
          >
            <FiChevronUp className="w-4 h-4" />
          </button>
        </div>
      );
    } else if (status === 'ride_ended') {
      return (
        <div className="flex gap-2">
          <button
            onClick={onCollectPayment}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white min-h-[40px] px-3 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            <FiDollarSign className="w-4 h-4" />
            <span>Complete</span>
          </button>
          <button
            onClick={handleMoreDetails}
            className="min-h-[40px] min-w-[40px] bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 flex items-center justify-center"
          >
            <FiChevronUp className="w-4 h-4" />
          </button>
        </div>
      );
    }
    
    return (
      <button
        onClick={handleMoreDetails}
        className="w-full min-h-[40px] py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
      >
        <FiList className="w-4 h-4" />
        <span>View Details</span>
      </button>
    );
  };

  const renderBottomSheetContent = () => (
    <div className="space-y-6">
      {/* Customer Info */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FiUser className="w-5 h-5" />
          Customer Information
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Name:</span>
            <span className="font-medium">{activeRide.userName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Phone:</span>
            <span className="font-medium">{activeRide.userPhone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Ride ID:</span>
            <span className="font-medium text-sm">{activeRide.rideId || activeRide._id}</span>
          </div>
        </div>
      </div>

      {/* Trip Details */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <FiMapPin className="w-5 h-5" />
          Trip Details
        </h3>
        
        {/* Pickup Location */}
        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
          <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
          <div className="flex-1">
            <div className="text-sm text-green-700 font-medium">Pickup</div>
            <div className="text-gray-900">{activeRide.pickupLocation?.boothName}</div>
          </div>
        </div>
        
        {/* Drop Location */}
        <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
          <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
          <div className="flex-1">
            <div className="text-sm text-red-700 font-medium">Drop</div>
            <div className="text-gray-900">{activeRide.dropLocation?.address}</div>
          </div>
        </div>
      </div>

      {/* Trip Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-gray-600 text-sm mb-1">Vehicle</div>
          <div className="font-medium">
            {getVehicleIcon(activeRide.vehicleType)} {activeRide.vehicleType?.toUpperCase()}
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-gray-600 text-sm mb-1">Fare</div>
          <div className="font-medium text-green-600">₹{getDriverEarnings(activeRide)}</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-gray-600 text-sm mb-1">Distance</div>
          <div className="font-medium">{activeRide.distance || 'N/A'}km</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-gray-600 text-sm mb-1">Time</div>
          <div className="font-medium">{formatTime(activeRide.timestamp)}</div>
        </div>
      </div>

      {/* OTP Section */}
      {showOTPInput && (
        <div className="bg-blue-50 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-3">{showOTPInput.label}</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={otpInput}
              onChange={(e) => onOTPInputChange(e.target.value)}
              placeholder="Enter 4-digit OTP"
              className="w-full p-3 border border-blue-200 rounded-lg text-center text-lg font-mono"
              maxLength="4"
            />
            <div className="flex gap-2">
              <button
                onClick={onOTPVerification}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Verify OTP
              </button>
              <button
                onClick={onCancelOTP}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {rideError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 text-sm">{rideError}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {renderQuickActions()}
      </div>
    </div>
  );

  return (
    <>
      {/* Compact Card View */}
      <div className={`bg-white rounded-xl shadow-lg border border-gray-200 driver-ride-card ${className}`}>
        {/* Status Header */}
        <div className={`${getStatusColor(activeRide.status)} text-white px-3 py-2 rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="font-semibold text-sm">{getStatusText(activeRide.status)}</span>
            </div>
            <span className="text-xs opacity-90">
              #{activeRide.boothRideNumber || activeRide.rideId?.slice(-4)}
            </span>
          </div>
        </div>

        <div className="p-3">
          {/* Compact Customer & Fare Info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <FiUser className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{activeRide.userName}</div>
                <div className="text-xs text-gray-600">{activeRide.userPhone}</div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold text-green-600">₹{getDriverEarnings(activeRide)}</div>
              <div className="text-xs text-gray-500">{activeRide.distance || 'N/A'}km</div>
            </div>
          </div>

          {/* Compact Location Info */}
          <div className="space-y-1 mb-3">
            <div className="flex items-start gap-2 text-xs">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-0.5 flex-shrink-0"></div>
              <span className="text-gray-600">From:</span>
              <span className="font-medium text-gray-900 truncate flex-1">{activeRide.pickupLocation?.boothName}</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-0.5 flex-shrink-0"></div>
              <span className="text-gray-600">To:</span>
              <span className="font-medium text-gray-900 truncate flex-1">{activeRide.dropLocation?.address}</span>
            </div>
          </div>

          {/* OTP Input Section - Compact for mobile */}
          {showOTPInput && (
            <div 
              className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-3 animate-pulse"
              ref={(el) => {
                if (el) {
                  setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }
              }}
            >
              {console.log('🎯 [ActiveRidePanel] Rendering OTP input in main view')}              <h3 className="font-semibold text-blue-900 mb-2 text-sm flex items-center gap-1">
                <span className="text-base">🔐</span> {showOTPInput.label}
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => onOTPInputChange(e.target.value)}
                  placeholder="Enter 4-digit OTP"
                  className="w-full p-2.5 border border-blue-300 rounded-lg text-center text-base font-mono focus:border-blue-500 focus:outline-none"
                  maxLength="4"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={onOTPVerification}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg font-medium text-sm transition-colors"
                  >
                    Verify OTP
                  </button>
                  <button
                    onClick={onCancelOTP}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message - Compact */}
          {rideError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
              <div className="text-red-800 text-xs">{rideError}</div>
            </div>
          )}

          {/* Quick Actions */}
          {renderQuickActions()}
        </div>
      </div>

      {/* Bottom Sheet for Details */}
      <DriverBottomSheet
        isOpen={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        title="Active Ride Details"
        minHeight={400}
      >
        {renderBottomSheetContent()}
      </DriverBottomSheet>
    </>
  );
};

export default ActiveRidePanel;