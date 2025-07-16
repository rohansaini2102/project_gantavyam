import React, { useState } from 'react';
import { 
  FiUser, 
  FiPhone, 
  FiMapPin, 
  FiNavigation, 
  FiTruck, 
  FiClock, 
  FiDollarSign,
  FiPlay,
  FiSquare,
  FiCheckCircle,
  FiX,
  FiList
} from 'react-icons/fi';

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
  if (!activeRide) {
    return null;
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

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-t-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FiNavigation className="w-5 h-5 text-green-500" />
            Active Ride
          </h3>
          
          {/* Status Badge */}
          <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getStatusColor(activeRide.status)}`}>
            {getStatusText(activeRide.status)}
          </span>
        </div>

        {/* Ride Number */}
        {activeRide.boothRideNumber && (
          <div className="bg-yellow-400 text-black px-4 py-2 rounded-lg text-center font-bold text-lg mb-4">
            Ride #{activeRide.boothRideNumber}
          </div>
        )}

        {/* Queue Information */}
        {activeRide.queueNumber && (
          <div className="bg-green-100 border-2 border-green-500 text-green-800 p-4 rounded-lg text-center mb-4">
            <div className="text-lg font-bold mb-1 flex items-center justify-center gap-2">
              <FiList className="w-5 h-5" />
              Queue: {activeRide.queueNumber}
            </div>
            <div className="text-base mb-1">
              Position: #{activeRide.queuePosition}
            </div>
            {activeRide.totalInQueue > 0 && (
              <div className="text-sm text-green-600">
                {activeRide.totalInQueue} rides in queue
              </div>
            )}
            <div className="text-sm font-medium mt-2">
              📍 {activeRide.boothName || activeRide.pickupStation}
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {/* Error Message */}
        {rideError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {rideError}
          </div>
        )}

        {/* Rider Information */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <FiUser className="w-4 h-4" />
            Rider Information
          </h4>
          
          <div className="space-y-2">
            <div className="text-lg font-semibold text-gray-900">
              {activeRide.userName || 'Unknown Rider'}
            </div>
            
            {activeRide.userPhone && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600">
                  <FiPhone className="w-4 h-4" />
                  {activeRide.userPhone}
                </span>
                <a 
                  href={`tel:${activeRide.userPhone}`}
                  className="px-3 py-1 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600 transition-colors"
                >
                  Call Rider
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Trip Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <FiMapPin className="w-4 h-4" />
            Trip Details
          </h4>
          
          <div className="space-y-3">
            {/* Pickup */}
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
              <div>
                <div className="text-sm text-gray-500">Pickup</div>
                <div className="font-medium text-gray-900">
                  {activeRide.pickupLocation?.boothName || 
                   activeRide.pickupLocation?.stationName || 
                   activeRide.pickupStation || 
                   'Location not specified'}
                </div>
              </div>
            </div>
            
            {/* Drop */}
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
              <div>
                <div className="text-sm text-gray-500">Drop</div>
                <div className="font-medium text-gray-900">
                  {activeRide.dropLocation?.address || 'Destination not specified'}
                </div>
              </div>
            </div>
            
            {/* Vehicle & Distance */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <FiTruck className="w-3 h-3" />
                  Vehicle
                </div>
                <div className="font-medium text-gray-900">
                  {activeRide.vehicleType?.toUpperCase() || 'Not specified'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <FiNavigation className="w-3 h-3" />
                  Distance
                </div>
                <div className="font-medium text-gray-900">
                  {activeRide.distance ? `${activeRide.distance}km` : 'Calculating...'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fare Display */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center mb-4">
          <div className="text-sm text-yellow-700 mb-1">Total Fare</div>
          <div className="text-2xl font-bold text-yellow-800 flex items-center justify-center gap-1">
            <FiDollarSign className="w-5 h-5" />
            ₹{activeRide.fare || activeRide.estimatedFare}
          </div>
        </div>

        {/* Action Buttons based on Status */}
        <div className="space-y-3">
          {activeRide.status === 'driver_assigned' && (
            <button
              onClick={onStartRide}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FiPlay className="w-4 h-4" />
              Start Ride (Verify Start OTP)
            </button>
          )}

          {activeRide.status === 'ride_started' && (
            <button
              onClick={onEndRide}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FiSquare className="w-4 h-4" />
              Complete Ride (Verify End OTP)
            </button>
          )}

          {/* Status Messages */}
          {activeRide.status === 'ride_ended' && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg text-center">
              <div className="font-medium mb-1">🏁 Ride Ended - Processing...</div>
              <div className="text-sm">Payment collection and ride completion in progress</div>
            </div>
          )}

          {activeRide.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-center">
              <div className="font-medium mb-1 flex items-center justify-center gap-2">
                <FiCheckCircle className="w-5 h-5" />
                Ride Completed Successfully!
              </div>
              <div className="text-sm mb-1">
                Payment: ₹{activeRide.actualFare || activeRide.fare || activeRide.estimatedFare} (Cash)
              </div>
              <div className="text-xs text-green-600">
                Ride data saved to history. Dashboard will clear automatically.
              </div>
            </div>
          )}
        </div>

        {/* OTP Input Interface */}
        {showOTPInput && (
          <div className={`mt-4 p-4 rounded-lg border-2 ${
            showOTPInput.type === 'start' 
              ? 'bg-green-50 border-green-500' 
              : 'bg-yellow-50 border-yellow-500'
          }`}>
            <div className="text-center mb-4">
              <div className="font-bold text-lg text-gray-900 mb-2">
                {showOTPInput.type === 'start' ? '🚀 Start Ride Verification' : '🏁 End Ride Verification'}
              </div>
              <div className="text-sm text-gray-600">
                {showOTPInput.type === 'start' ? 
                  'Ask the rider for their Start OTP to begin the ride' : 
                  'Ask the rider for their End OTP to complete the ride'
                }
              </div>
            </div>
            
            <div className="flex gap-3 items-center mb-4">
              <input
                type="text"
                value={otpInput}
                onChange={(e) => onOTPInputChange && onOTPInputChange(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Enter 4-digit OTP"
                maxLength="4"
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-lg font-bold tracking-widest focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-opacity-20"
                autoFocus
              />
              <button
                onClick={onOTPVerification}
                disabled={otpInput.length !== 4}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  otpInput.length === 4
                    ? 'bg-sky-500 hover:bg-sky-600 text-white'
                    : 'bg-gray-400 text-white cursor-not-allowed'
                }`}
              >
                Verify
              </button>
            </div>
            
            <div className="text-center">
              <button
                onClick={onCancelOTP}
                className="px-4 py-2 text-gray-600 bg-transparent border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveRidePanel;