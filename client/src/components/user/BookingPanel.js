import React, { useState, useEffect } from 'react';
import { Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';
import VehicleCard from './VehicleCard';
import { FIXED_PICKUP_LOCATION, FIXED_PICKUP_MESSAGE } from '../../config/fixedLocations';
import { FaMapMarkerAlt, FaInfoCircle, FaSpinner } from 'react-icons/fa';

const BookingPanel = ({
  pickupLocations = [],
  selectedPickup,
  onPickupSelect,
  dropLocation,
  dropCoordinates,
  onDropLocationChange,
  vehicleType,
  onVehicleSelect,
  fareEstimates,
  onBookRide,
  isBooking = false,
  socketConnected = false,
  className = '',
  onStepChange
}) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Locations, 2: Vehicle, 3: Confirm
  const [pickupSearchQuery, setPickupSearchQuery] = useState(FIXED_PICKUP_LOCATION.name);
  const [dropLocationConfirmed, setDropLocationConfirmed] = useState(false);
  
  // Notify parent component of step changes
  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStep);
    }
  }, [currentStep, onStepChange]);
  
  // Auto-select fixed pickup location on mount
  useEffect(() => {
    if (!selectedPickup) {
      onPickupSelect(FIXED_PICKUP_LOCATION);
      setPickupSearchQuery(FIXED_PICKUP_LOCATION.name);
    }
  }, [selectedPickup, onPickupSelect]);
  
  // Google Places Autocomplete state
  const [autocomplete, setAutocomplete] = useState(null);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  
  // Map state for drop location selection
  const [showMap, setShowMap] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Optional: Auto-show map when coordinates are available
  // Commented out to keep map toggle manual for better UX
  // useEffect(() => {
  //   if (dropCoordinates && !showMap) {
  //     setShowMap(true);
  //   }
  // }, [dropCoordinates]);

  // Center map on coordinates change
  useEffect(() => {
    if (dropCoordinates && mapInstance && showMap) {
      mapInstance.panTo(dropCoordinates);
      // Don't change zoom if user has already adjusted it
      if (mapInstance.getZoom() < 13) {
        mapInstance.setZoom(15);
      }
    }
  }, [dropCoordinates, mapInstance, showMap]);

  // Removed pickup location filtering since we use fixed location

  // Vehicle options - using real fare estimates or reasonable defaults only when estimates unavailable
  const vehicles = [
    {
      type: 'bike',
      available: true,
      eta: '2 mins away',
      price: fareEstimates?.estimates?.bike?.customerTotalFare || fareEstimates?.estimates?.bike?.totalFare || (fareEstimates ? 'Calculating...' : 25)
    },
    {
      type: 'auto',
      available: true,
      eta: '3 mins away',
      price: fareEstimates?.estimates?.auto?.customerTotalFare || fareEstimates?.estimates?.auto?.totalFare || (fareEstimates ? 'Calculating...' : 40)
    },
    {
      type: 'car',
      available: true,
      eta: '5 mins away',
      price: fareEstimates?.estimates?.car?.customerTotalFare || fareEstimates?.estimates?.car?.totalFare || (fareEstimates ? 'Calculating...' : 80)
    }
  ];

  // Removed pickup search and select handlers since we use fixed location

  const handleVehicleSelect = (vehicleType) => {
    onVehicleSelect(vehicleType);
    // Auto-advance to confirmation step
    setCurrentStep(3);
  };

  // Google Places Autocomplete handlers
  const onAutocompleteLoad = (autoComplete) => {
    console.log('Autocomplete loaded:', autoComplete);
    setAutocomplete(autoComplete);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      console.log('Place selected:', place);
      
      if (place.geometry) {
        const address = place.formatted_address || place.name;
        const coordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        
        console.log('Setting drop location:', { address, coordinates });
        onDropLocationChange(address, coordinates);
        setDropLocationConfirmed(false); // Reset confirmation when location changes
        
        // Always show map when drop location is selected
        if (!showMap) {
          setShowMap(true);
        }
        
        // Center map on the selected location and fit both markers
        setTimeout(() => {
          if (mapInstance && selectedPickup) {
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend({ lat: selectedPickup.lat, lng: selectedPickup.lng });
            bounds.extend(coordinates);
            mapInstance.fitBounds(bounds);
            
            // Add some padding
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            mapInstance.fitBounds(bounds, padding);
          } else if (mapInstance) {
            mapInstance.panTo(coordinates);
            mapInstance.setZoom(15);
          }
        }, 100); // Small delay to ensure map is rendered
        
        // Don't auto-advance to step 2 - let user confirm location first
        // if (selectedPickup) {
        //   setCurrentStep(2);
        // }
      } else {
        console.warn('No geometry data for selected place');
      }
    } else {
      console.warn('Autocomplete is not loaded yet!');
    }
  };

  // Fallback geocoding using Google Geocoding API
  const geocodeAddress = async (address) => {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps API not loaded');
      return null;
    }

    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng(),
            formatted_address: results[0].formatted_address
          });
        } else {
          console.error('Geocoding failed:', status);
          resolve(null);
        }
      });
    });
  };

  // Handle manual address input (when user types and presses enter)
  const handleManualAddressInput = async (address) => {
    if (!address.trim()) return;
    
    setIsGeocodingLocation(true);
    try {
      const result = await geocodeAddress(address);
      if (result) {
        const coordinates = {
          lat: result.lat,
          lng: result.lng
        };
        
        onDropLocationChange(result.formatted_address, coordinates);
        setDropLocationConfirmed(false); // Reset confirmation when location changes
        
        // Always show map when drop location is selected
        if (!showMap) {
          setShowMap(true);
        }
        
        // Center map on the geocoded location
        setTimeout(() => {
          if (mapInstance && selectedPickup) {
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend({ lat: selectedPickup.lat, lng: selectedPickup.lng });
            bounds.extend(coordinates);
            mapInstance.fitBounds(bounds);
            
            // Add some padding
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            mapInstance.fitBounds(bounds, padding);
          } else if (mapInstance) {
            mapInstance.panTo(coordinates);
            mapInstance.setZoom(15);
          }
        }, 100);
      } else {
        // Fallback to Delhi center with user notification
        console.warn('Could not geocode address, using Delhi center');
        const fallbackCoordinates = { lat: 28.6139, lng: 77.2090 };
        onDropLocationChange(address, fallbackCoordinates);
        
        if (showMap && mapInstance) {
          mapInstance.panTo(fallbackCoordinates);
          mapInstance.setZoom(12);
        }
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      const fallbackCoordinates = { lat: 28.6139, lng: 77.2090 };
      onDropLocationChange(address, fallbackCoordinates);
      
      if (showMap && mapInstance) {
        mapInstance.panTo(fallbackCoordinates);
        mapInstance.setZoom(12);
      }
    } finally {
      setIsGeocodingLocation(false);
    }
  };

  // Handle map click for drop location selection
  const handleMapClick = (event) => {
    const coordinates = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    
    setIsReverseGeocoding(true);
    
    // Reverse geocode to get address
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: coordinates }, (results, status) => {
      if (status === 'OK' && results[0]) {
        onDropLocationChange(results[0].formatted_address, coordinates);
      } else {
        onDropLocationChange(`Location: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`, coordinates);
      }
      setDropLocationConfirmed(false); // Reset confirmation when location changes
      setIsReverseGeocoding(false);
    });
  };

  // Handle marker drag end
  const handleMarkerDragEnd = (event) => {
    const coordinates = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    
    setIsReverseGeocoding(true);
    
    // Reverse geocode to get address
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: coordinates }, (results, status) => {
      if (status === 'OK' && results[0]) {
        onDropLocationChange(results[0].formatted_address, coordinates);
      } else {
        onDropLocationChange(`Location: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`, coordinates);
      }
      setDropLocationConfirmed(false); // Reset confirmation when location changes
      setIsReverseGeocoding(false);
    });
  };

  // Handle map load
  const onMapLoad = (map) => {
    setMapInstance(map);
  };

  const canProceedToVehicles = selectedPickup && dropLocation;
  const canBookRide = selectedPickup && dropLocation && vehicleType;
  
  // Helper function to get validation message
  const getValidationMessage = () => {
    if (!selectedPickup) return 'Please select a pickup location';
    if (!dropLocation) return 'Please enter a drop location';
    if (!vehicleType) return 'Please select a vehicle type';
    return '';
  };

  return (
    <div className={`bg-white ${className}`}>
      {/* Step Indicator */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep >= step 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-600'
                }
              `}>
                {step}
              </div>
              {step < 3 && (
                <div className={`
                  w-8 h-0.5 mx-2
                  ${currentStep > step ? 'bg-blue-500' : 'bg-gray-200'}
                `} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-sm text-gray-600">
          {currentStep === 1 && 'Set pickup and drop locations'}
          {currentStep === 2 && 'Choose your vehicle'}
          {currentStep === 3 && 'Confirm your booking'}
        </div>
      </div>

      <div className="p-0 md:p-6 space-y-4 md:space-y-6">
        {/* Step 1: Locations */}
        {currentStep === 1 && (
          <div className="space-y-4 p-4 md:p-0 pb-24 md:pb-0">
            {/* Pickup Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pickup Location (Fixed)
              </label>
              <div className="relative">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">📍</span>
                  <input
                    type="text"
                    value={pickupSearchQuery}
                    disabled={true}
                    className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  {FIXED_PICKUP_MESSAGE}
                </p>
              </div>
            </div>

            {/* Drop Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Drop Location
              </label>
              <div className="relative">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">📍</span>
                  {window.google?.maps ? (
                    <Autocomplete
                      onLoad={onAutocompleteLoad}
                      onPlaceChanged={onPlaceChanged}
                      className="flex-1"
                      options={{
                        bounds: new window.google.maps.LatLngBounds(
                          new window.google.maps.LatLng(28.4089, 76.8856), // Southwest Delhi NCR
                          new window.google.maps.LatLng(28.8832, 77.3470)  // Northeast Delhi NCR
                        ),
                        componentRestrictions: { country: 'in' },
                        fields: ['formatted_address', 'geometry', 'name']
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Enter your destination"
                        defaultValue={dropLocation || ''}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = e.target.value;
                            if (value && value !== dropLocation) {
                              handleManualAddressInput(value);
                            }
                          }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </Autocomplete>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter your destination address"
                      value={dropLocation || ''}
                      onChange={(e) => onDropLocationChange(e.target.value, null)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const value = e.target.value;
                          if (value) {
                            handleManualAddressInput(value);
                          }
                        }
                      }}
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>
                {isGeocodingLocation && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Map Toggle Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all active:scale-[0.98] touch-manipulation"
              >
                <FaMapMarkerAlt className={`transition-transform duration-300 ${showMap ? 'rotate-180' : ''}`} />
                <span className="font-medium text-gray-700">
                  {showMap ? 'Hide Map' : 'Select on Map'}
                </span>
              </button>
            </div>

            {/* Map Container */}
            {showMap && window.google?.maps && (
              <div className="mt-4 animate-fadeIn">
                <div className={`p-3 rounded-lg mb-3 transition-all ${
                  dropCoordinates && !dropLocationConfirmed 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-blue-50'
                }`}>
                  <p className={`text-sm flex items-start gap-2 ${
                    dropCoordinates && !dropLocationConfirmed 
                      ? 'text-green-700' 
                      : 'text-blue-700'
                  }`}>
                    <FaInfoCircle className="mt-0.5 flex-shrink-0" />
                    <span>
                      {dropCoordinates && !dropLocationConfirmed
                        ? "✨ Drop location selected! Drag the red marker to adjust or click 'Confirm Drop Location' below" 
                        : dropCoordinates 
                        ? "Drag the red marker to fine-tune your drop location" 
                        : "Tap anywhere on the map to set your drop location"}
                    </span>
                  </p>
                </div>
                
                <div className="relative rounded-lg overflow-hidden shadow-md"
                     style={{ height: window.innerWidth < 768 ? '350px' : '400px' }}>
                  
                  {/* Loading overlay */}
                  {isReverseGeocoding && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg z-10">
                      <span className="text-sm text-gray-600 flex items-center gap-2">
                        <FaSpinner className="animate-spin" />
                        Getting address...
                      </span>
                    </div>
                  )}
                  
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={dropCoordinates || selectedPickup ? 
                      (dropCoordinates || { lat: selectedPickup.lat, lng: selectedPickup.lng })
                      : { lat: 28.6139, lng: 77.2090 }
                    }
                    zoom={13}
                    onClick={handleMapClick}
                    onLoad={onMapLoad}
                    options={{
                      zoomControl: true,
                      mapTypeControl: false,
                      scaleControl: false,
                      streetViewControl: false,
                      rotateControl: false,
                      fullscreenControl: true,
                      clickableIcons: false
                    }}
                  >
                    {/* Fixed Pickup Location Marker */}
                    {selectedPickup && (
                      <Marker
                        position={{ lat: selectedPickup.lat, lng: selectedPickup.lng }}
                        title={selectedPickup.name}
                        icon={{
                          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                          scaledSize: new window.google.maps.Size(44, 44)
                        }}
                      />
                    )}
                    
                    {/* Drop Location Marker (Draggable) */}
                    {dropCoordinates && (
                      <Marker
                        position={dropCoordinates}
                        draggable={true}
                        onDragEnd={handleMarkerDragEnd}
                        title="Drop Location - Drag to adjust"
                        icon={{
                          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                          scaledSize: new window.google.maps.Size(44, 44)
                        }}
                        animation={window.google.maps.Animation.DROP}
                      />
                    )}
                  </GoogleMap>
                </div>
                
                {/* Map Legend */}
                <div className="mt-3 flex items-center justify-center gap-6 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <span style={{ color: '#1E40AF' }}>●</span> Pickup Location (Fixed)
                  </span>
                  <span className="flex items-center gap-1">
                    <span style={{ color: '#DC2626' }}>●</span> Drop Location (Tap/Drag)
                  </span>
                </div>
              </div>
            )}

            {/* Continue Button */}
            <div className="mt-6">
              <button
                onClick={() => {
                  if (canProceedToVehicles) {
                    if (dropCoordinates && !dropLocationConfirmed) {
                      // Confirm the drop location
                      setDropLocationConfirmed(true);
                      setCurrentStep(2);
                    } else if (dropLocationConfirmed) {
                      setCurrentStep(2);
                    }
                  }
                }}
                disabled={!canProceedToVehicles}
                className={`
                  w-full py-4 rounded-lg font-semibold transition-colors text-lg
                  ${canProceedToVehicles
                    ? 'bg-black text-white hover:bg-gray-800 shadow-lg'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                {!selectedPickup ? 'Select pickup location' :
                 !dropLocation ? 'Enter drop location' :
                 dropCoordinates && !dropLocationConfirmed ? 'Confirm Drop Location' :
                 'Choose Vehicle'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Vehicle Selection */}
        {currentStep === 2 && (
          <div className="space-y-4 p-4 md:p-0 pb-24 md:pb-0">
            <h3 className="text-lg font-semibold text-gray-900">Choose a Vehicle</h3>
            
            <div className="space-y-3">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.type}
                  vehicle={vehicle.type}
                  selected={vehicleType === vehicle.type}
                  onSelect={() => handleVehicleSelect(vehicle.type)}
                  price={vehicle.price}
                  eta={vehicle.eta}
                  available={vehicle.available}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-6">
              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 py-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => vehicleType && setCurrentStep(3)}
                  disabled={!vehicleType}
                  className={`
                    flex-1 py-4 rounded-lg font-semibold transition-colors text-lg
                    ${vehicleType
                      ? 'bg-black text-white hover:bg-gray-800 shadow-lg'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  {!vehicleType ? 'Select a vehicle' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm Booking */}
        {currentStep === 3 && (
          <div className="space-y-6 p-4 md:p-0 pb-24 md:pb-0">
            <h3 className="text-lg font-semibold text-gray-900">Confirm Your Booking</h3>

            {/* Trip Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start space-x-3">
                <span className="text-lg">📍</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Pickup</p>
                  <p className="font-medium">{selectedPickup?.name}</p>
                </div>
              </div>
              
              <div className="border-l-2 border-gray-300 ml-2 h-4"></div>
              
              <div className="flex items-start space-x-3">
                <span className="text-lg">📍</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Drop</p>
                  <p className="font-medium">{dropLocation}</p>
                </div>
              </div>
              
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Vehicle</span>
                  <span className="font-medium capitalize">{vehicleType}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-600">Estimated Fare</span>
                  <span className="font-semibold text-lg">
                    ₹{vehicles.find(v => v.type === vehicleType)?.price || '---'}
                  </span>
                </div>
              </div>
            </div>

            {/* Connection Status */}
            <div className="space-y-2">
              <div className={`
                flex items-center space-x-2 text-sm
                ${socketConnected ? 'text-green-600' : 'text-orange-600'}
              `}>
                <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
                <span>{socketConnected ? 'Connected & Ready' : 'Offline Mode - Booking Available'}</span>
              </div>
              
              {!socketConnected && (
                <div className="text-xs text-gray-500 bg-orange-50 p-2 rounded">
                  ⚠️ You can still book rides. Real-time updates may be limited.
                </div>
              )}
              
              {dropLocation && !window.google?.maps && (
                <div className="flex items-center space-x-2 text-sm text-yellow-600">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span>Maps unavailable - Using approximate location</span>
                </div>
              )}
            </div>

            {/* Validation Message */}
            {!canBookRide && getValidationMessage() && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                ❌ {getValidationMessage()}
              </div>
            )}

            {/* Book Button */}
            <div className="mt-6">
              <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="w-full md:flex-1 py-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={onBookRide}
                  disabled={!canBookRide || isBooking}
                  className={`
                    w-full md:flex-1 py-4 rounded-lg font-semibold transition-colors text-lg
                    ${canBookRide && !isBooking
                      ? socketConnected 
                        ? 'bg-black text-white hover:bg-gray-800 shadow-lg'
                        : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  {isBooking ? 'Booking...' : 
                   !socketConnected ? 'Book Ride (Offline Mode)' :
                   'Request Ride'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPanel;