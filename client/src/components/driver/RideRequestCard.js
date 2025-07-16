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

  const handleAccept = () => {
    if (onAccept && !isAccepting) {
      onAccept(request);
    }
  };

  const handleDecline = () => {
    if (onDecline) {
      onDecline(request._id);
    }
  };

  const cardContent = (
    <>
      {/* Ride Number Badge */}
      {request.boothRideNumber && (
        <div className="bg-blue-500 text-white px-4 py-2 rounded-t-xl text-center font-bold text-lg">
          Ride #{request.boothRideNumber}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Header with User Info and Fare */}
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <FiUser className="w-4 h-4 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 text-base truncate">{request.userName}</h4>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <FiPhone className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{request.userPhone}</span>
            </div>
          </div>
          
          <div className="text-right flex-shrink-0">
            <div className="text-xl font-bold text-green-600 flex items-center gap-1">
              <FiDollarSign className="w-4 h-4" />
              ₹{request.fare || request.estimatedFare}
            </div>
            <div className="text-xs text-gray-500 mt-1 truncate max-w-[120px] sm:max-w-[80px]">
              ID: {request.requestNumber || request.rideId}
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="space-y-3">
          {/* Pickup Location */}
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-500 font-medium">Pickup</div>
              <div className="font-semibold text-gray-900 text-sm line-clamp-2">
                {request.pickupLocation?.boothName}
              </div>
            </div>
          </div>
          
          {/* Drop Location */}
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-500 font-medium">Drop</div>
              <div className="font-semibold text-gray-900 text-sm line-clamp-2">
                {request.dropLocation?.address}
              </div>
            </div>
          </div>
        </div>

        {/* Trip Info Grid */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-600 text-xs mb-1">
              <FiTruck className="w-3 h-3" />
              <span className="hidden sm:inline">Vehicle</span>
            </div>
            <div className="font-semibold text-gray-900 text-sm">
              <span className="text-base">{getVehicleIcon(request.vehicleType)}</span>
              <span className="ml-1 hidden sm:inline">{request.vehicleType?.toUpperCase()}</span>
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-600 text-xs mb-1">
              <FiNavigation className="w-3 h-3" />
              <span className="hidden sm:inline">Distance</span>
            </div>
            <div className="font-semibold text-gray-900 text-sm">{request.distance}km</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-600 text-xs mb-1">
              <FiClock className="w-3 h-3" />
              <span className="hidden sm:inline">Time</span>
            </div>
            <div className="font-semibold text-gray-900 text-sm">{formatTime(request.timestamp)}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAccept();
            }}
            disabled={isAccepting}
            className={`flex-1 py-4 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 min-h-[48px] touch-manipulation ${
              isAccepting 
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white'
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
              handleDecline();
            }}
            disabled={isAccepting}
            className="flex-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white py-4 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
          >
            <FiX className="w-4 h-4" />
            Decline
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div 
      onClick={() => onSelect && onSelect(request)}
      className={`
        bg-white rounded-2xl border-2 transition-all duration-200 cursor-pointer
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200' 
          : 'border-gray-200 hover:border-blue-300 shadow-md hover:shadow-lg'
        }
        ${className}
      `}
    >
      {cardContent}
    </div>
  );
};

export default RideRequestCard;