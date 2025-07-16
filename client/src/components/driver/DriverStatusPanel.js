import React, { useState, useEffect } from 'react';
import { FiMapPin, FiWifi, FiWifiOff, FiRadio, FiTruck, FiNavigation2 } from 'react-icons/fi';

const DriverStatusPanel = ({
  driver,
  isOnline = false,
  socketConnected = false,
  selectedPickupLocation = '',
  vehicleType = 'auto',
  driverLocation = null,
  pickupLocations = [],
  pickupLocationsLoading = false,
  pickupLocationsError = '',
  statusError = '',
  isGoingOnline = false,
  onToggleOnlineStatus,
  onPickupLocationChange,
  onVehicleTypeChange,
  onLoadPickupLocations,
  className = ''
}) => {
  const [pickupSearchQuery, setPickupSearchQuery] = useState(selectedPickupLocation || '');
  const [showPickupResults, setShowPickupResults] = useState(false);
  const [selectedPickupIndex, setSelectedPickupIndex] = useState(-1);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('all');
  const [maxPickupResults, setMaxPickupResults] = useState(8);

  // Sync search query with selected pickup location
  useEffect(() => {
    setPickupSearchQuery(selectedPickupLocation || '');
  }, [selectedPickupLocation]);

  // Group locations by type
  const locationsByType = pickupLocations.reduce((acc, location) => {
    if (!acc[location.type]) acc[location.type] = [];
    acc[location.type].push(location);
    return acc;
  }, {});

  // Location type filters
  const locationFilters = [
    { value: 'all', label: 'All Types', icon: '📍' },
    { value: 'metro', label: 'Metro', icon: '🚇' },
    { value: 'railway', label: 'Railway', icon: '🚂' },
    { value: 'airport', label: 'Airport', icon: '✈️' },
    { value: 'bus_terminal', label: 'Bus', icon: '🚌' }
  ];

  // Vehicle type options
  const vehicleTypes = [
    { value: 'bike', label: 'Bike', icon: <FiNavigation2 className="w-4 h-4" /> },
    { value: 'auto', label: 'Auto', icon: <FiTruck className="w-4 h-4" /> },
    { value: 'car', label: 'Car', icon: <FiTruck className="w-4 h-4" /> }
  ];

  // Search pickup locations
  const searchPickupLocations = (query) => {
    if (!query.trim()) return [];
    
    let filtered = pickupLocations;
    if (selectedLocationFilter !== 'all') {
      filtered = pickupLocations.filter(location => location.type === selectedLocationFilter);
    }
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return filtered
      .map(location => {
        let score = 0;
        const searchableText = `${location.name} ${location.address || ''} ${location.line || ''}`.toLowerCase();
        
        searchTerms.forEach(term => {
          if (location.name.toLowerCase().includes(term)) score += 10;
          if (location.address?.toLowerCase().includes(term)) score += 5;
          if (location.line?.toLowerCase().includes(term)) score += 3;
          if (searchableText.includes(term)) score += 1;
        });
        
        return { ...location, score };
      })
      .filter(location => location.score > 0)
      .sort((a, b) => b.score - a.score);
  };

  // Get location icon
  const getLocationIcon = (type) => {
    const icons = {
      metro: '🚇',
      railway: '🚂',
      airport: '✈️',
      bus_terminal: '🚌',
      hospital: '🏥',
      mall: '🏬',
      hotel: '🏨'
    };
    return icons[type] || '📍';
  };

  // Get location type label
  const getLocationTypeLabel = (type) => {
    const labels = {
      metro: 'Metro Station',
      railway: 'Railway Station',
      airport: 'Airport',
      bus_terminal: 'Bus Terminal',
      hospital: 'Hospital',
      mall: 'Shopping Mall',
      hotel: 'Hotel'
    };
    return labels[type] || 'Location';
  };

  // Handle pickup search
  const handlePickupSearchChange = (e) => {
    const value = e.target.value;
    setPickupSearchQuery(value);
    setShowPickupResults(value.trim().length > 0);
    setSelectedPickupIndex(-1);
  };

  // Handle pickup selection
  const handlePickupSelect = (location) => {
    const locationName = location.name || location;
    setPickupSearchQuery(locationName);
    if (onPickupLocationChange) {
      onPickupLocationChange(locationName);
    }
    setShowPickupResults(false);
    setSelectedPickupIndex(-1);
  };

  // Highlight matched text
  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <span key={index} className="bg-yellow-200 font-semibold">{part}</span> : 
        part
    );
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FiRadio className="w-5 h-5 text-sky-500" />
          Driver Status
        </h3>
        
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {socketConnected ? (
            <FiWifi className="w-4 h-4 text-green-500" />
          ) : (
            <FiWifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            socketConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {socketConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Error Messages */}
      {statusError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {statusError}
        </div>
      )}

      {/* Current Status & Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className={`text-lg font-bold ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          
          <button
            onClick={onToggleOnlineStatus}
            disabled={!socketConnected || isGoingOnline}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              !socketConnected || isGoingOnline
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : isOnline 
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isGoingOnline && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isGoingOnline ? 'Going Online...' : isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
        
        {driverLocation && (
          <p className="text-sm text-gray-600 flex items-center gap-1">
            <FiMapPin className="w-4 h-4" />
            Location: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
          </p>
        )}
      </div>

      {/* Fixed Pickup Location Display */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Pickup Location
        </label>
        
        {/* Fixed Location Display */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚇</span>
            <div className="flex-1">
              <div className="font-medium text-sm text-blue-800">
                Hauz Khas Metro Gate No 1
              </div>
              <div className="text-xs text-blue-600">
                Fixed pickup location - Hauz Khas Metro Station Gate No 1, Outer Ring Road, Hauz Khas, New Delhi
              </div>
              <div className="text-xs text-blue-500 mt-1">
                🔒 This is the only pickup location available for all drivers
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Vehicle Type
        </label>
        <div className="flex gap-3">
          {vehicleTypes.map(type => (
            <label 
              key={type.value} 
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                vehicleType === type.value
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'border-gray-300 hover:border-gray-400'
              } ${isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="vehicleType"
                value={type.value}
                checked={vehicleType === type.value}
                onChange={(e) => onVehicleTypeChange && onVehicleTypeChange(e.target.value)}
                disabled={isOnline}
                className="sr-only"
              />
              {type.icon}
              <span className="text-sm font-medium">{type.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DriverStatusPanel;