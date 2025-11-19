/**
 * Map Navigation Service
 * Helper functions for Google Maps navigation and route management
 */

/**
 * Generate Google Maps URL for external navigation
 * Opens in Google Maps app on mobile, or web on desktop
 * @param {Object} pickup - Pickup location {latitude, longitude, boothName, address}
 * @param {Object} drop - Drop location {latitude, longitude, address}
 * @returns {string} Google Maps URL
 */
export function generateGoogleMapsUrl(pickup, drop) {
  if (!pickup || !drop) {
    console.error('Invalid location data for Google Maps URL');
    return '';
  }

  const baseUrl = 'https://www.google.com/maps/dir/';

  // Check if we have valid coordinates (not 0,0)
  const hasValidPickupCoords = pickup.latitude && pickup.longitude &&
                                pickup.latitude !== 0 && pickup.longitude !== 0;
  const hasValidDropCoords = drop.latitude && drop.longitude &&
                              drop.latitude !== 0 && drop.longitude !== 0;

  let origin, destination;

  // Use coordinates if valid, otherwise use address
  if (hasValidPickupCoords) {
    origin = `${pickup.latitude},${pickup.longitude}`;
  } else {
    origin = pickup.boothName || pickup.address || 'Current Location';
  }

  if (hasValidDropCoords) {
    destination = `${drop.latitude},${drop.longitude}`;
  } else {
    destination = drop.address || 'Destination';
  }

  const params = new URLSearchParams({
    api: '1',
    origin: origin,
    destination: destination,
    travelmode: 'driving',
    dir_action: 'navigate',
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Format distance from meters to readable format
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance (e.g., "5.2 km" or "850 m")
 */
export function formatDistance(meters) {
  if (!meters || meters < 0) return '0 m';

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const kilometers = meters / 1000;
  return `${kilometers.toFixed(1)} km`;
}

/**
 * Format duration from seconds to readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "25 min" or "1h 15min")
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0 min';

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}min`;
}

/**
 * Get estimated arrival time
 * @param {number} durationSeconds - Travel duration in seconds
 * @returns {string} Formatted arrival time (e.g., "3:45 PM")
 */
export function getEstimatedArrival(durationSeconds) {
  if (!durationSeconds || durationSeconds < 0) return '--:--';

  const now = new Date();
  const arrivalTime = new Date(now.getTime() + durationSeconds * 1000);

  return arrivalTime.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calculate straight-line distance between two coordinates
 * Uses Haversine formula
 * @param {Object} point1 - First point {latitude, longitude}
 * @param {Object} point2 - Second point {latitude, longitude}
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(point1, point2) {
  if (!point1 || !point2) return 0;

  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);

  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Number(distance.toFixed(2));
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} Radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Open Google Maps in a new tab/app
 * @param {Object} pickup - Pickup location
 * @param {Object} drop - Drop location
 */
export function openGoogleMapsNavigation(pickup, drop) {
  const url = generateGoogleMapsUrl(pickup, drop);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Check if Google Maps API is loaded
 * @returns {boolean} True if Google Maps is available
 */
export function isGoogleMapsLoaded() {
  return typeof window !== 'undefined' &&
         typeof window.google !== 'undefined' &&
         typeof window.google.maps !== 'undefined';
}

/**
 * Get route bounds to fit both pickup and drop locations
 * @param {Object} pickup - Pickup location
 * @param {Object} drop - Drop location
 * @returns {Object} Bounds object for map
 */
export function getRouteBounds(pickup, drop) {
  if (!isGoogleMapsLoaded() || !pickup || !drop) return null;

  const bounds = new window.google.maps.LatLngBounds();
  bounds.extend({ lat: pickup.latitude, lng: pickup.longitude });
  bounds.extend({ lat: drop.latitude, lng: drop.longitude });

  return bounds;
}
