import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaFilter, FaEye, FaMapMarkerAlt, FaClock, FaUser, FaCar } from 'react-icons/fa';
import { MdRefresh, MdDownload } from 'react-icons/md';
import * as api from '../../services/api';
import socketService from '../../services/socket';
import DriverStatusIndicator from '../../components/admin/DriverStatusIndicator';
import RideStatusTimeline from '../../components/admin/RideStatusTimeline';

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
          
          // Listen to driver status events
          socket.on('driverOnline', (data) => {
            console.log('📢 [Ride Management] Driver online notification:', data);
            handleRealTimeUpdate({ type: 'driverOnline', data });
          });
          
          socket.on('driverOffline', (data) => {
            console.log('📢 [Ride Management] Driver offline notification:', data);
            handleRealTimeUpdate({ type: 'driverOffline', data });
          });
          
          // Listen to registration events
          socket.on('userRegistered', (data) => {
            console.log('📢 [Ride Management] User registration notification:', data);
            handleRealTimeUpdate({ type: 'userRegistered', data });
          });
          
          socket.on('driverRegistered', (data) => {
            console.log('📢 [Ride Management] Driver registration notification:', data);
            handleRealTimeUpdate({ type: 'driverRegistered', data });
          });
          
          // Listen to manual booking events
          socket.on('manualBookingCreated', (data) => {
            console.log('📢 [Ride Management] Manual booking created:', data);
            handleRealTimeUpdate({ type: 'manualBookingCreated', data });
          });
          
          socket.on('rideAssigned', (data) => {
            console.log('📢 [Ride Management] Ride assigned to driver:', data);
            handleRealTimeUpdate({ type: 'rideAssigned', data });
          });
          
          socket.on('connectionSuccess', (data) => {
            console.log('✅ [Ride Management] Admin socket authenticated:', data);
            setSocketConnected(true);
          });

          socket.on('connect', () => {
            console.log('✅ [Ride Management] Socket connected');
            setSocketConnected(true);
          });

          socket.on('disconnect', (reason) => {
            console.warn('❌ [Ride Management] Socket disconnected:', reason);
            setSocketConnected(false);
          });
          
          socket.on('connect_error', (error) => {
            console.error('❌ [Ride Management] Socket connection error:', error);
            setSocketConnected(false);
          });
          
        } else {
          console.error('❌ [Ride Management] Failed to initialize socket or socket not connected');
          setSocketConnected(false);
        }
      } catch (error) {
        console.error('❌ [Ride Management] Error initializing socket:', error);
        setSocketConnected(false);
      }
    };

    // Initialize socket connection
    initializeAdminSocket();
    
    // Cleanup function
    return () => {
      if (socketRef.current) {
        console.log('🔌 [Ride Management] Cleaning up socket connection');
        const socket = socketService.getSocket();
        if (socket) {
          // Remove only the listeners we added
          socket.off('rideUpdate');
          socket.off('newRideRequest');
          socket.off('rideAccepted');
          socket.off('rideStarted');
          socket.off('rideCompleted');
          socket.off('rideEnded');
          socket.off('rideCancelled');
          socket.off('driverOnline');
          socket.off('driverOffline');
          socket.off('userRegistered');
          socket.off('driverRegistered');
          socket.off('manualBookingCreated');
          socket.off('rideAssigned');
          socket.off('connectionSuccess');
          socket.off('connect');
          socket.off('disconnect');
          socket.off('connect_error');
        }
        // Don't disconnect the socket as it might be used by other components
      }
    };
  }, []);

  // Load initial data
  useEffect(() => {
    loadRides();
    loadBooths();
    loadRideStatistics();
  }, []);
  
  // Reset retry count when filters change
  useEffect(() => {
    setRetryCount(0);
  }, [filters]);

  // Reload rides when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadRides(true); // Reset pagination
      loadRideStatistics(); // Refresh statistics when filters change
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

      // Build query params - only include non-empty filters
      const queryParams = {
        limit: pagination.limit,
        skip: resetPagination ? 0 : pagination.skip
      };
      
      // Only add filters that have actual values
      if (filters.booth && filters.booth !== 'all') {
        queryParams.booth = filters.booth;
      }
      if (filters.status && filters.status !== 'all') {
        queryParams.status = filters.status;
      }
      if (filters.startDate && filters.startDate.trim()) {
        queryParams.startDate = filters.startDate;
      }
      if (filters.endDate && filters.endDate.trim()) {
        queryParams.endDate = filters.endDate;
      }
      if (filters.searchQuery && filters.searchQuery.trim()) {
        queryParams.searchQuery = filters.searchQuery;
      }

      console.log('🔍 [Ride Management] Loading rides with filters:', queryParams);
      console.log('🔍 [Ride Management] Original filters state:', filters);
      console.log('🔍 [Ride Management] Query will include date filters:', !!queryParams.startDate || !!queryParams.endDate);

      const response = await api.admin.getRides(queryParams);
      
      console.log('🔍 [Ride Management] API Response:', response);
      console.log('🔍 [Ride Management] Response type:', typeof response);
      console.log('🔍 [Ride Management] Response keys:', Object.keys(response || {}));
      
      // Initialize with safe defaults
      let ridesData = [];
      let paginationData = { total: 0, hasMore: false };
      
      // Parse standardized response: { success: true, data: { rides: [...], pagination: {...} } }
      if (response && response.success && response.data) {
        ridesData = Array.isArray(response.data.rides) ? response.data.rides : [];
        paginationData = response.data.pagination || { total: ridesData.length, hasMore: false };
        
        console.log('🔍 [Ride Management] Parsed response:', {
          ridesCount: ridesData.length,
          totalRides: paginationData.total,
          hasMore: paginationData.hasMore
        });
        
        // DEBUG: Log destination data for rides
        console.log('🔍 [DEBUG] Frontend ride destinations:');
        ridesData.slice(0, 3).forEach((ride, index) => {
          console.log(`  Ride ${index + 1}:`, {
            id: ride._id,
            destination: ride.destination,
            hasDestination: !!ride.destination,
            dropLocation: ride.dropLocation,
            pickupLocation: ride.pickupLocation
          });
        });
      } else {
        console.error('🔍 [Ride Management] Invalid response format:', response);
        ridesData = [];
        paginationData = { total: 0, hasMore: false };
      }
      
      console.log('🔍 [Ride Management] Processed rides:', ridesData.length);
      console.log('🔍 [Ride Management] Sample ride:', ridesData[0]);
      
      if (resetPagination) {
        // Ensure ridesData is an array before setting state and deduplicate
        const safeRidesData = Array.isArray(ridesData) ? ridesData : [];
        setRides(deduplicateRides(safeRidesData));
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
          const combined = [...safePrev, ...safeRidesData];
          return deduplicateRides(combined);
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

  const loadRideStatistics = async () => {
    try {
      setStatsLoading(true);
      console.log('📊 [Ride Management] Loading ride statistics...');
      
      // Use the ride analytics endpoint to get accurate counts
      const response = await api.admin.getRideAnalytics();
      console.log('📊 [Ride Management] Statistics response:', response);
      
      if (response && response.success && response.data) {
        const stats = response.data;
        const ridesByStatus = stats.ridesByStatus || {};
        
        // Calculate active rides (pending + driver_assigned + ride_started)
        const activeRides = (ridesByStatus.pending || 0) + 
                           (ridesByStatus.driver_assigned || 0) + 
                           (ridesByStatus.ride_started || 0);
        
        // Calculate completed rides (ride_ended + completed)
        const completedRides = (ridesByStatus.ride_ended || 0) + 
                              (ridesByStatus.completed || 0);
        
        setRideStats({
          total: stats.totalRides || 0,
          completed: completedRides,
          active: activeRides,
          cancelled: ridesByStatus.cancelled || 0
        });
        
        console.log('📊 [Ride Management] Statistics loaded:', {
          total: stats.totalRides,
          completed: completedRides,
          active: activeRides,
          cancelled: ridesByStatus.cancelled || 0,
          ridesByStatus: ridesByStatus
        });
      } else {
        // Fallback: try direct rides endpoint to get counts
        console.log('📊 [Ride Management] Analytics endpoint structure unexpected, using fallback...');
        
        // Get total count from main rides endpoint
        const totalResponse = await api.admin.getRides({ limit: 1 });
        const totalRides = totalResponse?.data?.pagination?.total || 0;
        
        // If we have rides, estimate the distribution (this is a fallback)
        if (totalRides > 0) {
          // Load first page to get a sample of statuses
          const sampleResponse = await api.admin.getRides({ limit: 100 });
          const sampleRides = sampleResponse?.data?.rides || [];
          
          // Count statuses in sample
          const statusCounts = sampleRides.reduce((acc, ride) => {
            const status = ride.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          
          // Calculate based on sample (rough estimate)
          const sampleSize = sampleRides.length;
          const ratio = totalRides / Math.max(sampleSize, 1);
          
          const activeCount = Math.round(
            ((statusCounts.pending || 0) + 
             (statusCounts.driver_assigned || 0) + 
             (statusCounts.ride_started || 0)) * ratio
          );
          
          const completedCount = Math.round(
            ((statusCounts.ride_ended || 0) + 
             (statusCounts.completed || 0)) * ratio
          );
          
          const cancelledCount = Math.round((statusCounts.cancelled || 0) * ratio);
          
          setRideStats({
            total: totalRides,
            completed: completedCount,
            active: activeCount,
            cancelled: cancelledCount
          });
          
          console.log('📊 [Ride Management] Estimated statistics from sample:', {
            total: totalRides,
            sampleSize,
            ratio,
            statusCounts
          });
        } else {
          // No rides found
          setRideStats({
            total: 0,
            completed: 0,
            active: 0,
            cancelled: 0
          });
        }
      }
    } catch (error) {
      console.error('📊 [Ride Management] Error loading ride statistics:', error);
      
      if (error.status === 401) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
        return;
      }
      
      // Keep existing stats or set to zero
      console.warn('📊 [Ride Management] Keeping existing statistics due to error');
    } finally {
      setStatsLoading(false);
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
        console.log('🚨 [NEW RIDE DEBUG] Received new ride request:', data);
        console.log('🚨 [NEW RIDE DEBUG] Current filters:', filters);
        console.log('🚨 [NEW RIDE DEBUG] Should show ride:', shouldShowRide(data));
        
        // Add new ride to the beginning of the list if it matches current filters
        if (shouldShowRide(data)) {
          console.log('✅ [NEW RIDE DEBUG] Adding ride to list');
          setRides(prev => {
            const safePrev = Array.isArray(prev) ? prev : [];
            // Check if ride already exists to avoid duplicates - check multiple ID fields
            const exists = safePrev.some(ride => 
              ride._id === data.rideId || 
              ride._id === data._id ||
              ride.rideId === data.rideId ||
              ride.rideId === data.uniqueRideId
            );
            console.log('🚨 [NEW RIDE DEBUG] Ride already exists:', exists);
            if (!exists) {
              const newRide = formatRideData(data);
              console.log('🚨 [NEW RIDE DEBUG] Formatted new ride:', newRide);
              const updatedRides = [newRide, ...safePrev];
              const deduplicatedRides = deduplicateRides(updatedRides);
              console.log('🚨 [NEW RIDE DEBUG] Final rides count:', deduplicatedRides.length);
              return deduplicatedRides;
            }
            return deduplicateRides(safePrev);
          });
          
          // Update pagination total
          setPagination(prev => ({
            ...prev,
            total: (prev.total || 0) + 1
          }));
        } else {
          console.log('🚨 [NEW RIDE DEBUG] Ride doesn\'t match current filters, but force refreshing...');
        }
        
        // IMMEDIATE REFRESH: Reload rides list to ensure new ride is visible
        console.log('🔄 [NEW RIDE DEBUG] Refreshing rides list for new ride...');
        loadRides(true); // Reset pagination and reload immediately
        
        // Update ride statistics - new ride means +1 total, +1 active (pending)
        setRideStats(prev => ({
          ...prev,
          total: prev.total + 1,
          active: prev.active + 1
        }));
        break;
        
      case 'rideAccepted':
      case 'rideStarted':
      case 'rideStatusUpdated':
        // Update existing ride in the list
        setRides(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const updatedRides = safePrev.map(ride => {
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
          return deduplicateRides(updatedRides);
        });
        // No statistics change for status updates (still active)
        break;
        
      case 'rideCompleted':
      case 'rideEnded':
        // Update existing ride in the list
        setRides(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const updatedRides = safePrev.map(ride => {
            if (ride._id === data.rideId || ride.rideId === data.uniqueRideId) {
              return {
                ...ride,
                status: data.status || 'ride_ended', // Use the status from data if available
                driverName: data.driverName || ride.driverName,
                updatedAt: data.timestamp || data.updatedAt || new Date().toISOString(),
                queueNumber: data.queueNumber || ride.queueNumber
              };
            }
            return ride;
          });
          return deduplicateRides(updatedRides);
        });
        
        // Update statistics - ride completed/ended means -1 active, +1 completed
        setRideStats(prev => ({
          ...prev,
          active: Math.max(0, prev.active - 1),
          completed: prev.completed + 1
        }));
        break;
        
      case 'rideCancelled':
        // Update existing ride in the list
        setRides(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const updatedRides = safePrev.map(ride => {
            if (ride._id === data.rideId || ride.rideId === data.uniqueRideId) {
              return {
                ...ride,
                status: 'cancelled',
                driverName: data.driverName || ride.driverName,
                updatedAt: data.timestamp || data.updatedAt || new Date().toISOString(),
                queueNumber: data.queueNumber || ride.queueNumber
              };
            }
            return ride;
          });
          return deduplicateRides(updatedRides);
        });
        
        // Update statistics - ride cancelled means -1 active, +1 cancelled
        setRideStats(prev => ({
          ...prev,
          active: Math.max(0, prev.active - 1),
          cancelled: prev.cancelled + 1
        }));
        break;
        
      case 'driverOnline':
        console.log('🚗 [Ride Management] Driver came online:', data);
        // Could refresh driver statistics or show notification
        break;
        
      case 'driverOffline':
        console.log('🚗 [Ride Management] Driver went offline:', data);
        // Could refresh driver statistics or show notification
        break;
        
      case 'userRegistered':
        console.log('👤 [Ride Management] New user registered:', data);
        // Could refresh user statistics or show notification
        break;
        
      case 'driverRegistered':
        console.log('🚚 [Ride Management] New driver registered:', data);
        // Could refresh driver statistics or show notification
        break;
        
      case 'manualBookingCreated':
        console.log('📋 [Ride Management] Manual booking created:', data);
        // Refresh the rides list to show the new manual booking
        loadRides(true);
        
        // Update statistics - new manual booking means +1 total, +1 active
        setRideStats(prev => ({
          ...prev,
          total: prev.total + 1,
          active: prev.active + 1
        }));
        break;
        
      case 'rideAssigned':
        console.log('🚗 [Ride Management] Ride assigned to driver:', data);
        // Update existing ride in the list to show driver assignment
        setRides(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const updatedRides = safePrev.map(ride => {
            if (ride._id === data.rideId || ride.rideId === data.bookingId) {
              return {
                ...ride,
                status: 'driver_assigned',
                driverId: data.driverId ? { 
                  name: data.driverName || 'Assigned Driver',
                  _id: data.driverId 
                } : ride.driverId,
                driverName: data.driverName || ride.driverName,
                updatedAt: data.timestamp || new Date().toISOString(),
                queueNumber: data.queueNumber || ride.queueNumber,
                assignedAt: data.assignedAt || new Date().toISOString()
              };
            }
            return ride;
          });
          return deduplicateRides(updatedRides);
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
  // Deduplicate rides array based on multiple ID fields
  const deduplicateRides = (rides) => {
    const seen = new Set();
    return rides.filter(ride => {
      const id = ride._id || ride.rideId;
      if (seen.has(id)) {
        console.warn('🔍 [Ride Management] Removing duplicate ride:', id);
        return false;
      }
      seen.add(id);
      return true;
    });
  };

  const formatRideData = (data) => {
    const formattedData = {
      _id: data.rideId || data._id,
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
    
    // DEBUG: Log real-time ride data formatting
    console.log('🔍 [DEBUG] Formatting real-time ride data:', {
      originalDropLocation: data.dropLocation,
      originalDestination: data.destination,
      formattedDestination: formattedData.destination,
      hasDropLocationAddress: !!data.dropLocation?.address
    });
    
    return formattedData;
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
      ride_ended: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const statusLabels = {
      pending: 'Pending',
      driver_assigned: 'Driver Assigned',
      ride_started: 'In Progress',
      ride_ended: 'Ended',
      completed: 'Completed',
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
    <div className="p-4 bg-gray-50 min-h-screen max-w-full overflow-hidden">
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
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
              onClick={() => {
                loadRides(true);
                loadRideStatistics();
              }}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white p-3 rounded-lg shadow relative">
            {statsLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
              </div>
            )}
            <div className="text-xl font-bold text-gray-900">{rideStats.total}</div>
            <div className="text-xs text-gray-600">Total Rides</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow relative">
            {statsLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
              </div>
            )}
            <div className="text-xl font-bold text-green-600">{rideStats.completed}</div>
            <div className="text-xs text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow relative">
            {statsLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            )}
            <div className="text-xl font-bold text-blue-600">{rideStats.active}</div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow relative">
            {statsLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
              </div>
            )}
            <div className="text-xl font-bold text-red-600">{rideStats.cancelled}</div>
            <div className="text-xs text-gray-600">Cancelled</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-lg shadow mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
              <option value="ride_ended">Ended</option>
              <option value="completed">Completed</option>
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
        <div className="table-responsive overflow-x-auto">
          <table className="table-desktop w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  Ride Details
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  User
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  Driver
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  Queue
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
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
                const queueNumber = ride.queueNumber || '';
                const queuePosition = ride.queuePosition || '';
                const createdAt = ride.createdAt || ride.bookingTime || null;
                
                return (
                <tr key={ride._id || ride.rideId || `ride-${index}`} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      #{rideId}
                    </div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">
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
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      From: {locationName}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center">
                      <FaUser className="text-blue-500 mr-2 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {userName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {ride.driverId ? (
                      <DriverStatusIndicator 
                        driver={{
                          ...ride.driverId,
                          fullName: ride.driverId.name || ride.driverId.fullName || driverName,
                          mobileNo: ride.driverId.phone || ride.driverId.mobileNo,
                          vehicleNo: ride.driverId.vehicleNumber || ride.driverId.vehicleNo,
                          queuePosition: ride.queuePosition,
                          currentRide: ride.status === 'ride_started' || ride.status === 'driver_assigned' ? ride._id : null,
                          isOnline: true // Assume online if assigned to ride
                        }}
                        showDetails={false}
                        size="small"
                      />
                    ) : (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse flex-shrink-0"></div>
                        <span className="text-sm text-orange-600 font-medium truncate">Searching...</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {getStatusBadge(status)}
                  </td>
                  <td className="px-3 py-3">
                    {queueNumber ? (
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{queueNumber}</div>
                        {queuePosition && (
                          <div className="text-gray-500 text-xs">#{queuePosition}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm font-medium">
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
          
          {/* Mobile Card Layout */}
          <div className="table-mobile">
            <div className="p-4 space-y-4">
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
                const queueNumber = ride.queueNumber || '';
                const queuePosition = ride.queuePosition || '';
                const createdAt = ride.createdAt || ride.bookingTime || null;
                
                return (
                  <div key={ride._id || ride.rideId || `ride-${index}`} className="table-card">
                    <div className="table-card-header">
                      <div>
                        <div className="table-card-title">#{rideId}</div>
                        <div className="table-card-subtitle">To: {destination}</div>
                        <div className="flex items-center gap-2 mt-2">
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
                      </div>
                      <div className="text-right">
                        {getStatusBadge(status)}
                      </div>
                    </div>
                    
                    <div className="table-card-body">
                      <div className="table-card-row">
                        <span className="table-card-label">From</span>
                        <span className="table-card-value">{locationName}</span>
                      </div>
                      
                      <div className="table-card-row">
                        <span className="table-card-label">User</span>
                        <div className="table-card-value text-right">
                          <div className="font-medium">{userName}</div>
                        </div>
                      </div>
                      
                      <div className="table-card-row">
                        <span className="table-card-label">Driver</span>
                        <div className="table-card-value text-right">
                          {ride.driverId ? (
                            <DriverStatusIndicator 
                              driver={{
                                ...ride.driverId,
                                fullName: ride.driverId.name || ride.driverId.fullName || driverName,
                                mobileNo: ride.driverId.phone || ride.driverId.mobileNo,
                                vehicleNo: ride.driverId.vehicleNumber || ride.driverId.vehicleNo,
                                queuePosition: ride.queuePosition,
                                currentRide: ride.status === 'ride_started' || ride.status === 'driver_assigned' ? ride._id : null,
                                isOnline: true // Assume online if assigned to ride
                              }}
                              showDetails={false}
                              size="small"
                            />
                          ) : (
                            <div className="flex items-center justify-end">
                              <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse"></div>
                              <span className="text-xs text-orange-600">Searching...</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {queueNumber && (
                        <div className="table-card-row">
                          <span className="table-card-label">Queue</span>
                          <div className="table-card-value text-right">
                            <div className="font-medium">{queueNumber}</div>
                            {queuePosition && <div className="text-xs text-gray-500">#{queuePosition}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="table-card-actions">
                      <button
                        onClick={() => viewRideDetails(ride._id)}
                        className="table-card-action-btn bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <FaEye className="inline mr-2" />
                        View Details
                      </button>
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              {/* Quick Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Ride Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Ride ID</label>
                    <div className="mt-1 text-sm text-gray-900">
                      #{selectedRide.rideId || selectedRide._id?.slice(-8)}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">User Information</h4>
                  {selectedRide.userId ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{selectedRide.userId.name}</div>
                      <div className="text-sm text-gray-600">📞 {selectedRide.userId.phone}</div>
                      {selectedRide.userId.email && (
                        <div className="text-sm text-gray-600">📧 {selectedRide.userId.email}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">User information not available</div>
                  )}
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Driver Information</h4>
                  {selectedRide.driverId ? (
                    <DriverStatusIndicator 
                      driver={{
                        ...selectedRide.driverId,
                        fullName: selectedRide.driverId.name || selectedRide.driverId.fullName,
                        mobileNo: selectedRide.driverId.phone || selectedRide.driverId.mobileNo,
                        vehicleNo: selectedRide.driverId.vehicleNumber || selectedRide.driverId.vehicleNo,
                        queuePosition: selectedRide.queuePosition,
                        currentRide: selectedRide.status === 'ride_started' || selectedRide.status === 'driver_assigned' ? selectedRide._id : null,
                        isOnline: true, // Assume online if assigned to ride
                        rating: selectedRide.driverId.rating || 0,
                        totalRides: selectedRide.driverId.totalRides || 0,
                        currentMetroBooth: selectedRide.pickupLocation?.boothName
                      }}
                      showDetails={true}
                      size="medium"
                    />
                  ) : (
                    <div className="text-sm text-gray-500">No driver assigned</div>
                  )}
                </div>
              </div>

              {/* Ride Timeline */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Ride Timeline</h4>
                <RideStatusTimeline 
                  ride={{
                    ...selectedRide,
                    timestamp: selectedRide.createdAt || selectedRide.timestamp,
                    assignedAt: selectedRide.acceptedAt || selectedRide.assignedAt,
                    paymentStatus: selectedRide.paymentStatus || 'pending'
                  }}
                  showTimestamps={true}
                />
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