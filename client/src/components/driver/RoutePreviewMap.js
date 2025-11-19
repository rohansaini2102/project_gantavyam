import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';

/**
 * RoutePreviewMap Component
 * Displays Google Maps with route from pickup to drop location
 * Shows custom markers for driver, pickup, and drop locations
 */
function RoutePreviewMap({ pickup, drop, driverLocation, onRouteCalculated }) {
  const [directions, setDirections] = useState(null);
  const [map, setMap] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState(null);

  // Map container style
  const mapContainerStyle = {
    width: '100%',
    height: '100%',
  };

  // Default center (Hauz Khas, Delhi)
  const defaultCenter = {
    lat: 28.5433,
    lng: 77.2066,
  };

  // Check if coordinates are valid (defined early so it can be used below)
  const hasValidCoordinates = (location) => {
    if (!location) return false;
    const lat = location.latitude;
    const lng = location.longitude;
    // Check if coordinates are not 0,0 and are within valid ranges
    return lat !== 0 && lng !== 0 &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180;
  };

  // Calculate center point - use default if coordinates are invalid
  const center = (pickup && hasValidCoordinates(pickup))
    ? { lat: pickup.latitude, lng: pickup.longitude }
    : defaultCenter;

  // Map options
  const mapOptions = {
    disableDefaultUI: false,
    zoomControl: false, // Using custom controls
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      },
    ],
  };

  // Calculate and display route
  const calculateRoute = useCallback(() => {
    if (!pickup || !drop || !window.google) return;

    // Check for valid coordinates - show concise message if invalid
    if (!hasValidCoordinates(pickup) || !hasValidCoordinates(drop)) {
      setCalculating(false);
      setError('📍 No GPS data - showing addresses only');
      return;
    }

    setCalculating(true);
    setError(null);

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: { lat: pickup.latitude, lng: pickup.longitude },
        destination: { lat: drop.latitude, lng: drop.longitude },
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: 'bestguess',
        },
      },
      (result, status) => {
        setCalculating(false);

        if (status === 'OK' && result) {
          setDirections(result);

          // Extract route info and pass to parent
          if (onRouteCalculated && result.routes[0]?.legs[0]) {
            const leg = result.routes[0].legs[0];
            onRouteCalculated({
              distance: leg.distance?.value || 0, // meters
              duration: leg.duration?.value || 0, // seconds
              durationInTraffic: leg.duration_in_traffic?.value || leg.duration?.value || 0,
            });
          }
        } else {
          // Detailed error handling for different DirectionsService status codes
          console.error('Directions request failed:', status, result);

          let errorMessage = 'Unable to calculate route.';
          switch (status) {
            case 'REQUEST_DENIED':
              errorMessage = '🚫 API Error: Google Directions API not enabled or billing not set up. Check Google Cloud Console.';
              console.error('❌ Directions API is not enabled or API key lacks permissions. Enable Directions API in Google Cloud Console and ensure billing is active.');
              break;
            case 'OVER_QUERY_LIMIT':
              errorMessage = '⚠️ Daily quota exceeded. Please try again later or upgrade your Google Maps plan.';
              console.error('❌ Google Maps API quota exceeded. Check usage limits in Google Cloud Console.');
              break;
            case 'ZERO_RESULTS':
              errorMessage = '🗺️ No route found between these locations. They may be too far apart or unreachable by road.';
              break;
            case 'INVALID_REQUEST':
              errorMessage = '❌ Invalid locations provided. Check coordinates: Pickup(' + pickup.latitude + ',' + pickup.longitude + ') Drop(' + drop.latitude + ',' + drop.longitude + ')';
              break;
            case 'UNKNOWN_ERROR':
              errorMessage = '⚠️ Server error. Please try again in a moment.';
              break;
            case 'MAX_WAYPOINTS_EXCEEDED':
              errorMessage = '❌ Too many waypoints in the route.';
              break;
            case 'NOT_FOUND':
              errorMessage = '🗺️ One or both locations could not be geocoded.';
              break;
            default:
              errorMessage = `Route calculation failed (Status: ${status}). Please check console for details.`;
          }

          setError(errorMessage);
        }
      }
    );
  }, [pickup, drop, onRouteCalculated]);

  // Validate API key on mount
  useEffect(() => {
    if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
      console.error('❌ REACT_APP_GOOGLE_MAPS_API_KEY is not set in environment variables');
      setError('⚠️ Google Maps API key is not configured. Please set REACT_APP_GOOGLE_MAPS_API_KEY in .env file.');
    }
  }, []);

  // Calculate route when locations change
  useEffect(() => {
    if (pickup && drop) {
      const timer = setTimeout(() => {
        calculateRoute();
      }, 500); // Debounce

      return () => clearTimeout(timer);
    }
  }, [pickup, drop, calculateRoute]);

  // Fit map to show entire route
  useEffect(() => {
    if (map && pickup && drop) {
      // Only fit bounds if we have valid coordinates
      const validPickup = hasValidCoordinates(pickup);
      const validDrop = hasValidCoordinates(drop);

      if (validPickup || validDrop) {
        const bounds = new window.google.maps.LatLngBounds();

        if (validPickup) {
          bounds.extend({ lat: pickup.latitude, lng: pickup.longitude });
        }

        if (validDrop) {
          bounds.extend({ lat: drop.latitude, lng: drop.longitude });
        }

        if (driverLocation && hasValidCoordinates(driverLocation)) {
          bounds.extend({ lat: driverLocation.latitude, lng: driverLocation.longitude });
        }

        map.fitBounds(bounds, {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50,
        });
      }
    }
  }, [map, pickup, drop, driverLocation]);

  const handleMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={13}
        onLoad={handleMapLoad}
        options={mapOptions}
      >
        {/* Driver location marker (blue) */}
        {driverLocation && (
          <Marker
            position={{
              lat: driverLocation.latitude,
              lng: driverLocation.longitude,
            }}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
              scaledSize: new window.google.maps.Size(40, 40),
            }}
            title="Your Location"
            zIndex={3}
          />
        )}

        {/* Pickup marker (green) */}
        {pickup && hasValidCoordinates(pickup) && (
          <Marker
            position={{
              lat: pickup.latitude,
              lng: pickup.longitude,
            }}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
              scaledSize: new window.google.maps.Size(50, 50),
            }}
            label={{
              text: 'A',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
            title={pickup.boothName || 'Pickup Location'}
            zIndex={2}
          />
        )}

        {/* Drop marker (red) */}
        {drop && hasValidCoordinates(drop) && (
          <Marker
            position={{
              lat: drop.latitude,
              lng: drop.longitude,
            }}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
              scaledSize: new window.google.maps.Size(50, 50),
            }}
            label={{
              text: 'B',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
            title={drop.address || 'Drop Location'}
            zIndex={1}
          />
        )}

        {/* Route polyline */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true, // Use our custom markers
              polylineOptions: {
                strokeColor: '#3B82F6', // Blue-500
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}
      </GoogleMap>

      {/* Loading overlay */}
      {calculating && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <div className="text-sm text-gray-600">Calculating route...</div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

export default RoutePreviewMap;
