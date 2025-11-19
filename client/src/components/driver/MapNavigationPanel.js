import React, { useState } from 'react';
import { FiNavigation, FiX, FiExternalLink, FiMapPin } from 'react-icons/fi';
import DriverBottomSheet from './DriverBottomSheet';
import RoutePreviewMap from './RoutePreviewMap';
import {
  formatDistance,
  formatDuration,
  getEstimatedArrival,
  openGoogleMapsNavigation,
} from '../../services/mapNavigationService';

/**
 * MapNavigationPanel Component
 * Rich, mobile-friendly navigation panel for drivers
 * Shows route preview, distance, time, and Google Maps integration
 */
function MapNavigationPanel({
  isOpen,
  onClose,
  pickupLocation,
  dropLocation,
  driverLocation,
  rideDetails = {},
}) {
  const [routeInfo, setRouteInfo] = useState(null);

  // Handle route calculation callback
  const handleRouteCalculated = (info) => {
    setRouteInfo(info);
  };

  // Open Google Maps navigation
  const handleOpenGoogleMaps = () => {
    openGoogleMapsNavigation(pickupLocation, dropLocation);
  };

  // Format locations for display
  const pickupAddress = pickupLocation?.boothName || pickupLocation?.address || 'Pickup Location';
  const dropAddress = dropLocation?.address || 'Drop Location';

  // Calculate display values
  const distance = routeInfo?.distance
    ? formatDistance(routeInfo.distance)
    : rideDetails.distance
    ? `${rideDetails.distance} km`
    : '--';

  const duration = routeInfo?.duration
    ? formatDuration(routeInfo.duration)
    : '--';

  const eta = routeInfo?.duration
    ? getEstimatedArrival(routeInfo.duration)
    : '--';

  return (
    <DriverBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Route Navigation"
      minHeight={500}
      showHandle={true}
      closeOnOverlayClick={true}
    >
      <div className="flex flex-col h-full">
        {/* Header - Distance/Time Summary */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FiNavigation className="w-5 h-5" />
            <span className="font-bold text-base">Route Preview</span>
          </div>
          <div className="text-sm font-semibold">
            {distance} {routeInfo && `• ${duration}`}
          </div>
        </div>

        {/* Google Map - Reduced height for better button visibility */}
        <div className="h-48 sm:h-64 relative bg-gray-100">
          {pickupLocation && dropLocation ? (
            <RoutePreviewMap
              pickup={pickupLocation}
              drop={dropLocation}
              driverLocation={driverLocation}
              onRouteCalculated={handleRouteCalculated}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FiMapPin className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Location data not available</p>
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {/* Pickup Location */}
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200 shadow-sm">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-green-700 mb-1">PICKUP</div>
              <div className="font-semibold text-gray-900 text-sm leading-snug">
                {pickupAddress}
              </div>
              {pickupLocation && (
                <div className="text-xs text-gray-500 mt-1">
                  {pickupLocation.latitude?.toFixed(6)}, {pickupLocation.longitude?.toFixed(6)}
                </div>
              )}
            </div>
          </div>

          {/* Drop Location */}
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-red-200 shadow-sm">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-red-700 mb-1">DROP</div>
              <div className="font-semibold text-gray-900 text-sm leading-snug">
                {dropAddress}
              </div>
              {dropLocation && (
                <div className="text-xs text-gray-500 mt-1">
                  {dropLocation.latitude?.toFixed(6)}, {dropLocation.longitude?.toFixed(6)}
                </div>
              )}
            </div>
          </div>

          {/* PRIMARY ACTION: Open in Google Maps - ALWAYS VISIBLE */}
          <div className="space-y-2">
            <button
              onClick={handleOpenGoogleMaps}
              className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white py-4 px-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 min-h-[56px] touch-manipulation transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              <FiExternalLink className="w-6 h-6" />
              <span>Open in Google Maps</span>
            </button>
            <div className="text-xs text-center text-gray-600">
              Opens navigation with {(pickupLocation?.latitude === 0 || dropLocation?.latitude === 0) ? 'address search' : 'GPS coordinates'}
            </div>
          </div>

          {/* Trip Statistics Grid */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-center">
              <div className="text-xs text-gray-600 mb-1 font-medium">Distance</div>
              <div className="font-bold text-gray-900 text-base">{distance}</div>
            </div>
            <div className="text-center border-l border-r border-gray-200">
              <div className="text-xs text-gray-600 mb-1 font-medium">Duration</div>
              <div className="font-bold text-gray-900 text-base">{duration}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600 mb-1 font-medium">ETA</div>
              <div className="font-bold text-gray-900 text-base">{eta}</div>
            </div>
          </div>

          {/* Additional Ride Details (if available) */}
          {rideDetails.fare && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
              <div className="font-semibold text-gray-700">Your Earnings</div>
              <div className="text-2xl font-bold text-green-600">₹{rideDetails.fare}</div>
            </div>
          )}

          {/* Info box for missing coordinates */}
          {(!pickupLocation || !dropLocation ||
            (pickupLocation.latitude === 0 && pickupLocation.longitude === 0) ||
            (dropLocation.latitude === 0 && dropLocation.longitude === 0)) && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex gap-2">
                <div className="text-yellow-600 font-bold text-lg">📍</div>
                <div className="flex-1">
                  <div className="font-semibold text-yellow-800 text-sm mb-1">
                    No GPS data available
                  </div>
                  <div className="text-xs text-yellow-700">
                    Route preview unavailable. The button above will search using addresses instead.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-white hover:bg-gray-100 active:bg-gray-200 border-2 border-gray-300 rounded-lg font-medium text-gray-700 transition-colors duration-200 shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </DriverBottomSheet>
  );
}

export default MapNavigationPanel;
