import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Autocomplete, Marker } from '@react-google-maps/api';
import { FaMapMarkerAlt, FaCar, FaMotorcycle, FaTaxi, FaUser, FaRupeeSign, FaCheckCircle, FaSpinner, FaUserPlus, FaSearch, FaArrowLeft, FaArrowRight, FaUsers, FaClock, FaPhone } from 'react-icons/fa';
import { admin, users } from '../../services/api';
import { FIXED_PICKUP_LOCATION } from '../../config/fixedLocations';
import { initializeSocket, getSocket } from '../../services/socket';
import { getImageUrl } from '../../utils/imageUtils';

const STORAGE_KEY = 'manualBookingState';

const ManualBooking = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [customerType, setCustomerType] = useState(''); // 'existing' or 'new'
  const [dropLocation, setDropLocation] = useState('');
  const [dropCoordinates, setDropCoordinates] = useState(null);
  const [dropLocationConfirmed, setDropLocationConfirmed] = useState(false);
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
  
  // Driver selection state
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [driverError, setDriverError] = useState('');
  
  // Socket connection state
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [waitingForDriverResponse, setWaitingForDriverResponse] = useState(false);

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
      selectedDriver: selectedDriver ? {
        _id: selectedDriver._id,
        fullName: selectedDriver.fullName,
        mobileNo: selectedDriver.mobileNo,
        vehicleNo: selectedDriver.vehicleNo,
        vehicleType: selectedDriver.vehicleType,
        queuePosition: selectedDriver.queuePosition
      } : null,
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
    
    // Initialize socket for admin
    const initializeAdminSocket = async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.log('[ManualBooking] No admin token found');
        navigate('/admin/login');
        return;
      }
      
      try {
        console.log('[ManualBooking] Initializing socket...');
        const socketResult = initializeSocket(token);
        
        // Handle different return types from initializeSocket
        if (socketResult && typeof socketResult.then === 'function') {
          // It's a Promise
          const actualSocket = await socketResult;
          if (actualSocket) {
            console.log('[ManualBooking] Socket initialized successfully');
            setSocket(actualSocket);
            setSocketConnected(actualSocket.connected);
          } else {
            console.error('[ManualBooking] Failed to initialize socket (Promise returned null)');
          }
        } else if (socketResult) {
          // Direct socket instance
          console.log('[ManualBooking] Socket initialized successfully (direct)');
          setSocket(socketResult);
          setSocketConnected(socketResult.connected);
        } else {
          console.error('[ManualBooking] Socket initialization failed');
        }
      } catch (error) {
        console.error('[ManualBooking] Socket initialization error:', error);
      }
    };
    
    initializeAdminSocket();
    
    // Monitor socket connection
    const checkSocketConnection = () => {
      const socket = getSocket();
      const connected = socket && socket.connected;
      setSocketConnected(connected);
      
      // Log socket status
      if (connected && !socketConnected) {
        console.log('[ManualBooking] Socket is now connected');
      } else if (!connected && socketConnected) {
        console.log('[ManualBooking] Socket disconnected');
      }
    };
    
    // Check immediately after a short delay to let initialization complete
    setTimeout(checkSocketConnection, 500);
    
    // Set up interval to check connection
    const connectionInterval = setInterval(checkSocketConnection, 2000);
    
    return () => clearInterval(connectionInterval);
  }, [navigate]);

  // Set up socket event listeners for ride acceptance/rejection
  useEffect(() => {
    if (!socket || !socketConnected) return;

    console.log('[ManualBooking] Setting up socket event listeners for ride updates');

    // Listen for driver accepting the ride
    const handleDriverAssigned = (data) => {
      console.log('[ManualBooking] 🎉 Driver accepted the ride:', data);
      
      // Check if this is for our booking
      if (bookingDetails && 
          (data.bookingId === bookingDetails.bookingId || 
           data.rideId === bookingDetails._id)) {
        
        setWaitingForDriverResponse(false);
        setBookingDetails(prev => ({
          ...prev,
          status: 'driver_accepted',
          driverName: data.driverName,
          driverId: data.driverId,
          startOTP: data.startOTP,
          endOTP: data.endOTP,
          queueNumber: data.queueNumber,
          message: 'Driver has accepted the ride!'
        }));
      }
    };

    // Listen for driver rejecting the ride
    const handleRideRejected = (data) => {
      console.log('[ManualBooking] ❌ Driver rejected the ride:', data);
      
      // Check if this is for our booking
      if (bookingDetails && 
          (data.bookingId === bookingDetails.bookingId || 
           data.rideId === bookingDetails._id)) {
        
        setWaitingForDriverResponse(false);
        setBookingDetails(prev => ({
          ...prev,
          status: 'driver_rejected',
          message: `Driver rejected the ride: ${data.reason || 'Driver not available'}`,
          rejectionReason: data.reason
        }));
        
        // Alert the admin
        alert(`Driver rejected the ride: ${data.reason || 'Driver not available'}. Please try another driver.`);
      }
    };

    socket.on('driverAssigned', handleDriverAssigned);
    socket.on('rideRejectedByDriver', handleRideRejected);

    return () => {
      socket.off('driverAssigned', handleDriverAssigned);
      socket.off('rideRejectedByDriver', handleRideRejected);
    };
  }, [socket, socketConnected, bookingDetails]);

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

  // Calculate fare only when location is confirmed
  useEffect(() => {
    if (dropCoordinates && dropLocationConfirmed) {
      calculateFareEstimates();
    }
  }, [dropCoordinates, dropLocationConfirmed]);

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
        setDropLocationConfirmed(false); // Reset confirmation when location changes
        
        // Always show map when drop location is selected
        if (!showMap) {
          setShowMap(true);
        }
        
        // Center map on the selected location and fit both markers
        setTimeout(() => {
          if (mapInstance && currentBooth) {
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend({ lat: currentBooth.lat, lng: currentBooth.lng });
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
        
        // Don't calculate fare immediately - wait for confirmation
        // Fare calculation will be triggered when user confirms location
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
    setDropLocationConfirmed(false); // Reset confirmation when location changes
    
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
    setDropLocationConfirmed(false); // Reset confirmation when location changes
    
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
    if (currentStep < 5) setCurrentStep(currentStep + 1);
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
    
    // If location is not confirmed yet, confirm it now
    if (!dropLocationConfirmed) {
      setDropLocationConfirmed(true);
      // Fare calculation will trigger via useEffect
      return;
    }
    
    // If confirmed and fare is calculated, proceed
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
    // Proceed to driver selection instead of final confirmation
    fetchAvailableDrivers(vehicleType);
    nextStep();
  };

  // Fetch available drivers from queue
  const fetchAvailableDrivers = async (vehicleType) => {
    setLoadingDrivers(true);
    setDriverError('');
    
    try {
      // Fetch all drivers and filter by online status and vehicle type
      const response = await admin.getAllDrivers();
      const allDrivers = response.data || [];
      
      console.log('\n🔍 [Manual Booking] Driver Selection Debug:');
      console.log(`📊 Total drivers fetched: ${allDrivers.length}`);
      console.log(`🎯 Looking for vehicle type: ${vehicleType}`);
      console.log(`📍 Pickup station: ${currentBooth.name}`);
      
      // Log all drivers for debugging
      allDrivers.forEach((driver, index) => {
        console.log(`\n👤 Driver ${index + 1}: ${driver.fullName}`);
        console.log(`   📱 Phone: ${driver.mobileNo}`);
        console.log(`   🚗 Vehicle: ${driver.vehicleType} - ${driver.vehicleNo}`);
        console.log(`   🟢 Online: ${driver.isOnline}`);
        console.log(`   📍 Location: ${driver.currentMetroBooth || 'Not set'}`);
        console.log(`   🚦 Current Ride: ${driver.currentRide || 'None'}`);
        console.log(`   🏆 Queue Position: ${driver.queuePosition || 'Not set'}`);
        console.log(`   ⏰ Queue Entry: ${driver.queueEntryTime || 'Not set'}`);
      });
      
      // Use the same filtering logic as Queue Management
      // Step 1: Filter online drivers first
      const onlineDrivers = allDrivers.filter(driver => driver.isOnline);
      console.log(`\n✅ Online drivers: ${onlineDrivers.length}/${allDrivers.length}`);
      
      // Step 2: Filter by vehicle type (but more flexible)
      const vehicleMatchDrivers = onlineDrivers.filter(driver => {
        const matches = !vehicleType || driver.vehicleType === vehicleType;
        if (!matches) {
          console.log(`❌ ${driver.fullName}: Vehicle type mismatch (${driver.vehicleType} != ${vehicleType})`);
        }
        return matches;
      });
      console.log(`🚗 Vehicle type matches: ${vehicleMatchDrivers.length}/${onlineDrivers.length}`);
      
      // Step 3: Filter by current ride status
      const availableDrivers = vehicleMatchDrivers.filter(driver => {
        const available = !driver.currentRide;
        if (!available) {
          console.log(`⏸️ ${driver.fullName}: Currently on ride ${driver.currentRide}`);
        }
        return available;
      });
      console.log(`🆓 Available drivers: ${availableDrivers.length}/${vehicleMatchDrivers.length}`);
      
      // Step 4: Sort by queue entry time (same as Queue Management)
      const sortedDrivers = availableDrivers.sort((a, b) => {
        // Sort by queue entry time (first-come-first-served)
        if (a.queueEntryTime && b.queueEntryTime) {
          return new Date(a.queueEntryTime) - new Date(b.queueEntryTime);
        }
        // Fallback to last active time
        if (a.lastActiveTime && b.lastActiveTime) {
          return new Date(a.lastActiveTime) - new Date(b.lastActiveTime);
        }
        return (a.queuePosition || 999) - (b.queuePosition || 999);
      });
      
      // Step 5: Reassign queue positions based on sorted order
      const finalDrivers = sortedDrivers.map((driver, index) => ({
        ...driver,
        queuePosition: index + 1 // Reassign positions based on sorted order
      }));
      
      console.log(`\n🏁 Final driver queue for ${vehicleType}:`);
      finalDrivers.forEach((driver, index) => {
        console.log(`   ${index + 1}. ${driver.fullName} (${driver.mobileNo}) - ${driver.vehicleNo}`);
      });
      
      setAvailableDrivers(finalDrivers);
      
      if (finalDrivers.length === 0) {
        // If no drivers found with strict filtering, try fallback to all online drivers
        console.log(`\n⚠️ No ${vehicleType} drivers found, trying fallback to all online drivers...`);
        
        const fallbackDrivers = onlineDrivers
          .filter(driver => !driver.currentRide)
          .sort((a, b) => {
            if (a.queueEntryTime && b.queueEntryTime) {
              return new Date(a.queueEntryTime) - new Date(b.queueEntryTime);
            }
            if (a.lastActiveTime && b.lastActiveTime) {
              return new Date(a.lastActiveTime) - new Date(b.lastActiveTime);
            }
            return (a.queuePosition || 999) - (b.queuePosition || 999);
          })
          .map((driver, index) => ({
            ...driver,
            queuePosition: index + 1,
            isVehicleTypeMismatch: driver.vehicleType !== vehicleType
          }));
        
        if (fallbackDrivers.length > 0) {
          console.log(`\n🔄 Fallback: Found ${fallbackDrivers.length} online drivers (any vehicle type)`);
          setAvailableDrivers(fallbackDrivers);
          setDriverError(`No ${vehicleType} drivers available. Showing all online drivers.`);
        } else {
          // If still no drivers found, show helpful error message
          const reasons = [];
          if (allDrivers.length === 0) reasons.push('No drivers in database');
          else if (onlineDrivers.length === 0) reasons.push('No drivers online');
          else reasons.push('All drivers busy');
          
          setDriverError(`No drivers available: ${reasons.join(', ')}`);
        }
      }
      
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setDriverError('Failed to load available drivers');
    } finally {
      setLoadingDrivers(false);
    }
  };

  // Handle driver selection
  const handleDriverSelection = (driver) => {
    setSelectedDriver(driver);
    nextStep(); // Proceed to final confirmation
  };

  // Handle auto-assignment (use queue position #1)
  const handleAutoAssignment = () => {
    if (availableDrivers.length > 0) {
      setSelectedDriver(availableDrivers[0]); // Queue position #1
      nextStep();
    } else {
      alert('No drivers available for auto-assignment');
    }
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
      
      // Restore selected driver
      if (savedState.selectedDriver) {
        setSelectedDriver(savedState.selectedDriver);
      }
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
    debugger; // DEBUGGER 1: Entry point
    console.log('🚀 [Manual Booking] confirmBooking function called');
    console.log('📊 [Manual Booking] Current state:', {
      selectedDriver,
      selectedVehicle,
      userName,
      userPhone,
      dropLocation,
      socketConnected,
      socketExists: !!socket
    });
    
    // Add comprehensive validation and debugging
    try {
      setLoading(true);
      console.log('🔍 [Manual Booking] Setting loading to true');
      
      // Show initial loading message
      setBookingDetails({
        status: 'creating',
        message: 'Creating ride booking...',
        selectedDriver: selectedDriver
      });
      
      // Validate all required data before making API call
      console.log('🔍 [Manual Booking] Validating booking data...');
      
      if (!currentBooth?.name) {
        throw new Error('Pickup station is missing');
      }
      
      if (!dropLocation) {
        throw new Error('Drop location is missing');
      }
      
      if (!selectedVehicle?.type) {
        throw new Error('Vehicle type is missing');
      }
      
      if (!selectedVehicle?.price) {
        throw new Error('Vehicle price is missing');
      }
      
      if (!userPhone) {
        throw new Error('User phone is missing');
      }
      
      if (!userName) {
        throw new Error('User name is missing');
      }
      
      console.log('✅ [Manual Booking] All validation checks passed');
      
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
        selectedDriverId: selectedDriver?._id || null, // Add selected driver
        bookingSource: 'manual',
        paymentStatus: 'collected'
      };

      console.log('📋 [Manual Booking] Prepared booking data:', bookingData);
      console.log('🚗 [Manual Booking] Selected Driver Details:', {
        id: selectedDriver?._id,
        name: selectedDriver?.fullName,
        phone: selectedDriver?.mobileNo,
        vehicleNo: selectedDriver?.vehicleNo,
        queuePosition: selectedDriver?.queuePosition
      });
      console.log('🌐 [Manual Booking] About to call admin.createManualBooking...');
      console.log('🔌 [Manual Booking] Current socket status:', {
        connected: socketConnected,
        socketExists: !!socket,
        globalSocket: !!getSocket()
      });
      
      debugger; // DEBUGGER 2: Before API call
      const response = await admin.createManualBooking(bookingData);
      console.log('✅ [Manual Booking] API call successful, response:', response);
      
      if (response.success) {
        console.log('🎉 [Manual Booking] Booking successful, setting booking details');
        
        // Set waiting state and store booking details
        setWaitingForDriverResponse(true);
        setBookingDetails({
          ...response.booking,
          status: 'waiting_driver',
          message: 'Waiting for driver to accept the ride...',
          selectedDriver: selectedDriver,
          vehicleInfo: selectedVehicle,
          pickupLocation: currentBooth,
          dropLocation: { address: dropLocation }
        });
        
        // Clear saved state on successful booking
        clearBookingState();
        console.log('✅ [Manual Booking] Ride request sent to driver, waiting for response...');
      } else {
        console.error('❌ [Manual Booking] Booking failed - API returned success: false');
        console.error('❌ [Manual Booking] Response:', response);
        throw new Error(response.message || 'Booking failed - unknown reason');
      }
    } catch (error) {
      console.error('💥 [Manual Booking] Error in confirmBooking:', error);
      console.error('💥 [Manual Booking] Error type:', typeof error);
      console.error('💥 [Manual Booking] Error message:', error.message);
      console.error('💥 [Manual Booking] Error response:', error.response?.data);
      console.error('💥 [Manual Booking] Error status:', error.response?.status);
      console.error('💥 [Manual Booking] Full error object:', error);
      
      // More detailed error handling
      let errorMessage = 'Failed to book ride';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show specific error messages
      if (errorMessage.includes('not available') || errorMessage.includes('no driver')) {
        setBookingDetails({
          status: 'no_drivers',
          message: '⚠️ No drivers available for the selected vehicle type. Please try a different vehicle type or wait a few minutes.',
          vehicleInfo: selectedVehicle,
          pickupLocation: currentBooth,
          dropLocation: { address: dropLocation }
        });
      } else if (errorMessage.includes('not online') || errorMessage.includes('not reachable')) {
        setBookingDetails({
          status: 'driver_offline',
          message: `⚠️ ${errorMessage}\n\nPlease check Queue Management to ensure the driver is online, then try again.`,
          vehicleInfo: selectedVehicle,
          pickupLocation: currentBooth,
          dropLocation: { address: dropLocation },
          selectedDriver: selectedDriver
        });
      } else {
        alert(`Booking failed: ${errorMessage}`);
      }
    } finally {
      console.log('🔄 [Manual Booking] Setting loading to false');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setCustomerType('');
    setDropLocation('');
    setDropCoordinates(null);
    setDropLocationConfirmed(false);
    setFareEstimates(null);
    setSelectedVehicle(null);
    setSelectedDriver(null);
    setAvailableDrivers([]);
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
    // Show loading states during booking process
    if (bookingDetails.status === 'creating') {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <FaSpinner className="animate-spin text-blue-500 text-6xl mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Creating Ride Booking...</h2>
              <p className="text-gray-600 mt-2">{bookingDetails.message}</p>
            </div>
          </div>
        </div>
      );
    }
    
    // Show waiting for driver acceptance
    if (bookingDetails.status === 'waiting_driver') {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <FaClock className="animate-pulse text-yellow-500 text-6xl mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Waiting for Driver</h2>
              <p className="text-gray-600 mt-2">{bookingDetails.message}</p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold text-lg mb-2">Assigned Driver</h3>
              <div className="flex items-center space-x-4">
                <FaUser className="text-blue-500 text-2xl" />
                <div>
                  <p><strong>Name:</strong> {bookingDetails.selectedDriver?.fullName}</p>
                  <p><strong>Phone:</strong> {bookingDetails.selectedDriver?.mobileNo}</p>
                  <p><strong>Vehicle:</strong> {bookingDetails.selectedDriver?.vehicleNo}</p>
                </div>
              </div>
            </div>
            
            {bookingDetails.queueNumber && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Queue Information</h3>
                <p><strong>Queue Number:</strong> {bookingDetails.queueNumber}</p>
                <p><strong>Booking ID:</strong> {bookingDetails.bookingId}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Show driver offline error state
    if (bookingDetails.status === 'driver_offline') {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <FaSpinner className="text-yellow-500 text-6xl mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Driver Not Reachable</h2>
              <p className="text-gray-600 mt-2 whitespace-pre-line">{bookingDetails.message}</p>
            </div>
            
            {bookingDetails.selectedDriver && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-lg mb-2">Selected Driver</h3>
                <p><strong>Name:</strong> {bookingDetails.selectedDriver.fullName}</p>
                <p><strong>Phone:</strong> {bookingDetails.selectedDriver.mobileNo}</p>
                <p><strong>Vehicle:</strong> {bookingDetails.selectedDriver.vehicleNo}</p>
                <p className="text-red-600 mt-2">⚠️ Driver appears to be offline or disconnected</p>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setBookingDetails(null);
                  setCurrentStep(4); // Go back to driver selection
                }}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Select Different Driver
              </button>
              <button
                onClick={() => navigate('/admin/queue-management')}
                className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Check Queue Management
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    const isWaiting = bookingDetails.status === 'waiting_driver';
    const isRejected = bookingDetails.status === 'driver_rejected';
    
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            {isWaiting ? (
              <>
                <FaSpinner className="text-blue-500 text-6xl mx-auto mb-4 animate-spin" />
                <h2 className="text-2xl font-bold text-gray-800">Waiting for Driver Response...</h2>
                <p className="text-gray-600 mt-2">{bookingDetails.message}</p>
              </>
            ) : isRejected ? (
              <>
                <div className="text-red-500 text-6xl mx-auto mb-4">❌</div>
                <h2 className="text-2xl font-bold text-gray-800">Driver Rejected</h2>
                <p className="text-red-600 mt-2">{bookingDetails.message}</p>
              </>
            ) : (
              <>
                <FaCheckCircle className="text-green-500 text-6xl mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Ride Accepted by Driver!</h2>
              </>
            )}
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
              <h3 className="font-semibold text-lg mb-2">🔐 OTP Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center bg-white p-4 rounded-lg border-2 border-blue-200">
                  <p className="text-sm text-gray-600 mb-2">🚀 Start OTP</p>
                  <p className="text-4xl font-bold text-blue-600 font-mono">{bookingDetails.startOTP}</p>
                  <p className="text-xs text-gray-500 mt-2">Driver needs this to start ride</p>
                </div>
                <div className="text-center bg-white p-4 rounded-lg border-2 border-red-200">
                  <p className="text-sm text-gray-600 mb-2">🏁 End OTP</p>
                  <p className="text-4xl font-bold text-red-600 font-mono">{bookingDetails.endOTP}</p>
                  <p className="text-xs text-gray-500 mt-2">Driver needs this to end ride</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Important:</strong> Share these OTPs with the customer. Driver will ask for them to start and complete the ride.
                </p>
              </div>
            </div>

            {(bookingDetails.driver || bookingDetails.selectedDriver) && (
              <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                <h3 className="font-semibold text-lg mb-3">🚗 Assigned Driver</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Driver Name</p>
                    <p className="font-bold text-lg">{bookingDetails.driver?.name || bookingDetails.selectedDriver?.fullName}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Phone Number</p>
                    <p className="font-bold text-lg">{bookingDetails.driver?.phone || bookingDetails.selectedDriver?.mobileNo}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Vehicle Number</p>
                    <p className="font-bold text-lg">{bookingDetails.driver?.vehicleNumber || bookingDetails.selectedDriver?.vehicleNo}</p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-green-100 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>✅ Status:</strong> Driver assigned and ready to start ride
                  </p>
                </div>
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
              onClick={() => navigate('/admin/rides')}
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
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-800">Manual Ride Booking</h1>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                socketConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {socketConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </div>
            </div>
            <div className="flex items-center mt-4">
              {[1, 2, 3, 4, 5].map((step) => (
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
                  {step < 5 && <div className={`h-1 w-8 mx-1 ${currentStep > step ? 'bg-green-600' : 'bg-gray-300'}`} />}
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>Customer</span>
              <span>Location</span>
              <span>Vehicle</span>
              <span>Driver</span>
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
                  <div className={`p-3 rounded-lg mb-3 transition-all ${
                    dropCoordinates && !dropLocationConfirmed 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-blue-50'
                  }`}>
                    <p className={`text-sm ${
                      dropCoordinates && !dropLocationConfirmed 
                        ? 'text-green-700' 
                        : 'text-blue-700'
                    }`}>
                      {dropCoordinates && !dropLocationConfirmed ? (
                        <>
                          <strong>✨ Drop location selected!</strong> Drag the red marker to adjust or click 'Confirm Drop Location' to calculate fare.
                        </>
                      ) : (
                        <>
                          <strong>Tip:</strong> Click anywhere on the map to set drop location, or drag the marker to adjust. 
                          Most rides are within 10km radius of the pickup station.
                        </>
                      )}
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
                  disabled={!dropLocation || !dropCoordinates || (dropLocationConfirmed && isCalculatingFare)}
                  className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {!dropLocation ? 'Enter Drop Location' :
                   !dropCoordinates ? 'Select Drop Location' :
                   !dropLocationConfirmed ? 'Confirm Drop Location' :
                   isCalculatingFare ? 'Calculating Fare...' :
                   'Continue'}
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

          {/* Step 4: Driver Selection */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Select Driver from Queue</h2>
              
              {/* Trip Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-medium mb-2">Trip Summary</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p><strong>Vehicle:</strong> {selectedVehicle?.label}</p>
                    <p><strong>Fare:</strong> ₹{selectedVehicle?.price}</p>
                  </div>
                  <div>
                    <p><strong>From:</strong> {currentBooth.name}</p>
                    <p><strong>To:</strong> {dropLocation}</p>
                  </div>
                  <div>
                    <p><strong>Customer:</strong> {userName}</p>
                    <p><strong>Phone:</strong> {userPhone}</p>
                  </div>
                </div>
              </div>

              {/* Driver Selection */}
              <div className="mb-6">
                <h3 className="font-medium mb-4 flex items-center">
                  <FaUsers className="mr-2 text-blue-600" />
                  Available {selectedVehicle?.label} Drivers ({availableDrivers.length})
                </h3>

                {/* Auto Assign Option */}
                <div className="mb-4">
                  <button
                    onClick={handleAutoAssignment}
                    disabled={availableDrivers.length === 0}
                    className="w-full p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-blue-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🚀 Auto Assign (Queue Position #1)
                    {availableDrivers.length > 0 && (
                      <div className="text-sm text-gray-600 mt-1">
                        Next: {availableDrivers[0]?.fullName}
                      </div>
                    )}
                  </button>
                </div>

                {/* Loading State */}
                {loadingDrivers && (
                  <div className="text-center py-8">
                    <FaSpinner className="animate-spin text-blue-600 text-2xl mx-auto mb-4" />
                    <p className="text-gray-600">Loading available drivers...</p>
                  </div>
                )}

                {/* Error State */}
                {driverError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-800 text-sm">{driverError}</p>
                  </div>
                )}

                {/* Driver List */}
                {!loadingDrivers && !driverError && (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {availableDrivers.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <FaUser className="text-gray-400 text-3xl mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">No {selectedVehicle?.label} drivers available</p>
                        <p className="text-gray-500 text-sm">Please check queue management or try a different vehicle type</p>
                      </div>
                    ) : (
                      availableDrivers.map((driver, index) => (
                        <div
                          key={driver._id}
                          onClick={() => handleDriverSelection(driver)}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedDriver?._id === driver._id
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : driver.isVehicleTypeMismatch
                                ? 'border-orange-200 bg-orange-50 hover:border-orange-300'
                                : index === 0
                                  ? 'border-green-200 bg-green-50 hover:border-green-300'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {/* Queue Position */}
                              <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                                index === 0 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                #{driver.queuePosition || index + 1}
                              </div>
                              
                              {/* Driver Photo */}
                              {driver.driverSelfie ? (
                                <img 
                                  src={getImageUrl(driver.driverSelfie)} 
                                  alt={driver.fullName} 
                                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                  <FaUser className="text-gray-400" />
                                </div>
                              )}
                              
                              {/* Driver Info */}
                              <div>
                                <h4 className="font-medium text-gray-800 flex items-center">
                                  {driver.fullName}
                                  {index === 0 && !driver.isVehicleTypeMismatch && (
                                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                      Next in Queue
                                    </span>
                                  )}
                                  {driver.isVehicleTypeMismatch && (
                                    <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                                      Different Vehicle
                                    </span>
                                  )}
                                </h4>
                                <p className="text-sm text-gray-600 flex items-center">
                                  <FaPhone className="mr-1" /> {driver.mobileNo}
                                </p>
                                <p className={`text-sm ${driver.isVehicleTypeMismatch ? 'text-orange-600' : 'text-gray-500'}`}>
                                  🚗 {driver.vehicleNo} • {driver.vehicleType?.toUpperCase()}
                                  {driver.isVehicleTypeMismatch && (
                                    <span className="ml-2 text-xs">
                                      (Expected: {selectedVehicle?.type?.toUpperCase()})
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            
                            {/* Driver Stats */}
                            <div className="text-right">
                              <div className="text-sm text-blue-600 font-medium">
                                <FaClock className="inline mr-1" />
                                {driver.queueEntryTime ? (
                                  (() => {
                                    const waitTime = Math.floor((new Date() - new Date(driver.queueEntryTime)) / 60000);
                                    return waitTime < 60 ? `${waitTime}m in queue` : `${Math.floor(waitTime/60)}h ${waitTime%60}m in queue`;
                                  })()
                                ) : 'Just joined'}
                              </div>
                              {driver.rating && (
                                <div className="text-xs text-yellow-600">
                                  ⭐ {driver.rating.toFixed(1)} ({driver.totalRides || 0} rides)
                                </div>
                              )}
                              {driver.currentMetroBooth && (
                                <div className="text-xs text-gray-500">
                                  📍 {driver.currentMetroBooth}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
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
                <button
                  onClick={nextStep}
                  disabled={!selectedDriver}
                  className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Continue with {selectedDriver ? selectedDriver.fullName : 'Selected Driver'}
                  <FaArrowRight className="ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Final Confirmation */}
          {currentStep === 5 && (
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

                {/* Driver Details */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Assigned Driver</h3>
                  {selectedDriver ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p><strong>Name:</strong> {selectedDriver.fullName}</p>
                        <p><strong>Phone:</strong> {selectedDriver.mobileNo}</p>
                        <p><strong>Vehicle:</strong> {selectedDriver.vehicleNo}</p>
                      </div>
                      <div>
                        <p><strong>Type:</strong> {selectedDriver.vehicleType?.toUpperCase()}</p>
                        <p><strong>Queue Position:</strong> #{selectedDriver.queuePosition}</p>
                        <div className="flex items-center mt-2">
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            ✓ Selected from Queue
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600">No driver selected</p>
                  )}
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

              {/* Socket Connection Warning */}
              {!socketConnected && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                  <p className="text-yellow-800">
                    ⚠️ Socket connection lost. Please check your internet connection before booking.
                  </p>
                </div>
              )}

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
                  onClick={() => {
                    debugger; // DEBUGGER: Confirm booking button clicked
                    console.log('🖱️ [Manual Booking] Confirm Booking button clicked!');
                    console.log('📊 [Manual Booking] Complete state check:', {
                      socketConnected,
                      socketExists: !!socket,
                      globalSocketExists: !!getSocket(),
                      selectedDriver: {
                        id: selectedDriver?._id,
                        name: selectedDriver?.fullName,
                        phone: selectedDriver?.mobileNo,
                        vehicleType: selectedDriver?.vehicleType,
                        vehicleNo: selectedDriver?.vehicleNo,
                        queuePosition: selectedDriver?.queuePosition
                      },
                      selectedVehicle: {
                        type: selectedVehicle?.type,
                        label: selectedVehicle?.label,
                        price: selectedVehicle?.price
                      },
                      customer: {
                        name: userName,
                        phone: userPhone,
                        existingUserId: existingUser?._id
                      },
                      trip: {
                        pickup: currentBooth.name,
                        drop: dropLocation,
                        distance: fareEstimates?.distance
                      }
                    });
                    
                    if (!socketConnected || !socket) {
                      // Try to re-initialize socket
                      console.log('⚠️ [ManualBooking] Socket not ready, attempting to initialize...');
                      const token = localStorage.getItem('adminToken');
                      if (token) {
                        const socketPromise = initializeSocket(token);
                        if (socketPromise && typeof socketPromise.then === 'function') {
                          socketPromise.then((sock) => {
                            const newSocket = sock || getSocket();
                            if (newSocket && newSocket.connected) {
                              console.log('✅ [ManualBooking] Socket re-initialized successfully');
                              setSocket(newSocket);
                              setSocketConnected(true);
                              confirmBooking();
                            } else {
                              alert('⚠️ Unable to establish connection. Please refresh the page and try again.');
                            }
                          }).catch((error) => {
                            console.error('[ManualBooking] Socket re-initialization error:', error);
                            alert('⚠️ Connection error. Please refresh the page and try again.');
                          });
                        } else {
                          // Direct socket returned
                          const newSocket = socketPromise || getSocket();
                          if (newSocket && newSocket.connected) {
                            console.log('[ManualBooking] Socket ready (direct)');
                            setSocket(newSocket);
                            setSocketConnected(true);
                            confirmBooking();
                          } else {
                            alert('⚠️ Unable to establish connection. Please refresh the page and try again.');
                          }
                        }
                      } else {
                        alert('⚠️ Authentication lost. Please login again.');
                        navigate('/admin/login');
                      }
                      return;
                    }
                    confirmBooking();
                  }}
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