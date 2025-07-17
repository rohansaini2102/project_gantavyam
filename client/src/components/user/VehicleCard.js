import React from 'react';

const VehicleCard = ({ 
  vehicle, 
  selected = false, 
  onSelect, 
  price, 
  eta, 
  queueInfo,
  available = true,
  className = ''
}) => {
  const vehicleIcons = {
    bike: '🏍️',
    auto: '🛺',
    car: '🚗'
  };

  const vehicleNames = {
    bike: 'Bike',
    auto: 'Auto',
    car: 'Cab'
  };

  const vehicleDescriptions = {
    bike: 'Quick & affordable',
    auto: 'Comfortable for 3',
    car: 'Spacious & AC'
  };

  const vehicleSubtitles = {
    bike: 'Fastest way to travel',
    auto: 'Most popular choice',
    car: 'Premium comfort ride'
  };

  return (
    <div
      onClick={() => available && onSelect && onSelect(vehicle)}
      className={`
        relative p-4 rounded-xl border transition-all duration-200 cursor-pointer
        ${selected 
          ? 'border-black bg-gray-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
        }
        ${!available ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {/* Vehicle Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Vehicle Icon */}
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl">
            {vehicleIcons[vehicle] || '🚗'}
          </div>

          {/* Vehicle Details */}
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900 text-base">
                {vehicleNames[vehicle] || vehicle}
              </h3>
              <span className="text-sm text-gray-600">
                {vehicleDescriptions[vehicle]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {vehicleSubtitles[vehicle] || 'Available for booking'}
            </p>
          </div>
        </div>

        {/* Price */}
        {price && (
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">
              ₹{price}
            </div>
          </div>
        )}
      </div>

      {/* Queue Information */}
      {queueInfo && (
        <div className="mt-3 p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Queue Position:</span>
            <span className="font-medium text-blue-600">#{queueInfo.position}</span>
          </div>
          {queueInfo.waitTime && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">Estimated Wait:</span>
              <span className="font-medium text-gray-900">{queueInfo.waitTime} mins</span>
            </div>
          )}
        </div>
      )}

      {/* Features/Tags */}
      {vehicle === 'auto' && (
        <div className="mt-3">
          <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute top-3 right-3">
          <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}

      {/* Unavailable Overlay */}
      {!available && (
        <div className="absolute inset-0 bg-gray-100 bg-opacity-75 rounded-2xl flex items-center justify-center">
          <span className="text-gray-600 font-medium">Currently Unavailable</span>
        </div>
      )}
    </div>
  );
};

export default VehicleCard;