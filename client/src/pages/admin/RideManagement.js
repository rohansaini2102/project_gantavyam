import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaFilter, FaEye, FaMapMarkerAlt, FaClock, FaUser, FaCar, FaChartLine } from 'react-icons/fa';
import { MdRefresh, MdDownload } from 'react-icons/md';
import * as api from '../../services/api';
import socketService from '../../services/socket';
import DriverStatusIndicator from '../../components/admin/DriverStatusIndicator';
import RideStatusTimeline from '../../components/admin/RideStatusTimeline';
import RideFinancialDetails from '../../components/admin/RideFinancialDetails';
import FinancialSummary from '../../components/admin/FinancialSummary';

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
  const [rideStats, setRideStats] = useState({
    total: 0,
    completed: 0,
    active: 0,
    cancelled: 0
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [showFinancialDashboard, setShowFinancialDashboard] = useState(false);
  const socketRef = useRef(null);

  // Initialize socket connection for real-time updates
  useEffect(() => {
    const initializeAdminSocket = async () => {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        console.error('🔌 [Ride Management] No admin token found for socket connection');
        return;
      }

      console.log('🔌 [Ride Management] Initializing admin socket connection');
      socketRef.current = socketService;

      try {
        // socketService.initialize() returns a Promise that resolves to the socket
        const socket = await socketService.initialize(adminToken);

        if (socket && socket.connected) {
          console.log('✅ [Ride Management] Socket initialized successfully');
          setSocketConnected(true);

          // Set up event listeners for admin-specific events
          // Primary event: rideUpdate (sent to admins room)
          socket.on('rideUpdate', (updateData) => {
            console.log('📢 [Ride Management] Real-time rideUpdate received:', updateData);
            if (updateData.type === 'newRideRequest') {
              console.log('🚨 [NEW RIDE DEBUG] Admin received new ride via rideUpdate:', updateData.data);
            }
            // updateData structure: { type: eventType, data: eventData, timestamp: ... }
            handleRealTimeUpdate(updateData);
          });

          // Fallback: Listen to direct events as well (for compatibility)
          socket.on('newRideRequest', (data) => {
            console.log('📢 [Ride Management] Direct newRideRequest received:', data);
            console.log('🚨 [NEW RIDE DEBUG] Admin received new ride via direct event:', data);
            handleRealTimeUpdate({ type: 'newRideRequest', data });
          });

          socket.on('rideAccepted', (data) => {
            console.log('📢 [Ride Management] Direct rideAccepted received:', data);
            handleRealTimeUpdate({ type: 'rideAccepted', data });
          });

          socket.on('rideStarted', (data) => {
            console.log('📢 [Ride Management] Direct rideStarted received:', data);
            handleRealTimeUpdate({ type: 'rideStarted', data });
          });

          socket.on('rideCompleted', (data) => {
            console.log('📢 [Ride Management] Direct rideCompleted received:', data);
            handleRealTimeUpdate({ type: 'rideCompleted', data });
          });

          socket.on('rideEnded', (data) => {
            console.log('📢 [Ride Management] Direct rideEnded received:', data);
            handleRealTimeUpdate({ type: 'rideEnded', data });
          });

          socket.on('rideCancelled', (data) => {
            console.log('📢 [Ride Management] Direct rideCancelled received:', data);
            handleRealTimeUpdate({ type: 'rideCancelled', data });
          });

          socket.on('connect', () => {
            console.log('✅ [Ride Management] Socket reconnected');
            setSocketConnected(true);
          });

          socket.on('disconnect', () => {
            console.log('🔌 [Ride Management] Socket disconnected');
            setSocketConnected(false);
          });
        } else {
          console.warn('⚠️ [Ride Management] Socket initialized but not connected');
          setSocketConnected(false);
        }
      } catch (error) {
        console.error('❌ [Ride Management] Failed to initialize socket:', error);
        setSocketConnected(false);
      }
    };

    initializeAdminSocket();

    // Cleanup on unmount
    return () => {
      if (socketRef.current && socketRef.current.socket) {
        console.log('🔌 [Ride Management] Cleaning up socket listeners');
        socketRef.current.socket.off('rideUpdate');
        socketRef.current.socket.off('newRideRequest');
        socketRef.current.socket.off('rideAccepted');
        socketRef.current.socket.off('rideStarted');
        socketRef.current.socket.off('rideCompleted');
        socketRef.current.socket.off('rideEnded');
        socketRef.current.socket.off('rideCancelled');
        socketRef.current.socket.off('connect');
        socketRef.current.socket.off('disconnect');
      }
    };
  }, []);

  // Handle real-time updates from socket
  const handleRealTimeUpdate = (updateData) => {
    console.log('🔄 [Ride Management] Processing real-time update:', updateData.type);

    const { type, data } = updateData;

    switch (type) {
      case 'newRideRequest':
        // Add new ride to the beginning of the list
        setRides(prevRides => {
          // Check if ride already exists (prevent duplicates)
          const existingIndex = prevRides.findIndex(r =>
            (r._id === data._id) ||
            (r.rideId === data.rideId)
          );

          if (existingIndex !== -1) {
            // Update existing ride
            const updatedRides = [...prevRides];
            updatedRides[existingIndex] = data;
            return updatedRides;
          } else {
            // Add new ride
            return [data, ...prevRides];
          }
        });

        // Update stats
        setRideStats(prev => ({
          ...prev,
          total: prev.total + 1,
          active: prev.active + 1
        }));
        break;

      case 'rideAccepted':
      case 'rideStarted':
      case 'rideCompleted':
      case 'rideEnded':
      case 'rideCancelled':
        // Update existing ride in the list
        setRides(prevRides => prevRides.map(ride => {
          if ((ride._id === data._id) || (ride.rideId === data.rideId)) {
            return { ...ride, ...data };
          }
          return ride;
        }));

        // Update selected ride if it's the one being updated
        if (selectedRide && ((selectedRide._id === data._id) || (selectedRide.rideId === data.rideId))) {
          setSelectedRide(prev => ({ ...prev, ...data }));
        }

        // Update stats based on status changes
        if (type === 'rideCompleted' || type === 'rideEnded') {
          setRideStats(prev => ({
            ...prev,
            active: Math.max(0, prev.active - 1),
            completed: prev.completed + 1
          }));
        } else if (type === 'rideCancelled') {
          setRideStats(prev => ({
            ...prev,
            active: Math.max(0, prev.active - 1),
            cancelled: prev.cancelled + 1
          }));
        }
        break;

      default:
        console.log('Unknown update type:', type);
    }

    setLastUpdate(new Date());
  };

  // Fetch booths
  useEffect(() => {
    fetchBooths();
  }, []);

  const fetchBooths = async () => {
    try {
      const response = await api.getMetroStations();
      if (response.success && response.data.stations) {
        setBooths(response.data.stations);
      }
    } catch (error) {
      console.error('Error fetching booths:', error);
    }
  };

  // Fetch rides with filters
  useEffect(() => {
    let isMounted = true;

    const fetchRidesWithRetry = async (attemptCount = 0) => {
      if (!isMounted) return;

      try {
        setLoading(true);
        setError(null);

        console.log(`🔍 [Ride Management] Fetching rides (attempt ${attemptCount + 1})...`);

        const params = {
          ...filters,
          skip: pagination.skip,
          limit: pagination.limit
        };

        const response = await api.getAdminRides(params);

        if (response.success) {
          if (isMounted) {
            // Ensure rides is always an array
            const ridesData = Array.isArray(response.data?.rides) ? response.data.rides :
              Array.isArray(response.data) ? response.data : [];

            console.log(`✅ [Ride Management] Successfully loaded ${ridesData.length} rides`);

            setRides(ridesData);

            // Update pagination
            if (response.data?.pagination) {
              setPagination(prev => ({
                ...prev,
                total: response.data.pagination.total || ridesData.length,
                hasMore: response.data.pagination.hasMore || false
              }));
            }

            // Update stats
            if (response.data?.stats) {
              setRideStats(response.data.stats);
            }

            setError(null);
            setRetryCount(0);
          }
        } else {
          throw new Error(response.message || 'Failed to fetch rides');
        }
      } catch (error) {
        console.error(`❌ [Ride Management] Error fetching rides:`, error);

        if (isMounted) {
          if (attemptCount < 2) {
            console.log(`🔄 [Ride Management] Retrying in 2 seconds...`);
            setTimeout(() => {
              if (isMounted) {
                setRetryCount(attemptCount + 1);
                fetchRidesWithRetry(attemptCount + 1);
              }
            }, 2000);
          } else {
            setError(`Failed to load rides: ${error.message}. Please refresh the page.`);
            setRides([]);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRidesWithRetry(0);

    return () => {
      isMounted = false;
    };
  }, [filters, pagination.skip, pagination.limit]);

  // Fetch ride stats
  useEffect(() => {
    fetchRideStats();
    const interval = setInterval(fetchRideStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [filters]);

  const fetchRideStats = async () => {
    try {
      setStatsLoading(true);
      const response = await api.getRideStats(filters);
      if (response.success) {
        setRideStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching ride stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, skip: 0 }));
  };

  const handleSearch = (e) => {
    setFilters(prev => ({
      ...prev,
      searchQuery: e.target.value
    }));
    setPagination(prev => ({ ...prev, skip: 0 }));
  };

  const viewRideDetails = async (rideId) => {
    try {
      console.log('👁️ [Ride Management] Viewing ride details:', rideId);

      // First try to find the ride in our local list
      const localRide = rides.find(r => r._id === rideId);

      if (localRide) {
        setSelectedRide(localRide);
        setShowDetails(true);
      } else {
        // If not found locally, fetch from server
        const response = await api.getRideDetails(rideId);
        if (response.success) {
          setSelectedRide(response.data);
          setShowDetails(true);
        } else {
          console.error('Failed to fetch ride details:', response.message);
        }
      }
    } catch (error) {
      console.error('Error viewing ride details:', error);
    }
  };

  // Safe Fare Calculation Helper Functions
  const safeNumber = (value, defaultValue = 0) => {
    const num = parseFloat(value);
    return isNaN(num) || num === null || num === undefined ? defaultValue : num;
  };

  const getBaseFare = (ride) => {
    if (!ride) return 0;
    const fare = safeNumber(ride.driverFare) || safeNumber(ride.fare) || safeNumber(ride.actualFare);
    return Math.max(0, fare);
  };

  const getCustomerTotal = (ride) => {
    if (!ride) return 0;
    const total = safeNumber(ride.customerFare) || safeNumber(ride.estimatedFare) || safeNumber(ride.totalFare) || safeNumber(ride.fare);
    return Math.max(0, total);
  };

  // Get the best available fare amount - prioritize customer fare for admin view
  const getFareAmount = (ride) => {
    if (!ride) return 0;

    // For admin panel, prioritize customer fare (what customer actually pays)
    // Fallback to estimated fare or other fare fields for older rides
    const possibleFares = [
      ride.customerFare,          // What customer pays (includes GST, commission)
      ride.estimatedFare,         // Initial estimate (fallback for older rides)
      ride.actualFare,           // Actual completed fare
      ride.totalFare,            // Total fare
      ride.fareBreakdown?.total, // Fare breakdown total
      ride.fare,                 // Legacy fare field (driver earnings)
      ride.driverFare            // Driver earnings (last resort)
    ];

    // Find the first non-zero, valid fare value
    for (const fare of possibleFares) {
      const value = safeNumber(fare);
      if (value > 0) {
        return value;
      }
    }

    return 0;
  };

  const calculateCommission = (ride) => {
    if (!ride) return 0;

    // Use existing commission if available
    if (ride.commissionAmount !== undefined && ride.commissionAmount !== null) {
      return Math.max(0, safeNumber(ride.commissionAmount));
    }

    // Calculate 10% commission on base fare
    const baseFare = getBaseFare(ride);
    return Math.round(baseFare * 0.1);
  };

  const calculateGST = (ride) => {
    if (!ride) return 0;

    // Use existing GST if available
    if (ride.gstAmount !== undefined && ride.gstAmount !== null) {
      return Math.max(0, safeNumber(ride.gstAmount));
    }

    // Calculate 5% GST on (base fare + commission)
    const baseFare = getBaseFare(ride);
    const commission = calculateCommission(ride);
    return Math.round((baseFare + commission) * 0.05);
  };

  const getNightCharge = (ride) => {
    if (!ride) return 0;
    return Math.max(0, safeNumber(ride.nightChargeAmount));
  };

  const calculatePlatformEarnings = (ride) => {
    if (!ride) return 0;

    const commission = calculateCommission(ride);
    const gst = calculateGST(ride);
    const nightCharge = getNightCharge(ride);

    return commission + gst + nightCharge;
  };

  const getSurgeFactor = (ride) => {
    if (!ride || !ride.surgeFactor) return 1.0;
    const factor = safeNumber(ride.surgeFactor, 1.0);
    return Math.max(1.0, factor);
  };

  const getDistance = (ride) => {
    if (!ride || !ride.distance) return 'N/A';
    const distance = safeNumber(ride.distance);
    return distance > 0 ? `${distance.toFixed(2)} km` : 'N/A';
  };

  const formatCurrency = (amount) => {
    const value = safeNumber(amount);
    if (value === 0) return '₹0';
    if (value < 0) return '-₹' + Math.abs(value);
    return '₹' + value;
  };

  const fareHasError = (ride) => {
    if (!ride) return true;

    const baseFare = getBaseFare(ride);
    const customerTotal = getCustomerTotal(ride);
    const platformEarnings = calculatePlatformEarnings(ride);

    // Check if calculations make sense
    if (baseFare === 0 && customerTotal === 0) return true;
    if (customerTotal > 0 && baseFare === 0) return true;

    // Check if platform earnings + driver fare roughly equals customer total
    const calculatedTotal = baseFare + platformEarnings;
    const difference = Math.abs(calculatedTotal - customerTotal);

    // Allow small rounding differences (up to ₹5)
    if (customerTotal > 0 && difference > 5) {
      return true;
    }

    return false;
  };
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⏳' },
      driver_assigned: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '👤' },
      ride_started: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: '🚗' },
      ride_ended: { bg: 'bg-purple-100', text: 'text-purple-800', icon: '📍' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', icon: '✅' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: '❌' }
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: '❓' };

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <span>{config.icon}</span>
        {status?.replace('_', ' ').charAt(0).toUpperCase() + status?.slice(1).replace('_', ' ')}
      </span>
    );
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRefresh = () => {
    setPagination(prev => ({ ...prev, skip: 0 }));
    fetchRideStats();
  };

  const handleLoadMore = () => {
    setPagination(prev => ({
      ...prev,
      skip: prev.skip + prev.limit
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Ride Management</h1>
              {socketConnected ? (
                <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Live
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  Offline
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFinancialDashboard(!showFinancialDashboard)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-sm"
              >
                <FaChartLine />
                {showFinancialDashboard ? 'Hide' : 'Show'} Financial Dashboard
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {lastUpdate && (
                <span className="text-sm text-gray-500">
                  Last updated: {formatDateTime(lastUpdate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Financial Dashboard */}
        {showFinancialDashboard && (
          <div className="mb-6">
            <FinancialSummary
              rides={rides}
              onRefresh={handleRefresh}
              loading={loading}
            />
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Rides</p>
                <div className="text-xl font-bold text-gray-900">{rideStats.total}</div>
              </div>
              <div className="p-3 bg-gray-100 rounded-full">
                <FaCar className="text-gray-600 text-lg" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <div className="text-xl font-bold text-green-600">{rideStats.completed}</div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <FaMapMarkerAlt className="text-green-600 text-lg" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <div className="text-xl font-bold text-blue-600">{rideStats.active}</div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <FaClock className="text-blue-600 text-lg" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cancelled</p>
                <div className="text-xl font-bold text-red-600">{rideStats.cancelled}</div>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <FaUser className="text-red-600 text-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, user, driver..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={filters.searchQuery}
                    onChange={handleSearch}
                  />
                </div>
              </div>

              <select
                name="booth"
                value={filters.booth}
                onChange={handleFilterChange}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">All Booths</option>
                {booths.map(booth => (
                  <option key={booth.id} value={booth.name}>
                    {booth.name}
                  </option>
                ))}
              </select>

              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="driver_assigned">Driver Assigned</option>
                <option value="ride_started">Ride Started</option>
                <option value="ride_ended">Ride Ended</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />

              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />

              <button
                onClick={() => setFilters({
                  booth: 'all',
                  status: 'all',
                  startDate: '',
                  endDate: '',
                  searchQuery: ''
                })}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <FaFilter />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Rides Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading && rides.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading rides...</p>
                {retryCount > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Retry attempt {retryCount}/3
                  </p>
                )}
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : rides.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FaCar className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No rides found</p>
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting your filters or check back later
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ride ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      From → To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fare
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
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
                    const driverName = ride.driverId?.name || ride.driverId?.fullName || ride.driver?.name || ride.driverName || '';
                    const vehicleNumber = ride.driverId?.vehicleNumber || ride.driverId?.vehicleNo || ride.driver?.vehicleNumber || ride.driverVehicleNo || '';
                    const status = ride.status || 'unknown';
                    // const queueNumber = ride.queueNumber || ''; // Not used in table layout
                    const queuePosition = ride.queuePosition || '';
                    const createdAt = ride.createdAt || ride.bookingTime || null;

                    return (
                      <tr key={ride._id || ride.rideId || `ride-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">#{rideId}</div>
                              {ride.vehicleType && (
                                <div className="text-xs text-gray-500">
                                  {ride.vehicleType.charAt(0).toUpperCase() + ride.vehicleType.slice(1)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{userName}</div>
                          {userPhone && <div className="text-xs text-gray-500">{userPhone}</div>}
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center">
                              <FaMapMarkerAlt className="text-green-500 text-xs mr-1" />
                              <span className="font-medium">{locationName}</span>
                            </div>
                            <div className="flex items-center mt-1">
                              <FaMapMarkerAlt className="text-red-500 text-xs mr-1" />
                              <span className="text-gray-600 text-xs">{destination}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {ride.driverId ? (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{driverName}</div>
                              {vehicleNumber && <div className="text-xs text-gray-500">{vehicleNumber}</div>}
                              {queuePosition && <div className="text-xs text-blue-600">Queue: #{queuePosition}</div>}
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse"></div>
                              <span className="text-xs text-orange-600">Searching...</span>
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(status)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const fareAmount = getFareAmount(ride);
                            return fareAmount > 0 ? (
                              <div className="text-sm font-semibold text-green-600">
                                ₹{fareAmount}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">-</div>
                            );
                          })()}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {createdAt ? formatDateTime(createdAt) : 'N/A'}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => viewRideDetails(ride._id)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-600 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                          >
                            <FaEye className="mr-1" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Load More Button */}
          {pagination.hasMore && !loading && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleLoadMore}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Load More Rides
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ride Details Modal */}
      {showDetails && selectedRide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Ride Details - #{selectedRide.rideId || selectedRide._id?.slice(-8)}
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Timeline */}
              <RideStatusTimeline ride={selectedRide} />

              {/* Basic Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Ride ID</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedRide.rideId || selectedRide._id}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <div className="mt-1">
                      {getStatusBadge(selectedRide.status)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Vehicle Type</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedRide.vehicleType?.charAt(0).toUpperCase() + selectedRide.vehicleType?.slice(1) || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Booking Time</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {formatDateTime(selectedRide.createdAt || selectedRide.bookingTime)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Details using new component */}
              <RideFinancialDetails ride={selectedRide} showSummary={true} />

              {/* Location Info */}
              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Location Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">📍 Pickup Location</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {typeof selectedRide.pickupLocation === 'object'
                        ? selectedRide.pickupLocation.boothName || 'Unknown'
                        : selectedRide.pickupLocation || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">🎯 Destination</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedRide.destination || 'Not specified'}
                    </div>
                  </div>
                  {selectedRide.distance && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">📏 Distance</label>
                      <div className="mt-1 text-sm text-gray-900">
                        {selectedRide.distance} km
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Queue Info */}
              {selectedRide.queueNumber && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Queue Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Queue Number</label>
                      <div className="mt-1 text-sm text-gray-900">
                        {selectedRide.queueNumber}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Position</label>
                      <div className="mt-1 text-sm text-gray-900">
                        #{selectedRide.queuePosition || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* User Info */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">User Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Name</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedRide.userId?.name || selectedRide.userName || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Phone</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedRide.userId?.mobileNo || selectedRide.userPhone || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Driver Info */}
              {selectedRide.driverId && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Driver Information</h4>
                  <DriverStatusIndicator
                    driver={{
                      ...selectedRide.driverId,
                      fullName: selectedRide.driverId.name || selectedRide.driverId.fullName || selectedRide.driverName,
                      mobileNo: selectedRide.driverId.phone || selectedRide.driverId.mobileNo || selectedRide.driverPhone,
                      vehicleNo: selectedRide.driverId.vehicleNumber || selectedRide.driverId.vehicleNo || selectedRide.driverVehicleNo,
                      queuePosition: selectedRide.queuePosition,
                      currentRide: selectedRide.status === 'ride_started' || selectedRide.status === 'driver_assigned' ? selectedRide._id : null,
                      isOnline: true,
                      vehicleType: selectedRide.driverId.vehicleType || selectedRide.vehicleType,
                      lastActiveTime: selectedRide.driverId.lastActiveTime,
                      totalRides: selectedRide.driverId.totalRides,
                      completedRides: selectedRide.driverId.completedRides,
                      rating: selectedRide.driverId.rating,
                      isAvailable: selectedRide.driverId.isAvailable,
                      paymentStatus: selectedRide.paymentStatus || 'pending'
                    }}
                    showDetails={true}
                    size="large"
                  />
                </div>
              )}

              {/* OTP Info */}
              {selectedRide.otp && (
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Verification</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">OTP</label>
                      <div className="mt-1 text-lg font-mono font-bold text-orange-600">
                        {selectedRide.otp}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Verified</label>
                      <div className="mt-1 text-sm text-gray-900">
                        {selectedRide.otpVerified ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => window.open(`/api/admin/rides/${selectedRide._id}/invoice`, '_blank')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <MdDownload />
                  Download Invoice
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideManagement;
