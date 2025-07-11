import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaEye, FaFilter, FaSearch, FaUsers, FaClock, FaChartBar } from 'react-icons/fa';
import { MdRefresh, MdLocationOn } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import * as api from '../../services/api';

const BoothManagement = () => {
  const [booths, setBooths] = useState([]);
  const [filteredBooths, setFilteredBooths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    hasRides: 'all',
    searchQuery: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadBooths();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [booths, filters]);

  const loadBooths = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🏢 [Booth Management] Loading booths...');
      
      const response = await api.admin.getBoothsList();
      
      console.log('🏢 [Booth Management] API Response:', response);
      
      if (response.data && response.data.success) {
        setBooths(response.data.data.booths);
        console.log('🏢 [Booth Management] Loaded booths:', response.data.data.booths.length);
      } else {
        throw new Error('Failed to load booths data');
      }
    } catch (error) {
      console.error('🏢 [Booth Management] Error loading booths:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...booths];

    // Filter by type
    if (filters.type !== 'all') {
      filtered = filtered.filter(booth => booth.type === filters.type);
    }

    // Filter by ride activity
    if (filters.hasRides === 'active') {
      filtered = filtered.filter(booth => booth.hasActiveRides);
    } else if (filters.hasRides === 'inactive') {
      filtered = filtered.filter(booth => !booth.hasActiveRides);
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(booth =>
        (booth.name && booth.name.toLowerCase().includes(query)) ||
        (booth.address && booth.address.toLowerCase().includes(query)) ||
        (booth.subType && booth.subType.toLowerCase().includes(query))
      );
    }

    setFilteredBooths(filtered);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      type: 'all',
      hasRides: 'all',
      searchQuery: ''
    });
  };

  const viewBoothRides = (boothName) => {
    navigate(`/admin/rides?booth=${encodeURIComponent(boothName)}`);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'metro':
        return '🚇';
      case 'railway':
        return '🚊';
      case 'airport':
        return '✈️';
      case 'bus_terminal':
        return '🚌';
      default:
        return '📍';
    }
  };

  const getTypeBadge = (type) => {
    const typeColors = {
      metro: 'bg-blue-100 text-blue-800',
      railway: 'bg-green-100 text-green-800',
      airport: 'bg-purple-100 text-purple-800',
      bus_terminal: 'bg-orange-100 text-orange-800'
    };

    const typeLabels = {
      metro: 'Metro',
      railway: 'Railway',
      airport: 'Airport',
      bus_terminal: 'Bus Terminal'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[type] || 'bg-gray-100 text-gray-800'}`}>
        {typeLabels[type] || type}
      </span>
    );
  };

  const formatLastRide = (dateString) => {
    if (!dateString) return 'No rides yet';
    
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading booths...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600 mr-3">⚠️</div>
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Booths</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={loadBooths}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Booth Management</h1>
          <div className="flex space-x-3">
            <button
              onClick={loadBooths}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <MdRefresh />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-900">{booths.length}</div>
            <div className="text-sm text-gray-600">Total Booths</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {booths.filter(b => b.hasActiveRides).length}
            </div>
            <div className="text-sm text-gray-600">Active Booths</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">
              {booths.reduce((sum, b) => sum + b.totalRides, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Rides</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(booths.map(b => b.type)).size}
            </div>
            <div className="text-sm text-gray-600">Booth Types</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booth Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="metro">Metro</option>
              <option value="railway">Railway</option>
              <option value="airport">Airport</option>
              <option value="bus_terminal">Bus Terminal</option>
            </select>
          </div>

          {/* Activity Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <select
              value={filters.hasRides}
              onChange={(e) => handleFilterChange('hasRides', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Booths</option>
              <option value="active">Active (Has Rides)</option>
              <option value="inactive">Inactive (No Rides)</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search booths..."
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Booths Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBooths.map((booth) => (
          <div key={booth.name} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{getTypeIcon(booth.type)}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {booth.name}
                    </h3>
                    <div className="mt-1">{getTypeBadge(booth.type)}</div>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{booth.totalRides}</div>
                  <div className="text-sm text-gray-600">Total Rides</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${booth.hasActiveRides ? 'text-green-600' : 'text-gray-400'}`}>
                    {booth.hasActiveRides ? '✓' : '✗'}
                  </div>
                  <div className="text-sm text-gray-600">Active</div>
                </div>
              </div>

              {/* Address */}
              {booth.address && (
                <div className="mb-4">
                  <div className="flex items-start space-x-2">
                    <MdLocationOn className="text-gray-400 mt-1 flex-shrink-0" />
                    <p className="text-sm text-gray-600 line-clamp-2">{booth.address}</p>
                  </div>
                </div>
              )}

              {/* Last Ride */}
              {booth.lastRide && (
                <div className="mb-4">
                  <div className="flex items-center space-x-2">
                    <FaClock className="text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Last Ride</div>
                      <div className="text-sm text-gray-600">{formatLastRide(booth.lastRide)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* SubType */}
              {booth.subType && (
                <div className="mb-4">
                  <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                    {booth.subType}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => viewBoothRides(booth.name)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaEye />
                  <span>View Rides</span>
                </button>
                <button className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                  <FaChartBar />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {!loading && filteredBooths.length === 0 && (
        <div className="text-center py-12">
          <FaMapMarkerAlt className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No booths found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search filters or check back later.
          </p>
        </div>
      )}
    </div>
  );
};

export default BoothManagement;