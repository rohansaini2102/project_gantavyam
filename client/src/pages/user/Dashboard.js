import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Autocomplete } from '@react-google-maps/api';
import axios from 'axios';
import moment from 'moment';
import { debounce } from 'lodash';
import { initializeSocket, disconnectSocket, subscribeToDriverUpdates, unsubscribeFromDriverUpdates } from '../../services/socket';
import { API_URL } from '../../config';

// API key for Google Maps
const GOOGLE_MAPS_API_KEY = "AIzaSyDFbjmVJoi2wDzwJNR2rrowpSEtSes1jw4";

// Libraries to load for Google Maps
const libraries = ["places", "geometry"];

// Booth locations (pickup points)
const BOOTH_LOCATIONS = [
  { id: 1, name: "Booth 1", latitude: 26.92393656, longitude: 75.82674328 },
  { id: 2, name: "Booth 2", latitude: 26.82582392, longitude: 75.80242345 },
  { id: 3, name: "Booth 3", latitude: 26.86193047, longitude: 75.81190017 }
];

const UserDashboard = () => {
  // Navigation hook
  const navigate = useNavigate();
  
  // User and authentication state
  const [user, setUser] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  
  // Location related state
  const [userLocation, setUserLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isLocationAvailable, setIsLocationAvailable] = useState(true);
  const [locationErrorCount, setLocationErrorCount] = useState(0);
  
  // Booking flow state
  const [isBookingFlow, setIsBookingFlow] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [dropLocation, setDropLocation] = useState('');
  const [dropCoordinates, setDropCoordinates] = useState(null);
  const [distance, setDistance] = useState(null);
  const [fare, setFare] = useState(null);
  const [showFare, setShowFare] = useState(false);
  
  // Ride request state
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [rideRequestStatus, setRideRequestStatus] = useState(null);
  const [rideId, setRideId] = useState(null);
  
  // Driver and ride tracking state
  const [driverInfo, setDriverInfo] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverBearing, setDriverBearing] = useState(null);
  const [previousDriverLocation, setPreviousDriverLocation] = useState(null);
  const [isDriverMoving, setIsDriverMoving] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState(null);
  const [distanceToPickup, setDistanceToPickup] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [directions, setDirections] = useState(null);
  const [remainingRoute, setRemainingRoute] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Map and UI state
  const [mapRef, setMapRef] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [autocomplete, setAutocomplete] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState('home');
  const [isTrafficEnabled, setIsTrafficEnabled] = useState(true);
  const [trafficData, setTrafficData] = useState(null);
  
  // Communication state
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [showContactDriver, setShowContactDriver] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Ride history
  const [rideHistory, setRideHistory] = useState([]);
  const [isLoadingRides, setIsLoadingRides] = useState(false);
  
  // Notification state
  const [notificationToast, setNotificationToast] = useState(null);

  // Check if user is logged in and initialize socket
  useEffect(() => {
    let socket;
    const token = localStorage.getItem('userToken');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      navigate('/user/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Initialize socket connection with user token
      console.log('[UserDashboard] Initializing socket...');
      socket = initializeSocket(token);
      
      if (socket) {
        console.log('[UserDashboard] Socket initialized successfully');
        
        // Add connection status listeners
        socket.on('connect', () => {
          console.log('✅ [UserDashboard] Socket connected');
          setSocketConnected(true);
          setSocketError(null);
        });
        
        socket.on('disconnect', () => {
          console.log('⚠️ [UserDashboard] Socket disconnected');
          setSocketConnected(false);
          setSocketError('Connection lost. Reconnecting...');
        });
        
        socket.on('connect_error', (error) => {
          console.error('❌ [UserDashboard] Socket connection error:', error);
          setSocketConnected(false);
          setSocketError('Connection failed. Retrying...');
        });
        
        socket.on('connectionSuccess', (data) => {
          console.log('✅ [UserDashboard] Server confirmed connection:', data);
        });
      }
    } catch (error) {
      console.error('[UserDashboard] Error parsing user data:', error);
      navigate('/user/login');
    }

    // Cleanup on unmount
    return () => {
      console.log('[UserDashboard] Cleaning up...');
      unsubscribeFromDriverUpdates(socket);
      disconnectSocket(socket);
    };
  }, [navigate]);

  // Setup socket listeners for ride events
  useEffect(() => {
    const socket = initializeSocket(localStorage.getItem('userToken'));
    if (!socket) return;

    // Listen for ride acceptance
    socket.on('rideAccepted', (data) => {
      console.log('[UserDashboard] Ride accepted:', data);
      setDriverInfo({
        id: data.driverId,
        name: data.driverName,
        phone: data.driverPhone,
        photo: data.driverPhoto,
        rating: data.driverRating
      });
      setVehicleInfo({
        make: data.vehicleMake,
        model: data.vehicleModel,
        licensePlate: data.licensePlate
      });
      setRideId(data.rideId);
      setIsTracking(true);
      setRideRequestStatus('driver_found');
      
      // Show notification
      setNotificationToast({
        type: 'success',
        message: `Your ride has been accepted by ${data.driverName}`
      });
      
      setTimeout(() => setNotificationToast(null), 5000);
    });

    // Listen for ride request confirmation
    socket.on('rideRequestConfirmed', (data) => {
      console.log('[UserDashboard] Ride request confirmed:', data);
      if (data.success) {
        setRideRequestStatus('sent');
        setRideId(data.rideId);
      } else {
        setRideRequestStatus('error');
        setNotificationToast({
          type: 'error',
          message: data.error || 'Failed to send ride request'
        });
      }
    });

    return () => {
      socket.off('rideAccepted');
      socket.off('rideRequestConfirmed');
    };
  }, []);

  // Get user's current location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        
        try {
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
          );
          if (response.data.results[0]) {
            setAddress(response.data.results[0].formatted_address);
          }
        } catch (error) {
          console.error('Error getting address:', error);
        }
      },
      (error) => {
        console.error('Location access denied or failed', error);
        setLocationError('Location access denied or unavailable.');
      }
    );
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Setup real-time driver updates
  useEffect(() => {
    const socket = initializeSocket(localStorage.getItem('userToken'));
    if (!socket) return;

    socket.on('driverLocationUpdated', (data) => {
      if (data.rideId === rideId) {
        setDriverLocation(data.location);
        setLastUpdateTime(Date.now());
      }
    });

    return () => {
      socket.off('driverLocationUpdated');
    };
  }, [rideId]);

  // Google Maps handlers
  const onLoadScript = () => {
    setIsLoaded(true);
  };

  const onMapLoad = (map) => {
    setMapRef(map);
  };

  const onLoadAutocomplete = (autoComplete) => {
    setAutocomplete(autoComplete);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        setDropLocation(place.formatted_address);
        setDropCoordinates({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        });
      }
    }
  };

  // UI Handlers
  const handleBookRide = () => {
    setIsBookingFlow(true);
  };

  const handleBoothSelect = (booth) => {
    setSelectedBooth(booth);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('user');
    unsubscribeFromDriverUpdates(initializeSocket(localStorage.getItem('userToken')));
    navigate('/user/login');
  };

  const handleProfilePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload an image file (JPEG, PNG, or GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('profileImage', file);

      const token = localStorage.getItem('userToken');
      const response = await axios.post(
        `${API_URL}/users/profile-image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        const updatedUser = { 
          ...user, 
          profileImage: response.data.profileImage 
        };
        setUser(updatedUser);
        setImageUrl(response.data.imageUrl);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      alert('Failed to upload profile image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Calculate fare
  const calculateFare = async () => {
    if (!selectedBooth || !dropCoordinates || !window.google) {
      alert('Please select both pickup and drop locations');
      return;
    }

    try {
      const service = new window.google.maps.DistanceMatrixService();
      
      const request = {
        origins: [{ lat: selectedBooth.latitude, lng: selectedBooth.longitude }],
        destinations: [{ lat: dropCoordinates.lat, lng: dropCoordinates.lng }],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC
      };

      const response = await new Promise((resolve, reject) => {
        service.getDistanceMatrix(request, (response, status) => {
          if (status === 'OK') {
            resolve(response);
          } else {
            reject(new Error('Failed to calculate distance'));
          }
        });
      });

      if (response.rows[0].elements[0].status === 'OK') {
        const distanceInMeters = response.rows[0].elements[0].distance.value;
        const distanceInKm = distanceInMeters / 1000;
        setDistance(distanceInKm);
        
        const calculatedFare = Math.max(50, Math.ceil(distanceInKm * 10));
        setFare(calculatedFare);
        setShowFare(true);
      } else {
        throw new Error('Could not calculate distance for the given locations');
      }
    } catch (error) {
      console.error('Error calculating fare:', error);
      alert('Failed to calculate fare. Please try again.');
    }
  };

  // Handle ride request submission
  const handleProceed = async () => {
    console.log('[UserDashboard] Starting ride request...');
    
    if (!selectedBooth || !dropCoordinates || !fare) {
      console.error('[UserDashboard] Missing required data');
      return;
    }
    
    const token = localStorage.getItem('userToken');
    if (!token) {
      setNotificationToast({
        type: 'error',
        message: 'Authentication error. Please login again.'
      });
      return;
    }
    
    setIsRequestingRide(true);
    setRideRequestStatus('sending');

    // Get or initialize socket
    let socket = initializeSocket(token);
    if (!socket || !socket.connected) {
      console.log('[UserDashboard] Socket not connected, reinitializing...');
      socket = initializeSocket(token);
      
      if (!socket) {
        setRideRequestStatus('error');
        setNotificationToast({
          type: 'error',
          message: 'Connection error. Please refresh the page.'
        });
        setIsRequestingRide(false);
        return;
      }
    }

    // Prepare ride request data
    const rideRequestData = {
      userName: user.name,
      userPhone: user.phone,
      pickupLocation: {
        latitude: selectedBooth.latitude,
        longitude: selectedBooth.longitude,
        boothName: selectedBooth.name
      },
      dropLocation: {
        latitude: dropCoordinates.lat,
        longitude: dropCoordinates.lng,
        address: dropLocation
      },
      distance: distance,
      fare: fare,
      timestamp: new Date().toISOString()
    };
    
    console.log('[UserDashboard] Sending ride request:', rideRequestData);
    
    // Send ride request
    socket.sendRideRequest(rideRequestData, (response) => {
      console.log('[UserDashboard] Ride request response:', response);
      
      if (response && response.success) {
        setRideRequestStatus('sent');
        setRideId(response.rideId);
      } else {
        setRideRequestStatus('error');
        setNotificationToast({
          type: 'error',
          message: response?.error || 'Failed to send ride request'
        });
      }
      
      setIsRequestingRide(false);
    });
  };

  // Fetch ride history
  const fetchRideHistory = async () => {
    try {
      setIsLoadingRides(true);
      const token = localStorage.getItem('userToken');
      const response = await axios.get(`${API_URL}/ride-history/user-rides`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setRideHistory(response.data.rides);
      }
    } catch (error) {
      console.error('Error fetching ride history:', error);
    } finally {
      setIsLoadingRides(false);
    }
  };

  // Fetch ride history when tab changes
  useEffect(() => {
    if (activeTab === 'rides') {
      fetchRideHistory();
    }
  }, [activeTab]);

  // Handle chat messages
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !rideId) return;

    const message = {
      rideId,
      senderId: user._id,
      senderName: user.name,
      content: newMessage.trim(),
      timestamp: new Date()
    };

    try {
      const socket = initializeSocket(localStorage.getItem('userToken'));
      if (socket) {
        socket.emit('sendMessage', message);
        setMessages(prev => [...prev, message]);
        setNewMessage('');
      } else {
        throw new Error('No socket connection');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNotificationToast({
        type: 'error',
        message: 'Failed to send message'
      });
    }
  };

  // Cancel ride
  const handleCancelRide = async () => {
    if (!rideId) return;
    
    try {
      setIsCancelling(true);
      const token = localStorage.getItem('userToken');
      const response = await axios.post(
        `${API_URL}/rides/cancel`,
        { rideId },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setNotificationToast({
          type: 'success',
          message: 'Ride cancelled successfully'
        });
        setIsTracking(false);
        setRideRequestStatus(null);
        setRideId(null);
      }
    } catch (error) {
      setNotificationToast({
        type: 'error',
        message: 'Failed to cancel ride. Please try again.'
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Contact driver
  const handleContactDriver = () => {
    if (!driverInfo?.phone) return;
    window.location.href = `tel:${driverInfo.phone}`;
  };

  // Loading state
  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="loader"></div>
      <p>Loading your dashboard...</p>
    </div>
  );

  // Notification Toast component
  const NotificationToast = ({ type, message }) => {
    return (
      <div className={`notification-toast ${type}`}>
        <i className={`fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
        <p>{message}</p>
      </div>
    );
  };

  // Chat Interface component
  const ChatInterface = () => {
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
      scrollToBottom();
    }, [messages]);

    return (
      <div className="chat-interface">
        <div className="chat-header">
          <h3>Chat with {driverInfo?.name}</h3>
          <button 
            className="close-chat-btn"
            onClick={() => setShowChat(false)}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="chat-messages">
          {isChatLoading ? (
            <div className="chat-loading">
              <div className="loading-spinner"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.senderId === user._id ? 'sent' : 'received'}`}
              >
                <div className="message-content">
                  <p>{message.content}</p>
                  <span className="message-time">
                    {moment(message.timestamp).format('hh:mm A')}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <form className="chat-input" onSubmit={sendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={!socketConnected}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || !socketConnected}
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </form>
      </div>
    );
  };

  // Render main content based on active tab
  const renderMainContent = () => {
    if (activeTab === 'home') {
      return (
        <div className="content-wrapper">
          <div className="map-container">
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '400px' }}
              center={userLocation || { lat: 26.9124, lng: 75.7873 }}
              zoom={12}
              onLoad={onMapLoad}
            >
              {userLocation && (
                <Marker
                  position={userLocation}
                  icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                  }}
                />
              )}
              {selectedBooth && (
                <Marker
                  position={{ lat: selectedBooth.latitude, lng: selectedBooth.longitude }}
                  icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
                  }}
                />
              )}
              {dropCoordinates && (
                <Marker
                  position={dropCoordinates}
                  icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                  }}
                />
              )}
            </GoogleMap>
          </div>

          <div className="location-info">
            <h3>Your Current Location</h3>
            <p>{address || 'Loading address...'}</p>
            {userLocation && (
              <p>
                Latitude: {userLocation.lat.toFixed(6)}<br />
                Longitude: {userLocation.lng.toFixed(6)}
              </p>
            )}
          </div>

          {!isBookingFlow ? (
            <button className="book-ride-btn" onClick={handleBookRide}>
              BOOK RIDE
            </button>
          ) : (
            <div className="booking-flow">
              <h3>Select Pickup Location</h3>
              <div className="improved-booth-options">
                {BOOTH_LOCATIONS.map(booth => (
                  <div
                    key={booth.id}
                    className={`improved-booth-option ${selectedBooth?.id === booth.id ? 'selected' : ''}`}
                    onClick={() => handleBoothSelect(booth)}
                  >
                    <div className="booth-header">
                      <span className="booth-name">{booth.name}</span>
                      {selectedBooth?.id === booth.id && 
                        <span className="booth-selected-badge">Selected</span>
                      }
                    </div>
                    <div className="booth-coords">
                      <span>Lat: {booth.latitude.toFixed(5)}</span>
                      <span>Lng: {booth.longitude.toFixed(5)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {selectedBooth && (
                <button className="confirm-pickup-btn" onClick={() => setIsBookingFlow('confirmed')}>
                  Confirm Pickup Location
                </button>
              )}
              
              {selectedBooth && isBookingFlow === 'confirmed' && (
                <div className="drop-location">
                  <h3>Enter Drop Location</h3>
                  {isLoaded && (
                    <Autocomplete
                      onLoad={onLoadAutocomplete}
                      onPlaceChanged={onPlaceChanged}
                    >
                      <input
                        type="text"
                        placeholder="Enter drop location address"
                        value={dropLocation}
                        onChange={(e) => setDropLocation(e.target.value)}
                        className="drop-input"
                      />
                    </Autocomplete>
                  )}
                  {dropCoordinates && (
                    <button className="calculate-fare-btn" onClick={calculateFare}>
                      Calculate Fare
                    </button>
                  )}
                </div>
              )}

              {showFare && fare && (
                <div className="fare-display">
                  <h3>Ride Summary</h3>
                  <div className="fare-details">
                    <p>Distance: {distance?.toFixed(2)} km</p>
                    <p className="fare-amount">Fare: ₹{fare}</p>
                  </div>
                  {!isRequestingRide ? (
                    <button className="proceed-btn" onClick={handleProceed}>
                      Proceed
                    </button>
                  ) : (
                    <div className="request-status">
                      {rideRequestStatus === 'sending' && (
                        <div className="searching-loader">
                          <div className="car-animation">
                            <i className="fas fa-car"></i>
                          </div>
                          <p>Sending ride request to drivers...</p>
                        </div>
                      )}
                      {rideRequestStatus === 'sent' && (
                        <div className="searching-loader">
                          <div className="car-animation">
                            <i className="fas fa-car"></i>
                          </div>
                          <p>Looking for nearby drivers...</p>
                          <div className="pulse-animation"></div>
                        </div>
                      )}
                      {rideRequestStatus === 'error' && (
                        <div className="error-message">
                          <i className="fas fa-exclamation-circle"></i>
                          <p>Failed to send ride request. Please try again.</p>
                          <button className="retry-btn" onClick={handleProceed}>
                            Try Again
                          </button>
                        </div>
                      )}
                      {rideRequestStatus === 'driver_found' && (
                        <div className="driver-found-message">
                          <i className="fas fa-check-circle"></i>
                          <p>Driver found! Your ride is on the way.</p>
                        </div>
                      )}
                      {rideRequestStatus === 'no_driver' && (
                        <div className="error-message">
                          <i className="fas fa-times-circle"></i>
                          <p>No drivers available right now.</p>
                          <button className="retry-btn" onClick={handleProceed}>
                            Try Again
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    } else if (activeTab === 'profile') {
      return (
        <div className="profile-content">
          <h2>My Profile</h2>
          <div className="profile-info">
            <div className="info-card">
              <label>Name</label>
              <p>{user.name}</p>
            </div>
            <div className="info-card">
              <label>Email</label>
              <p>{user.email}</p>
            </div>
            <div className="info-card">
              <label>Phone</label>
              <p>{user.phone}</p>
            </div>
          </div>
        </div>
      );
    } else if (activeTab === 'rides') {
      return (
        <div className="rides-content">
          <h2>My Rides</h2>
          {isLoadingRides ? (
            <div className="loading-spinner"></div>
          ) : rideHistory.length === 0 ? (
            <p>No ride history available yet.</p>
          ) : (
            <div className="ride-history-list">
              {rideHistory.map((ride) => (
                <div key={ride._id} className="ride-history-item">
                  <div className="ride-header">
                    <span className="ride-date">
                      {moment(ride.timestamp).format('MMM DD, YYYY - hh:mm A')}
                    </span>
                    <span className={`ride-status ${ride.status.toLowerCase()}`}>
                      {ride.status}
                    </span>
                  </div>
                  <div className="ride-details">
                    <div className="location-details">
                      <div className="pickup">
                        <strong>Pickup:</strong> {ride.pickupLocation.boothName}
                      </div>
                      <div className="drop">
                        <strong>Drop:</strong> {ride.dropLocation.address}
                      </div>
                    </div>
                    <div className="ride-info">
                      <div className="info-item">
                        <strong>Distance:</strong> {ride.distance.toFixed(2)} km
                      </div>
                      <div className="info-item">
                        <strong>Fare:</strong> ₹{ride.fare}
                      </div>
                    </div>
                    <div className="driver-info">
                      <div className="info-item">
                        <strong>Driver:</strong> {ride.driverName}
                      </div>
                      <div className="info-item">
                        <strong>Phone:</strong> {ride.driverPhone}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else if (activeTab === 'settings') {
      return (
        <div className="profile-content">
          <h2>Settings</h2>
          <div className="settings-options">
            <div className="setting-item">
              <div>
                <h3>Notifications</h3>
                <p>Receive notifications about your rides</p>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="setting-item">
              <div>
                <h3>Dark Mode</h3>
                <p>Switch to dark theme</p>
              </div>
              <label className="switch">
                <input type="checkbox" />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      );
    } else if (isTracking && driverLocation) {
      return (
        <div className="live-tracking-content">
          {socketError && (
            <div className="connection-error">
              <i className="fas fa-exclamation-circle"></i>
              <p>{socketError}</p>
            </div>
          )}
          <div className="tracking-header">
            <h2>Your ride is on the way!</h2>
            <div className="driver-info-card">
              <div className="driver-avatar">
                {driverInfo?.photo ? (
                  <img src={driverInfo.photo} alt={driverInfo.name} />
                ) : (
                  <i className="fas fa-user"></i>
                )}
              </div>
              <div className="driver-details">
                <h3>{driverInfo?.name}</h3>
                <div className="driver-rating">
                  {[...Array(5)].map((_, i) => (
                    <i 
                      key={i} 
                      className={`fas fa-star ${i < (driverInfo?.rating || 0) ? 'filled' : ''}`}
                    ></i>
                  ))}
                </div>
                <div className="vehicle-info">
                  <p>{vehicleInfo?.make} {vehicleInfo?.model}</p>
                  <p className="license-plate">{vehicleInfo?.licensePlate}</p>
                </div>
                <p className="driver-phone">{driverInfo?.phone}</p>
                <div className="driver-status">
                  <div className={`status-indicator ${isDriverMoving ? 'moving' : 'stopped'}`}></div>
                  <span>{isDriverMoving ? 'Driver is moving' : 'Driver is stopped'}</span>
                </div>
              </div>
            </div>
            
            {distanceToPickup && (
              <div className="arrival-info">
                <i className="fas fa-map-marker-alt"></i>
                <p>Driver is {distanceToPickup} km away</p>
                {estimatedArrivalTime && (
                  <p>Arriving in approximately {estimatedArrivalTime} minutes</p>
                )}
                {lastUpdateTime && (
                  <p className="last-update">
                    Last updated: {moment(lastUpdateTime).fromNow()}
                  </p>
                )}
              </div>
            )}
            
            <div className="driver-actions">
              <button 
                className="chat-btn"
                onClick={() => setShowChat(true)}
              >
                <i className="fas fa-comments"></i>
                Chat
                {unreadMessages > 0 && (
                  <span className="unread-badge">{unreadMessages}</span>
                )}
              </button>
              <button 
                className="contact-driver-btn"
                onClick={() => setShowContactDriver(true)}
              >
                <i className="fas fa-phone"></i>
                Contact Driver
              </button>
              <button 
                className="cancel-ride-btn"
                onClick={handleCancelRide}
                disabled={isCancelling}
              >
                <i className="fas fa-times"></i>
                Cancel Ride
              </button>
            </div>
          </div>
          
          <div className="map-container">
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '400px' }}
              center={driverLocation}
              zoom={13}
              onLoad={onMapLoad}
              options={{
                trafficLayer: isTrafficEnabled
              }}
            >
              {isLocationAvailable ? (
                <>
                  <Marker 
                    position={driverLocation} 
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                      scaledSize: new window.google.maps.Size(40, 40),
                      rotation: driverBearing || 0
                    }}
                  />
                  <Marker 
                    position={{ lat: selectedBooth.latitude, lng: selectedBooth.longitude }}
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                      scaledSize: new window.google.maps.Size(40, 40)
                    }}
                  />
                  {directions && (
                    <DirectionsRenderer directions={directions} />
                  )}
                </>
              ) : (
                <div className="map-error-overlay">
                  <i className="fas fa-exclamation-triangle"></i>
                  <p>Driver location unavailable</p>
                  <button onClick={() => window.location.reload()}>
                    Refresh
                  </button>
                </div>
              )}
            </GoogleMap>
          </div>
          
          {showContactDriver && (
            <div className="contact-driver-modal">
              <div className="modal-content">
                <h3>Contact Driver</h3>
                <p>Would you like to call the driver?</p>
                <div className="modal-actions">
                  <button onClick={handleContactDriver}>
                    <i className="fas fa-phone"></i>
                    Call Now
                  </button>
                  <button onClick={() => setShowContactDriver(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {showChat && <ChatInterface />}
        </div>
      );
    }

    return null;
  };

  // Main component return
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Notification Toast */}
      {notificationToast && <NotificationToast {...notificationToast} />}
      
      {/* Hamburger Button */}
      <button 
        className={`hamburger-btn ${isSidebarOpen ? 'active' : ''}`}
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <div className="hamburger-line"></div>
        <div className="hamburger-line"></div>
        <div className="hamburger-line"></div>
      </button>

      {/* Sidebar */}
      <div className={`sidebar ${!isSidebarOpen ? 'closed' : ''}`}>
        <div className="profile-section">
          <h3 className="text-lg font-bold text-blue-700 mb-2">{user.name}</h3>
        </div>
        <nav className="dashboard-nav">
          <button 
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('home');
              if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
              }
            }}
          >
            Home
          </button>
          <button 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('profile');
              if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
              }
            }}
          >
            Profile
          </button>
          <button 
            className={`nav-item ${activeTab === 'rides' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('rides');
              if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
              }
            }}
          >
            My Rides
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('settings');
              if (window.innerWidth <= 768) {
                setIsSidebarOpen(false);
              }
            }}
          >
            Settings
          </button>
          <button 
            className="nav-item logout"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className={`main-content ${!isSidebarOpen ? 'expanded' : ''}`}>
        {isUploading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}
        {renderMainContent()}
      </div>
    </div>
  );
};

export default UserDashboard;