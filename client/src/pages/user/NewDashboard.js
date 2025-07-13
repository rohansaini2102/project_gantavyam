import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { users } from '../../services/api';
import { initializeSocket, subscribeToUserRideUpdates, unsubscribeFromUserRideUpdates, isSocketConnected, cancelRide } from '../../services/socket';

// New Components
import UserLayout from '../../components/user/UserLayout';
import UserHeader from '../../components/user/UserHeader';
import BookingPanel from '../../components/user/BookingPanel';
import ActiveRideTracker from '../../components/user/ActiveRideTracker';
import BottomSheet from '../../components/user/BottomSheet';

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

const NewUserDashboard = () => {
  const navigate = useNavigate();
  
  // User state
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [selectedPickup, setSelectedPickup] = useState(null);
  const [dropLocation, setDropLocation] = useState('');
  const [dropCoordinates, setDropCoordinates] = useState(null);
  const [directions, setDirections] = useState(null);
  
  // Booking state
  const [vehicleType, setVehicleType] = useState('');
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

  // UI state
  const [currentView, setCurrentView] = useState('booking'); // booking, active, history
  const [showMobileBottomSheet, setShowMobileBottomSheet] = useState(false);

  console.log('[NewUserDashboard] Component mounted');

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('userToken');
    
    if (!token || !isTokenValid(token)) {
      console.error('[NewUserDashboard] Invalid or missing token');
      navigate('/user/login');
      return;
    }
    
    // Get user from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, [navigate]);

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (!token) {
      console.error('[NewUserDashboard] No token found for socket connection');
      return;
    }

    console.log('[NewUserDashboard] Initializing socket connection');
    
    const initSocket = async () => {
      try {
        const socketInstance = await initializeSocket(token);
        if (socketInstance) {
          console.log('[NewUserDashboard] ✅ Socket initialized successfully');
          setSocket(socketInstance);
          setSocketConnected(true);
        } else {
          console.error('[NewUserDashboard] ❌ Failed to initialize socket');
          setSocketConnected(false);
        }
      } catch (error) {
        console.error('[NewUserDashboard] ❌ Error initializing socket:', error);
        setSocketConnected(false);
      }
    };

    initSocket();

    // Check connection status periodically
    const connectionInterval = setInterval(() => {
      const connected = isSocketConnected();
      setSocketConnected(connected);
      
      if (!connected) {
        console.log('[NewUserDashboard] ⚠️ Socket disconnected, checking for reconnection...');
        
        // Try to reinitialize if completely disconnected
        const currentSocket = socket;
        if (!currentSocket || !currentSocket.connected) {
          console.log('[NewUserDashboard] 🔄 Attempting to reinitialize socket...');
          initSocket();
        }
      }
    }, 3000); // Check every 3 seconds

    return () => {
      clearInterval(connectionInterval);
    };
  }, []); // Empty dependency array - only run once

  // Socket event subscriptions
  useEffect(() => {
    if (!socket) return;

    console.log('[NewUserDashboard] Setting up socket event listeners');
    
    const unsubscribe = subscribeToUserRideUpdates({
      onRideAccepted: (data) => {
        console.log('[NewUserDashboard] Ride accepted:', data);
        setActiveRide(prev => prev ? { ...prev, ...data, status: 'driver_assigned' } : data);
        setBookingError('✅ Ride accepted! Driver is on the way.');
        setTimeout(() => setBookingError(''), 3000);
      },

      onDriverAssigned: (data) => {
        console.log('[NewUserDashboard] Driver assigned:', data);
        setActiveRide(prev => prev ? { ...prev, ...data } : data);
      },

      onRideStarted: (data) => {
        console.log('[NewUserDashboard] Ride started:', data);
        setActiveRide(prev => prev ? { ...prev, ...data, status: 'ride_started' } : data);
        setShowOTP({ type: 'end', otp: data.endOTP });
      },

      onRideEnded: (data) => {
        console.log('[NewUserDashboard] Ride ended:', data);
        setActiveRide(prev => prev ? { ...prev, ...data, status: 'ride_ended' } : data);
        setShowOTP(null);
      },

      onRideCompleted: (data) => {
        console.log('[NewUserDashboard] Ride completed:', data);
        setActiveRide(prev => prev ? { ...prev, ...data, status: 'completed' } : data);
        setShowOTP(null);
        setBookingError('🎉 Ride completed successfully!');
        
        // Auto-return to booking after 5 seconds
        setTimeout(() => {
          setBookingError('');
          handleReturnToBooking();
        }, 5000);
        
        // Reload ride history
        users.getRideHistory(1, 5).then(response => {
          setRideHistory(response.data?.rideHistory || []);
        });
      },

      onRideCancelled: (data) => {
        console.log('[NewUserDashboard] Ride cancelled:', data);
        setActiveRide(prev => prev ? { ...prev, ...data, status: 'cancelled' } : data);
        setShowOTP(null);
        setBookingError('❌ Ride was cancelled. You can book another ride.');
        
        // Auto-return to booking after 3 seconds
        setTimeout(() => {
          setBookingError('');
          handleReturnToBooking();
        }, 3000);
      },

      onQueueNumberAssigned: (data) => {
        console.log('[NewUserDashboard] Queue number assigned:', data);
        setActiveRide(prev => ({
          ...prev,
          queueNumber: data.queueNumber,
          queuePosition: data.queuePosition,
          queueStatus: 'queued',
          estimatedWaitTime: data.estimatedWaitTime,
          totalInQueue: data.totalInQueue,
          boothName: data.boothName
        }));
      }
    });

    return () => {
      console.log('[NewUserDashboard] Cleaning up socket subscriptions');
      if (unsubscribe) unsubscribe();
    };
  }, [socket]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      console.log('[NewUserDashboard] Loading initial data');
      
      const [locationsResponse, activeResponse, historyResponse] = await Promise.all([
        users.getPickupLocations(),
        users.getActiveRides(),
        users.getRideHistory(1, 5)
      ]);
      
      if (locationsResponse.success) {
        setPickupLocations(locationsResponse.data?.locations || []);
      }
      
      if (activeResponse.success && activeResponse.data?.ride) {
        setActiveRide(activeResponse.data.ride);
        setCurrentView('active');
      }
      
      setRideHistory(historyResponse.data?.rideHistory || []);
      
    } catch (error) {
      console.error('[NewUserDashboard] Error loading initial data:', error);
    }
  };

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('[NewUserDashboard] Geolocation error:', error);
        }
      );
    }
  }, []);

  // Calculate fare when locations change
  useEffect(() => {
    if (selectedPickup && dropCoordinates && vehicleType) {
      calculateFare();
    }
  }, [selectedPickup, dropCoordinates, vehicleType]);

  const calculateFare = async () => {
    try {
      setIsCalculatingFare(true);
      const fareData = {
        pickupStation: selectedPickup.name, // Station name for server lookup
        dropLat: dropCoordinates.lat,       // Drop location latitude
        dropLng: dropCoordinates.lng        // Drop location longitude
      };
      
      console.log('[NewUserDashboard] Calculating fare with data:', fareData);
      
      const response = await users.getFareEstimate(fareData);
      if (response.success) {
        setFareEstimates(response.data);
        setBookingError(''); // Clear any previous errors
        console.log('[NewUserDashboard] Fare estimates received:', response.data);
      } else {
        console.error('[NewUserDashboard] Fare estimation failed:', response.message);
        setBookingError('⚠️ Could not calculate fare. You can still book the ride.');
        // Set fallback estimates for booking
        setFareEstimates({
          estimates: {
            bike: 50,
            auto: 100,
            car: 150
          }
        });
      }
    } catch (error) {
      console.error('[NewUserDashboard] Error calculating fare:', error);
      setBookingError('⚠️ Could not calculate fare. You can still book the ride.');
      // Set fallback estimates for booking
      setFareEstimates({
        estimates: {
          bike: 50,
          auto: 100,
          car: 150
        }
      });
    } finally {
      setIsCalculatingFare(false);
    }
  };

  const handlePickupSelect = (location) => {
    setSelectedPickup(location);
    console.log('[NewUserDashboard] Pickup selected:', location.name);
  };

  const handleDropLocationChange = (address, coordinates = null) => {
    setDropLocation(address);
    
    if (coordinates) {
      // Use provided coordinates from Google Places API
      console.log('[NewUserDashboard] Setting drop coordinates:', coordinates);
      setDropCoordinates(coordinates);
    } else if (address) {
      // Clear coordinates if only address is provided (user typing)
      setDropCoordinates(null);
    } else {
      // Clear both if address is empty
      setDropCoordinates(null);
    }
  };

  const handleVehicleSelect = (type) => {
    setVehicleType(type);
    console.log('[NewUserDashboard] Vehicle selected:', type);
  };

  const handleBookRide = async () => {
    if (!selectedPickup || !dropLocation || !vehicleType) {
      setBookingError('Please fill all required fields');
      return;
    }

    if (!socketConnected) {
      setBookingError('❌ Connection required for booking. Please wait for reconnection.');
      return;
    }

    if (!dropCoordinates) {
      setBookingError('❌ Please wait for location to be processed or select from suggestions');
      return;
    }

    try {
      setIsBooking(true);
      setBookingError('');

      const bookingData = {
        pickupStation: selectedPickup.name,
        dropLocation: {
          address: dropLocation,
          lat: dropCoordinates.lat,
          lng: dropCoordinates.lng
        },
        vehicleType,
        estimatedFare: fareEstimates?.estimates?.[vehicleType]?.totalFare || 0
      };

      console.log('[NewUserDashboard] Booking ride:', bookingData);
      
      const response = await users.bookRide(bookingData);
      
      if (response.success) {
        setActiveRide({
          ...response.data,
          pickupLocation: selectedPickup,
          dropLocation: { address: dropLocation },
          vehicleType,
          estimatedFare: response.data.estimatedFare || fareEstimates?.estimates?.[vehicleType]?.totalFare || 0
        });
        setCurrentView('active');
        setIsBooking(false); // Reset booking state immediately
        setBookingError('✅ Ride booked successfully! Looking for drivers...');
        
        // Show start OTP if provided
        if (response.data.startOTP) {
          setShowOTP({ type: 'start', otp: response.data.startOTP });
        }
        
        // Clear booking form for next use
        setTimeout(() => {
          setBookingError('');
        }, 3000);
      } else {
        setBookingError(response.message || 'Failed to book ride');
      }
    } catch (error) {
      console.error('[NewUserDashboard] Booking error:', error);
      setBookingError('Failed to book ride. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  // Cancel ride functionality
  const canCancelRide = (status) => {
    return ['pending', 'driver_assigned'].includes(status);
  };

  const handleCancelRide = () => {
    setShowCancelModal(true);
  };

  const confirmCancelRide = async () => {
    if (!cancelReason.trim()) return;

    try {
      setIsCancelling(true);
      
      const result = await cancelRide(activeRide._id || activeRide.rideId, cancelReason);
      
      if (result.success) {
        setActiveRide(null);
        setShowOTP(null);
        setCurrentView('booking');
        setBookingError('Ride cancelled successfully');
      } else {
        setBookingError('Failed to cancel ride');
      }
    } catch (error) {
      console.error('[NewUserDashboard] Cancel error:', error);
      setBookingError('Failed to cancel ride');
    } finally {
      setIsCancelling(false);
      setShowCancelModal(false);
      setCancelReason('');
    }
  };

  const handleReturnToBooking = () => {
    console.log('[NewUserDashboard] Returning to booking view');
    setActiveRide(null);
    setShowOTP(null);
    setCurrentView('booking');
    setBookingError('');
    
    // Clear form for new booking
    setSelectedPickup(null);
    setDropLocation('');
    setDropCoordinates(null);
    setVehicleType('');
    setFareEstimates(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('user');
    if (socket) {
      unsubscribeFromUserRideUpdates();
    }
    navigate('/user/login');
  };

  // Map configuration
  const mapContainerStyle = {
    width: '100%',
    height: '100%'
  };

  const center = userLocation || { lat: 28.6139, lng: 77.2090 }; // Default to Delhi

  // Render sidebar content based on current view
  const renderSidebarContent = () => {
    console.log('[NewUserDashboard] Rendering sidebar - currentView:', currentView, 'activeRide:', !!activeRide);
    
    if (currentView === 'active' && activeRide) {
      return (
        <ActiveRideTracker
          activeRide={activeRide}
          showOTP={showOTP}
          onCancelRide={handleCancelRide}
          canCancelRide={canCancelRide}
          onReturnToBooking={handleReturnToBooking}
        />
      );
    }

    // Default to booking view
    return (
      <BookingPanel
        pickupLocations={pickupLocations}
        selectedPickup={selectedPickup}
        onPickupSelect={handlePickupSelect}
        dropLocation={dropLocation}
        onDropLocationChange={handleDropLocationChange}
        vehicleType={vehicleType}
        onVehicleSelect={handleVehicleSelect}
        fareEstimates={fareEstimates}
        onBookRide={handleBookRide}
        isBooking={isBooking}
        socketConnected={socketConnected}
      />
    );
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
      {/* User location marker */}
      {userLocation && (
        <Marker
          position={userLocation}
          icon={{
            url: "data:image/svg+xml;charset=UTF-8,%3csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='10' cy='10' r='8' fill='%234285f4'/%3e%3ccircle cx='10' cy='10' r='3' fill='white'/%3e%3c/svg%3e",
            scaledSize: new window.google.maps.Size(20, 20),
          }}
        />
      )}

      {/* Pickup location marker */}
      {selectedPickup && (
        <Marker
          position={{
            lat: selectedPickup.coordinates?.coordinates[1] || selectedPickup.latitude || 0,
            lng: selectedPickup.coordinates?.coordinates[0] || selectedPickup.longitude || 0
          }}
          icon={{
            url: "data:image/svg+xml;charset=UTF-8,%3csvg width='30' height='30' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M15 0C8.373 0 3 5.373 3 12c0 9 12 18 12 18s12-9 12-18c0-6.627-5.373-12-12-12zm0 16c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z' fill='%2300ff00'/%3e%3c/svg%3e",
            scaledSize: new window.google.maps.Size(30, 30),
          }}
        />
      )}

      {/* Drop location marker */}
      {dropCoordinates && (
        <Marker
          position={dropCoordinates}
          icon={{
            url: "data:image/svg+xml;charset=UTF-8,%3csvg width='30' height='30' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M15 0C8.373 0 3 5.373 3 12c0 9 12 18 12 18s12-9 12-18c0-6.627-5.373-12-12-12zm0 16c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z' fill='%23ff0000'/%3e%3c/svg%3e",
            scaledSize: new window.google.maps.Size(30, 30),
          }}
        />
      )}

      {/* Directions */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#4285f4',
              strokeWeight: 4,
            },
          }}
        />
      )}
    </GoogleMap>
  );

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <UserLayout
      sidebar={renderSidebarContent()}
      map={renderMap()}
    >
      {/* Error Messages */}
      {bookingError && (
        <div className={`
          fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm
          ${bookingError.includes('✅') ? 'bg-green-100 text-green-800 border border-green-200' : 
            bookingError.includes('❌') ? 'bg-red-100 text-red-800 border border-red-200' : 
            'bg-blue-100 text-blue-800 border border-blue-200'}
        `}>
          {bookingError}
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancel Ride</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for cancellation
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a reason</option>
                <option value="Driver taking too long">Driver taking too long</option>
                <option value="Change of plans">Change of plans</option>
                <option value="Found alternate transport">Found alternate transport</option>
                <option value="Emergency">Emergency</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Keep Ride
              </button>
              <button
                onClick={confirmCancelRide}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Ride'}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-3">
              Cancelling after driver acceptance may incur charges
            </p>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default NewUserDashboard;