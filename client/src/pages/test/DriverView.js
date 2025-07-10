import React, { useState, useEffect } from 'react';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { DELHI_METRO_STATIONS } from '../../data/delhiMetroStations';
import './DriverView.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 28.6139, // Delhi center
  lng: 77.2090
};

// Mock ride requests for testing
const mockRideRequests = [
  {
    id: 1,
    userName: 'Rahul Kumar',
    userPhone: '9876543210',
    pickupStation: { id: 12, name: 'Rajiv Chowk', lat: 28.6328, lng: 77.2197 },
    destination: 'Connaught Place, New Delhi',
    distance: 2.5,
    fare: 55,
    timestamp: new Date().toISOString()
  },
  {
    id: 2,
    userName: 'Priya Sharma',
    userPhone: '9876543211',
    pickupStation: { id: 15, name: 'Hauz Khas', lat: 28.5433, lng: 77.2066 },
    destination: 'Select City Walk, Saket',
    distance: 3.8,
    fare: 68,
    timestamp: new Date().toISOString()
  }
];

const DriverView = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [map, setMap] = useState(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Get driver location
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setDriverLocation(location);
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Simulate receiving ride requests when online
  useEffect(() => {
    if (isOnline) {
      // Add mock requests after a delay
      const timer = setTimeout(() => {
        setRideRequests(mockRideRequests);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setRideRequests([]);
    }
  }, [isOnline]);

  const toggleOnlineStatus = () => {
    setIsOnline(!isOnline);
    if (!isOnline) {
      // Going online
      console.log('Driver is now online');
    } else {
      // Going offline
      console.log('Driver is now offline');
      setRideRequests([]);
      setActiveRide(null);
    }
  };

  const acceptRide = (request) => {
    setActiveRide(request);
    setRideRequests(rideRequests.filter(r => r.id !== request.id));
    setSelectedRequest(null);
    alert(`Ride accepted! Navigate to ${request.pickupStation.name} Metro Station`);
  };

  const rejectRide = (requestId) => {
    setRideRequests(rideRequests.filter(r => r.id !== requestId));
    setSelectedRequest(null);
  };

  const completeRide = () => {
    alert(`Ride completed! Fare collected: ₹${activeRide.fare}`);
    setActiveRide(null);
  };

  const onMapLoad = (mapInstance) => {
    setMap(mapInstance);
  };

  if (loadError) {
    return <div>Error loading maps. Please check your API key.</div>;
  }

  if (!isLoaded) {
    return <div>Loading maps...</div>;
  }

  return (
    <div className="driver-view-container">
      <h1>Driver Dashboard</h1>

      <div className="status-section">
        <div className="status-card">
          <h3>Driver Status</h3>
          <div className="status-toggle">
            <span className={`status-text ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            <button 
              onClick={toggleOnlineStatus}
              className={`toggle-btn ${isOnline ? 'online' : 'offline'}`}
            >
              {isOnline ? 'Go Offline' : 'Go Online'}
            </button>
          </div>
          {driverLocation && (
            <p className="location-info">
              Current Location: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
            </p>
          )}
        </div>

        {activeRide && (
          <div className="active-ride-card">
            <h3>Active Ride</h3>
            <div className="ride-info">
              <p><strong>Passenger:</strong> {activeRide.userName}</p>
              <p><strong>Phone:</strong> {activeRide.userPhone}</p>
              <p><strong>Pickup:</strong> {activeRide.pickupStation.name} Metro</p>
              <p><strong>Destination:</strong> {activeRide.destination}</p>
              <p><strong>Fare:</strong> ₹{activeRide.fare}</p>
            </div>
            <button onClick={completeRide} className="complete-btn">
              Complete Ride
            </button>
          </div>
        )}
      </div>

      {isOnline && !activeRide && (
        <div className="requests-section">
          <h2>Incoming Ride Requests</h2>
          {rideRequests.length === 0 ? (
            <p className="no-requests">Waiting for ride requests...</p>
          ) : (
            <div className="requests-list">
              {rideRequests.map(request => (
                <div 
                  key={request.id} 
                  className={`request-card ${selectedRequest?.id === request.id ? 'selected' : ''}`}
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="request-header">
                    <h4>{request.userName}</h4>
                    <span className="fare">₹{request.fare}</span>
                  </div>
                  <p className="pickup">
                    <strong>Pickup:</strong> {request.pickupStation.name} Metro
                  </p>
                  <p className="destination">
                    <strong>Drop:</strong> {request.destination}
                  </p>
                  <p className="distance">
                    <strong>Distance:</strong> {request.distance} km
                  </p>
                  <div className="request-actions">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        acceptRide(request);
                      }}
                      className="accept-btn"
                    >
                      Accept
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        rejectRide(request.id);
                      }}
                      className="reject-btn"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="map-section">
        <h3>Map View</h3>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={12}
          center={driverLocation || defaultCenter}
          onLoad={onMapLoad}
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

          {/* Show pickup location for active ride */}
          {activeRide && (
            <Marker
              position={{ lat: activeRide.pickupStation.lat, lng: activeRide.pickupStation.lng }}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                scaledSize: new window.google.maps.Size(40, 40)
              }}
              title={`Pickup: ${activeRide.pickupStation.name}`}
            />
          )}

          {/* Show pickup locations for pending requests */}
          {rideRequests.map(request => (
            <Marker
              key={request.id}
              position={{ lat: request.pickupStation.lat, lng: request.pickupStation.lng }}
              icon={{
                url: request.id === selectedRequest?.id 
                  ? 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
                  : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: new window.google.maps.Size(
                  request.id === selectedRequest?.id ? 35 : 30,
                  request.id === selectedRequest?.id ? 35 : 30
                )
              }}
              title={`${request.userName} - ${request.pickupStation.name}`}
              onClick={() => setSelectedRequest(request)}
            />
          ))}
        </GoogleMap>
      </div>
    </div>
  );
};

export default DriverView;