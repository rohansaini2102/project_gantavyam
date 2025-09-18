import React, { useState } from 'react';
import { FaMapMarkerAlt, FaUser, FaPhone, FaClock } from 'react-icons/fa';

const MinimalRideCard = ({ ride, onAccept, onReject, isAccepting = false }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [startX, setStartX] = useState(0);

  // Touch handlers for swipe gestures
  const handleTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    
    // Limit swipe distance
    if (Math.abs(diff) < 100) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    // Trigger action if swiped far enough
    if (swipeOffset > 75) {
      onAccept(ride);
    } else if (swipeOffset < -75) {
      onReject(ride);
    }
    
    // Reset swipe
    setSwipeOffset(0);
    setStartX(0);
  };

  // Format distance
  const formatDistance = (distance) => {
    if (!distance) return 'N/A';
    return typeof distance === 'number' ? `${distance.toFixed(1)} km` : distance;
  };

  // Format time
  const formatTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
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
      console.warn(`[MinimalRideCard] Using fallback fare for ride ${ride._id} - driverFare missing`);
      return ride.fare;
    }

    if (ride.estimatedFare && ride.estimatedFare > 0) {
      console.warn(`[MinimalRideCard] Using fallback estimatedFare for ride ${ride._id} - driverFare missing`);
      return ride.estimatedFare;
    }

    // Log warning if no fare data available
    if (ride && ride._id) {
      console.warn(`[MinimalRideCard] No fare data available for ride ${ride._id}:`, {
        rideId: ride._id,
        driverFare: ride.driverFare,
        fare: ride.fare,
        estimatedFare: ride.estimatedFare,
        status: ride.status
      });
    }

    return 0;
  };

  return (
    <div 
      className="minimal-ride-card"
      style={{
        transform: `translateX(${swipeOffset}px)`,
        transition: swipeOffset === 0 ? 'transform 0.3s ease' : 'none',
        opacity: Math.abs(swipeOffset) > 50 ? 0.8 : 1
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with Fare and Distance */}
      <div className="minimal-ride-card-header">
        <div>
          <div className="minimal-ride-fare">
            ₹{getDriverEarnings(ride)}
          </div>
          <div className="minimal-ride-distance">
            {formatDistance(ride.distance)}
          </div>
        </div>
        
        {/* Time if available */}
        {ride.createdAt && (
          <div className="text-gray-500 text-sm flex items-center gap-1">
            <FaClock className="text-xs" />
            {formatTime(ride.createdAt)}
          </div>
        )}
      </div>

      {/* Pickup Location */}
      <div className="minimal-ride-location">
        <FaMapMarkerAlt className="text-green-500 flex-shrink-0" />
        <span className="truncate">
          {ride.pickupLocation?.boothName || 
           ride.pickupStation?.name || 
           ride.pickupLocation || 
           'Pickup location'}
        </span>
      </div>

      {/* Drop Location */}
      <div className="minimal-ride-location">
        <FaMapMarkerAlt className="text-red-500 flex-shrink-0" />
        <span className="truncate">
          {ride.dropLocation?.address || 
           ride.dropoffStation?.name || 
           ride.dropLocation || 
           'Drop location'}
        </span>
      </div>

      {/* Customer Info (if available) */}
      {(ride.userName || ride.customerName || ride.userPhone) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          {(ride.userName || ride.customerName) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FaUser className="text-xs" />
              <span>{ride.userName || ride.customerName}</span>
            </div>
          )}
          
          {ride.userPhone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FaPhone className="text-xs" />
              <span>{ride.userPhone}</span>
            </div>
          )}
        </div>
      )}

      {/* Vehicle Type Badge */}
      {ride.vehicleType && (
        <div className="inline-block mt-2">
          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full uppercase">
            {ride.vehicleType}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="minimal-ride-actions">
        <button
          onClick={() => onAccept(ride)}
          disabled={isAccepting}
          className="minimal-btn minimal-btn-accept"
        >
          {isAccepting ? 'Accepting...' : '✓ Accept'}
        </button>
        
        <button
          onClick={() => onReject(ride)}
          disabled={isAccepting}
          className="minimal-btn minimal-btn-reject"
        >
          ✕ Reject
        </button>
      </div>

      {/* Swipe Hint */}
      <div className="text-center text-xs text-gray-400 mt-2">
        Swipe right to accept, left to reject
      </div>
    </div>
  );
};

export default MinimalRideCard;