import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { drivers } from '../../services/api';
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

// New Driver Components
import {
  DriverLayout,
  DriverStatusPanel,
  RideRequestsList,
  ActiveRidePanel,
  DriverRideHistory,
  DriverStatsCards
} from '../../components/driver';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const NewDriverDashboard = () => {
  const navigate = useNavigate();
  
  // Driver state
  const [driver, setDriver] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Driver status
  const [isOnline, setIsOnline] = useState(false);
  const [selectedPickupLocation, setSelectedPickupLocation] = useState('');
  const [vehicleType, setVehicleType] = useState('auto');
  const [driverLocation, setDriverLocation] = useState(null);
  
  // Pickup locations
  const [pickupLocations, setPickupLocations] = useState([]);
  const [locationsByType, setLocationsByType] = useState({});
  const [pickupLocationsLoading, setPickupLocationsLoading] = useState(false);
  const [pickupLocationsError, setPickupLocationsError] = useState('');
  
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
  const [isGoingOnline, setIsGoingOnline] = useState(false);
  const [acceptingRideId, setAcceptingRideId] = useState(null);
  
  // History state
  const [rideHistory, setRideHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [driverStats, setDriverStats] = useState(null);

  // UI state
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, requests, active, history, profile
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  console.log('[NewDriverDashboard] Component mounted');

  // Window resize listener
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Authentication check and socket initialization
  useEffect(() => {
    console.log('[NewDriverDashboard] Checking authentication...');
    const token = localStorage.getItem('driverToken');
    const driverData = localStorage.getItem('driver');
    
    if (!token || !driverData) {
      console.log('[NewDriverDashboard] No authentication data found');
      navigate('/driver/login');
      return;
    }
    
    try {
      const parsedDriver = JSON.parse(driverData);
      console.log('[NewDriverDashboard] Driver loaded:', parsedDriver);
      setDriver(parsedDriver);
      
      // Initialize socket connection
      console.log('[NewDriverDashboard] Initializing socket connection...');
      const initSocket = async () => {
        try {
          const socketInstance = initializeSocket(token);
          
          if (socketInstance && typeof socketInstance.then === 'function') {
            console.log('[NewDriverDashboard] Waiting for socket initialization...');
            const actualSocket = await socketInstance;
            setSocket(actualSocket);
          } else {
            setSocket(socketInstance);
          }
        } catch (error) {
          console.error('[NewDriverDashboard] Socket initialization error:', error);
        }
      };
      
      initSocket();
      
      // Check socket connection status
      const checkConnection = () => {
        const connected = isSocketConnected();
        setSocketConnected(connected);
        console.log('[NewDriverDashboard] Socket connection status:', connected);
      };
      
      checkConnection();
      const connectionCheckInterval = setInterval(checkConnection, 5000);
      
      return () => clearInterval(connectionCheckInterval);
      
    } catch (error) {
      console.error('[NewDriverDashboard] Error parsing driver data:', error);
      navigate('/driver/login');
    }
  }, [navigate]);

  // Load pickup locations
  const loadPickupLocations = async (retryCount = 0) => {
    const maxRetries = 3;
    
    try {
      console.log(`[NewDriverDashboard] Loading pickup locations... (attempt ${retryCount + 1})`);
      
      setPickupLocationsLoading(true);
      setPickupLocationsError('');
      
      const response = await drivers.getPickupLocations();
      console.log('[NewDriverDashboard] Pickup locations response:', response);
      
      if (response.success && response.data && Array.isArray(response.data.locations)) {
        const locations = response.data.locations;
        setPickupLocations(locations);
        
        // Group by type
        const grouped = locations.reduce((acc, location) => {
          if (!acc[location.type]) acc[location.type] = [];
          acc[location.type].push(location);
          return acc;
        }, {});
        setLocationsByType(grouped);
        
        // Always use fixed pickup location
        const fixedLocation = "Hauz Khas Metro Gate No 1";
        setSelectedPickupLocation(fixedLocation);
        console.log(`🎯 [NewDriverDashboard] Using fixed pickup location: ${fixedLocation}`);
        
        setPickupLocationsLoading(false);
        console.log(`✅ [NewDriverDashboard] Successfully loaded ${locations.length} pickup locations`);
      } else {
        throw new Error('Invalid response structure: no locations data found in API response');
      }
      
    } catch (error) {
      console.error(`❌ [NewDriverDashboard] Error loading pickup locations (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < maxRetries) {
        const retryDelay = Math.pow(2, retryCount) * 1000;
        console.log(`⏳ [NewDriverDashboard] Retrying in ${retryDelay}ms...`);
        setTimeout(() => {
          loadPickupLocations(retryCount + 1);
        }, retryDelay);
      } else {
        console.warn('⚠️ [NewDriverDashboard] All retries failed for pickup locations');
        setPickupLocationsLoading(false);
        setPickupLocationsError(`Failed to load pickup locations: ${error.error || error.message}`);
      }
    }
  };

  // Set fixed location on mount (no need to load pickup locations from API)
  useEffect(() => {
    if (driver) {
      const fixedLocation = "Hauz Khas Metro Gate No 1";
      setSelectedPickupLocation(fixedLocation);
      setPickupLocations([{
        id: 'fixed-location',
        name: fixedLocation,
        type: 'metro',
        address: 'Hauz Khas Metro Station Gate No 1, Outer Ring Road, Hauz Khas, New Delhi'
      }]);
      console.log(`🎯 [NewDriverDashboard] Set fixed pickup location: ${fixedLocation}`);
    }
  }, [driver]);

  // Get driver's current location
  useEffect(() => {
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
              speed: position.coords.speed
            });
          }
        },
        (error) => {
          console.error('[NewDriverDashboard] Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isOnline, socketConnected, activeRide]);

  // Set up socket listeners for ride requests
  useEffect(() => {
    if (socket && socketConnected) {
      console.log('[NewDriverDashboard] Setting up socket listeners...');
      
      const unsubscribe = subscribeToDriverUpdates({
        onNewRideRequest: (data) => {
          console.log('[NewDriverDashboard] New ride request:', data);
          
          setRideRequests(prev => {
            const existingRequest = prev.find(r => r._id === data._id);
            if (existingRequest) {
              console.log('⚠️ [NewDriverDashboard] Duplicate ride request, ignoring');
              return prev;
            }
            console.log('✅ [NewDriverDashboard] Adding new ride request to list');
            
            // Auto-switch to requests view on first request if currently on dashboard
            if (prev.length === 0 && currentView === 'dashboard') {
              console.log('[NewDriverDashboard] Auto-switching to requests view for first request');
              setCurrentView('requests');
            }
            
            return [...prev, data];
          });
        },
        
        onRideRequestClosed: (data) => {
          console.log('[NewDriverDashboard] Ride request closed:', data);
          setRideRequests(prev => prev.filter(r => r._id !== data.rideId));
          if (selectedRequest?._id === data.rideId) {
            setSelectedRequest(null);
          }
        },
        
        onRideAssigned: (data) => {
          console.log('[NewDriverDashboard] Ride assigned:', data);
          setActiveRide(data);
          setCurrentView('active');
          setRideRequests([]);
          setSelectedRequest(null);
          setRideError('');
          setAcceptingRideId(null); // Clear accepting state
        },
        
        onRideAcceptConfirmed: (data) => {
          console.log('[NewDriverDashboard] Ride accept confirmed:', data);
          setActiveRide(data);
          setCurrentView('active');
          setRideRequests([]);
          setSelectedRequest(null);
          setRideError('');
          setAcceptingRideId(null); // Clear accepting state
        },
        
        onDriverOnlineConfirmed: (data) => {
          console.log('[NewDriverDashboard] Driver online confirmed:', data);
          setIsOnline(true);
          setStatusError('');
          setIsGoingOnline(false);
          
          // Auto-switch to requests view when going online (like old dashboard)
          console.log('[NewDriverDashboard] Auto-switching to requests view after going online');
          setCurrentView('requests');
        },
        
        onDriverOfflineConfirmed: (data) => {
          console.log('[NewDriverDashboard] Driver offline confirmed:', data);
          setIsOnline(false);
          setRideRequests([]);
          setActiveRide(null);
          setSelectedRequest(null);
          
          // Switch back to dashboard view when going offline
          console.log('[NewDriverDashboard] Switching back to dashboard view after going offline');
          setCurrentView('dashboard');
        },
        
        onRideStarted: (data) => {
          console.log('[NewDriverDashboard] Ride started:', data);
          setActiveRide(prev => ({ ...prev, ...data, status: 'ride_started' }));
          setShowOTPInput(null);
        },
        
        onRideEnded: (data) => {
          console.log('[NewDriverDashboard] Ride ended:', data);
          setActiveRide(prev => ({ ...prev, ...data, status: 'ride_ended' }));
          setShowOTPInput(null);
        },
        
        onRideCompleted: (data) => {
          console.log('[NewDriverDashboard] Ride completed automatically:', data);
          setActiveRide(prev => ({ ...prev, ...data, status: 'completed' }));
          setShowOTPInput(null);
          setRideError('');
          
          // Clear active ride after showing completion message
          setTimeout(() => {
            setActiveRide(null);
            setCurrentView('dashboard');
            console.log('[NewDriverDashboard] ✅ Ride cleared from dashboard - moved to history');
          }, 4000);
        },
        
        onRideAcceptError: (error) => {
          console.error('[NewDriverDashboard] Ride accept error:', error);
          setRideError(error.message || 'Failed to accept ride');
          setAcceptingRideId(null); // Clear accepting state
          
          // If it's a "ride no longer available" error, automatically remove it from the list
          if (error.message && error.message.includes('no longer available')) {
            console.log('[NewDriverDashboard] Removing unavailable ride from list');
            setRideError('⚠️ This ride was just accepted by another driver');
            
            // Clear the error after a few seconds
            setTimeout(() => {
              setRideError('');
            }, 3000);
          }
        },
        
        onOTPVerificationSuccess: (data) => {
          console.log('[NewDriverDashboard] OTP verification success:', data);
          setRideError('');
          setOtpInput('');
          setShowOTPInput(null);
          
          // Update ride status based on verification response
          const newStatus = data.status || data.rideStatus;
          if (newStatus === 'ride_started') {
            setActiveRide(prev => ({ ...prev, status: 'ride_started' }));
            setRideError('✅ Ride started successfully!');
          } else if (newStatus === 'ride_ended' || newStatus === 'completed') {
            setActiveRide(prev => ({ ...prev, status: newStatus }));
            setRideError('✅ Ride completed successfully!');
          }
          
          // Clear success message after a few seconds
          setTimeout(() => {
            setRideError('');
          }, 3000);
        },
        
        onOTPVerificationError: (error) => {
          console.error('[NewDriverDashboard] OTP verification error:', error);
          setRideError(error.message || 'OTP verification failed');
          // Don't clear the OTP input so user can try again
        },

        onError: (error) => {
          console.error('[NewDriverDashboard] Socket error:', error);
          setRideError(error.message || 'Socket communication error');
          
          // If we're trying to go online and get an error, show it in status
          if (isGoingOnline) {
            setStatusError(error.message || 'Failed to go online');
            setIsGoingOnline(false);
          }
        }
      });

      return () => {
        console.log('[NewDriverDashboard] Cleaning up socket subscriptions');
        if (unsubscribe) unsubscribe();
      };
    }
  }, [socket, socketConnected, selectedRequest]);

  // Toggle online status
  const toggleOnlineStatus = async () => {
    console.log('[NewDriverDashboard] toggleOnlineStatus called', {
      socketConnected,
      isOnline,
      vehicleType,
      driverLocation,
      driver: driver ? driver.id : 'null'
    });
    
    if (!socketConnected) {
      console.log('[NewDriverDashboard] ❌ Socket not connected');
      setStatusError('Socket connection required');
      return;
    }

    if (!isOnline) {
      // Going online - only need vehicle type (location is fixed)
      if (!vehicleType) {
        console.log('[NewDriverDashboard] ❌ No vehicle type selected');
        setStatusError('Please select vehicle type');
        return;
      }
      
      if (!driver || !driver.id) {
        console.log('[NewDriverDashboard] ❌ Driver data missing');
        setStatusError('Driver information missing');
        return;
      }
      
      setStatusError('');
      setIsGoingOnline(true);
      console.log('[NewDriverDashboard] ✅ Going online...');
      
      // Use fixed pickup location instead of user selection
      const fixedLocation = "Hauz Khas Metro Gate No 1";
      
      // Use default location if driverLocation is not available
      const locationToUse = driverLocation || {
        lat: 28.5433, // Hauz Khas Metro coordinates
        lng: 77.2066
      };
      
      console.log('[NewDriverDashboard] 🚀 Calling driverGoOnline with:', {
        metroBooth: fixedLocation,
        vehicleType: vehicleType,
        driverId: driver.id,
        location: locationToUse
      });
      
      driverGoOnline({
        metroBooth: fixedLocation,
        vehicleType: vehicleType,
        driverId: driver.id,
        location: locationToUse
      });
      
      // Set a timeout to reset the loading state if no response
      setTimeout(() => {
        if (isGoingOnline) {
          console.log('[NewDriverDashboard] ⚠️ Timeout waiting for online confirmation');
          setStatusError('Failed to go online - please try again');
          setIsGoingOnline(false);
        }
      }, 10000); // 10 second timeout
      
      // Update the selected pickup location for UI consistency
      setSelectedPickupLocation(fixedLocation);
    } else {
      // Going offline
      console.log('[NewDriverDashboard] Going offline...');
      driverGoOffline();
    }
  };

  // Accept ride
  const acceptRide = (request) => {
    if (!socketConnected) {
      setRideError('Socket connection required');
      return;
    }
    
    // Prevent double-clicks
    if (acceptingRideId === request._id) {
      console.log('[NewDriverDashboard] Already accepting this ride, ignoring duplicate click');
      return;
    }

    console.log('[NewDriverDashboard] 🚗 Accepting ride:', request);
    setRideError('');
    setAcceptingRideId(request._id);
    
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
    
    // Reset accepting state after a timeout in case no response
    setTimeout(() => {
      if (acceptingRideId === request._id) {
        console.log('[NewDriverDashboard] ⚠️ Timeout waiting for ride accept response');
        setAcceptingRideId(null);
        setRideError('Ride acceptance timeout - please try again');
      }
    }, 10000); // 10 second timeout
  };

  // Decline ride
  const declineRide = (requestId) => {
    console.log('[NewDriverDashboard] Declining ride:', requestId);
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
    
    if (otpInput.length !== 4) {
      setRideError('OTP must be 4 digits');
      return;
    }

    if (!activeRide) {
      setRideError('No active ride found');
      return;
    }
    
    if (!socketConnected) {
      setRideError('Socket connection required for OTP verification');
      return;
    }

    const otpData = {
      rideId: activeRide._id || activeRide.rideId,
      otp: otpInput.trim()
    };

    console.log('[NewDriverDashboard] Verifying OTP:', {
      type: showOTPInput.type,
      rideId: otpData.rideId,
      otp: otpData.otp
    });

    const handleOTPResponse = (response) => {
      console.log('[NewDriverDashboard] OTP verification response:', response);
      
      if (response && response.success) {
        console.log('[NewDriverDashboard] OTP verified successfully');
        setOtpInput('');
        setShowOTPInput(null);
        setRideError('');
        
        if (showOTPInput.type === 'start') {
          setActiveRide(prev => ({ ...prev, status: 'ride_started' }));
        } else if (showOTPInput.type === 'end') {
          setActiveRide(prev => ({ ...prev, status: 'ride_ended' }));
        }
      } else {
        console.error('[NewDriverDashboard] OTP verification failed:', response);
        setRideError(response?.message || 'Invalid OTP. Please try again.');
      }
    };

    if (showOTPInput.type === 'start') {
      verifyStartOTP(otpData, handleOTPResponse);
    } else if (showOTPInput.type === 'end') {
      verifyEndOTP(otpData, handleOTPResponse);
    }
  };

  // Load driver ride history
  const loadRideHistory = async (page = 1, filter = 'all', resetHistory = false) => {
    try {
      setHistoryLoading(true);
      setHistoryError('');
      
      console.log(`[NewDriverDashboard] Loading ride history: page=${page}, filter=${filter}`);
      
      const response = await drivers.getRideHistory(page, 10, filter);
      console.log('[NewDriverDashboard] History response:', response);
      
      if (response.success) {
        const newHistory = response.data.rideHistory || [];
        
        if (resetHistory || page === 1) {
          setRideHistory(newHistory);
        } else {
          setRideHistory(prev => [...prev, ...newHistory]);
        }
        
        setHistoryHasMore(newHistory.length === 10);
        setHistoryPage(page);
        
        // Load driver stats if available
        if (response.data.driverStats) {
          setDriverStats(response.data.driverStats);
        }
      }
      
    } catch (error) {
      console.error('[NewDriverDashboard] Error loading ride history:', error);
      setHistoryError(error.message || 'Failed to load ride history');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load more history
  const loadMoreHistory = () => {
    if (!historyLoading && historyHasMore) {
      loadRideHistory(historyPage + 1, historyFilter, false);
    }
  };

  // Handle filter change
  const handleHistoryFilterChange = (newFilter) => {
    setHistoryFilter(newFilter);
    loadRideHistory(1, newFilter, true);
  };

  // Handle view change
  const handleViewChange = (view) => {
    setCurrentView(view);
    
    // Load data when switching to history view
    if (view === 'history' && rideHistory.length === 0) {
      loadRideHistory(1, historyFilter, true);
    }
  };

  // Handle logout
  const handleLogout = () => {
    if (socket) {
      unsubscribeFromDriverUpdates();
    }
    localStorage.removeItem('driverToken');
    localStorage.removeItem('driver');
    navigate('/driver/login');
  };

  // Map configuration
  const mapContainerStyle = {
    width: '100%',
    height: '100%'
  };

  const center = driverLocation || { lat: 28.6139, lng: 77.2090 }; // Default to Delhi

  // Render sidebar content based on current view
  const renderSidebarContent = () => {
    console.log('[NewDriverDashboard] Rendering sidebar - currentView:', currentView);
    
    const isMobile = windowWidth < 768;
    
    switch (currentView) {
      case 'requests':
        return (
          <RideRequestsList
            rideRequests={rideRequests}
            selectedRequest={selectedRequest}
            socketConnected={socketConnected}
            acceptingRideId={acceptingRideId}
            onSelectRequest={setSelectedRequest}
            onAcceptRide={acceptRide}
            onDeclineRide={declineRide}
          />
        );
        
      case 'active':
        return (
          <ActiveRidePanel
            activeRide={activeRide}
            otpInput={otpInput}
            showOTPInput={showOTPInput}
            rideError={rideError}
            onOTPInputChange={setOtpInput}
            onStartRide={() => {
              console.log('🎯 [NewDashboard] onStartRide called, setting showOTPInput');
              setShowOTPInput({ type: 'start', label: 'Ask user for Start OTP' });
              console.log('✅ [NewDashboard] showOTPInput set to start type');
            }}
            onEndRide={() => setShowOTPInput({ type: 'end', label: 'Ask user for End OTP' })}
            onOTPVerification={() => {
              console.log('🔐 [NewDashboard] OTP Verification clicked', {
                otpInput: otpInput,
                showOTPInput: showOTPInput,
                activeRide: activeRide
              });
              handleOTPVerification();
            }}
            onCancelOTP={() => {
              setShowOTPInput(null);
              setOtpInput('');
            }}
          />
        );
        
      case 'history':
        return (
          <DriverRideHistory
            rideHistory={rideHistory}
            historyLoading={historyLoading}
            historyError={historyError}
            historyHasMore={historyHasMore}
            historyFilter={historyFilter}
            onFilterChange={handleHistoryFilterChange}
            onLoadMore={loadMoreHistory}
          />
        );
        
      default: // dashboard
        return (
          <div className="space-y-6">
            <DriverStatusPanel
              driver={driver}
              isOnline={isOnline}
              socketConnected={socketConnected}
              selectedPickupLocation={selectedPickupLocation}
              vehicleType={vehicleType}
              driverLocation={driverLocation}
              pickupLocations={pickupLocations}
              pickupLocationsLoading={pickupLocationsLoading}
              pickupLocationsError={pickupLocationsError}
              statusError={statusError}
              isGoingOnline={isGoingOnline}
              onToggleOnlineStatus={toggleOnlineStatus}
              onPickupLocationChange={setSelectedPickupLocation}
              onVehicleTypeChange={setVehicleType}
              onLoadPickupLocations={loadPickupLocations}
            />
            
            {/* Ride Requests Notification */}
            {isOnline && rideRequests.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-800 mb-1">
                      🔔 {rideRequests.length} New Ride Request{rideRequests.length > 1 ? 's' : ''}!
                    </h3>
                    <p className="text-yellow-700 text-sm">
                      You have pending ride requests waiting for your response.
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentView('requests')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors animate-bounce"
                  >
                    View Requests
                  </button>
                </div>
              </div>
            )}
            
            {/* Ready to Go Online Indicator */}
            {!isOnline && !isGoingOnline && selectedPickupLocation && vehicleType && socketConnected && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-blue-800 mb-1">
                    🚀 Ready to Go Online!
                  </h3>
                  <p className="text-blue-700 text-sm">
                    All settings configured. Click "Go Online" to start receiving ride requests.
                  </p>
                  <p className="text-blue-600 text-xs mt-2">
                    Location: {selectedPickupLocation} | Vehicle: {vehicleType} | Socket: ✅ Connected
                  </p>
                </div>
              </div>
            )}

            {/* Debug Info - Show when online but no requests or when going online */}
            {((isOnline && rideRequests.length === 0) || isGoingOnline) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-blue-800 mb-1">
                    {isGoingOnline ? '🔄 Going Online...' : '🟢 Online & Ready'}
                  </h3>
                  <p className="text-blue-700 text-sm">
                    {isGoingOnline 
                      ? 'Connecting to ride request system...' 
                      : 'Waiting for ride requests...'
                    } Socket: {socketConnected ? '✅ Connected' : '❌ Disconnected'}
                  </p>
                  <p className="text-blue-600 text-xs mt-2">
                    Location: {selectedPickupLocation || 'Not set'} | Vehicle: {vehicleType}
                  </p>
                  {isGoingOnline && (
                    <p className="text-blue-500 text-xs mt-1 italic">
                      You will be automatically switched to requests view once online.
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {driverStats && (
              <DriverStatsCards driverStats={driverStats} />
            )}
          </div>
        );
    }
  };

  // Render map
  const renderMap = () => (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={13}
      options={{
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {/* Driver location marker */}
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

      {/* Active ride pickup marker */}
      {activeRide && activeRide.pickupLocation && (
        <Marker
          position={{
            lat: activeRide.pickupLocation.latitude || activeRide.pickupLocation.lat,
            lng: activeRide.pickupLocation.longitude || activeRide.pickupLocation.lng
          }}
          icon={{
            url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
            scaledSize: new window.google.maps.Size(35, 35)
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
            url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
            scaledSize: new window.google.maps.Size(30, 30)
          }}
          title={`Ride Request: ${request.pickupLocation?.boothName}`}
        />
      ))}
    </GoogleMap>
  );

  // Loading state
  if (!driver) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <DriverLayout
      sidebar={renderSidebarContent()}
      map={renderMap()}
      currentView={currentView}
      onViewChange={handleViewChange}
      activeRide={activeRide}
      driver={driver}
      rideRequestsCount={rideRequests.length}
      socketConnected={socketConnected}
      isOnline={isOnline}
      onLogout={handleLogout}
    >
      {/* Error Messages */}
      {(statusError || rideError) && (
        <div className={`
          fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm
          ${statusError ? 'bg-red-100 text-red-800 border border-red-200' : 
            'bg-blue-100 text-blue-800 border border-blue-200'}
        `}>
          {statusError || rideError}
        </div>
      )}
    </DriverLayout>
  );
};

export default NewDriverDashboard;