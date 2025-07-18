import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { drivers, users } from '../../services/api';
import { 
  initializeSocket, 
  subscribeToDriverUpdates, 
  unsubscribeFromDriverUpdates, 
  isSocketConnected,
  driverGoOnline,
  driverGoOffline,
  driverAcceptRide,
  verifyStartOTP,
  verifyEndOTP,
  updateDriverLocation
} from '../../services/socket';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const DriverDashboard = () => {
  const navigate = useNavigate();
  
  // Driver state
  const [driver, setDriver] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Driver status
  const [isOnline, setIsOnline] = useState(false);
  const [selectedPickupLocation, setSelectedPickupLocation] = useState('');
  const [selectedMetroBooth, setSelectedMetroBooth] = useState(''); // Legacy compatibility
  const [vehicleType, setVehicleType] = useState('auto');
  const [driverLocation, setDriverLocation] = useState(null);
  
  // Pickup locations
  const [pickupLocations, setPickupLocations] = useState([]);
  const [locationsByType, setLocationsByType] = useState({});
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('all');
  const [pickupSearchQuery, setPickupSearchQuery] = useState('');
  const [showPickupResults, setShowPickupResults] = useState(false);
  const [selectedPickupIndex, setSelectedPickupIndex] = useState(-1);
  const [maxPickupResults, setMaxPickupResults] = useState(8);
  
  // Backward compatibility
  const [metroStations, setMetroStations] = useState([]);
  
  // Ride state
  const [rideRequests, setRideRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // OTP state
  const [showOTPInput, setShowOTPInput] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  
  // Error handling
  const [statusError, setStatusError] = useState('');
  const [rideError, setRideError] = useState('');
  const [pickupLocationsLoading, setPickupLocationsLoading] = useState(false);
  const [pickupLocationsError, setPickupLocationsError] = useState('');

  // Tab and history state
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'history'
  const [rideHistory, setRideHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'completed', 'cancelled'
  const [driverStats, setDriverStats] = useState(null);

  console.log('[DriverDashboard] Component mounted');

  // Authentication check and socket initialization
  useEffect(() => {
    console.log('[DriverDashboard] Checking authentication...');
    const token = localStorage.getItem('driverToken');
    const driverData = localStorage.getItem('driver');
    
    if (!token || !driverData) {
      console.log('[DriverDashboard] No authentication data found');
      navigate('/driver/login');
      return;
    }
    
    try {
      const parsedDriver = JSON.parse(driverData);
      console.log('[DriverDashboard] Driver loaded:', parsedDriver);
      setDriver(parsedDriver);
      
      // Initialize socket connection
      console.log('[DriverDashboard] Initializing socket connection...');
      const initSocket = async () => {
        try {
          const socketInstance = initializeSocket(token);
          
          // Check if it's a Promise
          if (socketInstance && typeof socketInstance.then === 'function') {
            console.log('[DriverDashboard] Waiting for socket initialization...');
            const actualSocket = await socketInstance;
            setSocket(actualSocket);
          } else {
            // It's already a socket object or null
            setSocket(socketInstance);
          }
        } catch (error) {
          console.error('[DriverDashboard] Socket initialization failed:', error);
          setSocket(null);
        }
      };
      
      initSocket();
      
      // Check socket connection status
      const checkConnection = () => {
        const connected = isSocketConnected();
        setSocketConnected(connected);
        console.log('[DriverDashboard] Socket connected:', connected);
      };
      
      // Check immediately and then periodically
      checkConnection();
      const connectionInterval = setInterval(checkConnection, 2000);
      
      return () => clearInterval(connectionInterval);
    } catch (error) {
      console.error('[DriverDashboard] Error parsing driver data:', error);
      navigate('/driver/login');
    }
  }, [navigate]);


  // Load pickup locations for booth selection
  const loadPickupLocations = async (retryCount = 0) => {
    const maxRetries = 3;
    
    try {
      console.log(`[DriverDashboard] 📍 Loading pickup locations... (attempt ${retryCount + 1})`);
      
      // Debug authentication
      const driverToken = localStorage.getItem('driverToken');
      console.log('[DriverDashboard] 📍 Driver token status:', {
        hasToken: !!driverToken,
        tokenLength: driverToken?.length,
        tokenStart: driverToken?.substring(0, 50) + '...'
      });
      
      setPickupLocationsLoading(true);
      setPickupLocationsError('');
      
      const response = await drivers.getPickupLocations();
      console.log('[DriverDashboard] 📍 Pickup locations response:', response);
      console.log('[DriverDashboard] 📍 Pickup locations data:', response.data);
      
      if (response.data && (response.data.locations || response.data.stations)) {
        const locations = response.data.locations || response.data.stations || [];
        const byType = response.data.locationsByType || {};
        
        setPickupLocations(locations);
        setLocationsByType(byType);
        
        // For backward compatibility, also set metroStations
        const metroOnly = locations.filter(loc => loc.type === 'metro');
        setMetroStations(metroOnly);
        setPickupLocationsLoading(false);
        
        console.log(`✅ [DriverDashboard] Successfully loaded ${locations.length} pickup locations (${metroOnly.length} metro stations)`);
      } else {
        throw new Error('Invalid response structure: no locations data found in API response');
      }
      
    } catch (error) {
      console.error(`❌ [DriverDashboard] Error loading pickup locations (attempt ${retryCount + 1}):`, error);
      console.error(`❌ [DriverDashboard] Error details:`, {
        message: error.message,
        status: error.status,
        error: error.error,
        stack: error.stack
      });
      
      if (retryCount < maxRetries) {
        const retryDelay = Math.pow(2, retryCount) * 1000;
        console.log(`🔄 [DriverDashboard] Retrying in ${retryDelay}ms...`);
        
        setPickupLocationsError(`Loading... (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        setTimeout(() => {
          loadPickupLocations(retryCount + 1);
        }, retryDelay);
      } else {
        console.warn('⚠️ [DriverDashboard] All retries failed for pickup locations');
        setPickupLocationsLoading(false);
        setPickupLocationsError(`Failed to load pickup locations: ${error.error || error.message}`);
      }
    }
  };

  // Load pickup locations for booth selection
  useEffect(() => {
    if (driver) {
      loadPickupLocations();
    }
  }, [driver]);

  // Load driver dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        console.log('[DriverDashboard] Loading dashboard data...');
        const response = await drivers.getDashboard();
        console.log('[DriverDashboard] Dashboard data:', response.data);
        
        const dashboardData = response.data;
        setIsOnline(dashboardData.driver.isOnline || false);
        setSelectedMetroBooth(dashboardData.driver.currentMetroBooth || '');
        setSelectedPickupLocation(dashboardData.driver.currentMetroBooth || '');
        setVehicleType(dashboardData.driver.vehicleType || 'auto');
      } catch (error) {
        console.error('[DriverDashboard] Error loading dashboard data:', error);
      }
    };

    if (driver) {
      loadDashboardData();
    }
  }, [driver]);

  // Get driver location tracking
  useEffect(() => {
    console.log('[DriverDashboard] Setting up location tracking...');
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setDriverLocation(location);
          
          // Update location on server if driver is online and has active ride
          if (isOnline && socketConnected && activeRide) {
            updateDriverLocation({
              location,
              rideId: activeRide._id,
              bearing: position.coords.heading,
              speed: position.coords.speed,
              timestamp: new Date().toISOString()
            });
          }
        },
        (error) => {
          console.error('[DriverDashboard] Geolocation error:', error);
          // Default to Delhi center
          setDriverLocation({ lat: 28.6139, lng: 77.2090 });
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isOnline, socketConnected, activeRide]);

  // Set up socket listeners for ride requests
  useEffect(() => {
    if (socket && socketConnected) {
      console.log('[DriverDashboard] Setting up socket listeners...');
      
      subscribeToDriverUpdates({
        onNewRideRequest: (data) => {
          console.log('🚨 [DriverDashboard] NEW RIDE REQUEST RECEIVED:', {
            rideId: data._id,
            uniqueRideId: data.rideId,
            boothRideNumber: data.boothRideNumber,
            pickupStation: data.pickupLocation?.boothName,
            vehicleType: data.vehicleType,
            estimatedFare: data.estimatedFare,
            userName: data.userName,
            timestamp: new Date().toISOString()
          });
          
          setRideRequests(prev => {
            // Check if request already exists
            const existingRequest = prev.find(r => r._id === data._id);
            if (existingRequest) {
              console.log('⚠️ [DriverDashboard] Duplicate ride request, ignoring');
              return prev;
            }
            console.log('✅ [DriverDashboard] Adding new ride request to list');
            return [...prev, data];
          });
        },
        
        onRideRequestClosed: (data) => {
          console.log('[DriverDashboard] Ride request closed:', data);
          setRideRequests(prev => prev.filter(r => r._id !== data.rideId));
          if (selectedRequest && selectedRequest._id === data.rideId) {
            setSelectedRequest(null);
          }
        },
        
        onRideAcceptConfirmed: (data) => {
          console.log('[DriverDashboard] Ride accept confirmed:', data);
          setActiveRide(data);
          setRideRequests([]);
          setSelectedRequest(null);
          setRideError('');
        },
        
        onQueueNumberAssigned: (data) => {
          console.log('[DriverDashboard] Queue number assigned:', data);
          setActiveRide(prev => ({ 
            ...prev, 
            queueNumber: data.queueNumber,
            queuePosition: data.queuePosition,
            queueStatus: 'queued',
            estimatedWaitTime: data.estimatedWaitTime,
            totalInQueue: data.totalInQueue,
            boothName: data.boothName,
            boothCode: data.boothCode
          }));
          setRideError(`✅ ${data.message}`);
        },
        
        onRideAcceptError: (data) => {
          console.log('[DriverDashboard] Ride accept error:', data);
          setRideError(data.message || 'Failed to accept ride');
        },
        
        onDriverOnlineConfirmed: (data) => {
          console.log('[DriverDashboard] Driver online confirmed:', data);
          setIsOnline(true);
          setStatusError('');
        },
        
        onDriverOfflineConfirmed: (data) => {
          console.log('[DriverDashboard] Driver offline confirmed:', data);
          setIsOnline(false);
          setRideRequests([]);
          setActiveRide(null);
          setSelectedRequest(null);
          setStatusError('');
        },
        
        onRideStarted: (data) => {
          console.log('[DriverDashboard] Ride started:', data);
          setActiveRide(prev => ({ ...prev, ...data, status: 'ride_started' }));
          setShowOTPInput(null);
        },
        
        onRideEnded: (data) => {
          console.log('[DriverDashboard] Ride ended:', data);
          // Keep ride active to show completion status
          setActiveRide(prev => ({ ...prev, ...data, status: 'ride_ended' }));
          setShowOTPInput(null);
        },
        
        onRideCompleted: (data) => {
          console.log('[DriverDashboard] Ride completed automatically:', data);
          // Update ride status to completed
          setActiveRide(prev => ({ ...prev, ...data, status: 'completed' }));
          setShowOTPInput(null);
          setRideError('');
          
          // Clear active ride after showing completion message
          setTimeout(() => {
            setActiveRide(null);
            console.log('[DriverDashboard] ✅ Ride cleared from dashboard - moved to history');
          }, 4000);
        },
        
        onRideCancelled: (data) => {
          console.log('[DriverDashboard] Ride cancelled:', data);
          setActiveRide(null);
          setShowOTPInput(null);
          setRideError(`Ride cancelled: ${data.reason || 'No reason provided'}`);
        },
        
        onOTPVerificationSuccess: (data) => {
          console.log('[DriverDashboard] OTP verification success:', data);
          setShowOTPInput(null);
          setOtpInput('');
          setRideError('');
        },
        
        onOTPVerificationError: (data) => {
          console.log('[DriverDashboard] OTP verification error:', data);
          setRideError(data.message || 'Invalid OTP');
        }
      });

      // Add room info listener for debugging
      if (socket && typeof socket.on === 'function') {
        socket.on('roomInfo', (data) => {
          console.log('🔍 [DriverDashboard] Room Info Response:', data);
          console.log('📊 Socket room details:', {
            socketId: data.socketId,
            userId: data.userId,
            role: data.role,
            rooms: data.rooms,
            driversOnline: data.driversOnline,
            inDriversRoom: data.inDriversRoom
          });
        });
      } else {
        console.warn('⚠️ [DriverDashboard] Socket not available for roomInfo listener');
      }

      return () => {
        unsubscribeFromDriverUpdates();
        if (socket && typeof socket.off === 'function') {
          socket.off('roomInfo');
        }
      };
    }
  }, [socket, socketConnected, selectedRequest]);

  // Toggle online status
  const toggleOnlineStatus = async () => {
    if (!socketConnected) {
      setStatusError('Socket connection required');
      return;
    }

    if (!isOnline) {
      // Going online - need pickup location and vehicle type
      if (!selectedPickupLocation || !vehicleType) {
        setStatusError('Please select pickup location and vehicle type');
        return;
      }
      
      setStatusError('');
      console.log('[DriverDashboard] Going online...');
      
      driverGoOnline({
        metroBooth: selectedPickupLocation, // Keep legacy field name for backend compatibility
        pickupLocation: selectedPickupLocation,
        vehicleType: vehicleType,
        location: driverLocation
      });
    } else {
      // Going offline
      console.log('[DriverDashboard] Going offline...');
      driverGoOffline();
    }
  };

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

  // Fuzzy matching function with Levenshtein distance
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

  // Enhanced search function with fuzzy matching
  const searchPickupLocations = (query) => {
    console.log('[DriverDashboard SearchPickupLocations] Query:', query);
    console.log('[DriverDashboard SearchPickupLocations] Total locations:', pickupLocations.length);
    
    if (!query.trim()) return [];
    
    const searchTerm = query.toLowerCase().trim();
    
    // Apply location type filter
    let filtered = pickupLocations;
    if (selectedLocationFilter !== 'all') {
      filtered = pickupLocations.filter(location => location.type === selectedLocationFilter);
    }
    
    // Score-based matching for better relevance
    const scored = filtered.map(location => {
      const name = location.name.toLowerCase();
      const address = (location.address || '').toLowerCase();
      const line = (location.line || '').toLowerCase();
      const subType = (location.subType || '').toLowerCase();
      
      let score = 0;
      
      // Exact name match (highest priority)
      if (name === searchTerm) {
        score += 100;
      } else if (name.startsWith(searchTerm)) {
        score += 80;
      } else if (name.includes(searchTerm)) {
        score += 60;
      }
      
      // Address matching
      if (address.includes(searchTerm)) {
        score += 40;
      }
      
      // Line/subtype matching
      if (line.includes(searchTerm) || subType.includes(searchTerm)) {
        score += 30;
      }
      
      // Fuzzy matching for typo tolerance
      const nameDistance = levenshteinDistance(searchTerm, name);
      const maxDistance = Math.max(searchTerm.length, name.length);
      if (nameDistance <= 2 && maxDistance > 3) {
        score += Math.max(0, 20 - (nameDistance * 5));
      }
      
      // Boost priority locations
      if (location.priority >= 8) score += 10;
      else if (location.priority >= 6) score += 5;
      
      return { ...location, searchScore: score };
    });
    
    // Filter out very low scores and sort by score
    return scored
      .filter(item => item.searchScore > 0)
      .sort((a, b) => {
        if (b.searchScore !== a.searchScore) {
          return b.searchScore - a.searchScore;
        }
        return a.name.localeCompare(b.name);
      });
  };

  // Handle pickup location selection
  const handlePickupSelect = (location) => {
    setSelectedPickupLocation(location.name);
    setSelectedMetroBooth(location.name); // Keep legacy compatibility
    setPickupSearchQuery(location.name);
    setShowPickupResults(false);
    setSelectedPickupIndex(-1);
  };

  // Handle pickup search input changes
  const handlePickupSearchChange = (e) => {
    const value = e.target.value;
    setPickupSearchQuery(value);
    setSelectedPickupLocation(value);
    setSelectedMetroBooth(value); // Keep legacy compatibility
    setShowPickupResults(value.trim().length > 0);
    setSelectedPickupIndex(-1);
  };

  // Handle keyboard navigation for pickup search
  const handlePickupKeyDown = (e, results) => {
    if (!showPickupResults || results.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedPickupIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedPickupIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedPickupIndex >= 0 && results[selectedPickupIndex]) {
          handlePickupSelect(results[selectedPickupIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowPickupResults(false);
        setSelectedPickupIndex(-1);
        break;
      default:
        break;
    }
  };

  // Highlight matched text in search results
  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <strong key={index} style={{ backgroundColor: '#fffbdd' }}>{part}</strong> : 
        part
    );
  };

  // Debug function to check driver status
  const handleDebugStatus = async () => {
    try {
      console.log('🔍 [DriverDashboard] Requesting debug status...');
      
      // Check socket connection
      if (socket && typeof socket.emit === 'function') {
        socket.emit('getRoomInfo');
        console.log('📡 [DriverDashboard] Requested room info from socket');
      } else {
        console.warn('⚠️ [DriverDashboard] Socket not available for getRoomInfo');
      }
      
      // Get server-side status
      const response = await drivers.get('/debug/status');
      console.log('📊 [DriverDashboard] Server debug status:', response.data);
      
      // Show status in alert for quick viewing
      const debugInfo = response.data.data;
      alert(`Debug Status:
Total Drivers: ${debugInfo.summary.totalDrivers}
Online Drivers: ${debugInfo.summary.onlineDrivers}
Drivers in Socket Room: ${debugInfo.summary.driversInSocketRoom}

Current Driver Status:
Socket Connected: ${socketConnected}
Is Online: ${isOnline}
Pickup Location: ${selectedPickupLocation}
Vehicle Type: ${vehicleType}

Check console for detailed information.`);
      
    } catch (error) {
      console.error('❌ [DriverDashboard] Error getting debug status:', error);
      alert('Error getting debug status. Check console for details.');
    }
  };

  // Accept ride
  const acceptRide = (request) => {
    if (!socketConnected) {
      setRideError('Socket connection required');
      return;
    }

    console.log('[DriverDashboard] Accepting ride:', request);
    setRideError('');
    
    driverAcceptRide({
      rideId: request._id,
      driverId: driver.id,
      driverName: driver.fullName,
      driverPhone: driver.mobileNo,
      vehicleDetails: {
        type: vehicleType,
        number: driver.vehicleNo
      },
      currentLocation: driverLocation
    });
  };

  // Decline ride
  const declineRide = (requestId) => {
    console.log('[DriverDashboard] Declining ride:', requestId);
    setRideRequests(prev => prev.filter(r => r._id !== requestId));
    if (selectedRequest?._id === requestId) {
      setSelectedRequest(null);
    }
  };

  // Handle OTP verification
  const handleOTPVerification = () => {
    if (!otpInput.trim()) {
      setRideError('Please enter OTP');
      return;
    }

    if (!activeRide) {
      setRideError('No active ride found');
      return;
    }

    const otpData = {
      rideId: activeRide._id || activeRide.rideId,
      otp: otpInput.trim()
    };

    console.log('[DriverDashboard] Verifying OTP:', {
      type: showOTPInput.type,
      rideId: otpData.rideId,
      otp: otpData.otp
    });

    // Add callback handling for OTP verification
    const handleOTPResponse = (response) => {
      console.log('[DriverDashboard] OTP verification response:', response);
      
      if (response && response.success) {
        console.log('[DriverDashboard] OTP verified successfully');
        setOtpInput('');
        setShowOTPInput(null);
        setRideError('');
        
        // Update ride status based on OTP type
        if (showOTPInput.type === 'start') {
          setActiveRide(prev => ({ ...prev, status: 'ride_started' }));
        } else if (showOTPInput.type === 'end') {
          setActiveRide(prev => ({ ...prev, status: 'ride_ended' }));
        }
      } else {
        console.error('[DriverDashboard] OTP verification failed:', response);
        setRideError(response?.message || 'Invalid OTP. Please try again.');
      }
    };

    if (showOTPInput.type === 'start') {
      verifyStartOTP(otpData, handleOTPResponse);
    } else if (showOTPInput.type === 'end') {
      verifyEndOTP(otpData, handleOTPResponse);
    }
  };

  // Collect Payment
  const collectPayment = async () => {
    if (!activeRide) {
      setRideError('No active ride found');
      return;
    }

    try {
      console.log('[DriverDashboard] Collecting payment for ride:', activeRide._id);
      const response = await drivers.collectPayment({
        rideId: activeRide._id || activeRide.rideId,
        paymentMethod: 'cash'
      });

      console.log('[DriverDashboard] Payment collected successfully:', response);
      
      // Update local state
      setActiveRide(prev => ({
        ...prev,
        paymentStatus: 'collected',
        status: 'completed'
      }));

      // Clear active ride after a delay
      setTimeout(() => {
        setActiveRide(null);
        setRideError('');
      }, 3000);

    } catch (error) {
      console.error('[DriverDashboard] Error collecting payment:', error);
      setRideError(error.error || 'Failed to collect payment');
    }
  };

  // Load driver ride history
  const loadRideHistory = async (page = 1, filter = 'all', resetHistory = false) => {
    try {
      setHistoryLoading(true);
      setHistoryError('');
      
      console.log(`[DriverDashboard] Loading ride history: page=${page}, filter=${filter}`);
      
      const response = await drivers.getRideHistory(page, 10, filter);
      console.log('[DriverDashboard] History response:', response);
      
      if (response.success) {
        const newHistory = response.data.rideHistory || [];
        
        if (resetHistory || page === 1) {
          setRideHistory(newHistory);
        } else {
          setRideHistory(prev => [...prev, ...newHistory]);
        }
        
        setHistoryHasMore(newHistory.length === 10); // Has more if we got full page
        setHistoryPage(page);
      } else {
        throw new Error(response.message || 'Failed to load history');
      }
      
    } catch (error) {
      console.error('[DriverDashboard] Error loading ride history:', error);
      setHistoryError(error.message || 'Failed to load ride history');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load driver statistics
  const loadDriverStats = async () => {
    try {
      console.log('[DriverDashboard] Loading driver statistics...');
      
      const response = await drivers.getStatistics();
      console.log('[DriverDashboard] Stats response:', response);
      
      if (response.success) {
        setDriverStats(response.data.analytics);
      }
      
    } catch (error) {
      console.error('[DriverDashboard] Error loading driver stats:', error);
      // Don't show error for stats - it's not critical
    }
  };

  // Handle tab change
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    
    if (tabName === 'history' && rideHistory.length === 0) {
      // Load history when first accessing the tab
      loadRideHistory(1, historyFilter, true);
      loadDriverStats();
    }
  };

  // Handle filter change
  const handleFilterChange = (newFilter) => {
    setHistoryFilter(newFilter);
    loadRideHistory(1, newFilter, true);
  };

  // Load more history (pagination)
  const loadMoreHistory = () => {
    if (!historyLoading && historyHasMore) {
      loadRideHistory(historyPage + 1, historyFilter, false);
    }
  };

  // Logout
  const handleLogout = () => {
    console.log('[DriverDashboard] Logging out...');
    unsubscribeFromDriverUpdates();
    if (isOnline) {
      driverGoOffline();
    }
    localStorage.removeItem('driver');
    localStorage.removeItem('driverToken');
    navigate('/driver/login');
  };

  if (!driver) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Mobile Header */}
      <header className="bg-black text-white">
        <div className="px-4 py-3 flex items-center justify-between lg:px-6">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-bold lg:text-xl">Driver Dashboard</h1>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              socketConnected ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {socketConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-2 lg:hidden">
            <button
              onClick={toggleOnlineStatus}
              disabled={!socketConnected}
              className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                !socketConnected ? 'bg-gray-500 cursor-not-allowed' : 
                isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </button>
            <button 
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm font-bold transition-colors"
            >
              Logout
            </button>
          </div>
          
          {/* Desktop Header Controls */}
          <div className="hidden lg:flex items-center space-x-4">
            <span className="text-sm">Welcome, {driver.fullName || driver.name}</span>
            <button
              onClick={toggleOnlineStatus}
              disabled={!socketConnected}
              className={`px-4 py-2 rounded font-bold transition-colors ${
                !socketConnected ? 'bg-gray-500 cursor-not-allowed' : 
                isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </button>
            <button 
              onClick={handleDebugStatus}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded font-bold transition-colors"
            >
              Debug
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded font-bold transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 lg:p-6 max-w-7xl mx-auto">
        
        {/* Error Displays */}
        {statusError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
            <strong>Status Error:</strong> {statusError}
          </div>
        )}
        
        {rideError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
            <strong>Ride Error:</strong> {rideError}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex bg-gray-100 rounded-t-lg border-b-2 border-gray-200 mb-4 overflow-x-auto">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`flex-1 px-4 py-3 text-center font-bold transition-all duration-300 rounded-tl-lg ${
              activeTab === 'dashboard' 
                ? 'bg-blue-500 text-white' 
                : 'bg-transparent text-blue-500 hover:bg-blue-50'
            }`}
          >
            <span className="text-sm lg:text-base">🚗 Active Dashboard</span>
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`flex-1 px-4 py-3 text-center font-bold transition-all duration-300 rounded-tr-lg ${
              activeTab === 'history' 
                ? 'bg-blue-500 text-white' 
                : 'bg-transparent text-blue-500 hover:bg-blue-50'
            }`}
          >
            <span className="text-sm lg:text-base">📊 Ride History</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <>
            {/* Status Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          
          {/* Driver Status & Configuration */}
          <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md col-span-1 lg:col-span-2 xl:col-span-1">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Driver Status</h3>
            
            {/* Current Status */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <span className={`text-xl font-bold ${
                  isOnline ? 'text-green-500' : 'text-gray-500'
                }`}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                <button
                  onClick={toggleOnlineStatus}
                  disabled={!socketConnected}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    !socketConnected ? 'bg-gray-500 cursor-not-allowed' : 
                    isOnline ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                >
                  {isOnline ? 'Go Offline' : 'Go Online'}
                </button>
              </div>
              
              {driverLocation && (
                <p className="text-gray-600 text-sm">
                  📍 Location: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
                </p>
              )}
            </div>

            {/* Pickup Location Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Pickup Location:
              </label>
              
              {/* Location Type Filter */}
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { value: 'all', label: 'All Types', icon: '📍' },
                  { value: 'metro', label: 'Metro', icon: '🚇' },
                  { value: 'railway', label: 'Railway', icon: '🚂' },
                  { value: 'airport', label: 'Airport', icon: '✈️' },
                  { value: 'bus_terminal', label: 'Bus', icon: '🚌' }
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setSelectedLocationFilter(filter.value)}
                    disabled={isOnline}
                    className={`px-3 py-2 text-xs rounded-full font-medium transition-colors ${
                      selectedLocationFilter === filter.value 
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' 
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                    } ${isOnline ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    {filter.icon} {filter.label}
                  </button>
                ))}
              </div>

              {pickupLocationsLoading && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg mb-2">
                  🔄 Loading pickup locations...
                </div>
              )}
              
              {pickupLocationsError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg mb-2">
                  ⚠️ {pickupLocationsError}
                  {pickupLocationsError.includes('Failed') && (
                    <button
                      onClick={() => loadPickupLocations()}
                      className="ml-2 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
              
              {/* Searchable Pickup Location Input */}
              <div className="relative">
                <input
                  type="text"
                  value={pickupSearchQuery}
                  onChange={handlePickupSearchChange}
                  onKeyDown={(e) => {
                    const results = searchPickupLocations(pickupSearchQuery).slice(0, maxPickupResults);
                    handlePickupKeyDown(e, results);
                  }}
                  onFocus={() => {
                    if (pickupSearchQuery.trim()) {
                      setShowPickupResults(true);
                    }
                  }}
                  onBlur={() => {
                    // Small delay to allow clicking on results
                    setTimeout(() => setShowPickupResults(false), 200);
                  }}
                  disabled={isOnline || pickupLocationsLoading}
                  placeholder={pickupLocationsLoading ? 'Loading locations...' : 'Search pickup location...'}
                  className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    (isOnline || pickupLocationsLoading) ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                  } border-gray-300`}
                />

                {/* Search Results Dropdown */}
                {showPickupResults && pickupSearchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 border-t-0 rounded-b-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    {(() => {
                      const results = searchPickupLocations(pickupSearchQuery);
                      const displayResults = results.slice(0, maxPickupResults);
                      
                      if (displayResults.length === 0) {
                        return (
                          <div className="p-3 text-gray-500 italic text-sm">
                            No locations found
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {displayResults.map((location, index) => (
                            <div
                              key={location.id}
                              onClick={() => handlePickupSelect(location)}
                              className={`p-3 cursor-pointer flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                                index === selectedPickupIndex ? 'bg-gray-100' : 'bg-white'
                              } ${index < displayResults.length - 1 ? 'border-b border-gray-200' : ''}`}
                              onMouseEnter={() => setSelectedPickupIndex(index)}
                            >
                              <span className="text-lg">{getLocationIcon(location.type)}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm mb-1 truncate">
                                  {highlightText(location.name, pickupSearchQuery)}
                                </div>
                                <div className="text-xs text-gray-600 truncate">
                                  {highlightText(location.address || '', pickupSearchQuery)}
                                  {location.line && (
                                    <span className="text-blue-600 ml-2">
                                      {highlightText(location.line, pickupSearchQuery)} Line
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {getLocationTypeLabel(location.type)}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {results.length > maxPickupResults && (
                            <div className="p-2 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-600">
                              <span>Showing {maxPickupResults} of {results.length} results</span>
                              <button
                                onClick={() => setMaxPickupResults(prev => prev + 8)}
                                className="text-blue-600 hover:text-blue-800 cursor-pointer"
                              >
                                Show more
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              
              {/* Location Stats */}
              {pickupLocations.length > 0 && !pickupLocationsLoading && (
                <div className="text-xs text-gray-500 mt-2">
                  {pickupLocations.length} pickup locations available
                  {selectedLocationFilter !== 'all' && locationsByType[selectedLocationFilter] && (
                    <span> • {locationsByType[selectedLocationFilter].length} {selectedLocationFilter} locations</span>
                  )}
                </div>
              )}
            </div>

            {/* Vehicle Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Vehicle Type:
              </label>
              <div className="flex flex-wrap gap-3">
                {['bike', 'auto', 'car'].map(type => (
                  <label key={type} className={`flex items-center gap-2 ${
                    isOnline ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}>
                    <input
                      type="radio"
                      name="vehicleType"
                      value={type}
                      checked={vehicleType === type}
                      onChange={(e) => setVehicleType(e.target.value)}
                      disabled={isOnline}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Active Ride */}
          {activeRide && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 lg:p-6 rounded-lg shadow-md col-span-1 lg:col-span-2">
              {/* Booth Ride Number - Prominent Display */}
              {activeRide.boothRideNumber && (
                <div className="bg-yellow-400 text-black px-4 py-3 rounded-lg text-center mb-4 text-lg font-bold">
                  Ride #{activeRide.boothRideNumber}
                </div>
              )}

              {/* Queue Information for Driver */}
              {activeRide.queueNumber && (
                <div style={{
                  backgroundColor: '#e8f5e9',
                  border: '2px solid #4caf50',
                  color: '#2e7d32',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                  boxShadow: '0 3px 10px rgba(76,175,80,0.2)'
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    📋 Queue: {activeRide.queueNumber}
                  </div>
                  <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                    Your position: #{activeRide.queuePosition}
                  </div>
                  {activeRide.totalInQueue > 0 && (
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                      {activeRide.totalInQueue} rides in queue
                    </div>
                  )}
                  <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>
                    📍 {activeRide.boothName || activeRide.pickupStation}
                  </div>
                </div>
              )}
              
              <h3 style={{ marginTop: 0, color: '#333', marginBottom: '1.5rem' }}>Active Ride Details</h3>
              
              {/* Rider Information Card */}
              <div style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #dee2e6'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>
                  🚶 Rider Information
                </h4>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {activeRide.userName || 'Unknown Rider'}
                </div>
                {activeRide.userPhone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📞 {activeRide.userPhone}</span>
                    <a 
                      href={`tel:${activeRide.userPhone}`}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#007bff',
                        color: '#fff',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}
                    >
                      Call Rider
                    </a>
                  </div>
                )}
              </div>
              
              {/* Trip Details */}
              <div style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #dee2e6'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>
                  📍 Trip Details
                </h4>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: '#28a745' }}>Pickup:</strong>
                  <div style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
                    {activeRide.pickupLocation?.boothName || 
                     activeRide.pickupLocation?.stationName || 
                     activeRide.pickupStation || 
                     'Location not specified'}
                  </div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: '#dc3545' }}>Drop:</strong>
                  <div style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
                    {activeRide.dropLocation?.address || 'Destination not specified'}
                  </div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong>Vehicle Type:</strong> {activeRide.vehicleType?.toUpperCase() || 'Not specified'}
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong>Distance:</strong> {activeRide.distance ? `${activeRide.distance}km` : 'Calculating...'}
                </div>
              </div>
              
              {/* Fare Display */}
              <div style={{
                backgroundColor: '#fff3cd',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #ffeaa7',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#856404', marginBottom: '0.5rem' }}>
                  Total Fare
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#856404' }}>
                  ₹{activeRide.fare || activeRide.estimatedFare}
                </div>
              </div>
              
              {/* Status Display */}
              <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                <span style={{ 
                  padding: '0.5rem 1.5rem', 
                  borderRadius: '4px', 
                  backgroundColor: activeRide.status === 'driver_assigned' ? '#17a2b8' : 
                                  activeRide.status === 'ride_started' ? '#28a745' : 
                                  activeRide.status === 'ride_ended' ? '#ffc107' : '#6c757d',
                  color: '#fff',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}>
                  {activeRide.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* OTP Section */}
              {activeRide.status === 'driver_assigned' && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => setShowOTPInput({ type: 'start', label: 'Ask user for Start OTP' })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Start Ride (Verify Start OTP)
                  </button>
                </div>
              )}

              {activeRide.status === 'ride_started' && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => setShowOTPInput({ type: 'end', label: 'Ask user for End OTP' })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Complete Ride (Verify End OTP)
                  </button>
                </div>
              )}

              {/* Ride Completion Status */}
              {activeRide.status === 'ride_ended' && (
                <div style={{
                  backgroundColor: '#fff3cd',
                  padding: '1rem',
                  borderRadius: '4px',
                  textAlign: 'center',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '1.2rem', color: '#856404' }}>
                    🏁 Ride Ended - Processing...
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    Payment collection and ride completion in progress
                  </div>
                </div>
              )}

              {/* Ride Completed Status */}
              {activeRide.status === 'completed' && (
                <div style={{
                  backgroundColor: '#d4edda',
                  padding: '1rem',
                  borderRadius: '4px',
                  textAlign: 'center',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '1.2rem', color: '#155724' }}>
                    ✅ Ride Completed Successfully!
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    Payment: ₹{activeRide.actualFare || activeRide.fare || activeRide.estimatedFare} (Cash)
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                    Ride data saved to history. Dashboard will clear automatically.
                  </div>
                </div>
              )}

              {/* Enhanced OTP Input Interface */}
              {showOTPInput && (
                <div style={{ 
                  padding: '1.5rem', 
                  backgroundColor: showOTPInput.type === 'start' ? '#d4edda' : '#fff3cd', 
                  borderRadius: '8px',
                  border: showOTPInput.type === 'start' ? '2px solid #28a745' : '2px solid #ffc107',
                  marginTop: '1rem'
                }}>
                  <div style={{ 
                    textAlign: 'center',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ 
                      fontSize: '1.2rem', 
                      fontWeight: 'bold', 
                      color: '#333',
                      marginBottom: '0.5rem'
                    }}>
                      {showOTPInput.type === 'start' ? '🚀 Start Ride Verification' : '🏁 End Ride Verification'}
                    </div>
                    <div style={{ 
                      fontSize: '0.9rem', 
                      color: '#666' 
                    }}>
                      {showOTPInput.type === 'start' ? 
                        'Ask the rider for their Start OTP to begin the ride' : 
                        'Ask the rider for their End OTP to complete the ride'
                      }
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Enter 4-digit OTP"
                      maxLength="4"
                      style={{
                        flex: 1,
                        padding: '1rem',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '1.2rem',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        letterSpacing: '0.2rem'
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleOTPVerification}
                      disabled={otpInput.length !== 4}
                      style={{
                        padding: '1rem 1.5rem',
                        backgroundColor: otpInput.length === 4 ? '#007bff' : '#6c757d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: otpInput.length === 4 ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                      }}
                    >
                      Verify OTP
                    </button>
                  </div>
                  
                  <div style={{ 
                    textAlign: 'center',
                    marginTop: '1rem'
                  }}>
                    <button
                      onClick={() => {
                        setShowOTPInput(null);
                        setOtpInput('');
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        color: '#666',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ride Requests */}
        {isOnline && !activeRide && (
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            marginBottom: '2rem'
          }}>
            <h2 style={{ marginTop: 0, color: '#333' }}>
              Ride Requests ({rideRequests.length})
            </h2>
            {rideRequests.length === 0 ? (
              <p style={{ 
                textAlign: 'center', 
                color: '#666', 
                padding: '2rem',
                fontSize: '1.1rem'
              }}>
                {socketConnected ? 'Waiting for ride requests...' : 'Socket connection required for requests'}
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {rideRequests.map(request => (
                  <div 
                    key={request._id}
                    style={{
                      backgroundColor: selectedRequest?._id === request._id ? '#fff3cd' : '#f8f9fa',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      border: selectedRequest?._id === request._id ? '2px solid #ffc107' : '1px solid #dee2e6',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedRequest(request)}
                  >
                    {/* Booth Ride Number - Prominent Display */}
                    {request.boothRideNumber && (
                      <div style={{
                        backgroundColor: '#007bff',
                        color: '#fff',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        textAlign: 'center',
                        marginBottom: '1rem',
                        fontSize: '1.1rem',
                        fontWeight: 'bold'
                      }}>
                        Ride #{request.boothRideNumber}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>{request.userName}</h4>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                          📞 {request.userPhone}
                        </p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                          📍 <strong>Pickup:</strong> {request.pickupLocation?.boothName}
                        </p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                          📍 <strong>Drop:</strong> {request.dropLocation?.address}
                        </p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                          🚗 <strong>Vehicle:</strong> {request.vehicleType?.toUpperCase()}
                        </p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                          📏 <strong>Distance:</strong> {request.distance}km
                        </p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#999' }}>
                          🕒 {new Date(request.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
                          ₹{request.fare || request.estimatedFare}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>
                          ID: {request.requestNumber || request.rideId}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptRide(request);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          declineRide(request._id);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: '#dc3545',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Map */}
        <div style={{
          backgroundColor: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>Map View</h3>
          <div style={{ height: '400px', borderRadius: '4px', overflow: 'hidden' }}>
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={driverLocation || { lat: 28.6139, lng: 77.2090 }}
              zoom={12}
            >
              {/* Driver location */}
              {driverLocation && (
                <Marker
                  position={driverLocation}
                  icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    scaledSize: new window.google.maps.Size(40, 40)
                  }}
                  title="Your Location"
                />
              )}

              {/* Selected metro booth */}
              {selectedMetroBooth && metroStations.find(s => s.name === selectedMetroBooth) && (
                <Marker
                  position={{ 
                    lat: metroStations.find(s => s.name === selectedMetroBooth).lat, 
                    lng: metroStations.find(s => s.name === selectedMetroBooth).lng 
                  }}
                  icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    scaledSize: new window.google.maps.Size(40, 40)
                  }}
                  title={`Selected Booth: ${selectedMetroBooth}`}
                />
              )}

              {/* Active ride pickup */}
              {activeRide && (
                <Marker
                  position={{
                    lat: activeRide.pickupLocation?.latitude || activeRide.pickupLocation?.lat,
                    lng: activeRide.pickupLocation?.longitude || activeRide.pickupLocation?.lng
                  }}
                  icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    scaledSize: new window.google.maps.Size(40, 40)
                  }}
                  title={`Active Pickup: ${activeRide.pickupLocation?.boothName}`}
                />
              )}

              {/* Ride request pickups */}
              {rideRequests.map(request => (
                <Marker
                  key={request._id}
                  position={{
                    lat: request.pickupLocation?.latitude || request.pickupLocation?.lat,
                    lng: request.pickupLocation?.longitude || request.pickupLocation?.lng
                  }}
                  icon={{
                    url: selectedRequest?._id === request._id 
                      ? 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
                      : 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png',
                    scaledSize: new window.google.maps.Size(35, 35)
                  }}
                  title={`${request.userName} - ${request.pickupLocation?.boothName}`}
                  onClick={() => setSelectedRequest(request)}
                />
              ))}

              {/* All metro stations */}
              {metroStations.map(station => (
                <Marker
                  key={station.id}
                  position={{ lat: station.lat, lng: station.lng }}
                  icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    scaledSize: new window.google.maps.Size(15, 15)
                  }}
                  title={`${station.name} (${station.line} Line)`}
                />
              ))}
            </GoogleMap>
          </div>
        </div>
        </>
        )}

        {/* History Tab Content */}
        {activeTab === 'history' && (
          <div>
            {/* Driver Statistics Cards */}
            {driverStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                    {driverStats.totalRides || 0}
                  </div>
                  <div style={{ color: '#666', marginTop: '0.5rem' }}>Total Rides</div>
                </div>

                <div style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>
                    ₹{driverStats.totalEarnings || 0}
                  </div>
                  <div style={{ color: '#666', marginTop: '0.5rem' }}>Total Earnings</div>
                </div>

                <div style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#17a2b8' }}>
                    {driverStats.averageRating || 0}/5
                  </div>
                  <div style={{ color: '#666', marginTop: '0.5rem' }}>Average Rating</div>
                </div>

                <div style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6f42c1' }}>
                    {Math.round(driverStats.averageDistance || 0)} km
                  </div>
                  <div style={{ color: '#666', marginTop: '0.5rem' }}>Avg Distance</div>
                </div>
              </div>
            )}

            {/* Filter Controls */}
            <div style={{
              backgroundColor: '#fff',
              padding: '1rem',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              marginBottom: '2rem'
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', color: '#333' }}>Filter:</span>
                {['all', 'completed', 'cancelled'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => handleFilterChange(filter)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: historyFilter === filter ? '#007bff' : '#f8f9fa',
                      color: historyFilter === filter ? '#fff' : '#333',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: historyFilter === filter ? 'bold' : 'normal',
                      textTransform: 'capitalize'
                    }}
                  >
                    {filter === 'all' ? 'All Rides' : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* History Error */}
            {historyError && (
              <div style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '1rem',
                borderRadius: '4px',
                marginBottom: '2rem',
                border: '1px solid #f5c6cb'
              }}>
                History Error: {historyError}
              </div>
            )}

            {/* Ride History Table */}
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '1rem',
                borderBottom: '1px solid #dee2e6',
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}>
                📋 Ride History ({rideHistory.length} rides)
              </div>

              {historyLoading && rideHistory.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                  Loading ride history...
                </div>
              ) : rideHistory.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                  No rides found. Start accepting rides to build your history!
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Date</th>
                          <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Ride ID</th>
                          <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Passenger</th>
                          <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Route</th>
                          <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Vehicle</th>
                          <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Fare</th>
                          <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Status</th>
                          <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rideHistory.map((ride, index) => (
                          <tr key={ride._id || index} style={{ 
                            backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa',
                            borderBottom: '1px solid #dee2e6'
                          }}>
                            <td style={{ padding: '1rem' }}>
                              {new Date(ride.timestamps?.requested || ride.createdAt).toLocaleDateString()}
                              <br />
                              <small style={{ color: '#666' }}>
                                {new Date(ride.timestamps?.requested || ride.createdAt).toLocaleTimeString()}
                              </small>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <strong>{ride.boothRideNumber}</strong>
                              <br />
                              <small style={{ color: '#666' }}>{ride.rideId}</small>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              {ride.user?.name || ride.userName || 'Unknown'}
                              <br />
                              <small style={{ color: '#666' }}>
                                {ride.user?.mobileNo || ride.userPhone || ''}
                              </small>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <strong>{ride.pickupLocation?.boothName}</strong>
                              <br />
                              <small style={{ color: '#666' }}>
                                to {ride.dropLocation?.address?.substring(0, 30)}...
                              </small>
                            </td>
                            <td style={{ padding: '1rem', textTransform: 'uppercase' }}>
                              {ride.vehicleType}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <strong style={{ color: '#28a745' }}>₹{ride.actualFare}</strong>
                              {ride.estimatedFare !== ride.actualFare && (
                                <>
                                  <br />
                                  <small style={{ color: '#666' }}>Est: ₹{ride.estimatedFare}</small>
                                </>
                              )}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: ride.status === 'completed' ? '#d4edda' : '#f8d7da',
                                color: ride.status === 'completed' ? '#155724' : '#721c24',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                              }}>
                                {ride.status}
                              </span>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              {ride.journeyStats?.rideDuration ? 
                                `${ride.journeyStats.rideDuration} min` : 
                                '-'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Load More Button */}
                  {historyHasMore && (
                    <div style={{ padding: '1rem', textAlign: 'center', borderTop: '1px solid #dee2e6' }}>
                      <button
                        onClick={loadMoreHistory}
                        disabled={historyLoading}
                        style={{
                          padding: '0.75rem 2rem',
                          backgroundColor: historyLoading ? '#6c757d' : '#007bff',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: historyLoading ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        {historyLoading ? 'Loading...' : 'Load More Rides'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default DriverDashboard;