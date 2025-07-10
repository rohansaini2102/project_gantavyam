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
  const [selectedMetroBooth, setSelectedMetroBooth] = useState('');
  const [vehicleType, setVehicleType] = useState('auto');
  const [driverLocation, setDriverLocation] = useState(null);
  
  // Metro stations
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
      const socketInstance = initializeSocket(token);
      setSocket(socketInstance);
      
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

  // Load metro stations for booth selection
  useEffect(() => {
    const loadMetroStations = async () => {
      try {
        console.log('[DriverDashboard] Loading metro stations...');
        const response = await drivers.getMetroStations();
        console.log('[DriverDashboard] Metro stations loaded:', response.data);
        setMetroStations(response.data.stations || []);
      } catch (error) {
        console.error('[DriverDashboard] Error loading metro stations:', error);
        setStatusError('Failed to load metro stations');
      }
    };

    if (driver) {
      loadMetroStations();
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
              rideId: activeRide.rideId,
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
          console.log('[DriverDashboard] New ride request:', data);
          setRideRequests(prev => {
            // Check if request already exists
            if (prev.find(r => r._id === data._id)) {
              return prev;
            }
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
          setActiveRide(null);
          setShowOTPInput(null);
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

      return () => {
        unsubscribeFromDriverUpdates();
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
      // Going online - need metro booth and vehicle type
      if (!selectedMetroBooth || !vehicleType) {
        setStatusError('Please select metro booth and vehicle type');
        return;
      }
      
      setStatusError('');
      console.log('[DriverDashboard] Going online...');
      
      driverGoOnline({
        metroBooth: selectedMetroBooth,
        vehicleType: vehicleType,
        location: driverLocation
      });
    } else {
      // Going offline
      console.log('[DriverDashboard] Going offline...');
      driverGoOffline();
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
      rideId: activeRide.rideId || activeRide._id,
      otp: otpInput.trim()
    };

    if (showOTPInput.type === 'start') {
      verifyStartOTP(otpData);
    } else if (showOTPInput.type === 'end') {
      verifyEndOTP(otpData);
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
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Driver Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>Welcome, {driver.fullName || driver.name}</span>
          <div style={{ 
            padding: '0.25rem 0.5rem', 
            borderRadius: '4px', 
            fontSize: '0.8rem',
            backgroundColor: socketConnected ? '#28a745' : '#dc3545'
          }}>
            {socketConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          <button
            onClick={toggleOnlineStatus}
            disabled={!socketConnected}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: !socketConnected ? '#6c757d' : isOnline ? '#28a745' : '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: !socketConnected ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
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
        
        {/* Error Displays */}
        {statusError && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '2rem',
            border: '1px solid #f5c6cb'
          }}>
            Status Error: {statusError}
          </div>
        )}
        
        {rideError && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '2rem',
            border: '1px solid #f5c6cb'
          }}>
            Ride Error: {rideError}
          </div>
        )}

        {/* Status Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* Driver Status & Configuration */}
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Driver Status</h3>
            
            {/* Current Status */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: isOnline ? '#28a745' : '#6c757d'
                }}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                <button
                  onClick={toggleOnlineStatus}
                  disabled={!socketConnected}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: !socketConnected ? '#6c757d' : isOnline ? '#dc3545' : '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: !socketConnected ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isOnline ? 'Go Offline' : 'Go Online'}
                </button>
              </div>
              
              {driverLocation && (
                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                  📍 Location: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
                </p>
              )}
            </div>

            {/* Metro Booth Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Metro Booth:
              </label>
              <select 
                value={selectedMetroBooth} 
                onChange={(e) => setSelectedMetroBooth(e.target.value)}
                disabled={isOnline}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  backgroundColor: isOnline ? '#f8f9fa' : '#fff'
                }}
              >
                <option value="">Select metro booth</option>
                {metroStations.map(station => (
                  <option key={station.id} value={station.name}>
                    {station.name} ({station.line} Line)
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle Type Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Vehicle Type:
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {['bike', 'auto', 'car'].map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', cursor: isOnline ? 'not-allowed' : 'pointer' }}>
                    <input
                      type="radio"
                      name="vehicleType"
                      value={type}
                      checked={vehicleType === type}
                      onChange={(e) => setVehicleType(e.target.value)}
                      disabled={isOnline}
                      style={{ marginRight: '0.5rem' }}
                    />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Active Ride */}
          {activeRide && (
            <div style={{
              backgroundColor: '#e8f5e9',
              padding: '2rem',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #28a745'
            }}>
              <h3 style={{ marginTop: 0, color: '#333' }}>Active Ride</h3>
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ margin: '0.5rem 0' }}><strong>Passenger:</strong> {activeRide.userName}</p>
                <p style={{ margin: '0.5rem 0' }}><strong>Phone:</strong> {activeRide.userPhone}</p>
                <p style={{ margin: '0.5rem 0' }}><strong>Pickup:</strong> {activeRide.pickupLocation?.boothName || activeRide.pickupLocation?.stationName}</p>
                <p style={{ margin: '0.5rem 0' }}><strong>Drop:</strong> {activeRide.dropLocation?.address}</p>
                <p style={{ margin: '0.5rem 0' }}><strong>Fare:</strong> ₹{activeRide.fare || activeRide.estimatedFare}</p>
                <p style={{ margin: '0.5rem 0' }}>
                  <strong>Status:</strong> 
                  <span style={{ 
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px', 
                    backgroundColor: activeRide.status === 'driver_assigned' ? '#17a2b8' : 
                                    activeRide.status === 'ride_started' ? '#28a745' : '#6c757d',
                    color: '#fff'
                  }}>
                    {activeRide.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </p>
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

              {/* OTP Input */}
              {showOTPInput && (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#fff3cd', 
                  borderRadius: '4px',
                  border: '1px solid #ffeaa7'
                }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    {showOTPInput.label}:
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="Enter OTP"
                      maxLength="6"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                    <button
                      onClick={handleOTPVerification}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Verify
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

      </main>
    </div>
  );
};

export default DriverDashboard;