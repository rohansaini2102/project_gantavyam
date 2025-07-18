import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Autocomplete, Marker } from '@react-google-maps/api';
import { FaMapMarkerAlt, FaCar, FaMotorcycle, FaTaxi, FaUser, FaRupeeSign, FaCheckCircle, FaSpinner, FaUserPlus, FaSearch, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { admin, users } from '../../services/api';
import { FIXED_PICKUP_LOCATION } from '../../config/fixedLocations';

const STORAGE_KEY = 'manualBookingState';

const ManualBooking = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [customerType, setCustomerType] = useState(''); // 'existing' or 'new'
  const [dropLocation, setDropLocation] = useState('');
  const [dropCoordinates, setDropCoordinates] = useState(null);
  const [fareEstimates, setFareEstimates] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [userName, setUserName] = useState('');
  const [existingUser, setExistingUser] = useState(null);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [autocomplete, setAutocomplete] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);

  // Fixed pickup location (same as online booking)
  const currentBooth = FIXED_PICKUP_LOCATION;

  // Helper function to get vehicle options with icons
  const getVehicleOptions = () => {
    return [
      { 
        type: 'bike', 
        label: 'Bike',
        icon: <FaMotorcycle />,
        available: true,
        eta: '2 mins away',
        price: fareEstimates?.estimates?.bike?.totalFare || (fareEstimates ? 'Calculating...' : 25)
      },
      { 
        type: 'auto', 
        label: 'Auto',
        icon: <FaTaxi />,
        available: true,
        eta: '3 mins away',
        price: fareEstimates?.estimates?.auto?.totalFare || (fareEstimates ? 'Calculating...' : 40)
      },
      { 
        type: 'car', 
        label: 'Car',
        icon: <FaCar />,
        available: true,
        eta: '5 mins away',
        price: fareEstimates?.estimates?.car?.totalFare || (fareEstimates ? 'Calculating...' : 80)
      }
    ];
  };

  // Helper function to find vehicle by type (for state restoration)
  const findVehicleByType = (vehicleType) => {
    const vehicleMap = {
      'bike': { type: 'bike', label: 'Bike', icon: <FaMotorcycle />, eta: '2 mins away' },
      'auto': { type: 'auto', label: 'Auto', icon: <FaTaxi />, eta: '3 mins away' },
      'car': { type: 'car', label: 'Car', icon: <FaCar />, eta: '5 mins away' }
    };
    
    const baseVehicle = vehicleMap[vehicleType];
    if (!baseVehicle) return null;
    
    return {
      ...baseVehicle,
      available: true,
      price: fareEstimates?.estimates?.[vehicleType]?.totalFare || (fareEstimates ? 'Calculating...' : (vehicleType === 'bike' ? 25 : vehicleType === 'auto' ? 40 : 80))
    };
  };

  // State persistence functions
  const saveBookingState = () => {
    // Don't save selectedVehicle with JSX icons - save only serializable data
    const serializableSelectedVehicle = selectedVehicle ? {
      type: selectedVehicle.type,
      label: selectedVehicle.label,
      available: selectedVehicle.available,
      eta: selectedVehicle.eta,
      price: selectedVehicle.price
    } : null;
    
    const state = {
      currentStep,
      customerType,
      dropLocation,
      dropCoordinates,
      fareEstimates,
      selectedVehicle: serializableSelectedVehicle,
      userPhone,
      userName,
      existingUser,
      showMap,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const loadBookingState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        // Check if state is less than 1 hour old
        if (Date.now() - state.timestamp < 3600000) {
          return state;
        }
      }
    } catch (error) {
      console.error('Error loading booking state:', error);
    }
    return null;
  };

  const clearBookingState = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // Initialize component and check for saved state
  useEffect(() => {
    const savedState = loadBookingState();
    if (savedState) {
      setShowRecoveryModal(true);
    }
  }, []);

  // Auto-save state when important fields change
  useEffect(() => {
    if (currentStep > 1 || customerType || dropLocation || userPhone) {
      saveBookingState();
    }
  }, [currentStep, customerType, dropLocation, dropCoordinates, fareEstimates, selectedVehicle, userPhone, userName, existingUser]);

  // Calculate fare estimates automatically when drop location changes
  const calculateFareEstimates = async () => {
    if (!dropCoordinates) return;
    
    setIsCalculatingFare(true);
    try {
      const fareData = {
        pickupLat: currentBooth.lat,
        pickupLng: currentBooth.lng,
        dropLat: dropCoordinates.lat,
        dropLng: dropCoordinates.lng,
        pickupStation: currentBooth.name
      };
      
      console.log('Calculating fare with data:', fareData);
      const response = await admin.getFareEstimate(fareData);
      
      if (response.success) {
        setFareEstimates(response);
        console.log('Fare estimates received:', response);
      } else {
        console.error('Fare estimation failed:', response.message);
        alert('Could not calculate fare. Please check the location and try again.');
      }
    } catch (error) {
      console.error('Error calculating fare:', error);
      alert('Failed to calculate fare. Please try again.');
    } finally {
      setIsCalculatingFare(false);
    }
  };

  // Auto-calculate fare when drop coordinates change (like user booking)
  useEffect(() => {
    if (dropCoordinates) {
      calculateFareEstimates();
    }
  }, [dropCoordinates]);

  // Google Maps is already loaded by App.js LoadScript
  // Check if it's available and set state accordingly
  useEffect(() => {
    const checkMapsAvailability = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('Google Maps API is available');
        setMapsLoaded(true);
        setMapsError(false);
      } else {
        console.warn('Google Maps API not yet available, retrying...');
        setTimeout(checkMapsAvailability, 1000);
      }
    };
    
    // Start checking after a brief delay
    const timer = setTimeout(checkMapsAvailability, 500);
    
    // Set a maximum timeout
    const maxTimer = setTimeout(() => {
      if (!mapsLoaded) {
        console.error('Google Maps API failed to load within timeout');
        setMapsError(true);
      }
    }, 10000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(maxTimer);
    };
  }, [mapsLoaded]);

  // Google Places Autocomplete handlers (like user booking)
  const onAutocompleteLoad = (autoComplete) => {
    console.log('Autocomplete loaded:', autoComplete);
    setAutocomplete(autoComplete);
    setMapsLoaded(true);
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
        setDropLocation(address);
        setDropCoordinates(coordinates);
        // Fare calculation will trigger automatically via useEffect
      } else {
        console.warn('No geometry data for selected place');
        alert('Please select a valid location from the dropdown');
      }
    }
  };

  // Handle map click for drop location selection
  const handleMapClick = (event) => {
    const coordinates = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    setDropCoordinates(coordinates);
    
    // Reverse geocode to get address
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: coordinates }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setDropLocation(results[0].formatted_address);
        console.log('Address set from map click:', results[0].formatted_address);
      } else {
        setDropLocation(`Location: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
      }
    });
  };

  // Handle marker drag end
  const handleMarkerDragEnd = (event) => {
    const coordinates = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    setDropCoordinates(coordinates);
    
    // Reverse geocode to get address
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: coordinates }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setDropLocation(results[0].formatted_address);
        console.log('Address updated from marker drag:', results[0].formatted_address);
      } else {
        setDropLocation(`Location: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
      }
    });
  };

  // Handle map load
  const onMapLoad = (map) => {
    setMapInstance(map);
    console.log('Map loaded successfully');
  };


  // Step navigation functions
  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Handle location step submission
  const handleLocationSubmit = () => {
    if (!dropLocation || !dropCoordinates) {
      alert('Please select a valid drop location');
      return;
    }
    
    if (!fareEstimates) {
      alert('Please wait for fare calculation to complete');
      return;
    }
    
    nextStep();
  };

  // Handle existing customer phone lookup
  const handleExistingCustomer = async () => {
    if (userPhone.length !== 10) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      const response = await admin.checkUserByPhone(userPhone);
      if (response.exists) {
        setExistingUser(response.user);
        setUserName(response.user.name);
        nextStep();
      } else {
        alert('Customer not found. Please use "New Customer" option.');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      alert('Failed to check customer details');
    }
  };

  // Handle new customer details
  const handleNewCustomer = () => {
    if (!userPhone || !userName) {
      alert('Please enter customer name and phone number');
      return;
    }
    
    if (userPhone.length !== 10) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }
    
    nextStep();
  };

  // Handle vehicle selection
  const handleVehicleSelection = (vehicleType) => {
    const vehicleOptions = getVehicleOptions();
    const vehicle = vehicleOptions.find(v => v.type === vehicleType);
    setSelectedVehicle(vehicle);
    nextStep();
  };

  // State recovery functions
  const restoreBookingState = () => {
    const savedState = loadBookingState();
    if (savedState) {
      setCurrentStep(savedState.currentStep);
      setCustomerType(savedState.customerType);
      setDropLocation(savedState.dropLocation);
      setDropCoordinates(savedState.dropCoordinates);
      setFareEstimates(savedState.fareEstimates);
      
      // Restore selectedVehicle by recreating it with icons
      if (savedState.selectedVehicle) {
        const restoredVehicle = findVehicleByType(savedState.selectedVehicle.type);
        setSelectedVehicle(restoredVehicle);
      } else {
        setSelectedVehicle(null);
      }
      
      setUserPhone(savedState.userPhone);
      setUserName(savedState.userName);
      setExistingUser(savedState.existingUser);
      setShowMap(savedState.showMap || false);
    }
    setShowRecoveryModal(false);
  };

  const startFreshBooking = () => {
    clearBookingState();
    setShowRecoveryModal(false);
    resetForm();
  };

  // Final booking confirmation using standard user booking API
  const confirmBooking = async () => {
    setLoading(true);
    
    try {
      // Prepare data for manual booking API
      const bookingData = {
        pickupStation: currentBooth.name,
        pickupLocation: currentBooth.name,
        dropLocation: dropLocation,
        vehicleType: selectedVehicle.type,
        estimatedFare: selectedVehicle.price,
        distance: fareEstimates?.distance || 'Unknown',
        userPhone: userPhone,
        userName: userName,
        existingUserId: existingUser?._id || null,
        bookingSource: 'manual',
        paymentStatus: 'collected'
      };

      console.log('Booking ride with data:', bookingData);
      const response = await admin.createManualBooking(bookingData);
      
      if (response.success) {
        setBookingDetails({
          ...response.booking,
          vehicleInfo: selectedVehicle,
          pickupLocation: currentBooth,
          dropLocation: { address: dropLocation }
        });
        
        // Clear saved state on successful booking
        clearBookingState();
        console.log('Ride booked successfully!');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert(error.response?.data?.message || 'Failed to book ride');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setCustomerType('');
    setDropLocation('');
    setDropCoordinates(null);
    setFareEstimates(null);
    setSelectedVehicle(null);
    setUserPhone('');
    setUserName('');
    setExistingUser(null);
    setBookingDetails(null);
    clearBookingState();
  };

  // Show loading screen for booking submission
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Booking ride...</p>
        </div>
      </div>
    );
  }

  if (bookingDetails) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <FaCheckCircle className="text-green-500 text-6xl mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">Ride Booked Successfully!</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Ride Details</h3>
              <p><strong>Booking ID:</strong> {bookingDetails.bookingId}</p>
              <p><strong>Queue Number:</strong> {bookingDetails.queueNumber}</p>
              <p><strong>Pickup:</strong> {bookingDetails.pickupLocation?.boothName || currentBooth.name}</p>
              <p><strong>Drop:</strong> {bookingDetails.dropLocation?.address || dropLocation}</p>
              <p><strong>Vehicle Type:</strong> {bookingDetails.vehicleType}</p>
              <p><strong>Fare:</strong> ₹{bookingDetails.estimatedFare}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">OTP Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Start OTP</p>
                  <p className="text-3xl font-bold text-blue-600">{bookingDetails.startOTP}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">End OTP</p>
                  <p className="text-3xl font-bold text-red-600">{bookingDetails.endOTP}</p>
                </div>
              </div>
            </div>

            {bookingDetails.driver && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Driver Details</h3>
                <p><strong>Name:</strong> {bookingDetails.driver.name}</p>
                <p><strong>Phone:</strong> {bookingDetails.driver.phone}</p>
                <p><strong>Vehicle Number:</strong> {bookingDetails.driver.vehicleNumber}</p>
              </div>
            )}

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Customer Details</h3>
              <p><strong>Name:</strong> {bookingDetails.userName || userName}</p>
              <p><strong>Phone:</strong> {bookingDetails.userPhone || userPhone}</p>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={resetForm}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Book Another Ride
            </button>
            <button
              onClick={() => navigate('/admin/ride-management')}
              className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
            >
              View All Rides
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If there's an API key, try LoadScript; otherwise go straight to manual mode
  const renderContent = () => (
    <div className="container mx-auto px-4 py-8">
        {/* Recovery Modal */}
        {showRecoveryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Continue Previous Booking?</h3>
              <p className="text-gray-600 mb-6">
                You have an incomplete booking. Would you like to continue where you left off or start fresh?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={restoreBookingState}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                >
                  Continue Previous
                </button>
                <button
                  onClick={startFreshBooking}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
        {/* Header with Step Indicator */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="px-6 py-4 border-b">
            <h1 className="text-2xl font-bold text-gray-800">Manual Ride Booking</h1>
            <div className="flex items-center mt-4">
              {[1, 2, 3, 4].map((step) => (
                <React.Fragment key={step}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    currentStep === step 
                      ? 'bg-blue-600 text-white' 
                      : currentStep > step 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-300 text-gray-600'
                  }`}>
                    {currentStep > step ? '✓' : step}
                  </div>
                  {step < 4 && <div className={`h-1 w-12 mx-2 ${currentStep > step ? 'bg-green-600' : 'bg-gray-300'}`} />}
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>Customer</span>
              <span>Location</span>
              <span>Vehicle</span>
              <span>Confirm</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Step 1: Customer Type Selection */}
          {currentStep === 1 && (
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-6">Choose Customer Type</h2>
              <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                <button
                  onClick={() => setCustomerType('existing')}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    customerType === 'existing' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <FaUser className="text-3xl mx-auto mb-3 text-blue-600" />
                  <h3 className="font-medium text-lg">Existing Customer</h3>
                  <p className="text-sm text-gray-600 mt-2">Customer has an account</p>
                </button>
                
                <button
                  onClick={() => setCustomerType('new')}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    customerType === 'new' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-300 hover:border-green-300'
                  }`}
                >
                  <FaUserPlus className="text-3xl mx-auto mb-3 text-green-600" />
                  <h3 className="font-medium text-lg">New Customer</h3>
                  <p className="text-sm text-gray-600 mt-2">First-time customer</p>
                </button>
              </div>
              
              {customerType && (
                <div className="mt-8">
                  {customerType === 'existing' ? (
                    <div className="max-w-md mx-auto">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Customer Phone Number
                      </label>
                      <input
                        type="tel"
                        value={userPhone}
                        onChange={(e) => setUserPhone(e.target.value)}
                        placeholder="Enter 10-digit phone number"
                        maxLength="10"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleExistingCustomer}
                        className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FaSearch className="inline mr-2" />
                        Find Customer
                      </button>
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          placeholder="Enter customer name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={userPhone}
                          onChange={(e) => setUserPhone(e.target.value)}
                          placeholder="Enter 10-digit phone number"
                          maxLength="10"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <button
                        onClick={handleNewCustomer}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Continue
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Trip Details */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Trip Details</h2>
              
              {/* Customer Info Display */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-medium mb-2">Customer Information</h3>
                <p><strong>Name:</strong> {userName}</p>
                <p><strong>Phone:</strong> {userPhone}</p>
                {existingUser && <p className="text-green-600 text-sm">✓ Existing Customer</p>}
              </div>

              {/* Pickup Location (Fixed) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FaMapMarkerAlt className="inline mr-2" />
                  Pickup Location (Fixed)
                </label>
                <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                  {currentBooth.name}
                </div>
              </div>

              {/* Drop Location with Google Maps Autocomplete */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FaMapMarkerAlt className="inline mr-2" />
                  Drop Location
                </label>
                
                {mapsError ? (
                  <div>
                    <div className="w-full px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700 mb-3">
                      ⚠️ Google Maps is not available. You can still enter the destination manually.
                    </div>
                    <input
                      type="text"
                      value={dropLocation}
                      onChange={(e) => {
                        setDropLocation(e.target.value);
                        // Set dummy coordinates for manual input
                        if (e.target.value.trim()) {
                          setDropCoordinates({
                            lat: 28.5355, // Default Delhi coordinates
                            lng: 77.2910
                          });
                        } else {
                          setDropCoordinates(null);
                        }
                      }}
                      placeholder="Enter destination address..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Retry Google Maps
                    </button>
                  </div>
                ) : !mapsLoaded ? (
                  <div className="w-full px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-700">
                    <FaSpinner className="animate-spin inline mr-2" />
                    Loading Google Maps...
                  </div>
                ) : (
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
                      onChange={(e) => setDropLocation(e.target.value)}
                      placeholder="Search for destination..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </Autocomplete>
                )}
                
                {isCalculatingFare && (
                  <p className="text-sm text-blue-600 mt-2">
                    <FaSpinner className="animate-spin inline mr-2" />
                    Calculating fare...
                  </p>
                )}
                {fareEstimates && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ Fare calculated successfully
                  </p>
                )}
              </div>

              {/* Map Toggle Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
                >
                  <FaMapMarkerAlt />
                  {showMap ? 'Hide Map' : 'Show Map for Drop Location'}
                </button>
              </div>

              {/* Map Container */}
              {showMap && mapsLoaded && (
                <div className="mb-6">
                  <div className="bg-blue-50 p-3 rounded-lg mb-3">
                    <p className="text-sm text-blue-700">
                      <strong>Tip:</strong> Click anywhere on the map to set drop location, or drag the marker to adjust. 
                      Most rides are within 10km radius of the pickup station.
                    </p>
                  </div>
                  <div style={{ height: '400px', borderRadius: '8px', overflow: 'hidden' }}>
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={dropCoordinates || { lat: currentBooth.lat, lng: currentBooth.lng }}
                      zoom={13}
                      onClick={handleMapClick}
                      onLoad={onMapLoad}
                      options={{
                        zoomControl: true,
                        mapTypeControl: true,
                        scaleControl: true,
                        streetViewControl: false,
                        rotateControl: false,
                        fullscreenControl: true
                      }}
                    >
                      {/* Fixed Pickup Location Marker */}
                      <Marker
                        position={{ lat: currentBooth.lat, lng: currentBooth.lng }}
                        title={currentBooth.name}
                        icon={{
                          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                          scaledSize: new window.google.maps.Size(40, 40)
                        }}
                      />
                      
                      {/* Drop Location Marker (Draggable) */}
                      {dropCoordinates && (
                        <Marker
                          position={dropCoordinates}
                          draggable={true}
                          onDragEnd={handleMarkerDragEnd}
                          title="Drop Location - Drag to adjust"
                          icon={{
                            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                            scaledSize: new window.google.maps.Size(40, 40)
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
                      <span style={{ color: '#DC2626' }}>●</span> Drop Location (Draggable)
                    </span>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={prevStep}
                  className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  <FaArrowLeft className="mr-2" />
                  Back
                </button>
                <button
                  onClick={handleLocationSubmit}
                  disabled={!dropLocation || !dropCoordinates || isCalculatingFare}
                  className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Continue
                  <FaArrowRight className="ml-2" />
                </button>
                {mapsError && (
                  <p className="text-sm text-orange-600 mt-2">
                    Google Maps issues detected. You can still proceed if you have entered a location.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Vehicle Selection */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Choose Vehicle & Fare</h2>
              
              {/* Trip Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-medium mb-2">Trip Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>From:</strong> {currentBooth.name}</p>
                    <p><strong>To:</strong> {dropLocation}</p>
                  </div>
                  <div>
                    <p><strong>Distance:</strong> {fareEstimates?.distance || 'Calculating...'} km</p>
                    <p><strong>Customer:</strong> {userName}</p>
                  </div>
                </div>
              </div>

              {/* Vehicle Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {getVehicleOptions().map((vehicle) => (
                  <div
                    key={vehicle.type}
                    onClick={() => handleVehicleSelection(vehicle.type)}
                    className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedVehicle?.type === vehicle.type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-3 text-blue-600">
                        {vehicle.icon}
                      </div>
                      <h3 className="font-medium text-lg">{vehicle.label}</h3>
                      <div className="mt-3">
                        <div className="text-2xl font-bold text-green-600">
                          {typeof vehicle.price === 'number' ? `₹${vehicle.price}` : vehicle.price}
                        </div>
                        <div className="text-sm text-gray-600">
                          {vehicle.eta}
                        </div>
                        {fareEstimates?.estimates?.[vehicle.type] && (
                          <div className="text-xs text-gray-500 mt-1">
                            Distance: {fareEstimates.distance}km
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={prevStep}
                  className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  <FaArrowLeft className="mr-2" />
                  Back
                </button>
                {selectedVehicle && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Selected: {selectedVehicle.label}</p>
                    <button
                      onClick={nextStep}
                      className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Continue
                      <FaArrowRight className="ml-2" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Final Confirmation */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Booking Confirmation</h2>
              
              {/* Complete Booking Summary */}
              <div className="space-y-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Customer Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>Name:</strong> {userName}</p>
                      <p><strong>Phone:</strong> {userPhone}</p>
                    </div>
                    <div>
                      {existingUser ? (
                        <p className="text-green-600">✓ Existing Customer</p>
                      ) : (
                        <p className="text-blue-600">★ New Customer</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Trip Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>From:</strong> {currentBooth.name}</p>
                      <p><strong>To:</strong> {dropLocation}</p>
                    </div>
                    <div>
                      <p><strong>Distance:</strong> {fareEstimates?.distance || 'N/A'} km</p>
                      <p><strong>Est. Time:</strong> {selectedVehicle?.eta || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Vehicle & Fare</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-2xl mr-3 text-green-600">
                        {selectedVehicle?.icon}
                      </div>
                      <div>
                        <p className="font-medium">{selectedVehicle?.label}</p>
                        <p className="text-sm text-gray-600">
                          {fareEstimates?.distance || 'N/A'} km • {selectedVehicle?.eta || 'ETA N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-green-600">
                        {typeof selectedVehicle?.price === 'number' ? `₹${selectedVehicle.price}` : selectedVehicle?.price || 'N/A'}
                      </div>
                      <p className="text-sm text-gray-600">Total Fare</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation Buttons */}
              <div className="flex justify-between">
                <button
                  onClick={prevStep}
                  className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  <FaArrowLeft className="mr-2" />
                  Back
                </button>
                <button
                  onClick={confirmBooking}
                  className="flex items-center bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors text-lg font-medium"
                >
                  <FaCheckCircle className="mr-2" />
                  Confirm Booking
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return renderContent();
};

export default ManualBooking;