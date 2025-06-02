import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { initializeSocket, disconnectSocket, subscribeToDriverUpdates, unsubscribeFromDriverUpdates } from '../../services/socket';
import axios from 'axios';
import { FiMenu, FiUser, FiMap, FiLogOut, FiCheckCircle, FiXCircle, FiBell, FiToggleLeft, FiToggleRight, FiMapPin, FiPhone, FiTruck, FiBarChart2, FiDollarSign, FiSettings, FiStar, FiList, FiHome } from 'react-icons/fi';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDFbjmVJoi2wDzwJNR2rrowpSEtSes1jw4';
const libraries = ['places'];

const navLinks = [
  { label: 'Dashboard', icon: <FiHome />, key: 'dashboard' },
  { label: 'Rides', icon: <FiList />, key: 'rides' },
  { label: 'Earnings', icon: <FiDollarSign />, key: 'earnings' },
  { label: 'Analytics', icon: <FiBarChart2 />, key: 'analytics' },
  { label: 'Ratings', icon: <FiStar />, key: 'ratings' },
  { label: 'Notifications', icon: <FiBell />, key: 'notifications' },
  { label: 'Settings', icon: <FiSettings />, key: 'settings' },
];

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [driver, setDriver] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [rideRequests, setRideRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [directions, setDirections] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [notificationToast, setNotificationToast] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const watchId = useRef(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [notification, setNotification] = useState(null);
  const mapRef = useRef(null);

  // Notification Toast component
  const NotificationToast = ({ type, message }) => {
    return (
      <div className={`notification-toast ${type}`}>
        <p>{message}</p>
      </div>
    );
  };

  // Auth & profile fetch
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
    } catch (error) {
      console.error('[DriverDashboard] Error parsing driver data:', error);
      navigate('/driver/login');
    }
  }, [navigate]);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('driverToken');
    if (!token || !driver) {
      console.log('[DriverDashboard] Waiting for token and driver data');
      return;
    }
    // Initialize socket only once
    if (!socket) {
      console.log('[DriverDashboard] Initializing socket connection...');
      const socketInstance = initializeSocket(token);
      if (socketInstance) {
        setSocket(socketInstance);
        // Setup event listeners (only once)
        socketInstance.on('connect', () => {
          console.log('✅ [DriverDashboard] Socket connected');
          setConnectionStatus('connected');
          // Update online status when connected
          if (isOnline) {
            socketInstance.emit('updateDriverStatus', {
              isOnline: true,
              location: userLocation
            });
          }
        });
        socketInstance.on('connectionSuccess', (data) => {
          console.log('✅ [DriverDashboard] Connection confirmed:', data);
        });
        socketInstance.on('connect_error', (error) => {
          console.error('❌ [DriverDashboard] Connection error:', error);
          setConnectionStatus('error');
        });
        socketInstance.on('disconnect', (reason) => {
          console.log('⚠️ [DriverDashboard] Disconnected:', reason);
          setConnectionStatus('disconnected');
        });
        // Listen for ride requests
        socketInstance.on('newRideRequest', (data) => {
          console.log('[DriverDashboard] New ride request:', data);
          const rideRequest = {
            _id: data._id || data.id,
            userId: data.userId,
            userName: data.userName,
            userPhone: data.userPhone,
            pickupLocation: data.pickupLocation,
            dropLocation: data.dropLocation,
            fare: data.fare,
            distance: data.distance,
            timestamp: data.timestamp || new Date().toISOString()
          };
          setRideRequests(prev => {
            const exists = prev.some(r => r._id === rideRequest._id);
            if (exists) return prev;
            return [...prev, rideRequest];
          });
          setNotificationToast({
            type: 'info',
            message: `New ride request from ${data.userName}`
          });
          setTimeout(() => setNotificationToast(null), 5000);
        });
        socketInstance.on('rideRequestClosed', ({ rideId }) => {
          console.log('[DriverDashboard] Ride request closed:', rideId);
          setRideRequests(prev => prev.filter(r => r._id !== rideId));
        });
        socketInstance.on('rideAcceptConfirmed', (data) => {
          console.log('[DriverDashboard] Ride accept confirmed:', data);
          if (data.success) {
            setNotificationToast({
              type: 'success',
              message: 'Ride accepted successfully!'
            });
            setTimeout(() => setNotificationToast(null), 3000);
          }
        });
        socketInstance.on('rideAcceptError', (error) => {
          console.error('[DriverDashboard] Ride accept error:', error);
          setNotificationToast({
            type: 'error',
            message: error.message || 'Failed to accept ride'
          });
          setTimeout(() => setNotificationToast(null), 5000);
        });
        socketInstance.on('statusUpdated', (data) => {
          console.log('[DriverDashboard] Status update confirmation:', data);
        });
        // Additional event listeners for ride cancellation and location update errors
        socketInstance.on('rideCancelled', (data) => {
          console.log('[DriverDashboard] Ride cancelled:', data);
          if (activeRide && activeRide._id === data.rideId) {
            setActiveRide(null);
            setNotificationToast({
              type: 'warning',
              message: `Ride cancelled by ${data.cancelledBy}: ${data.reason || 'No reason provided'}`
            });
            // Stop location updates
            if (watchId.current) {
              navigator.geolocation.clearWatch(watchId.current);
              watchId.current = null;
            }
          }
          setTimeout(() => setNotificationToast(null), 5000);
        });
        socketInstance.on('locationUpdateError', (error) => {
          console.error('[DriverDashboard] Location update error:', error);
          setNotificationToast({
            type: 'error',
            message: 'Failed to update location. Please check GPS.'
          });
          setTimeout(() => setNotificationToast(null), 3000);
        });
      }
    }
    // Cleanup
    return () => {
      // Don't disconnect socket on effect cleanup
    };
  }, [driver]);

  // Enhanced accept ride function with better error handling
  const acceptRide = (ride) => {
    console.log('[DriverDashboard] Accepting ride:', ride);
    if (!socket || !driver) {
      console.error('[DriverDashboard] Cannot accept ride: no socket or driver data');
      setNotificationToast({
        type: 'error',
        message: 'Connection error. Please refresh the page.'
      });
      return;
    }
    const vehicleDetails = {
      make: driver.vehicleDetails?.make || 'Unknown',
      model: driver.vehicleDetails?.model || 'Model',
      licensePlate: driver.vehicleDetails?.licensePlate || driver.vehicleNo || 'XX-0000',
      color: driver.vehicleDetails?.color || 'Unknown'
    };
    console.log('[DriverDashboard] Sending acceptance with details:', {
      rideId: ride._id,
      driverId: driver._id || driver.id,
      vehicleDetails
    });
    socket.emit('driverAcceptRide', {
      rideId: ride._id,
      driverId: driver._id || driver.id,
      driverName: driver.fullName || driver.name,
      driverPhone: driver.mobileNo || driver.phone,
      driverPhoto: driver.profileImage || null,
      driverRating: driver.rating || 4.5,
      vehicleDetails,
      currentLocation: userLocation,
      timestamp: new Date().toISOString()
    });
    setActiveRide(ride);
    setRideRequests([]);
    startLocationUpdates(ride._id);
    console.log('[DriverDashboard] Ride acceptance sent, waiting for confirmation...');
  };

  // Add ride cancellation function
  const cancelRide = () => {
    if (!activeRide || !socket) return;
    console.log('[DriverDashboard] Cancelling ride:', activeRide._id);
    socket.emit('cancelRide', {
      rideId: activeRide._id,
      reason: 'Driver cancelled'
    });
    setActiveRide(null);
    setNotificationToast({
      type: 'info',
      message: 'Ride cancelled'
    });
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  // Enhanced location updates with error handling
  const startLocationUpdates = (rideId) => {
    console.log('[DriverDashboard] Starting location updates for ride:', rideId);
    if (!navigator.geolocation) {
      console.error('[DriverDashboard] Geolocation not available');
      setNotificationToast({
        type: 'error',
        message: 'GPS not available on this device'
      });
      return;
    }
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    let lastLocationTime = Date.now();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastLocationTime < 5000) return;
        lastLocationTime = now;
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        console.log(`[DriverDashboard] Sending location update: ${location.lat}, ${location.lng}`);
        setUserLocation(location);
        if (socket && socket.connected) {
          socket.emit('updateDriverLocation', {
            location,
            rideId,
            timestamp: new Date().toISOString(),
            bearing: pos.coords.heading || 0,
            speed: pos.coords.speed || 0,
            accuracy: pos.coords.accuracy
          });
        } else {
          console.error('[DriverDashboard] Socket not connected for location update');
          setNotificationToast({
            type: 'warning',
            message: 'Connection lost. Trying to reconnect...'
          });
        }
      },
      (err) => {
        console.error('[DriverDashboard] Geolocation error:', err);
        setNotificationToast({
          type: 'error',
          message: `Location error: ${err.message}`
        });
        // Don't clear the watch, keep trying
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  };

  // Geolocation: always track driver location
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    console.log('[DriverDashboard] Setting up geolocation tracking');
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setUserLocation(location);
        
        if (activeRide && socket) {
          socket.emit('updateDriverLocation', {
            location,
            rideId: activeRide._id
          });
        }
      },
      (err) => console.error('[DriverDashboard] Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    
    return () => {
      if (watchId.current) {
        console.log('[DriverDashboard] Clearing geolocation watch');
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [activeRide, socket]);

  // Directions to pickup
  useEffect(() => {
    if (!activeRide || !userLocation || !window.google) {
      setDirections(null);
      return;
    }
    
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: userLocation,
        destination: {
          lat: activeRide.pickupLocation.latitude,
          lng: activeRide.pickupLocation.longitude
        },
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === 'OK') {
          setDirections(result);
        }
      }
    );
  }, [activeRide, userLocation]);

  // Calculate distance to pickup
  const getDistanceToPickup = (pickup) => {
    if (!userLocation) return null;
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(pickup.latitude - userLocation.lat);
    const dLon = toRad(pickup.longitude - userLocation.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(userLocation.lat)) *
        Math.cos(toRad(pickup.latitude)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  // Status toggle with socket update
  const handleStatusToggle = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    console.log('[DriverDashboard] Toggling online status to:', newStatus);
    
    if (socket) {
      socket.emit('updateDriverStatus', {
        isOnline: newStatus,
        location: userLocation
      });
    }
  };

  // Logout
  const handleLogout = () => {
    console.log('[DriverDashboard] Logging out...');
    
    // Update status to offline before logout
    if (socket) {
      socket.emit('updateDriverStatus', {
        isOnline: false,
        location: userLocation
      });
    }
    
    // Clear local storage
    localStorage.removeItem('driver');
    localStorage.removeItem('driverToken');
    
    // Disconnect socket
    disconnectSocket();
    
    // Navigate to login
    navigate('/driver/login');
  };

  // Profile
  const goToProfile = () => {
    setShowProfile(true);
  };
  
  const closeProfile = () => {
    setShowProfile(false);
  };

  // Add declineRide function
  const declineRide = (rideId) => {
    console.log('[DriverDashboard] Declining ride:', rideId);
    setRideRequests((prev) => prev.filter(r => r._id !== rideId));
  };

  // Responsive: show sidebar on desktop, bottom sheet on mobile
  const isMobile = window.innerWidth < 768;

  // If loading
  if (!driver) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="loader"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300 ${isMobile ? (showSidebar ? 'translate-x-0' : '-translate-x-full') : ''} w-16 md:w-20 bg-black shadow-lg`}>
        {/* Logo */}
        <div className="flex items-center justify-center py-4 border-b border-gray-800">
          <div className="w-10 h-10 bg-sky-400 rounded-full flex items-center justify-center font-bold text-black text-2xl">G</div>
        </div>
        {/* Nav Icons */}
        <nav className="flex-1 flex flex-col items-center gap-6 py-8">
          {navLinks.map(link => (
            <button key={link.key} className="flex flex-col items-center text-sky-400 hover:text-sky-300 transition" title={link.label}>
              <span className="text-2xl">{link.icon}</span>
            </button>
          ))}
          <button className="flex flex-col items-center text-red-400 hover:text-red-200 transition mt-4" onClick={handleLogout} title="Logout">
            <FiLogOut className="text-2xl" />
          </button>
        </nav>
      </aside>
      {/* Hamburger for mobile */}
      {isMobile && !showSidebar && (
        <button onClick={() => setShowSidebar(true)} className="fixed top-4 left-4 z-40 text-3xl text-sky-400 bg-black rounded-full shadow p-2 border border-sky-400"><FiMenu /></button>
      )}
      {/* Overlay for mobile sidebar */}
      {isMobile && showSidebar && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-20" onClick={() => setShowSidebar(false)}></div>
      )}
      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-h-screen ${isMobile ? '' : 'md:ml-20'} transition-all duration-300`}> 
        {/* Header */}
        <header className="w-full flex items-center justify-between px-4 md:px-8 py-4 bg-black shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-400 rounded-full flex items-center justify-center font-bold text-black text-2xl md:hidden">G</div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              className={`flex items-center gap-2 px-4 py-1 rounded-full font-semibold text-sm ${isOnline ? 'bg-sky-400 text-black' : 'bg-gray-800 text-gray-300 border border-sky-400'}`}
              onClick={handleStatusToggle}
            >
              {isOnline ? <FiToggleRight className="text-xl" /> : <FiToggleLeft className="text-xl" />}
              {isOnline ? 'Online' : 'Offline'}
            </button>
            <button className="relative text-2xl text-sky-400">
              <FiBell />
              {notification && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
            <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-xl text-sky-500 border-2 border-sky-400">
              <FiUser />
            </button>
          </div>
        </header>
        {/* Main Map Area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full p-2 md:p-8">
          <div className="w-full max-w-5xl h-[60vh] rounded-2xl overflow-hidden shadow-lg bg-white">
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={userLocation || { lat: 26.9124, lng: 75.7873 }}
              zoom={13}
              onLoad={map => (mapRef.current = map)}
            >
              {userLocation && <Marker position={userLocation} label="You" />}
              {activeRide && (
                <Marker position={activeRide.pickupLocation} label="Pickup" />
              )}
              {directions && <DirectionsRenderer directions={directions} />}
            </GoogleMap>
          </div>
          {/* Floating Card for Ride Requests/Active Ride (only if present) */}
          {rideRequests.length > 0 && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4 z-10">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FiTruck className="text-sky-400" /> Ride Request</h2>
              <div className="flex flex-col gap-4">
                {rideRequests.map((ride) => (
                  <div key={ride._id} className="bg-gray-50 rounded-lg p-4 flex flex-col gap-2 shadow">
                    <div className="flex items-center gap-2 text-lg font-semibold text-sky-600"><FiMapPin /> {ride.pickupLocation?.boothName || 'Pickup'}</div>
                    <div className="text-gray-700">Drop: {ride.dropLocation?.address}</div>
                    <div className="flex items-center gap-4 mt-2">
                      <button className="flex-1 bg-sky-400 text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-black hover:text-white transition"><FiCheckCircle /> Accept</button>
                      <button className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-100 transition"><FiXCircle /> Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Floating Card for Active Ride (only if present) */}
          {activeRide && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4 z-10">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FiTruck className="text-sky-400" /> Active Ride</h2>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-lg font-semibold text-sky-600"><FiMapPin /> {activeRide.pickupLocation?.boothName || 'Pickup'}</div>
                <div className="text-gray-700">Drop: {activeRide.dropLocation?.address}</div>
                <div className="text-gray-700">Rider: {activeRide.userName} <span className="ml-2 text-gray-400">({activeRide.userPhone})</span></div>
                <div className="flex items-center gap-4 mt-2">
                  <button className="flex-1 bg-sky-400 text-black font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-black hover:text-white transition"><FiPhone /> Call</button>
                  <button className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-100 transition"><FiXCircle /> Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Stats as bottom sheet/modal on mobile (hidden by default, can be toggled with a button if needed) */}
        {/* Profile Modal */}
        {showProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-sm flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center text-4xl text-sky-500 mb-2"><FiUser /></div>
              <div className="font-bold text-xl mb-1">{driver?.fullName || driver?.name || 'Driver'}</div>
              <div className="text-gray-500 mb-2">{driver?.mobileNo || driver?.phone}</div>
              <button onClick={() => setShowProfile(false)} className="mt-4 px-6 py-2 bg-sky-400 text-black rounded-lg font-semibold hover:bg-black hover:text-white transition">Close</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DriverDashboard;