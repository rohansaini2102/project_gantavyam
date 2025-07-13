import React, { useState } from 'react';

const ActiveRideTracker = ({ 
  activeRide, 
  showOTP, 
  onCancelRide,
  canCancelRide,
  onReturnToBooking,
  className = '' 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!activeRide) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'driver_assigned': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ride_started': return 'bg-green-100 text-green-800 border-green-200';
      case 'ride_ended': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Finding Driver';
      case 'driver_assigned': return 'Driver Assigned';
      case 'ride_started': return 'Ride in Progress';
      case 'ride_ended': return 'Ride Completed';
      case 'completed': return 'Ride Completed';
      case 'cancelled': return 'Ride Cancelled';
      default: return status;
    }
  };

  const getRideProgress = (status) => {
    const steps = [
      { key: 'pending', label: 'Finding Driver', icon: '🔍' },
      { key: 'driver_assigned', label: 'Driver Assigned', icon: '👤' },
      { key: 'ride_started', label: 'Ride Started', icon: '🚗' },
      { key: 'ride_ended', label: 'Completed', icon: '🏁' }
    ];

    const currentIndex = steps.findIndex(step => step.key === status);
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      current: index === currentIndex
    }));
  };

  const getRideIcon = (vehicleType) => {
    switch (vehicleType) {
      case 'bike': return '🏍️';
      case 'auto': return '🛺';
      case 'car': return '🚗';
      default: return '🚗';
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getRideIcon(activeRide.vehicleType)}</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Active Ride</h3>
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(activeRide.status)}`}>
                {getStatusLabel(activeRide.status)}
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg 
              className={`w-5 h-5 transform transition-transform ${showDetails ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-4">
        {/* Ride ID & Queue Info */}
        <div className="mb-4">
          <div className="text-sm text-gray-600">Ride ID</div>
          <div className="font-mono text-lg font-medium text-gray-900">
            #{activeRide.uniqueRideId || activeRide.rideId}
          </div>
          
          {activeRide.queueNumber && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">Queue Number</div>
                  <div className="text-lg font-bold text-blue-600">{activeRide.queueNumber}</div>
                </div>
                {activeRide.queuePosition && (
                  <div className="text-right">
                    <div className="text-sm text-blue-700">Position</div>
                    <div className="text-lg font-semibold text-blue-600">#{activeRide.queuePosition}</div>
                  </div>
                )}
              </div>
              {activeRide.estimatedWaitTime && (
                <div className="mt-2 text-sm text-blue-700">
                  Estimated wait: {activeRide.estimatedWaitTime} minutes
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-3">Ride Progress</div>
          <div className="flex items-center justify-between">
            {getRideProgress(activeRide.status).map((step, index) => (
              <div key={step.key} className="flex flex-col items-center flex-1">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm
                  ${step.completed 
                    ? step.current 
                      ? 'bg-blue-500 text-white animate-pulse' 
                      : 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {step.completed ? (step.current ? step.icon : '✓') : step.icon}
                </div>
                <div className={`
                  text-xs mt-1 text-center px-1
                  ${step.completed ? 'text-gray-900 font-medium' : 'text-gray-500'}
                `}>
                  {step.label}
                </div>
                {index < getRideProgress(activeRide.status).length - 1 && (
                  <div className={`
                    absolute w-8 h-0.5 mt-4 ml-8
                    ${step.completed ? 'bg-green-500' : 'bg-gray-200'}
                  `} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Driver Info */}
        {activeRide.driverName && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium">
                  {activeRide.driverName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="font-medium text-gray-900">{activeRide.driverName}</div>
                {activeRide.driverPhone && (
                  <div className="text-sm text-gray-600">{activeRide.driverPhone}</div>
                )}
                {activeRide.driverVehicleNo && (
                  <div className="text-sm font-medium text-gray-700">{activeRide.driverVehicleNo}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* OTP Display */}
        {showOTP && (
          <div className={`
            mb-4 p-4 rounded-lg border-2
            ${showOTP.type === 'start' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
            }
          `}>
            <div className="text-center">
              <div className={`
                text-sm font-medium mb-2
                ${showOTP.type === 'start' ? 'text-green-800' : 'text-yellow-800'}
              `}>
                {showOTP.type === 'start' ? '🚀 Start OTP (Give to Driver)' : '🏁 End OTP (For Ride Completion)'}
              </div>
              <div className={`
                text-3xl font-bold tracking-wider
                ${showOTP.type === 'start' ? 'text-green-600' : 'text-yellow-600'}
              `}>
                {showOTP.otp}
              </div>
              <div className={`
                text-xs mt-2
                ${showOTP.type === 'start' ? 'text-green-700' : 'text-yellow-700'}
              `}>
                {showOTP.type === 'start' 
                  ? 'Share this OTP with your driver to start the ride' 
                  : 'Driver will ask for this OTP to complete your ride'
                }
              </div>
            </div>
          </div>
        )}

        {/* Trip Details (Expandable) */}
        {showDetails && (
          <div className="space-y-3 border-t border-gray-200 pt-4">
            <div>
              <div className="text-sm text-gray-600">Pickup</div>
              <div className="font-medium text-gray-900">
                {typeof activeRide.pickupLocation === 'object' 
                  ? activeRide.pickupLocation.boothName 
                  : activeRide.pickupLocation
                }
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600">Destination</div>
              <div className="font-medium text-gray-900">
                {activeRide.dropLocation?.address || activeRide.destination || 'Not specified'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Distance</div>
                <div className="font-medium text-gray-900">{activeRide.distance} km</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Fare</div>
                <div className="font-medium text-gray-900">₹{activeRide.estimatedFare}</div>
              </div>
            </div>

            {activeRide.paymentStatus && (
              <div>
                <div className="text-sm text-gray-600">Payment</div>
                <div className="font-medium text-gray-900 capitalize">{activeRide.paymentStatus}</div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
          {/* Return to Booking for completed/cancelled rides */}
          {(['ride_ended', 'completed', 'cancelled'].includes(activeRide.status)) && onReturnToBooking && (
            <button
              onClick={onReturnToBooking}
              className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              {activeRide.status === 'cancelled' ? 'Book Another Ride' : 'Book New Ride'}
            </button>
          )}
          
          {/* Cancel Button for active rides */}
          {canCancelRide && canCancelRide(activeRide.status) && (
            <>
              <button
                onClick={onCancelRide}
                className="w-full py-2 px-4 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
              >
                Cancel Ride
              </button>
              <div className="text-xs text-gray-500 text-center">
                ⚠️ Cancel before ride starts to avoid charges
              </div>
            </>
          )}
          
          {/* Contact Driver for active rides */}
          {activeRide.driverPhone && ['driver_assigned', 'ride_started'].includes(activeRide.status) && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => window.open(`tel:${activeRide.driverPhone}`)}
                className="py-2 px-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
              >
                📞 Call Driver
              </button>
              <button
                onClick={() => window.open(`sms:${activeRide.driverPhone}`)}
                className="py-2 px-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                💬 Message
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveRideTracker;