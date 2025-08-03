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
      <h1>Ride Booking Service</h1>
      
      <div className="booking-disabled-message" style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        margin: '20px'
      }}>
        <h2 style={{ color: '#6c757d', marginBottom: '20px' }}>
          Customer Online Booking Not Available
        </h2>
        <p style={{ fontSize: '18px', color: '#495057', marginBottom: '20px' }}>
          All rides are now managed through our admin booking system for better service quality and driver management.
        </p>
        <p style={{ fontSize: '16px', color: '#6c757d' }}>
          Please contact our admin team to book your ride or visit one of our booking counters.
        </p>
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#e7f3ff', borderRadius: '6px' }}>
          <h4 style={{ color: '#0066cc', marginBottom: '10px' }}>How to Book:</h4>
          <ul style={{ textAlign: 'left', color: '#495057', maxWidth: '400px', margin: '0 auto' }}>
            <li>Visit our admin booking counter</li>
            <li>Call our booking hotline</li>
            <li>Use our admin booking portal</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UserBooking;