import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { API_URL } from '../../config';

// Fix for default marker icon in leaflet
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const DriverProfile = () => {
  const [driver, setDriver] = useState(null);
  const [location, setLocation] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const driverId = JSON.parse(localStorage.getItem('driver')).id;

        const res = await axios.get(`${API_URL}/drivers/profile/${driverId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setDriver(res.data.data);
        setDarkMode(res.data.data.preferences?.darkMode || false);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch profile');
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    // Get and update location
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setLocation(newLocation);

          // Update location in backend
          try {
            const token = localStorage.getItem('token');
            const driverId = JSON.parse(localStorage.getItem('driver')).id;
            await axios.put(
              `${API_URL}/drivers/${driverId}/location`,
              newLocation,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
          } catch (err) {
            console.error('Failed to update location:', err);
          }
        },
        (err) => console.error('Location error:', err),
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const toggleDarkMode = async () => {
    try {
      const token = localStorage.getItem('token');
      const driverId = JSON.parse(localStorage.getItem('driver')).id;
      
      await axios.put(
        `${API_URL}/drivers/${driverId}/preferences`,
        { darkMode: !darkMode },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setDarkMode(!darkMode);
      // Apply dark mode to body
      document.body.classList.toggle('dark-mode');
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-600">{error}</div>;
  if (!driver) return <div className="flex items-center justify-center min-h-screen">No profile data found</div>;

  return (
    <div className={darkMode ? 'dark bg-gray-900 min-h-screen' : 'min-h-screen bg-gray-100'}>
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg mt-8">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">Driver Profile</h1>
        <button onClick={toggleDarkMode} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-800 transition">
          {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        </button>
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Personal Information</h2>
          <p><span className="font-semibold">Name:</span> {driver.fullName}</p>
          <p><span className="font-semibold">Mobile:</span> {driver.mobileNo}</p>
          <p><span className="font-semibold">Aadhaar:</span> {driver.aadhaarNo}</p>
          <p><span className="font-semibold">Vehicle No:</span> {driver.vehicleNo}</p>
        </div>
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Bank Details</h2>
          <p><span className="font-semibold">Account Holder:</span> {driver.bankDetails?.accountHolderName}</p>
          <p><span className="font-semibold">Account Number:</span> {driver.bankDetails?.accountNumber}</p>
          <p><span className="font-semibold">IFSC Code:</span> {driver.bankDetails?.ifscCode}</p>
          <p><span className="font-semibold">Bank Name:</span> {driver.bankDetails?.bankName}</p>
        </div>
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Documents</h2>
          <p><span className="font-semibold">Driving License:</span> {driver.drivingLicenseNo}</p>
          <p><span className="font-semibold">Permit Number:</span> {driver.permitNo}</p>
          <p><span className="font-semibold">Fitness Certificate:</span> {driver.fitnessCertificateNo}</p>
          <p><span className="font-semibold">Insurance Policy:</span> {driver.insurancePolicyNo}</p>
        </div>
        {location && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Current Location</h2>
            <p>Latitude: {location.latitude}</p>
            <p>Longitude: {location.longitude}</p>
            <div className="h-96 w-full mt-4">
              <MapContainer
                center={[location.latitude, location.longitude]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={[location.latitude, location.longitude]}>
                  <Popup>
                    You are here!
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        )}
      </div>
      <div className="text-center text-gray-500 text-xs mt-2">&copy; 2025 GANTAVYAM. All rights reserved.</div>
    </div>
  );
};

export default DriverProfile;
