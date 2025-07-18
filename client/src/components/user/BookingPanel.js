import React, { useState, useEffect } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import VehicleCard from './VehicleCard';
import { FIXED_PICKUP_LOCATION, FIXED_PICKUP_MESSAGE } from '../../config/fixedLocations';

const BookingPanel = ({
  pickupLocations = [],
  selectedPickup,
  onPickupSelect,
  dropLocation,
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

  // Removed pickup location filtering since we use fixed location

  // Vehicle options - using real fare estimates or reasonable defaults only when estimates unavailable
  const vehicles = [
    { 
      type: 'bike', 
      available: true,
      eta: '2 mins away',
      price: fareEstimates?.estimates?.bike?.totalFare || (fareEstimates ? 'Calculating...' : 25)
    },
    { 
      type: 'auto', 
      available: true,
      eta: '3 mins away',
      price: fareEstimates?.estimates?.auto?.totalFare || (fareEstimates ? 'Calculating...' : 40)
    },
    { 
      type: 'car', 
      available: true,
      eta: '5 mins away',
      price: fareEstimates?.estimates?.car?.totalFare || (fareEstimates ? 'Calculating...' : 80)
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
        
        if (selectedPickup) {
          setCurrentStep(2);
        }
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
        onDropLocationChange(result.formatted_address, {
          lat: result.lat,
          lng: result.lng
        });
      } else {
        // Fallback to Delhi center with user notification
        console.warn('Could not geocode address, using Delhi center');
        onDropLocationChange(address, { lat: 28.6139, lng: 77.2090 });
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      onDropLocationChange(address, { lat: 28.6139, lng: 77.2090 });
    } finally {
      setIsGeocodingLocation(false);
    }
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
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3" />
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
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3" />
                <div className="flex-1 relative">
                  {window.google && window.google.maps ? (
                    <Autocomplete
                      onLoad={onAutocompleteLoad}
                      onPlaceChanged={onPlaceChanged}
                      options={{
                        componentRestrictions: { country: "in" },
                        fields: ["geometry", "formatted_address", "name"],
                        types: ["establishment", "geocode"]
                      }}
                    >
                      <input
                        type="text"
                        value={dropLocation}
                        onChange={(e) => onDropLocationChange(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleManualAddressInput(e.target.value);
                          }
                        }}
                        placeholder="Enter destination address (e.g., Connaught Place, Delhi)"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isGeocodingLocation}
                      />
                    </Autocomplete>
                  ) : (
                    <input
                      type="text"
                      value={dropLocation}
                      onChange={(e) => onDropLocationChange(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleManualAddressInput(e.target.value);
                        }
                      }}
                      placeholder="Enter destination address (Google Maps loading...)"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isGeocodingLocation}
                    />
                  )}
                  {isGeocodingLocation && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Start typing to search or press Enter to geocode manually
              </p>
            </div>

            {/* Continue Button */}
            <div className="mt-6">
              <button
                onClick={() => canProceedToVehicles && setCurrentStep(2)}
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
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-1" />
                  <div>
                    <div className="font-medium">{selectedPickup?.name}</div>
                    <div className="text-sm text-gray-600">{selectedPickup?.address}</div>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-1" />
                  <div>
                    <div className="font-medium">{dropLocation}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Vehicle */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Selected Vehicle</h4>
              {vehicles.find(v => v.type === vehicleType) && (
                <VehicleCard
                  vehicle={vehicleType}
                  selected={true}
                  price={vehicles.find(v => v.type === vehicleType).price}
                  eta={vehicles.find(v => v.type === vehicleType).eta}
                />
              )}
            </div>

            {/* Connection Status & Location Status */}
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
                  <span>Google Maps loading for location search...</span>
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