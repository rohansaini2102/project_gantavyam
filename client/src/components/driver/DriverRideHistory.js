import React from 'react';
import { 
  FiClock, 
  FiUser, 
  FiMapPin, 
  FiTruck, 
  FiDollarSign, 
  FiCheckCircle, 
  FiXCircle,
  FiMoreHorizontal,
  FiFilter
} from 'react-icons/fi';

const DriverRideHistory = ({
  rideHistory = [],
  historyLoading = false,
  historyError = '',
  historyHasMore = false,
  historyFilter = 'all',
  onFilterChange,
  onLoadMore,
  className = ''
}) => {
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  // Helper function to get driver's earnings (base fare only, no GST/commission)
  const getDriverEarnings = (ride) => {
    // Priority 1: Use driverFare field if available
    if (ride.driverFare && ride.driverFare > 0) {
      return ride.driverFare;
    }

    // Priority 2: Calculate pure base fare from distance and vehicle type
    if (ride.distance && ride.vehicleType) {
      return calculatePureBaseFare(ride.distance, ride.vehicleType);
    }

    // Priority 3: Use existing fare field (often contains driver earnings in older data)
    if (ride.fare && ride.fare > 0) {
      // For legacy data, fare field often contains driver earnings
      return ride.fare;
    }

    // Priority 4: Reverse calculate from customer total (conservative estimate)
    if (ride.estimatedFare && ride.estimatedFare > 0) {
      // Remove estimated surge + commission + GST (divide by ~1.7)
      return Math.round(ride.estimatedFare / 1.7);
    }

    // Priority 5: Use actualFare as last resort
    if (ride.actualFare && ride.actualFare > 0) {
      return Math.round(ride.actualFare / 1.7);
    }

    // Last resort: return minimum fare for vehicle type
    return getMinimumFareForVehicle(ride.vehicleType || 'auto');
  };

  // Calculate pure base fare based on distance and vehicle type
  const calculatePureBaseFare = (distance, vehicleType) => {
    const fareConfig = {
      auto: { baseFare: 40, baseKm: 2, perKmRate: 17, minFare: 40 },
      bike: { baseFare: 25, baseKm: 2, perKmRate: 12, minFare: 25 },
      car: { baseFare: 60, baseKm: 2, perKmRate: 20, minFare: 60 }
    };

    const config = fareConfig[vehicleType] || fareConfig.auto;
    let fare = config.baseFare;

    if (distance > config.baseKm) {
      fare += (distance - config.baseKm) * config.perKmRate;
    }

    return Math.max(Math.round(fare), config.minFare);
  };

  // Get minimum fare for vehicle type
  const getMinimumFareForVehicle = (vehicleType) => {
    const minFares = {
      auto: 40,
      bike: 25,
      car: 60
    };
    return minFares[vehicleType] || 40;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: <FiCheckCircle className="w-3 h-3" />
      },
      cancelled: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: <FiXCircle className="w-3 h-3" />
      },
      default: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        icon: <FiMoreHorizontal className="w-3 h-3" />
      }
    };

    const config = statusConfig[status] || statusConfig.default;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        {status?.toUpperCase() || 'UNKNOWN'}
      </span>
    );
  };

  const filterOptions = [
    { value: 'all', label: 'All Rides' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FiClock className="w-5 h-5 text-sky-500" />
            Ride History ({rideHistory.length} rides)
          </h3>
          
          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <FiFilter className="w-4 h-4 text-gray-500" />
            <select
              value={historyFilter}
              onChange={(e) => onFilterChange && onFilterChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {filterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {historyError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {historyError}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {historyLoading && rideHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <FiClock className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600">Loading ride history...</p>
          </div>
        ) : rideHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiClock className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Rides Yet</h4>
            <p className="text-gray-600">Start accepting rides to build your history!</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Ride ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Passenger</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Route</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Vehicle</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Fare</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rideHistory.map((ride, index) => {
                      const { date, time } = formatDate(ride.timestamps?.requested || ride.createdAt);
                      
                      return (
                        <tr 
                          key={ride._id || index}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">{date}</div>
                            <div className="text-xs text-gray-500">{time}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">#{ride.boothRideNumber}</div>
                            <div className="text-xs text-gray-500">{ride.rideId}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {ride.user?.name || ride.userName || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {ride.user?.mobileNo || ride.userPhone || ''}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {ride.pickupLocation?.boothName}
                            </div>
                            <div className="text-xs text-gray-500">
                              to {ride.dropLocation?.address?.substring(0, 30)}...
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-gray-900 uppercase">
                              {ride.vehicleType}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-bold text-green-600">₹{getDriverEarnings(ride)}</div>
                            <div className="text-xs text-gray-500">Your earnings</div>
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(ride.status)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-900">
                              {ride.journeyStats?.rideDuration ? `${ride.journeyStats.rideDuration} min` : '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {rideHistory.map((ride, index) => {
                const { date, time } = formatDate(ride.timestamps?.requested || ride.createdAt);
                
                return (
                  <div key={ride._id || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-900">#{ride.boothRideNumber}</div>
                        <div className="text-sm text-gray-500">{date} at {time}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">₹{getDriverEarnings(ride)}</div>
                        <div className="text-xs text-gray-500">Your earnings</div>
                        {getStatusBadge(ride.status)}
                      </div>
                    </div>

                    {/* Passenger Info */}
                    <div className="flex items-center gap-2 mb-2">
                      <FiUser className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {ride.user?.name || ride.userName || 'Unknown'}
                      </span>
                      {ride.user?.mobileNo || ride.userPhone ? (
                        <span className="text-xs text-gray-500">
                          • {ride.user?.mobileNo || ride.userPhone}
                        </span>
                      ) : null}
                    </div>

                    {/* Route */}
                    <div className="flex items-start gap-2 mb-2">
                      <FiMapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {ride.pickupLocation?.boothName}
                        </div>
                        <div className="text-xs text-gray-500">
                          to {ride.dropLocation?.address}
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <FiTruck className="w-3 h-3" />
                          {ride.vehicleType?.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1">
                          <FiClock className="w-3 h-3" />
                          {ride.journeyStats?.rideDuration ? `${ride.journeyStats.rideDuration} min` : '-'}
                        </span>
                      </div>
                      <span className="text-gray-400">{ride.rideId}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {historyHasMore && (
              <div className="mt-6 text-center border-t border-gray-200 pt-6">
                <button
                  onClick={onLoadMore}
                  disabled={historyLoading}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    historyLoading
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-sky-500 hover:bg-sky-600 text-white'
                  }`}
                >
                  {historyLoading ? 'Loading...' : 'Load More Rides'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverRideHistory;