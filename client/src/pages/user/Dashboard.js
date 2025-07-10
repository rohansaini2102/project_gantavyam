import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { DELHI_METRO_STATIONS, findNearestStation } from '../../data/delhiMetroStations';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const UserDashboard = () => {
  const navigate = useNavigate();
  
  // User state
  const [user, setUser] = useState(null);
  
  // Location state
  const [userLocation, setUserLocation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [nearestStation, setNearestStation] = useState(null);
  const [dropLocation, setDropLocation] = useState('');
  const [fare, setFare] = useState(null);
  
  // Booking state
  const [isBooking, setIsBooking] = useState(false);

  console.log('[UserDashboard] Component mounted');

  // Authentication check
  useEffect(() => {
    console.log('[UserDashboard] Checking authentication...');
    const token = localStorage.getItem('userToken');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      console.log('[UserDashboard] No authentication data found');
      navigate('/user/login');
      return;
    }
    
    try {
      const parsedUser = JSON.parse(userData);
      console.log('[UserDashboard] User loaded:', parsedUser);
      setUser(parsedUser);
    } catch (error) {
      console.error('[UserDashboard] Error parsing user data:', error);
      navigate('/user/login');
    }
  }, [navigate]);

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
          
          // Find nearest metro station
          const nearest = findNearestStation(location.lat, location.lng);
          console.log('[UserDashboard] Nearest station:', nearest);
          setNearestStation(nearest);
          setSelectedStation(nearest);
        },
        (error) => {
          console.error('[UserDashboard] Geolocation error:', error);
          // Default to Delhi center
          const defaultLocation = { lat: 28.6139, lng: 77.2090 };
          setUserLocation(defaultLocation);
          const nearest = findNearestStation(defaultLocation.lat, defaultLocation.lng);
          setNearestStation(nearest);
          setSelectedStation(nearest);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Calculate fare based on distance
  const calculateFare = () => {
    if (!dropLocation.trim()) {
      alert('Please enter a drop location');
      return;
    }
    
    // Simple fare calculation (₹10 base + ₹5 per km estimated)
    const baseFare = 10;
    const estimatedDistance = Math.random() * 10 + 2; // Random distance for demo
    const calculatedFare = baseFare + (estimatedDistance * 5);
    setFare(Math.round(calculatedFare));
    console.log('[UserDashboard] Fare calculated:', calculatedFare);
  };

  // Book ride
  const bookRide = () => {
    if (!selectedStation || !dropLocation.trim() || !fare) {
      alert('Please select pickup station, enter drop location, and calculate fare');
      return;
    }
    
    console.log('[UserDashboard] Booking ride...', {
      pickup: selectedStation,
      drop: dropLocation,
      fare: fare
    });
    
    setIsBooking(true);
    
    // Simulate booking process
    setTimeout(() => {
      setIsBooking(false);
      alert(`Ride booked successfully! Pickup: ${selectedStation.name} Metro Station. Fare: ₹${fare}`);
    }, 2000);
  };

  // Logout
  const handleLogout = () => {
    console.log('[UserDashboard] Logging out...');
    localStorage.removeItem('user');
    localStorage.removeItem('userToken');
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
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Metro Booking</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>Welcome, {user.fullName || user.name}</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* Booking Form */}
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, color: '#333' }}>Book a Ride</h2>
            
            {/* Station Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Pickup Metro Station:
              </label>
              <select 
                value={selectedStation?.id || ''} 
                onChange={(e) => {
                  const station = DELHI_METRO_STATIONS.find(s => s.id === parseInt(e.target.value));
                  setSelectedStation(station);
                  console.log('[UserDashboard] Station selected:', station);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                <option value="">Select a station</option>
                {DELHI_METRO_STATIONS.map(station => (
                  <option key={station.id} value={station.id}>
                    {station.name} ({station.line} Line)
                  </option>
                ))}
              </select>
              {nearestStation && (
                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                  Nearest station: {nearestStation.name}
                </p>
              )}
            </div>

            {/* Drop Location */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Drop Location:
              </label>
              <input
                type="text"
                value={dropLocation}
                onChange={(e) => setDropLocation(e.target.value)}
                placeholder="Enter your destination"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>

            {/* Fare */}
            <div style={{ marginBottom: '1.5rem' }}>
              <button
                onClick={calculateFare}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  marginRight: '1rem'
                }}
              >
                Calculate Fare
              </button>
              {fare && (
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#28a745' }}>
                  Fare: ₹{fare}
                </span>
              )}
            </div>

            {/* Book Button */}
            <button
              onClick={bookRide}
              disabled={isBooking || !selectedStation || !dropLocation.trim() || !fare}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: isBooking ? '#ccc' : '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isBooking ? 'not-allowed' : 'pointer',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}
            >
              {isBooking ? 'Booking...' : 'Book Ride'}
            </button>
          </div>

          {/* Map */}
          <div style={{
            backgroundColor: '#fff',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            height: 'fit-content'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>Map</h3>
            <div style={{ height: '400px', borderRadius: '4px', overflow: 'hidden' }}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={userLocation || { lat: 28.6139, lng: 77.2090 }}
                zoom={12}
              >
                {/* User location */}
                {userLocation && (
                  <Marker
                    position={userLocation}
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                      scaledSize: new window.google.maps.Size(30, 30)
                    }}
                    title="Your Location"
                  />
                )}

                {/* Selected metro station */}
                {selectedStation && (
                  <Marker
                    position={{ lat: selectedStation.lat, lng: selectedStation.lng }}
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                      scaledSize: new window.google.maps.Size(35, 35)
                    }}
                    title={`${selectedStation.name} Metro Station`}
                  />
                )}

                {/* All metro stations */}
                {DELHI_METRO_STATIONS.map(station => (
                  <Marker
                    key={station.id}
                    position={{ lat: station.lat, lng: station.lng }}
                    icon={{
                      url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                      scaledSize: new window.google.maps.Size(20, 20)
                    }}
                    title={`${station.name} (${station.line} Line)`}
                    onClick={() => {
                      setSelectedStation(station);
                      console.log('[UserDashboard] Station clicked:', station);
                    }}
                  />
                ))}
              </GoogleMap>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>Status</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Current Location:</strong><br />
              {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'Getting location...'}
            </div>
            <div>
              <strong>Selected Station:</strong><br />
              {selectedStation ? `${selectedStation.name} (${selectedStation.line} Line)` : 'None selected'}
            </div>
            <div>
              <strong>Drop Location:</strong><br />
              {dropLocation || 'Not entered'}
            </div>
            <div>
              <strong>Estimated Fare:</strong><br />
              {fare ? `₹${fare}` : 'Not calculated'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;