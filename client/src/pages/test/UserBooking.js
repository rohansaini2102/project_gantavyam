import React, { useState, useEffect } from 'react';
import { useLoadScript, GoogleMap, Marker, DirectionsRenderer, Autocomplete } from '@react-google-maps/api';
import { DELHI_METRO_STATIONS, findNearestStation } from '../../data/delhiMetroStations';
import './UserBooking.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const libraries = ['places', 'geometry'];

const mapContainerStyle = {
  width: '100%',
  height: '500px'
};

const defaultCenter = {
  lat: 28.6139, // Delhi center
  lng: 77.2090
};

const UserBooking = () => {
  const [selectedStation, setSelectedStation] = useState(null);
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [nearestStation, setNearestStation] = useState(null);
  const [directions, setDirections] = useState(null);
  const [distance, setDistance] = useState(null);
  const [fare, setFare] = useState(null);
  const [autocomplete, setAutocomplete] = useState(null);
  const [map, setMap] = useState(null);
  const [showBookingDetails, setShowBookingDetails] = useState(false);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(userLoc);
          
          // Find nearest metro station
          const nearest = findNearestStation(userLoc.lat, userLoc.lng);
          setNearestStation(nearest);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  const onLoadAutocomplete = (autocompleteInstance) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        setDestination(place.formatted_address);
        setDestinationCoords({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        });
      }
    }
  };

  const calculateRoute = async () => {
    if (!selectedStation || !destinationCoords || !window.google) {
      alert('Please select a metro station and destination');
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    
    try {
      const result = await directionsService.route({
        origin: { lat: selectedStation.lat, lng: selectedStation.lng },
        destination: destinationCoords,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      setDirections(result);
      
      // Calculate distance and fare
      const distanceInMeters = result.routes[0].legs[0].distance.value;
      const distanceInKm = distanceInMeters / 1000;
      setDistance(distanceInKm);
      
      // Simple fare calculation: Base fare 30 + 10 per km
      const calculatedFare = Math.ceil(30 + (distanceInKm * 10));
      setFare(calculatedFare);
      setShowBookingDetails(true);
    } catch (error) {
      console.error('Error calculating route:', error);
      alert('Could not calculate route. Please try again.');
    }
  };

  const handleBookRide = () => {
    if (!selectedStation || !destinationCoords || !fare) {
      return;
    }

    // For now, just show an alert
    alert(`Ride Booked!\n
From: ${selectedStation.name} Metro Station
To: ${destination}
Distance: ${distance.toFixed(2)} km
Fare: ₹${fare}

This is a test booking. Backend integration pending.`);
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
    <div className="user-booking-container">
      <h1>Book Your Ride - Metro Station Pickup</h1>
      
      <div className="booking-form">
        <div className="form-section">
          <h3>Select Pickup Metro Station</h3>
          
          {nearestStation && (
            <div className="nearest-station-info">
              <p>Nearest Metro: <strong>{nearestStation.station.name}</strong> ({nearestStation.distance.toFixed(2)} km away)</p>
              <button 
                onClick={() => setSelectedStation(nearestStation.station)}
                className="select-nearest-btn"
              >
                Select Nearest Station
              </button>
            </div>
          )}

          <select 
            value={selectedStation?.id || ''} 
            onChange={(e) => {
              const station = DELHI_METRO_STATIONS.find(s => s.id === parseInt(e.target.value));
              setSelectedStation(station);
            }}
            className="station-select"
          >
            <option value="">-- Select Metro Station --</option>
            {DELHI_METRO_STATIONS.map(station => (
              <option key={station.id} value={station.id}>
                {station.name} - {station.line} Line
              </option>
            ))}
          </select>
        </div>

        <div className="form-section">
          <h3>Enter Destination</h3>
          <Autocomplete
            onLoad={onLoadAutocomplete}
            onPlaceChanged={onPlaceChanged}
          >
            <input
              type="text"
              placeholder="Enter your destination address"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="destination-input"
            />
          </Autocomplete>
        </div>

        <button 
          onClick={calculateRoute}
          disabled={!selectedStation || !destinationCoords}
          className="calculate-btn"
        >
          Calculate Fare
        </button>

        {showBookingDetails && (
          <div className="booking-details">
            <h3>Trip Details</h3>
            <p><strong>From:</strong> {selectedStation.name} Metro Station</p>
            <p><strong>To:</strong> {destination}</p>
            <p><strong>Distance:</strong> {distance.toFixed(2)} km</p>
            <p><strong>Estimated Fare:</strong> ₹{fare}</p>
            
            <button onClick={handleBookRide} className="book-ride-btn">
              Book Ride
            </button>
          </div>
        )}
      </div>

      <div className="map-section">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={11}
          center={userLocation || defaultCenter}
          onLoad={onMapLoad}
        >
          {/* User location marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
              }}
              title="Your Location"
            />
          )}

          {/* Metro station markers */}
          {DELHI_METRO_STATIONS.map(station => (
            <Marker
              key={station.id}
              position={{ lat: station.lat, lng: station.lng }}
              icon={{
                url: station.id === selectedStation?.id 
                  ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
                  : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: new window.google.maps.Size(
                  station.id === selectedStation?.id ? 40 : 30,
                  station.id === selectedStation?.id ? 40 : 30
                )
              }}
              title={`${station.name} - ${station.line} Line`}
              onClick={() => setSelectedStation(station)}
            />
          ))}

          {/* Destination marker */}
          {destinationCoords && (
            <Marker
              position={destinationCoords}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
              }}
              title="Destination"
            />
          )}

          {/* Route directions */}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#4285F4',
                  strokeWeight: 4
                }
              }}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
};

export default UserBooking;