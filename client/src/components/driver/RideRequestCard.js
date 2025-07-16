import React from 'react';
import { FiPhone, FiMapPin, FiClock, FiNavigation, FiTruck, FiDollarSign, FiUser, FiCheck, FiX } from 'react-icons/fi';

const RideRequestCard = ({
  request,
  isSelected = false,
  isAccepting = false,
  onSelect,
  onAccept,
  onDecline,
  className = ''
}) => {
  const formatTime = (timestamp) => {
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

  return (
    <div 
      onClick={() => onSelect && onSelect(request)}
      className={`
        bg-white rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${isSelected 
          ? 'border-yellow-400 bg-yellow-50 shadow-lg' 
          : 'border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg'
        }
        ${className}
      `}
    >
      {/* Ride Number Badge */}
      {request.boothRideNumber && (
        <div className="bg-sky-500 text-white px-4 py-2 rounded-t-xl text-center font-bold text-lg">
          Ride #{request.boothRideNumber}
        </div>
      )}

      <div className="p-6">
        {/* Header with User Info and Fare */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FiUser className="w-4 h-4 text-gray-500" />
              <h4 className="font-semibold text-gray-900 text-lg">{request.userName}</h4>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <FiPhone className="w-4 h-4" />
              <span>{request.userPhone}</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
              <FiDollarSign className="w-5 h-5" />
              ₹{request.fare || request.estimatedFare}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ID: {request.requestNumber || request.rideId}
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="space-y-3 mb-4">
          {/* Pickup Location */}
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
            <div className="flex-1">
              <div className="text-sm text-gray-500">Pickup</div>
              <div className="font-medium text-gray-900">{request.pickupLocation?.boothName}</div>
            </div>
          </div>
          
          {/* Drop Location */}
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
            <div className="flex-1">
              <div className="text-sm text-gray-500">Drop</div>
              <div className="font-medium text-gray-900">{request.dropLocation?.address}</div>
            </div>
          </div>
        </div>

        {/* Trip Info Grid */}
        <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-600 text-sm mb-1">
              <FiTruck className="w-4 h-4" />
              <span>Vehicle</span>
            </div>
            <div className="font-medium text-gray-900">
              {getVehicleIcon(request.vehicleType)} {request.vehicleType?.toUpperCase()}
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-600 text-sm mb-1">
              <FiNavigation className="w-4 h-4" />
              <span>Distance</span>
            </div>
            <div className="font-medium text-gray-900">{request.distance}km</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-600 text-sm mb-1">
              <FiClock className="w-4 h-4" />
              <span>Time</span>
            </div>
            <div className="font-medium text-gray-900">{formatTime(request.timestamp)}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isAccepting) {
                onAccept && onAccept(request);
              }
            }}
            disabled={isAccepting}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
              isAccepting 
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isAccepting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Accepting...
              </>
            ) : (
              <>
                <FiCheck className="w-4 h-4" />
                Accept
              </>
            )}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDecline && onDecline(request._id);
            }}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <FiX className="w-4 h-4" />
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default RideRequestCard;