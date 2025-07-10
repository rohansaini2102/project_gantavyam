import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { DELHI_METRO_STATIONS } from '../../data/delhiMetroStations';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Mock ride requests for testing
const mockRideRequests = [
  {
    _id: '1',
    userName: 'Rahul Kumar',
    userPhone: '9876543210',
    pickupLocation: {
      stationName: 'Rajiv Chowk',
      latitude: 28.6328,
      longitude: 77.2197,
      metroLine: 'Blue'
    },
    dropLocation: {
      address: 'Connaught Place, New Delhi'
    },
    fare: 55,
    distance: 2.5,
    timestamp: new Date().toISOString()
  },
  {
    _id: '2',
    userName: 'Priya Sharma',
    userPhone: '9876543211',
    pickupLocation: {
      stationName: 'Hauz Khas',
      latitude: 28.5433,
      longitude: 77.2066,
      metroLine: 'Yellow'
    },
    dropLocation: {
      address: 'Select City Walk, Saket'
    },
    fare: 68,
    distance: 3.8,
    timestamp: new Date().toISOString()
  }
];

const DriverDashboard = () => {
  const navigate = useNavigate();
  
  // Driver state
  const [driver, setDriver] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  
  // Ride state
  const [rideRequests, setRideRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  console.log('[DriverDashboard] Component mounted');

  // Authentication check
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

  // Get driver location
  useEffect(() => {
    console.log('[DriverDashboard] Setting up location tracking...');
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('[DriverDashboard] Location updated:', location);
          setDriverLocation(location);
        },
        (error) => {
          console.error('[DriverDashboard] Geolocation error:', error);
          // Default to Delhi center
          setDriverLocation({ lat: 28.6139, lng: 77.2090 });
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Simulate ride requests when online
  useEffect(() => {
    if (isOnline && !activeRide) {
      console.log('[DriverDashboard] Going online, loading mock requests...');
      const timer = setTimeout(() => {
        setRideRequests(mockRideRequests);
        console.log('[DriverDashboard] Mock requests loaded:', mockRideRequests);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setRideRequests([]);
    }
  }, [isOnline, activeRide]);

  // Toggle online status
  const toggleOnlineStatus = () => {
    const newStatus = !isOnline;
    console.log('[DriverDashboard] Toggling status to:', newStatus);
    setIsOnline(newStatus);
    
    if (!newStatus) {
      // Going offline
      setRideRequests([]);
      setActiveRide(null);
      setSelectedRequest(null);
    }
  };

  // Accept ride
  const acceptRide = (request) => {
    console.log('[DriverDashboard] Accepting ride:', request);
    setActiveRide(request);
    setRideRequests([]);
    setSelectedRequest(null);
    alert(`Ride accepted! Navigate to ${request.pickupLocation.stationName} Metro Station`);
  };

  // Decline ride
  const declineRide = (requestId) => {
    console.log('[DriverDashboard] Declining ride:', requestId);
    setRideRequests(prev => prev.filter(r => r._id !== requestId));
    if (selectedRequest?._id === requestId) {
      setSelectedRequest(null);
    }
  };

  // Complete ride
  const completeRide = () => {
    console.log('[DriverDashboard] Completing ride:', activeRide);
    alert(`Ride completed! Fare collected: ₹${activeRide.fare}`);
    setActiveRide(null);
  };

  // Cancel ride
  const cancelRide = () => {
    console.log('[DriverDashboard] Cancelling ride:', activeRide);
    setActiveRide(null);
    alert('Ride cancelled');
  };

  // Logout
  const handleLogout = () => {
    console.log('[DriverDashboard] Logging out...');
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
          <button
            onClick={toggleOnlineStatus}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isOnline ? '#28a745' : '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
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
        
        {/* Status Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* Driver Status */}
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Status</h3>
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
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: isOnline ? '#dc3545' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isOnline ? 'Go Offline' : 'Go Online'}
              </button>
            </div>
            {driverLocation && (
              <p style={{ color: '#666', fontSize: '0.9rem' }}>
                Location: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
              </p>
            )}
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
                <p style={{ margin: '0.5rem 0' }}><strong>Pickup:</strong> {activeRide.pickupLocation.stationName} Metro</p>
                <p style={{ margin: '0.5rem 0' }}><strong>Drop:</strong> {activeRide.dropLocation.address}</p>
                <p style={{ margin: '0.5rem 0' }}><strong>Fare:</strong> ₹{activeRide.fare}</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={completeRide}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Complete Ride
                </button>
                <button
                  onClick={cancelRide}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
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
            <h2 style={{ marginTop: 0, color: '#333' }}>Ride Requests</h2>
            {rideRequests.length === 0 ? (
              <p style={{ 
                textAlign: 'center', 
                color: '#666', 
                padding: '2rem',
                fontSize: '1.1rem'
              }}>
                {isOnline ? 'Waiting for ride requests...' : 'Go online to receive ride requests'}
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
                          📍 <strong>Pickup:</strong> {request.pickupLocation.stationName} Metro ({request.pickupLocation.metroLine} Line)
                        </p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                          📍 <strong>Drop:</strong> {request.dropLocation.address}
                        </p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                          📏 <strong>Distance:</strong> {request.distance} km
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
                          ₹{request.fare}
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

              {/* Active ride pickup */}
              {activeRide && (
                <Marker
                  position={{
                    lat: activeRide.pickupLocation.latitude,
                    lng: activeRide.pickupLocation.longitude
                  }}
                  icon={{
                    url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    scaledSize: new window.google.maps.Size(40, 40)
                  }}
                  title={`Active Pickup: ${activeRide.pickupLocation.stationName}`}
                />
              )}

              {/* Ride request pickups */}
              {rideRequests.map(request => (
                <Marker
                  key={request._id}
                  position={{
                    lat: request.pickupLocation.latitude,
                    lng: request.pickupLocation.longitude
                  }}
                  icon={{
                    url: selectedRequest?._id === request._id 
                      ? 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
                      : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    scaledSize: new window.google.maps.Size(35, 35)
                  }}
                  title={`${request.userName} - ${request.pickupLocation.stationName}`}
                  onClick={() => setSelectedRequest(request)}
                />
              ))}

              {/* All metro stations */}
              {DELHI_METRO_STATIONS.map(station => (
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