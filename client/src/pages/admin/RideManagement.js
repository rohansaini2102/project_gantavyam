import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaFilter, FaEye, FaMapMarkerAlt, FaClock, FaUser, FaCar } from 'react-icons/fa';
import { MdRefresh, MdDownload } from 'react-icons/md';
import * as api from '../../services/api';
import socketService from '../../services/socket';

const RideManagement = () => {
  const [rides, setRides] = useState([]);
  const [booths, setBooths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [filters, setFilters] = useState({
    booth: 'all',
    status: 'all',
    startDate: '',
    endDate: '',
    searchQuery: ''
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    skip: 0,
    hasMore: false
  });
  const [selectedRide, setSelectedRide] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const socketRef = useRef(null);

  // Initialize socket connection for real-time updates
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      console.log('🔌 [Ride Management] Initializing admin socket connection');
      socketRef.current = socketService;
      const socket = socketService.initialize(adminToken);
      
      if (socket) {
        // Listen for real-time ride updates
        socket.on('rideUpdate', (data) => {
          console.log('📢 [Ride Management] Real-time update received:', data);
          handleRealTimeUpdate(data);
        });
        
        socket.on('connectionSuccess', (data) => {
          console.log('✅ [Ride Management] Admin socket connected:', data);
          setSocketConnected(true);
        });

        socket.on('connect', () => {
          setSocketConnected(true);
          console.log('✅ [Ride Management] Socket connected');
        });

        socket.on('disconnect', () => {
          setSocketConnected(false);
          console.log('❌ [Ride Management] Socket disconnected');
        });
        
        socket.on('connect_error', (error) => {
          console.error('❌ [Ride Management] Socket connection error:', error);
          setSocketConnected(false);
        });
      }
    }
    
    return () => {
      if (socketRef.current) {
        console.log('🔌 [Ride Management] Disconnecting socket');
        socketService.disconnect();
      }
    };
  }, []);

  // Load initial data
  useEffect(() => {
    loadRides();
    loadBooths();
  }, []);
  
  // Reset retry count when filters change
  useEffect(() => {
    setRetryCount(0);
  }, [filters]);

  // Reload rides when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadRides(true); // Reset pagination
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const loadRides = async (resetPagination = false, isRetry = false) => {
    try {
      setLoading(true);
      if (!isRetry) {
        setError(null);
      }
      
      // Check authentication first
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        console.error('🔍 [Ride Management] No admin token found');
        setError('Authentication required. Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/admin/login';
        }, 2000);
        return;
      }

      const queryParams = {
        ...filters,
        limit: pagination.limit,
        skip: resetPagination ? 0 : pagination.skip
      };

      console.log('🔍 [Ride Management] Loading rides with filters:', queryParams);

      const response = await api.admin.getRides(queryParams);
      
      console.log('🔍 [Ride Management] API Response:', response);
      console.log('🔍 [Ride Management] Response type:', typeof response);
      console.log('🔍 [Ride Management] Response keys:', Object.keys(response || {}));
      
      // Initialize with safe defaults
      let ridesData = [];
      let paginationData = { total: 0, hasMore: false };
      
      // Simple, robust parsing logic
      try {
        if (response && response.data && response.data.success) {
          // Standard success response: { data: { success: true, data: { rides: [...], pagination: {...} } } }
          const responseData = response.data.data;
          ridesData = Array.isArray(responseData?.rides) ? responseData.rides : [];
          paginationData = responseData?.pagination || { total: ridesData.length, hasMore: false };
        } else if (response && response.success) {
          // Direct success response: { success: true, data: { rides: [...], pagination: {...} } }
          ridesData = Array.isArray(response.data?.rides) ? response.data.rides : [];
          paginationData = response.data?.pagination || { total: ridesData.length, hasMore: false };
        } else if (Array.isArray(response)) {
          // Direct array response
          ridesData = response;
          paginationData = { total: response.length, hasMore: false };
        } else {
          console.error('🔍 [Ride Management] Unexpected response structure:', response);
          ridesData = [];
          paginationData = { total: 0, hasMore: false };
        }
        
        // Ensure ridesData is always an array
        if (!Array.isArray(ridesData)) {
          console.warn('🔍 [Ride Management] ridesData is not an array, defaulting to empty array:', ridesData);
          ridesData = [];
        }
        
      } catch (parseError) {
        console.error('🔍 [Ride Management] Error parsing response:', parseError);
        ridesData = [];
        paginationData = { total: 0, hasMore: false };
      }
      
      console.log('🔍 [Ride Management] Processed rides:', ridesData.length);
      console.log('🔍 [Ride Management] Sample ride:', ridesData[0]);
      
      if (resetPagination) {
        // Ensure ridesData is an array before setting state
        const safeRidesData = Array.isArray(ridesData) ? ridesData : [];
        setRides(safeRidesData);
        setPagination(prev => ({
          ...prev,
          skip: 0,
          total: paginationData.total || safeRidesData.length,
          hasMore: paginationData.hasMore || false
        }));
      } else {
        setRides(prev => {
          // Ensure both prev and ridesData are arrays before spreading
          const safePrev = Array.isArray(prev) ? prev : [];
          const safeRidesData = Array.isArray(ridesData) ? ridesData : [];
          const updated = [...safePrev, ...safeRidesData];
          return updated;
        });
        setPagination(prev => ({
          ...prev,
          skip: (prev?.skip || 0) + (Array.isArray(ridesData) ? ridesData.length : 0),
          total: paginationData.total || ((prev?.total || 0) + (Array.isArray(ridesData) ? ridesData.length : 0)),
          hasMore: paginationData.hasMore || false
        }));
      }
    } catch (error) {
      console.error('🔍 [Ride Management] Error loading rides:', error);
      
      // Handle specific error types
      if (error.status === 401) {
        console.error('🔍 [Ride Management] Authentication failed - redirecting to login');
        localStorage.removeItem('adminToken');
        // Clear invalid state
        setRides([]);
        setPagination({ total: 0, limit: 50, skip: 0, hasMore: false });
        window.location.href = '/admin/login';
        return;
      }
      
      // Set error state for user feedback
      const errorMsg = error.status === 500 
        ? 'Server error. Please try again in a moment.'
        : 'Failed to load rides. Please check your connection.';
      setError(errorMsg);
      
      // Reset to safe state on error
      if (resetPagination) {
        setRides([]);
        setPagination({ total: 0, limit: 50, skip: 0, hasMore: false });
      }
      
      // Auto-retry logic
      if (retryCount < 2) {
        console.log('🔍 [Ride Management] Auto-retrying in 3 seconds...', retryCount + 1);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadRides(resetPagination, true);
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadBooths = async () => {
    try {
      console.log('🏢 [Ride Management] Loading booths...');
      const response = await api.admin.getBoothsList();
      console.log('🏢 [Ride Management] Booths response:', response);
      
      // Simple, robust parsing for booths
      let boothsData = [];
      
      try {
        if (response && response.data && response.data.success) {
          boothsData = Array.isArray(response.data.data?.booths) ? response.data.data.booths : [];
        } else if (response && response.success) {
          boothsData = Array.isArray(response.data?.booths) ? response.data.booths : [];
        } else if (Array.isArray(response)) {
          boothsData = response;
        } else {
          console.error('🏢 [Ride Management] Unexpected booths response structure:', response);
          boothsData = [];
        }
        
        // Ensure boothsData is always an array
        if (!Array.isArray(boothsData)) {
          console.warn('🏢 [Ride Management] boothsData is not an array, defaulting to empty array:', boothsData);
          boothsData = [];
        }
        
      } catch (parseError) {
        console.error('🏢 [Ride Management] Error parsing booths response:', parseError);
        boothsData = [];
      }
      
      setBooths(boothsData);
      console.log('🏢 [Ride Management] Booths loaded:', boothsData.length);
    } catch (error) {
      console.error('🏢 [Ride Management] Error loading booths:', error);
      
      if (error.status === 401) {
        console.error('🏢 [Ride Management] Authentication failed for booths');
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
        return;
      }
      
      // Continue with empty booths list on error  
      setBooths([]);
      console.warn('🏢 [Ride Management] Continuing with empty booths list due to error');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      booth: 'all',
      status: 'all',
      startDate: '',
      endDate: '',
      searchQuery: ''
    });
  };

  // Handle real-time ride updates
  const handleRealTimeUpdate = (updateData) => {
    const { type, data } = updateData;
    console.log('🔄 [Ride Management] Processing real-time update:', type, data);
    
    // Update last update time
    setLastUpdate(new Date());
    
    switch (type) {
      case 'newRideRequest':
        // Add new ride to the beginning of the list if it matches current filters
        if (shouldShowRide(data)) {
          setRides(prev => {
            const safePrev = Array.isArray(prev) ? prev : [];
            // Check if ride already exists to avoid duplicates
            const exists = safePrev.some(ride => ride._id === data.rideId);
            if (!exists) {
              const newRide = formatRideData(data);
              return [newRide, ...safePrev];
            }
            return safePrev;
          });
          
          // Update pagination total
          setPagination(prev => ({
            ...prev,
            total: (prev.total || 0) + 1
          }));
        }
        break;
        
      case 'rideAccepted':
      case 'rideStarted':
      case 'rideCompleted':
      case 'rideCancelled':
      case 'rideStatusUpdated':
        // Update existing ride in the list
        setRides(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return safePrev.map(ride => {
            if (ride._id === data.rideId || ride.rideId === data.uniqueRideId) {
              return {
                ...ride,
                status: data.status || data.newStatus,
                driverName: data.driverName || ride.driverName,
                updatedAt: data.timestamp || data.updatedAt || new Date().toISOString(),
                queueNumber: data.queueNumber || ride.queueNumber
              };
            }
            return ride;
          });
        });
        break;
        
      default:
        console.log('🔄 [Ride Management] Unknown update type:', type);
    }
  };

  // Check if a ride should be shown based on current filters
  const shouldShowRide = (rideData) => {
    const { booth, status } = filters;
    
    // Check booth filter
    if (booth && booth !== 'all') {
      const rideBooth = typeof rideData.pickupLocation === 'object' 
        ? rideData.pickupLocation.boothName 
        : rideData.pickupLocation;
      if (rideBooth !== booth) return false;
    }
    
    // Check status filter
    if (status && status !== 'all') {
      if (rideData.status !== status) return false;
    }
    
    return true;
  };

  // Format ride data from real-time updates to match expected structure
  const formatRideData = (data) => {
    return {
      _id: data.rideId,
      rideId: data.uniqueRideId || data.rideId,
      status: data.status,
      pickupLocation: data.pickupLocation,
      destination: data.dropLocation?.address || data.destination,
      userId: { name: data.userName, phone: data.userPhone },
      driverId: data.driverName ? { name: data.driverName } : null,
      estimatedFare: data.estimatedFare,
      distance: data.distance,
      vehicleType: data.vehicleType,
      queueNumber: data.queueNumber,
      createdAt: data.createdAt || new Date().toISOString()
    };
  };

  const viewRideDetails = async (rideId) => {
    try {
      const response = await api.admin.getRideDetails(rideId);
      
      // Handle different response structures
      let rideData;
      
      if (response?.data?.success) {
        rideData = response.data.data;
      } else if (response?.success) {
        rideData = response.data || response;
      } else if (response?._id) {
        rideData = response;
      } else {
        console.error('Unexpected ride details response:', response);
        alert('Failed to load ride details');
        return;
      }
      
      setSelectedRide(rideData);
      setShowDetails(true);
    } catch (error) {
      console.error('Error loading ride details:', error);
      
      if (error.status === 401) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
        return;
      }
      
      alert('Failed to load ride details. Please try again.');
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      driver_assigned: 'bg-blue-100 text-blue-800',
      ride_started: 'bg-green-100 text-green-800',
      ride_ended: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const statusLabels = {
      pending: 'Pending',
      driver_assigned: 'Driver Assigned',
      ride_started: 'In Progress',
      ride_ended: 'Completed',
      cancelled: 'Cancelled'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'No date';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid date';
    }
  };

  const loadMoreRides = () => {
    if (pagination?.hasMore && !loading) {
      loadRides(false);
    }
  };

  // Debug logging
  console.log('🔍 [Ride Management] Component render:', {
    rides: Array.isArray(rides) ? rides.length : 'NOT_ARRAY',
    ridesType: typeof rides,
    booths: Array.isArray(booths) ? booths.length : 'NOT_ARRAY',
    boothsType: typeof booths,
    loading,
    filters,
    pagination
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-gray-900">Ride Management</h1>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className={`text-sm font-medium ${socketConnected ? 'text-green-600' : 'text-red-600'}`}>
                {socketConnected ? 'Live' : 'Offline'}
              </span>
              {lastUpdate && socketConnected && (
                <span className="text-xs text-gray-500">
                  Updated {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => loadRides(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <MdRefresh />
              <span>Refresh</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <MdDownload />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-900">{pagination?.total || 0}</div>
            <div className="text-sm text-gray-600">Total Rides</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {Array.isArray(rides) ? rides.filter(r => r?.status === 'ride_ended').length : 0}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">
              {Array.isArray(rides) ? rides.filter(r => ['pending', 'driver_assigned', 'ride_started'].includes(r?.status)).length : 0}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">
              {Array.isArray(rides) ? rides.filter(r => r?.status === 'cancelled').length : 0}
            </div>
            <div className="text-sm text-gray-600">Cancelled</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Booth Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booth</label>
            <select
              value={filters.booth}
              onChange={(e) => handleFilterChange('booth', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Booths</option>
              {Array.isArray(booths) && booths.slice(0, 20).map((booth) => (
                <option key={booth?.name || booth?.id || Math.random()} value={booth?.name || booth?.id}>
                  {booth?.name || booth?.id || 'Unknown'} ({booth?.totalRides || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="driver_assigned">Driver Assigned</option>
              <option value="ride_started">In Progress</option>
              <option value="ride_ended">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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

      {/* Rides Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ride Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pickup Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Queue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.isArray(rides) && rides.map((ride, index) => {
                if (!ride || !ride._id) {
                  console.warn('🔍 [Ride Management] Invalid ride data at index:', index, ride);
                  return null;
                }
                
                // Safe data extraction
                const rideId = ride.rideId || ride._id?.slice(-8) || 'Unknown';
                const destination = ride.destination || 'No destination';
                const pickupLocation = ride.pickupLocation;
                const locationName = typeof pickupLocation === 'object' 
                  ? (pickupLocation?.boothName || 'Unknown') 
                  : (pickupLocation || 'Unknown');
                const userName = ride.userId?.name || ride.user?.name || 'Unknown User';
                const userPhone = ride.userId?.phone || ride.user?.phone || '';
                const driverName = ride.driverId?.name || ride.driver?.name || '';
                const vehicleNumber = ride.driverId?.vehicleNumber || ride.driverId?.vehicleNo || ride.driver?.vehicleNumber || '';
                const status = ride.status || 'unknown';
                const queueNumber = ride.queueNumber || '';
                const queuePosition = ride.queuePosition || '';
                const createdAt = ride.createdAt || ride.bookingTime || null;
                
                return (
                <tr key={ride._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{rideId}
                    </div>
                    <div className="text-sm text-gray-500">
                      To: {destination}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      {ride.estimatedFare && (
                        <span className="text-xs font-semibold text-green-600">
                          ₹{ride.estimatedFare}
                        </span>
                      )}
                      {ride.vehicleType && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {ride.vehicleType.charAt(0).toUpperCase() + ride.vehicleType.slice(1)}
                        </span>
                      )}
                    </div>
                    {createdAt && (
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDateTime(createdAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FaMapMarkerAlt className="text-red-500 mr-2" />
                      <div className="text-sm text-gray-900">
                        {locationName}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FaUser className="text-blue-500 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {userName}
                        </div>
                        {userPhone && (
                          <div className="text-sm text-gray-500">
                            {userPhone}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {driverName ? (
                      <div className="flex items-center">
                        <FaCar className="text-green-500 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {driverName}
                          </div>
                          {vehicleNumber && (
                            <div className="text-sm text-gray-500">
                              {vehicleNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse"></div>
                        <span className="text-sm text-orange-600 font-medium">Searching driver...</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {queueNumber ? (
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{queueNumber}</div>
                        {queuePosition && (
                          <div className="text-gray-500">Pos: #{queuePosition}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No queue</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FaClock className="text-gray-400 mr-2" />
                      <div className="text-sm text-gray-900">
                        {createdAt ? formatDateTime(createdAt) : 'No date'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => viewRideDetails(ride._id)}
                      className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                    >
                      <FaEye />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
                );
              }).filter(Boolean)}
            </tbody>
          </table>
        </div>

        {/* Load More Button */}
        {!error && pagination?.hasMore && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <button
              onClick={loadMoreRides}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Loading...' : `Load More Rides (${(pagination?.total || 0) - (Array.isArray(rides) ? rides.length : 0)} remaining)`}
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mx-4">
              <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Data</h3>
              <p className="text-red-600 mb-4">{error}</p>
              {retryCount >= 2 && (
                <button
                  onClick={() => {
                    setRetryCount(0);
                    loadRides(true);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry Now
                </button>
              )}
              {retryCount < 2 && (
                <p className="text-sm text-red-500">
                  Retrying automatically... (Attempt {retryCount + 1}/3)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && (!Array.isArray(rides) || rides.length === 0) && (
          <div className="text-center py-12">
            <FaSearch className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No rides found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search filters or check back later.
            </p>
            <button
              onClick={() => loadRides(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        )}
      </div>

      {/* Ride Details Modal */}
      {showDetails && selectedRide && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Ride Details - {selectedRide.rideId || selectedRide._id.slice(-8)}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedRide.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Vehicle Type</label>
                  <div className="mt-1 text-sm text-gray-900 capitalize">
                    {selectedRide.vehicleType || 'N/A'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Created</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {formatDateTime(selectedRide.createdAt)}
                  </div>
                </div>
              </div>

              {/* Financial Info */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Financial Details</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Estimated Fare</label>
                    <div className="mt-1 text-sm font-semibold text-green-600">
                      ₹{selectedRide.estimatedFare || selectedRide.fare || 0}
                    </div>
                  </div>
                  {selectedRide.actualFare && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Actual Fare</label>
                      <div className="mt-1 text-sm font-semibold text-green-600">
                        ₹{selectedRide.actualFare}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Distance</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedRide.distance ? `${selectedRide.distance} km` : 'N/A'}
                    </div>
                  </div>
                  {selectedRide.paymentStatus && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Payment Status</label>
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          selectedRide.paymentStatus === 'collected' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedRide.paymentStatus}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Location Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Pickup Location</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {typeof selectedRide.pickupLocation === 'object' 
                      ? selectedRide.pickupLocation.boothName || 'Unknown' 
                      : selectedRide.pickupLocation || 'Unknown'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Destination</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedRide.destination || 'Not specified'}
                  </div>
                </div>
              </div>

              {/* Queue Info */}
              {selectedRide.queueNumber && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Queue Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Queue Number</label>
                      <div className="mt-1 text-sm text-gray-900">{selectedRide.queueNumber}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Position</label>
                      <div className="mt-1 text-sm text-gray-900">#{selectedRide.queuePosition}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* OTP Info */}
              {(selectedRide.startOTP || selectedRide.endOTP) && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">OTP Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedRide.startOTP && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Start OTP</label>
                        <div className="mt-1 text-sm font-mono text-gray-900">{selectedRide.startOTP}</div>
                      </div>
                    )}
                    {selectedRide.endOTP && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">End OTP</label>
                        <div className="mt-1 text-sm font-mono text-gray-900">{selectedRide.endOTP}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* User & Driver Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">User Information</h4>
                  {selectedRide.userId ? (
                    <div>
                      <div className="text-sm font-medium">{selectedRide.userId.name}</div>
                      <div className="text-sm text-gray-600">{selectedRide.userId.phone}</div>
                      <div className="text-sm text-gray-600">{selectedRide.userId.email}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">User information not available</div>
                  )}
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Driver Information</h4>
                  {selectedRide.driverId ? (
                    <div>
                      <div className="text-sm font-medium">{selectedRide.driverId.name}</div>
                      <div className="text-sm text-gray-600">{selectedRide.driverId.vehicleNumber || selectedRide.driverId.vehicleNo}</div>
                      <div className="text-sm text-gray-600">{selectedRide.driverId.phone}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No driver assigned</div>
                  )}
                </div>
              </div>

              {/* Ride Timeline */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Ride Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Ride Created</div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(selectedRide.createdAt || selectedRide.timestamp)}
                      </div>
                    </div>
                  </div>
                  
                  {selectedRide.acceptedAt && (
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Driver Assigned</div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(selectedRide.acceptedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedRide.rideStartedAt && (
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Ride Started</div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(selectedRide.rideStartedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedRide.rideEndedAt && (
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Ride Ended</div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(selectedRide.rideEndedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedRide.completedAt && (
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-600 rounded-full mr-3"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Ride Completed</div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(selectedRide.completedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedRide.cancelledAt && (
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Ride Cancelled</div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(selectedRide.cancelledAt)}
                        </div>
                        {selectedRide.cancellationReason && (
                          <div className="text-xs text-red-600 mt-1">
                            Reason: {selectedRide.cancellationReason}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideManagement;