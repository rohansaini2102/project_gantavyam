import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker, Autocomplete, DirectionsRenderer } from '@react-google-maps/api';
import { users } from '../../services/api';
import { initializeSocket, subscribeToUserRideUpdates, unsubscribeFromUserRideUpdates, isSocketConnected, cancelRide } from '../../services/socket';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Utility function to check if token is valid
const isTokenValid = (token, onExpiringSoon = null) => {
  if (!token) {
    console.log('[Auth] No token provided');
    return false;
  }
  
  try {
    // Decode JWT payload
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Date.now();
    const expiry = payload.exp * 1000;
    const isValid = expiry > now;
    const timeLeft = Math.round((expiry - now) / 1000 / 60);
    
    console.log('[Auth] Token validation:', {
      exp: new Date(expiry),
      now: new Date(now),
      isValid,
      timeLeft: timeLeft + ' minutes'
    });
    
    // Warn if token expires within 5 minutes
    if (isValid && timeLeft <= 5 && onExpiringSoon) {
      console.warn('[Auth] Token expires soon! Time left:', timeLeft, 'minutes');
      onExpiringSoon('Session expiring soon. Please save your work and refresh the page.');
    }
    
    return isValid;
  } catch (error) {
    console.error('[Auth] Token validation error:', error);
    return false;
  }
};

const UserDashboard = () => {
  const navigate = useNavigate();
  
  // User state
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [locationsByType, setLocationsByType] = useState({});
  const [metroStations, setMetroStations] = useState([]); // Keep for backward compatibility
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('all'); // all, metro, railway, airport, bus_terminal
  const [selectedStation, setSelectedStation] = useState('');
  const [pickupSearchQuery, setPickupSearchQuery] = useState('');
  const [showPickupResults, setShowPickupResults] = useState(false);
  const [selectedPickupIndex, setSelectedPickupIndex] = useState(-1);
  const [maxPickupResults, setMaxPickupResults] = useState(8);
  const [dropLocation, setDropLocation] = useState('');
  const [dropCoordinates, setDropCoordinates] = useState(null);
  const [autocomplete, setAutocomplete] = useState(null);
  const [directions, setDirections] = useState(null);
  
  // Booking state
  const [vehicleType, setVehicleType] = useState('auto'); // bike, auto, car
  const [fareEstimates, setFareEstimates] = useState(null);
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  
  // Ride state
  const [activeRide, setActiveRide] = useState(null);
  const [rideHistory, setRideHistory] = useState([]);
  const [showOTP, setShowOTP] = useState(null);
  
  // Cancel ride state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  console.log('[UserDashboard] Component mounted');

  // Helper functions for transportation types
  const getLocationIcon = (type) => {
    const icons = {
      metro: '🚇',
      railway: '🚂', 
      airport: '✈️',
      bus_terminal: '🚌'
    };
    return icons[type] || '📍';
  };

  const getLocationTypeLabel = (type) => {
    const labels = {
      metro: 'Metro Station',
      railway: 'Railway Station',
      airport: 'Airport Terminal', 
      bus_terminal: 'Bus Terminal'
    };
    return labels[type] || 'Location';
  };

  const getFilteredLocations = () => {
    if (selectedLocationFilter === 'all') {
      return pickupLocations;
    }
    return pickupLocations.filter(location => location.type === selectedLocationFilter);
  };

  // Search and filter pickup locations
  const searchPickupLocations = (query) => {
    if (!query.trim()) {
      return getFilteredLocations().slice(0, maxPickupResults);
    }

    const searchTerm = query.toLowerCase().trim();
    const filtered = getFilteredLocations();
    
    // Score-based matching for better relevance
    const scored = filtered.map(location => {
      let score = 0;
      const name = location.name.toLowerCase();
      const address = location.address.toLowerCase();
      const line = location.line ? location.line.toLowerCase() : '';
      const subType = location.subType ? location.subType.toLowerCase() : '';
      
      // Exact match gets highest score
      if (name === searchTerm) score += 100;
      else if (name.startsWith(searchTerm)) score += 80;
      else if (name.includes(searchTerm)) score += 60;
      
      // Address matching
      if (address.includes(searchTerm)) score += 40;
      
      // Line matching for metro
      if (line && line.includes(searchTerm)) score += 30;
      
      // SubType matching
      if (subType && subType.includes(searchTerm)) score += 25;
      
      // Fuzzy matching for typos (simple implementation)
      if (score === 0) {
        const words = [name, address, line, subType].join(' ').split(' ');
        const hasPartialMatch = words.some(word => 
          word.length > 2 && (
            word.includes(searchTerm) || 
            searchTerm.includes(word) ||
            levenshteinDistance(word, searchTerm) <= 2
          )
        );
        if (hasPartialMatch) score += 10;
      }
      
      // Priority boost
      score += (location.priority || 0) * 2;
      
      return { ...location, searchScore: score };
    });
    
    // Filter out non-matches and sort by score
    return scored
      .filter(item => item.searchScore > 0)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, maxPickupResults);
  };

  // Simple Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  // Get search results
  const getSearchResults = () => {
    return searchPickupLocations(pickupSearchQuery);
  };

  // Handle pickup location selection
  const handlePickupSelect = (location) => {
    setSelectedStation(location.name);
    setPickupSearchQuery(location.name);
    setShowPickupResults(false);
    setSelectedPickupIndex(-1);
    setFareEstimates(null);
    setDirections(null);
    
    // Calculate directions if drop location is already set
    if (dropCoordinates) {
      calculateDirections(location.name, dropCoordinates);
    }
  };

  // Highlight matched text in search results
  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <span key={index} style={{ backgroundColor: '#ffeaa7', fontWeight: 'bold' }}>{part}</span> : 
        part
    );
  };

  // Handle keyboard navigation in search results
  const handlePickupKeyDown = (e) => {
    const results = getSearchResults();
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedPickupIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedPickupIndex(prev => prev > -1 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedPickupIndex >= 0 && results[selectedPickupIndex]) {
          handlePickupSelect(results[selectedPickupIndex]);
        }
        break;
      case 'Escape':
        setShowPickupResults(false);
        setSelectedPickupIndex(-1);
        break;
      default:
        break;
    }
  };

  // Handle search input changes
  const handlePickupSearchChange = (e) => {
    const value = e.target.value;
    setPickupSearchQuery(value);
    setShowPickupResults(true);
    setSelectedPickupIndex(-1);
    
    // Clear selected station if search query doesn't match
    if (selectedStation && !selectedStation.toLowerCase().includes(value.toLowerCase())) {
      setSelectedStation('');
      setFareEstimates(null);
      setDirections(null);
    }
  };

  // Close search results when clicking outside
  const handlePickupInputBlur = (e) => {
    // Delay hiding to allow clicking on results
    setTimeout(() => {
      if (e.currentTarget && document.activeElement && !e.currentTarget.contains(document.activeElement)) {
        setShowPickupResults(false);
        setSelectedPickupIndex(-1);
      }
    }, 150);
  };

  // Authentication check and socket initialization
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('[UserDashboard] Checking authentication...');
      
      // Add a small delay to ensure localStorage is updated after login
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const token = localStorage.getItem('userToken');
      const userData = localStorage.getItem('user');
      
      console.log('[UserDashboard] Found in localStorage:', {
        hasToken: !!token,
        hasUserData: !!userData,
        tokenLength: token?.length,
        tokenPreview: token ? token.substring(0, 50) + '...' : 'none'
      });
      
      // Check if we have an old expired token and clear it
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiry = new Date(payload.exp * 1000);
          const now = new Date();
          console.log('[UserDashboard] Token expiry check:', {
            expiry: expiry.toISOString(),
            now: now.toISOString(),
            isExpired: expiry <= now
          });
          
          if (expiry <= now) {
            console.log('[UserDashboard] Found expired token, clearing and redirecting to login');
            localStorage.removeItem('userToken');
            localStorage.removeItem('user');
            navigate('/user/login');
            return;
          }
        } catch (error) {
          console.error('[UserDashboard] Error parsing token:', error);
          localStorage.removeItem('userToken');
          localStorage.removeItem('user');
          navigate('/user/login');
          return;
        }
      }
      
      if (!token || !userData) {
        console.log('[UserDashboard] No authentication data found');
        navigate('/user/login');
        return;
      }
      
      // Validate token
      if (!isTokenValid(token, setBookingError)) {
        console.log('[UserDashboard] Token is expired or invalid, redirecting to login');
        localStorage.removeItem('userToken');
        localStorage.removeItem('user');
        navigate('/user/login');
        return;
      }
      
      try {
        const parsedUser = JSON.parse(userData);
        console.log('[UserDashboard] User loaded:', parsedUser);
        setUser(parsedUser);
        
        // Initialize socket connection
        console.log('[UserDashboard] Initializing socket connection...');
        const socketInstance = initializeSocket(token);
        setSocket(socketInstance);
        
        // Check socket connection status
        const checkConnection = () => {
          const connected = isSocketConnected();
          setSocketConnected(connected);
          console.log('[UserDashboard] Socket connected:', connected);
        };
        
        // Check immediately and then periodically
        checkConnection();
        const connectionInterval = setInterval(checkConnection, 2000);
        
        return () => clearInterval(connectionInterval);
      } catch (error) {
        console.error('[UserDashboard] Error parsing user data:', error);
        navigate('/user/login');
      }
    };

    initializeAuth();
  }, [navigate]);

  // Load pickup locations from backend
  useEffect(() => {
    const loadPickupLocations = async () => {
      try {
        console.log('[UserDashboard] Loading pickup locations from backend...');
        const response = await users.getMetroStations(); // This now returns all pickup locations
        console.log('[UserDashboard] Pickup locations loaded:', response.data);
        
        const locations = response.data.stations || [];
        const byType = response.data.locationsByType || {};
        
        setPickupLocations(locations);
        setLocationsByType(byType);
        
        // For backward compatibility, also set metroStations
        const metroOnly = locations.filter(loc => loc.type === 'metro');
        setMetroStations(metroOnly);
        
        console.log('[UserDashboard] Location summary:', {
          total: locations.length,
          metro: byType.metro?.length || 0,
          railway: byType.railway?.length || 0,
          airport: byType.airport?.length || 0,
          bus_terminal: byType.bus_terminal?.length || 0
        });
      } catch (error) {
        console.error('[UserDashboard] Error loading pickup locations:', error);
        setBookingError('Failed to load pickup locations');
      }
    };

    if (user) {
      loadPickupLocations();
    }
  }, [user]);

  // Get user location
  useEffect(() => {
    console.log('[UserDashboard] Getting user location...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('[UserDashboard] Location obtained:', location);
          setUserLocation(location);
        },
        (error) => {
          console.error('[UserDashboard] Geolocation error:', error);
          // Default to Delhi center
          const defaultLocation = { lat: 28.6139, lng: 77.2090 };
          setUserLocation(defaultLocation);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Load active rides and ride history
  useEffect(() => {
    const loadRideData = async () => {
      try {
        console.log('[UserDashboard] Loading ride data...');
        const [activeResponse, historyResponse] = await Promise.all([
          users.getActiveRides(),
          users.getRideHistory(1, 5)
        ]);
        
        console.log('[UserDashboard] Active rides:', activeResponse.data);
        console.log('[UserDashboard] Ride history:', historyResponse.data);
        
        const activeRides = activeResponse.data?.activeRides || [];
        if (activeRides.length > 0) {
          setActiveRide(activeRides[0]); // Show the most recent active ride
        }
        
        setRideHistory(historyResponse.data?.rideHistory || []);
      } catch (error) {
        console.error('[UserDashboard] Error loading ride data:', error);
        // Don't logout on these errors - they're not critical for dashboard functionality
        // Just log the error and continue
        if (error.status === 401) {
          console.log('[UserDashboard] Ride data APIs returned 401, but continuing without ride history');
        }
      }
    };

    if (user) {
      // Add a small delay to ensure token is properly set after authentication
      setTimeout(() => {
        loadRideData();
      }, 500);
    }
  }, [user]);

  // Set up socket listeners for ride updates
  useEffect(() => {
    if (socket && socketConnected) {
      console.log('[UserDashboard] Setting up socket listeners...');
      
      subscribeToUserRideUpdates({
        onRideAccepted: (data) => {
          console.log('[UserDashboard] Ride accepted:', data);
          setActiveRide(prev => ({ ...prev, ...data, status: 'driver_assigned' }));
          setShowOTP({ type: 'start', otp: data.startOTP });
          setBookingError('');
        },
        
        onRideStarted: (data) => {
          console.log('[UserDashboard] Ride started:', data);
          setActiveRide(prev => ({ ...prev, ...data, status: 'ride_started' }));
          setShowOTP({ type: 'end', otp: data.endOTP });
        },
        
        onRideEnded: (data) => {
          console.log('[UserDashboard] Ride ended:', data);
          // Keep ride active to show completion processing
          setActiveRide(prev => ({ ...prev, ...data, status: 'ride_ended' }));
          setShowOTP(null);
        },
        
        onRideCompleted: (data) => {
          console.log('[UserDashboard] Ride completed automatically:', data);
          setActiveRide(null);
          setShowOTP(null);
          // Reload ride history to show the completed ride
          users.getRideHistory(1, 5).then(response => {
            setRideHistory(response.data?.rideHistory || []);
          }).catch(error => {
            console.error('[UserDashboard] Error reloading ride history:', error);
          });
        },
        
        onRideCancelled: (data) => {
          console.log('[UserDashboard] Ride cancelled:', data);
          setActiveRide(null);
          setShowOTP(null);
          setBookingError(`Ride cancelled: ${data.reason || 'No reason provided'}`);
        },
        
        onDriverLocationUpdate: (data) => {
          console.log('[UserDashboard] Driver location update:', data);
          // Update driver location in active ride
          if (activeRide && data.rideId === activeRide.rideId) {
            setActiveRide(prev => ({
              ...prev,
              driverLocation: data.location
            }));
          }
        },
        
        onPaymentCollected: (data) => {
          console.log('[UserDashboard] Payment collected:', data);
          setActiveRide(null);
          setShowOTP(null);
          setBookingError(`✅ Payment collected! Ride completed. Amount: ₹${data.amount}`);
          // Reload ride history
          users.getRideHistory(1, 5).then(response => {
            setRideHistory(response.data?.rideHistory || []);
          });
        }
      });

      return () => {
        unsubscribeFromUserRideUpdates();
      };
    }
  }, [socket, socketConnected, activeRide]);

  // Check authentication before API calls
  const checkAuthBeforeApiCall = () => {
    const token = localStorage.getItem('userToken');
    
    // Check for contamination from other token types
    const adminToken = localStorage.getItem('adminToken');
    const driverToken = localStorage.getItem('driverToken');
    
    console.log('[UserDashboard] checkAuthBeforeApiCall - comprehensive token check:', {
      hasUserToken: !!token,
      hasAdminToken: !!adminToken,
      hasDriverToken: !!driverToken,
      userTokenLength: token?.length,
      userTokenStart: token?.substring(0, 20) + '...',
      allTokens: {
        user: !!token,
        admin: !!adminToken,
        driver: !!driverToken
      }
    });
    
    // Clear any non-user tokens that might contaminate the API calls
    if (adminToken) {
      console.log('[UserDashboard] Removing contaminating admin token');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('admin');
    }
    if (driverToken) {
      console.log('[UserDashboard] Removing contaminating driver token');
      localStorage.removeItem('driverToken');
      localStorage.removeItem('driver');
    }
    
    if (!token) {
      console.log('[UserDashboard] No user token found, redirecting to login');
      setBookingError('Session expired. Please login again.');
      setTimeout(() => navigate('/user/login'), 2000);
      return false;
    }
    
    if (!isTokenValid(token, setBookingError)) {
      console.log('[UserDashboard] User token expired, redirecting to login');
      setBookingError('Session expired. Please login again.');
      localStorage.removeItem('userToken');
      localStorage.removeItem('user');
      setTimeout(() => navigate('/user/login'), 2000);
      return false;
    }
    
    console.log('[UserDashboard] User token validation passed');
    return true;
  };

  // Calculate fare based on selected options
  const calculateFare = async () => {
    if (!selectedStation || !dropLocation.trim()) {
      setBookingError('Please select pickup station and drop location');
      return;
    }
    
    if (!dropCoordinates) {
      setBookingError('Please select a drop location from autocomplete suggestions or click on map');
      return;
    }
    
    // Check authentication before making API call
    if (!checkAuthBeforeApiCall()) {
      return;
    }
    
    setIsCalculatingFare(true);
    setBookingError('');
    
    try {
      console.log('[UserDashboard] Calculating fare...');
      const response = await users.getFareEstimate({
        pickupStation: selectedStation,
        dropLat: dropCoordinates.lat,
        dropLng: dropCoordinates.lng
      });
      
      console.log('[UserDashboard] Fare calculated:', response.data);
      // Backend returns {success: true, data: {estimates, distance, etc}}
      // We need to access response.data.data to get the actual fare data
      const fareData = response.data.data || response.data;
      console.log('[UserDashboard] Setting fare estimates:', fareData);
      
      // Validate that we have the expected structure
      if (!fareData.estimates) {
        console.error('[UserDashboard] Invalid fare data structure:', fareData);
        setBookingError('Invalid response from server. Please try again.');
        return;
      }
      
      setFareEstimates(fareData);
    } catch (error) {
      console.error('[UserDashboard] Error calculating fare:', error);
      
      // Handle authentication errors specifically
      if (error.status === 401) {
        console.log('[UserDashboard] 401 error - token invalid, redirecting to login');
        setBookingError('Session expired. Please login again.');
        localStorage.removeItem('userToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/user/login'), 2000);
      } else {
        setBookingError(error.error || 'Failed to calculate fare. Please try again.');
      }
    } finally {
      setIsCalculatingFare(false);
    }
  };

  // Book ride
  const bookRide = async () => {
    if (!fareEstimates || !vehicleType) {
      setBookingError('Please calculate fare first and select vehicle type');
      return;
    }
    
    // Check authentication before making API call
    if (!checkAuthBeforeApiCall()) {
      return;
    }
    
    setIsBooking(true);
    setBookingError('');
    
    try {
      console.log('[UserDashboard] Booking ride...');
      const selectedFareDetails = fareEstimates.estimates[vehicleType];
      const selectedFare = selectedFareDetails.totalFare || selectedFareDetails;
      
      const bookingData = {
        pickupStation: selectedStation,
        dropLocation: {
          address: dropLocation,
          lat: dropCoordinates.lat,
          lng: dropCoordinates.lng
        },
        vehicleType: vehicleType,
        estimatedFare: selectedFare
      };
      
      console.log('[UserDashboard] Booking data:', bookingData);
      const response = await users.bookRide(bookingData);
      
      console.log('[UserDashboard] Ride booked successfully:', response.data);
      setActiveRide({
        ...response.data.data,
        status: 'pending'
      });
      
      // Show user that request has been sent to drivers
      setBookingError('✅ Ride request sent to nearby drivers! Waiting for driver to accept...');
      
      // Clear form
      setFareEstimates(null);
      setDropLocation('');
      setDropCoordinates(null);
      setDirections(null);
      
    } catch (error) {
      console.error('[UserDashboard] Error booking ride:', error);
      
      // Handle authentication errors specifically
      if (error.status === 401) {
        console.log('[UserDashboard] 401 error - token invalid, redirecting to login');
        setBookingError('Session expired. Please login again.');
        localStorage.removeItem('userToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/user/login'), 2000);
      } else {
        setBookingError(error.error || 'Failed to book ride. Please try again.');
      }
    } finally {
      setIsBooking(false);
    }
  };

  // Handle autocomplete load
  const handleAutocompleteLoad = (autocompleteInstance) => {
    console.log('[UserDashboard] Autocomplete loaded');
    setAutocomplete(autocompleteInstance);
  };

  // Handle place selection from autocomplete
  const handlePlaceSelect = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      console.log('[UserDashboard] Place selected:', place);
      
      if (place.geometry && place.geometry.location) {
        const coordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        
        setDropLocation(place.formatted_address || place.name || '');
        setDropCoordinates(coordinates);
        setFareEstimates(null); // Clear fare when location changes
        
        // Calculate directions if pickup station is selected
        if (selectedStation) {
          calculateDirections(selectedStation, coordinates);
        }
        
        console.log('[UserDashboard] Drop location set from autocomplete:', {
          address: place.formatted_address,
          coordinates
        });
      } else {
        setBookingError('Selected place does not have location data');
      }
    }
  };

  // Handle map click for drop location
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
        console.log('[UserDashboard] Address set from map click:', results[0].formatted_address);
      } else {
        setDropLocation(`${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`);
      }
    });
    
    setFareEstimates(null); // Clear fare when location changes
    
    // Calculate directions if pickup station is selected
    if (selectedStation) {
      calculateDirections(selectedStation, coordinates);
    }
    
    console.log('[UserDashboard] Drop coordinates set from map click:', coordinates);
  };

  // Calculate directions between pickup and drop
  const calculateDirections = (stationName, dropCoords) => {
    const station = pickupLocations.find(s => s.name === stationName);
    if (!station || !dropCoords) return;

    const directionsService = new window.google.maps.DirectionsService();
    
    directionsService.route({
      origin: { lat: station.lat, lng: station.lng },
      destination: dropCoords,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK') {
        setDirections(result);
        console.log('[UserDashboard] Directions calculated:', result);
      } else {
        console.error('[UserDashboard] Directions calculation failed:', status);
        setDirections(null);
      }
    });
  };

  // Cancel ride functionality
  const canCancelRide = (status) => {
    // Allow cancellation for pending and driver_assigned status
    return ['pending', 'driver_assigned'].includes(status);
  };

  const handleCancelRide = () => {
    if (!activeRide) {
      setBookingError('No active ride to cancel');
      return;
    }
    
    if (!canCancelRide(activeRide.status)) {
      setBookingError('Cannot cancel ride in current status: ' + activeRide.status);
      return;
    }
    
    setShowCancelModal(true);
  };

  const confirmCancelRide = () => {
    if (!cancelReason.trim()) {
      setBookingError('Please select a cancellation reason');
      return;
    }
    
    setIsCancelling(true);
    setBookingError('');
    
    console.log('[UserDashboard] Cancelling ride:', {
      rideId: activeRide._id || activeRide.rideId,
      reason: cancelReason
    });
    
    // Debug log to understand activeRide structure
    console.log('[UserDashboard] activeRide for cancellation:', activeRide);
    
    const rideId = activeRide.rideId || activeRide._id || activeRide.uniqueRideId;
    
    if (!rideId) {
      console.error('[UserDashboard] No valid ride ID found for cancellation:', activeRide);
      setIsCancelling(false);
      setBookingError('Cannot cancel ride: Invalid ride ID');
      return;
    }
    
    console.log('[UserDashboard] Cancelling ride with ID:', rideId);
    
    cancelRide({
      rideId: rideId,
      reason: cancelReason
    }, (response) => {
      setIsCancelling(false);
      setShowCancelModal(false);
      setCancelReason('');
      
      if (response && response.success) {
        console.log('[UserDashboard] Ride cancelled successfully');
        setActiveRide(null);
        setShowOTP(null);
        setBookingError('✅ Ride cancelled successfully');
      } else {
        console.error('[UserDashboard] Failed to cancel ride:', response);
        setBookingError(response?.message || 'Failed to cancel ride. Please try again.');
      }
    });
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelReason('');
    setIsCancelling(false);
  };

  // Logout
  const handleLogout = () => {
    console.log('[UserDashboard] Logging out...');
    unsubscribeFromUserRideUpdates();
    
    // Complete token cleanup
    localStorage.removeItem('user');
    localStorage.removeItem('userToken');
    localStorage.removeItem('driver');
    localStorage.removeItem('driverToken');
    localStorage.removeItem('admin');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('driverRole');
    localStorage.removeItem('adminRole');
    
    // Clear any additional storage
    sessionStorage.clear();
    
    console.log('[UserDashboard] All tokens and storage cleared');
    navigate('/user/login');
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Metro Ride Booking</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>Welcome, {user.fullName || user.name}</span>
          <div style={{ 
            padding: '0.25rem 0.5rem', 
            borderRadius: '4px', 
            fontSize: '0.8rem',
            backgroundColor: socketConnected ? '#28a745' : '#dc3545'
          }}>
            {socketConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          <button 
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ff4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Active Ride Display */}
        {activeRide && (
          <div style={{
            backgroundColor: '#e8f5e9',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            marginBottom: '2rem',
            borderLeft: '4px solid #28a745'
          }}>
            <h2 style={{ marginTop: 0, color: '#333' }}>Active Ride</h2>
            
            {/* Booth Ride Number - Prominent Display */}
            {activeRide.boothRideNumber && (
              <div style={{
                backgroundColor: '#ffc107',
                color: '#000',
                padding: '1rem',
                borderRadius: '4px',
                textAlign: 'center',
                marginBottom: '1.5rem',
                fontSize: '1.3rem',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
              }}>
                🎫 Your Ride Number: {activeRide.boothRideNumber}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <strong>Ride ID:</strong><br />
                {activeRide.uniqueRideId || activeRide.rideId}
              </div>
              <div>
                <strong>Status:</strong><br />
                <span style={{ 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '4px', 
                  backgroundColor: activeRide.status === 'pending' ? '#ffc107' : 
                                  activeRide.status === 'driver_assigned' ? '#17a2b8' : 
                                  activeRide.status === 'ride_started' ? '#28a745' : 
                                  activeRide.status === 'ride_ended' ? '#fd7e14' :
                                  activeRide.status === 'completed' ? '#28a745' : '#6c757d',
                  color: '#fff'
                }}>
                  {activeRide.status === 'ride_ended' ? 'COMPLETING...' : 
                   activeRide.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div>
                <strong>Pickup:</strong><br />
                {activeRide.pickupStation}
              </div>
              <div>
                <strong>Vehicle:</strong><br />
                {activeRide.vehicleType?.toUpperCase()}
              </div>
              <div>
                <strong>Fare:</strong><br />
                ₹{activeRide.estimatedFare}
              </div>
            </div>
            
            {/* Enhanced OTP Display */}
            {showOTP && (
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1.5rem', 
                backgroundColor: showOTP.type === 'start' ? '#d4edda' : '#fff3cd', 
                borderRadius: '8px',
                border: showOTP.type === 'start' ? '2px solid #28a745' : '2px solid #ffc107',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  color: '#333',
                  marginBottom: '1rem'
                }}>
                  {showOTP.type === 'start' ? '🚀 Start OTP (Give to Driver)' : '🏁 End OTP (For Ride Completion)'}
                </div>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 'bold', 
                  color: showOTP.type === 'start' ? '#28a745' : '#ffc107',
                  letterSpacing: '0.2rem',
                  fontFamily: 'monospace',
                  backgroundColor: '#fff',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '2px dashed #ccc'
                }}>
                  {showOTP.otp}
                </div>
                <div style={{ 
                  fontSize: '0.9rem',
                  color: '#666',
                  marginTop: '0.5rem'
                }}>
                  {showOTP.type === 'start' ? 
                    'Share this OTP with your driver to start the ride' : 
                    'Driver will ask for this OTP to complete your ride'
                  }
                </div>
              </div>
            )}
            
            {/* Cancel Ride Button */}
            {canCancelRide(activeRide.status) && (
              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={handleCancelRide}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold'
                  }}
                >
                  Cancel Ride
                </button>
                <p style={{ 
                  fontSize: '0.8rem', 
                  color: '#666', 
                  marginTop: '0.5rem',
                  marginBottom: 0 
                }}>
                  {activeRide.status === 'pending' ? 
                    '⚠️ You can cancel while waiting for driver' : 
                    '⚠️ Cancel before ride starts to avoid charges'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {bookingError && (
          <div style={{
            backgroundColor: bookingError.includes('✅') ? '#d1edff' : '#f8d7da',
            color: bookingError.includes('✅') ? '#0c5460' : '#721c24',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '2rem',
            border: bookingError.includes('✅') ? '1px solid #bee5eb' : '1px solid #f5c6cb'
          }}>
            {bookingError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* Booking Form */}
          {!activeRide && (
            <div style={{
              backgroundColor: '#fff',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ marginTop: 0, color: '#333' }}>Book a Ride</h2>
              
              {/* Location Type Filter */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Transportation Type:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { value: 'all', label: '🚗 All', count: pickupLocations.length },
                    { value: 'metro', label: '🚇 Metro', count: locationsByType.metro?.length || 0 },
                    { value: 'railway', label: '🚂 Railway', count: locationsByType.railway?.length || 0 },
                    { value: 'airport', label: '✈️ Airport', count: locationsByType.airport?.length || 0 },
                    { value: 'bus_terminal', label: '🚌 Bus', count: locationsByType.bus_terminal?.length || 0 }
                  ].map(type => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setSelectedLocationFilter(type.value);
                        setSelectedStation(''); // Clear selection when filter changes
                        setPickupSearchQuery(''); // Clear search query
                        setShowPickupResults(false);
                        setFareEstimates(null);
                        setDirections(null);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: selectedLocationFilter === type.value ? '#007bff' : '#f8f9fa',
                        color: selectedLocationFilter === type.value ? '#fff' : '#333',
                        border: '1px solid #ddd',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: selectedLocationFilter === type.value ? 'bold' : 'normal',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {type.label} ({type.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Searchable Pickup Location */}
              <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Pickup Location:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={pickupSearchQuery}
                    onChange={handlePickupSearchChange}
                    onKeyDown={handlePickupKeyDown}
                    onFocus={() => setShowPickupResults(true)}
                    onBlur={handlePickupInputBlur}
                    placeholder={
                      selectedLocationFilter === 'all' ? 
                        'Search pickup location (type station name, area, or line)...' : 
                        `Search ${getLocationTypeLabel(selectedLocationFilter).toLowerCase()}...`
                    }
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      paddingRight: '2.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#999',
                    fontSize: '1.2rem'
                  }}>
                    🔍
                  </div>
                </div>
                
                {/* Search Results Dropdown */}
                {showPickupResults && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderTop: 'none',
                    borderRadius: '0 0 4px 4px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}>
                    {(() => {
                      const results = getSearchResults();
                      if (results.length === 0) {
                        return (
                          <div style={{ padding: '1rem', color: '#666', textAlign: 'center' }}>
                            {pickupSearchQuery.trim() ? 
                              `No locations found for "${pickupSearchQuery}"` : 
                              `Start typing to search ${getFilteredLocations().length} locations...`
                            }
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {results.map((location, index) => (
                            <div
                              key={location.id}
                              onClick={() => handlePickupSelect(location)}
                              style={{
                                padding: '0.75rem',
                                borderBottom: index < results.length - 1 ? '1px solid #eee' : 'none',
                                cursor: 'pointer',
                                backgroundColor: selectedPickupIndex === index ? '#e3f2fd' : '#fff',
                                transition: 'background-color 0.2s ease'
                              }}
                              onMouseEnter={() => setSelectedPickupIndex(index)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>
                                  {getLocationIcon(location.type)}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                                    {highlightMatch(location.name, pickupSearchQuery)}
                                    {location.type === 'metro' && location.line && (
                                      <span style={{ 
                                        fontSize: '0.8rem', 
                                        color: '#666', 
                                        marginLeft: '0.5rem',
                                        fontWeight: 'normal'
                                      }}>
                                        ({location.line} Line)
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                    {highlightMatch(location.address, pickupSearchQuery)}
                                    {location.subType && location.type !== 'metro' && (
                                      <span style={{ marginLeft: '0.5rem' }}>
                                        • {location.subType}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ 
                                  fontSize: '0.7rem', 
                                  color: '#999',
                                  textAlign: 'right'
                                }}>
                                  {getLocationTypeLabel(location.type)}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Show More Button */}
                          {getFilteredLocations().length > maxPickupResults && results.length === maxPickupResults && (
                            <div
                              onClick={() => setMaxPickupResults(prev => prev + 8)}
                              style={{
                                padding: '0.75rem',
                                textAlign: 'center',
                                color: '#007bff',
                                cursor: 'pointer',
                                borderTop: '1px solid #eee',
                                backgroundColor: '#f8f9fa'
                              }}
                            >
                              ↓ Show {Math.min(8, getFilteredLocations().length - maxPickupResults)} more locations
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                
                {getFilteredLocations().length === 0 && selectedLocationFilter !== 'all' && (
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                    No {getLocationTypeLabel(selectedLocationFilter).toLowerCase()}s available
                  </p>
                )}
                
                {/* Search Tips */}
                {!showPickupResults && !selectedStation && (
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                    💡 Try searching: "rajiv chowk", "new delhi", "airport", "red line", "anand vihar"
                  </p>
                )}
              </div>

              {/* Vehicle Type Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Vehicle Type:
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {['bike', 'auto', 'car'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="vehicleType"
                        value={type}
                        checked={vehicleType === type}
                        onChange={(e) => {
                          setVehicleType(e.target.value);
                          setFareEstimates(null); // Clear fare when vehicle type changes
                        }}
                        style={{ marginRight: '0.5rem' }}
                      />
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Drop Location with Autocomplete */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Drop Location:
                </label>
                <Autocomplete
                  onLoad={handleAutocompleteLoad}
                  onPlaceChanged={handlePlaceSelect}
                  options={{
                    bounds: new window.google.maps.LatLngBounds(
                      new window.google.maps.LatLng(28.4089, 76.8413), // Southwest
                      new window.google.maps.LatLng(28.8848, 77.3466)  // Northeast
                    ),
                    strictBounds: false,
                    types: ['geocode', 'establishment'],
                    componentRestrictions: { country: 'in' }
                  }}
                >
                  <input
                    type="text"
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                    placeholder="Search for destination or click on map"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                  />
                </Autocomplete>
                
                {dropCoordinates && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
                    <p style={{ fontSize: '0.8rem', color: '#155724', margin: '0' }}>
                      ✅ Location set: {dropCoordinates.lat.toFixed(4)}, {dropCoordinates.lng.toFixed(4)}
                    </p>
                    {directions && (
                      <p style={{ fontSize: '0.8rem', color: '#155724', margin: '0.25rem 0 0 0' }}>
                        🚗 Distance: {directions.routes[0]?.legs[0]?.distance?.text} • 
                        Duration: {directions.routes[0]?.legs[0]?.duration?.text}
                      </p>
                    )}
                  </div>
                )}
                
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                  💡 Type to search or click on the map to set drop location
                </p>
              </div>

              {/* Fare Calculation */}
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={calculateFare}
                  disabled={isCalculatingFare || !selectedStation || !dropLocation.trim() || !dropCoordinates}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: isCalculatingFare ? '#ccc' : '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isCalculatingFare ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    marginBottom: '1rem'
                  }}
                >
                  {isCalculatingFare ? 'Calculating...' : 'Calculate Fare'}
                </button>
                
                {fareEstimates && (
                  <div style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: '1rem', 
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Fare Estimates ({fareEstimates.distance}km)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {Object.entries(fareEstimates.estimates).map(([type, fareDetails]) => (
                        <div key={type} style={{ 
                          textAlign: 'center',
                          padding: '0.5rem',
                          backgroundColor: vehicleType === type ? '#007bff' : '#fff',
                          color: vehicleType === type ? '#fff' : '#333',
                          borderRadius: '4px',
                          border: '1px solid #ddd'
                        }}>
                          <div style={{ fontWeight: 'bold' }}>{type.toUpperCase()}</div>
                          <div>₹{fareDetails.totalFare || fareDetails}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Book Button */}
              <button
                onClick={bookRide}
                disabled={isBooking || !fareEstimates || !socketConnected}
                style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: isBooking ? '#ccc' : !socketConnected ? '#6c757d' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isBooking || !socketConnected ? 'not-allowed' : 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                {isBooking ? 'Booking...' : !socketConnected ? 'Connection Required' : 'Book Ride'}
              </button>
            </div>
          )}

          {/* Map */}
          <div style={{
            backgroundColor: '#fff',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            height: 'fit-content'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>Map</h3>
            
            {/* Map Legend */}
            <div style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px',
              fontSize: '0.8rem'
            }}>
              <strong>Map Legend:</strong>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span>🔵 Metro</span>
                <span>🟣 Railway</span>
                <span>🟠 Airport</span>
                <span>🟢 Bus Terminal</span>
                <span>🔴 Selected</span>
                <span>🟡 Driver</span>
              </div>
            </div>
            
            <div style={{ height: '400px', borderRadius: '4px', overflow: 'hidden' }}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={userLocation || { lat: 28.6139, lng: 77.2090 }}
                zoom={12}
                onClick={handleMapClick}
              >
                {/* Directions Route */}
                {directions && (
                  <DirectionsRenderer
                    directions={directions}
                    options={{
                      polylineOptions: {
                        strokeColor: '#4285F4',
                        strokeWeight: 4,
                        strokeOpacity: 0.8
                      },
                      suppressMarkers: false
                    }}
                  />
                )}
                {/* User location */}
                {userLocation && (
                  <Marker
                    position={userLocation}
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                      scaledSize: new window.google.maps.Size(30, 30)
                    }}
                    title="Your Current Location"
                  />
                )}

                {/* Selected pickup location - Only show if no directions to avoid overlap */}
                {selectedStation && pickupLocations.find(s => s.name === selectedStation) && !directions && (
                  <Marker
                    position={{ 
                      lat: pickupLocations.find(s => s.name === selectedStation).lat, 
                      lng: pickupLocations.find(s => s.name === selectedStation).lng 
                    }}
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                      scaledSize: new window.google.maps.Size(35, 35)
                    }}
                    title={`Pickup: ${selectedStation}`}
                  />
                )}

                {/* Drop location - Only show if no directions to avoid overlap */}
                {dropCoordinates && !directions && (
                  <Marker
                    position={dropCoordinates}
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                      scaledSize: new window.google.maps.Size(35, 35)
                    }}
                    title={`Drop Location: ${dropLocation}`}
                  />
                )}

                {/* Active ride driver location */}
                {activeRide?.driverLocation && (
                  <Marker
                    position={activeRide.driverLocation}
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
                      scaledSize: new window.google.maps.Size(40, 40)
                    }}
                    title="Driver Location"
                  />
                )}

                {/* All pickup locations with type-specific icons */}
                {getFilteredLocations().map(location => {
                  const getMarkerColor = (type) => {
                    const colors = {
                      metro: 'blue',
                      railway: 'purple', 
                      airport: 'orange',
                      bus_terminal: 'green'
                    };
                    return colors[type] || 'blue';
                  };
                  
                  return (
                    <Marker
                      key={location.id}
                      position={{ lat: location.lat, lng: location.lng }}
                      icon={{
                        url: `http://maps.google.com/mapfiles/ms/icons/${getMarkerColor(location.type)}-dot.png`,
                        scaledSize: new window.google.maps.Size(
                          location.type === 'airport' ? 25 : location.type === 'railway' ? 22 : 20, 
                          location.type === 'airport' ? 25 : location.type === 'railway' ? 22 : 20
                        )
                      }}
                      title={`${getLocationIcon(location.type)} ${location.name}${location.line ? ` (${location.line} Line)` : ''}${location.subType && location.type !== 'metro' ? ` - ${location.subType}` : ''}`}
                      onClick={() => {
                        setSelectedStation(location.name);
                        setFareEstimates(null);
                        setDirections(null);
                        
                        // Calculate directions if drop location is already set
                        if (dropCoordinates) {
                          calculateDirections(location.name, dropCoordinates);
                        }
                      }}
                    />
                  );
                })}
              </GoogleMap>
            </div>
          </div>
        </div>

        {/* Ride History */}
        {rideHistory.length > 0 && (
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Recent Rides</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {rideHistory.map(ride => (
                <div key={ride.rideId} style={{
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{ride.pickupLocation?.boothName} → {ride.dropLocation?.address}</strong>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {ride.vehicleType?.toUpperCase()} • {new Date(ride.timestamps.created).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#28a745' }}>
                        ₹{ride.actualFare || ride.estimatedFare}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        {ride.status?.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ride Cancellation Modal */}
        {showCancelModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#fff',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
                Cancel Ride
              </h3>
              
              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Please select a reason for cancelling your ride:
              </p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                {[
                  'Driver is taking too long',
                  'Changed my mind',
                  'Found alternative transport',
                  'Emergency situation',
                  'Driver not responding',
                  'Wrong pickup location',
                  'Price too high',
                  'Other'
                ].map(reason => (
                  <label key={reason} style={{
                    display: 'block',
                    marginBottom: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    backgroundColor: cancelReason === reason ? '#e8f4fd' : '#fff',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="cancelReason"
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      style={{ marginRight: '0.75rem' }}
                    />
                    {reason}
                  </label>
                ))}
              </div>
              
              {cancelReason === 'Other' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <textarea
                    placeholder="Please specify your reason..."
                    value={cancelReason === 'Other' ? cancelReason : ''}
                    onChange={(e) => setCancelReason(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      resize: 'vertical'
                    }}
                  />
                </div>
              )}
              
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={closeCancelModal}
                  disabled={isCancelling}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isCancelling ? 'not-allowed' : 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  Keep Ride
                </button>
                <button
                  onClick={confirmCancelRide}
                  disabled={isCancelling || !cancelReason.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: isCancelling ? '#ccc' : '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isCancelling || !cancelReason.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold'
                  }}
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
              
              <p style={{
                fontSize: '0.8rem',
                color: '#666',
                marginTop: '1rem',
                marginBottom: 0,
                textAlign: 'center'
              }}>
                {activeRide?.status === 'pending' ? 
                  'No charges will apply for cancelling before driver acceptance' :
                  'Cancelling after driver acceptance may incur charges'
                }
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default UserDashboard;