import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { admin } from '../services/api';
import { getIO } from '../services/socket';

// Initial state
const initialState = {
  drivers: [],
  loading: false,
  error: null,
  selectedBooth: null,
  queueUpdated: false
};

// Action types
const DRIVER_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_DRIVERS: 'SET_DRIVERS',
  SET_ERROR: 'SET_ERROR',
  SET_SELECTED_BOOTH: 'SET_SELECTED_BOOTH',
  UPDATE_DRIVER: 'UPDATE_DRIVER',
  REMOVE_DRIVER: 'REMOVE_DRIVER',
  QUEUE_UPDATED: 'QUEUE_UPDATED',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer
const driverReducer = (state, action) => {
  switch (action.type) {
    case DRIVER_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };
    
    case DRIVER_ACTIONS.SET_DRIVERS:
      return {
        ...state,
        drivers: action.payload,
        loading: false,
        error: null
      };
    
    case DRIVER_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    
    case DRIVER_ACTIONS.SET_SELECTED_BOOTH:
      return {
        ...state,
        selectedBooth: action.payload
      };
    
    case DRIVER_ACTIONS.UPDATE_DRIVER:
      return {
        ...state,
        drivers: state.drivers.map(driver =>
          driver._id === action.payload._id ? { ...driver, ...action.payload } : driver
        )
      };
    
    case DRIVER_ACTIONS.REMOVE_DRIVER:
      return {
        ...state,
        drivers: state.drivers.filter(driver => driver._id !== action.payload)
      };
    
    case DRIVER_ACTIONS.QUEUE_UPDATED:
      return {
        ...state,
        queueUpdated: !state.queueUpdated
      };
    
    case DRIVER_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
    
    default:
      return state;
  }
};

// Create context
const DriverContext = createContext();

// Provider component
export const DriverProvider = ({ children }) => {
  const [state, dispatch] = useReducer(driverReducer, initialState);

  // Actions
  const setLoading = (loading) => {
    dispatch({ type: DRIVER_ACTIONS.SET_LOADING, payload: loading });
  };

  const setDrivers = (drivers) => {
    dispatch({ type: DRIVER_ACTIONS.SET_DRIVERS, payload: drivers });
  };

  const setError = (error) => {
    dispatch({ type: DRIVER_ACTIONS.SET_ERROR, payload: error });
  };

  const clearError = () => {
    dispatch({ type: DRIVER_ACTIONS.CLEAR_ERROR });
  };

  const setSelectedBooth = (booth) => {
    dispatch({ type: DRIVER_ACTIONS.SET_SELECTED_BOOTH, payload: booth });
  };

  const updateDriver = (driver) => {
    dispatch({ type: DRIVER_ACTIONS.UPDATE_DRIVER, payload: driver });
  };

  const removeDriver = (driverId) => {
    dispatch({ type: DRIVER_ACTIONS.REMOVE_DRIVER, payload: driverId });
  };

  const triggerQueueUpdate = () => {
    dispatch({ type: DRIVER_ACTIONS.QUEUE_UPDATED });
  };

  // Fetch available drivers for a booth
  const fetchAvailableDrivers = async (boothName) => {
    setLoading(true);
    clearError();
    
    try {
      const response = await admin.getAvailableDrivers(boothName);
      if (response.success) {
        setDrivers(response.drivers);
        setSelectedBooth(boothName);
      } else {
        setError('Failed to fetch drivers');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error fetching drivers');
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Socket event handlers
  useEffect(() => {
    const socket = getIO();
    
    if (socket) {
      // Listen for driver status updates
      socket.on('driverStatusUpdate', (data) => {
        updateDriver(data.driver);
      });

      // Listen for queue position updates
      socket.on('queuePositionUpdate', (data) => {
        updateDriver(data.driver);
        triggerQueueUpdate();
      });

      // Listen for driver assignment updates
      socket.on('driverAssigned', (data) => {
        updateDriver(data.driver);
      });

      // Listen for driver availability changes
      socket.on('driverAvailabilityChange', (data) => {
        updateDriver(data.driver);
      });

      // Listen for real-time driver status updates
      socket.on('driverStatusUpdated', (data) => {
        console.log('[DriverContext] Received driverStatusUpdated:', data);
        updateDriver({
          _id: data.driverId,
          isOnline: data.isOnline,
          currentPickupLocation: data.currentPickupLocation,
          lastActiveTime: data.lastActiveTime,
          fullName: data.driverName
        });
        triggerQueueUpdate();
      });

      // Listen for queue position updates
      socket.on('queuePositionsUpdated', (data) => {
        console.log('[DriverContext] Received queuePositionsUpdated:', data);
        // Update all drivers with their new queue positions
        if (data.queueUpdates && Array.isArray(data.queueUpdates)) {
          data.queueUpdates.forEach(driverUpdate => {
            updateDriver({
              _id: driverUpdate._id,
              queuePosition: driverUpdate.queuePosition,
              isOnline: driverUpdate.isOnline,
              fullName: driverUpdate.fullName
            });
          });
          triggerQueueUpdate();
        }
      });

      // Listen for driver online/offline events
      socket.on('driverOnline', (data) => {
        console.log('[DriverContext] Driver went online:', data);
        updateDriver({
          _id: data.driverId,
          isOnline: true,
          currentPickupLocation: data.metroBooth,
          lastActiveTime: data.timestamp,
          fullName: data.driverName
        });
        triggerQueueUpdate();
      });

      socket.on('driverOffline', (data) => {
        console.log('[DriverContext] Driver went offline:', data);
        updateDriver({
          _id: data.driverId,
          isOnline: false,
          currentPickupLocation: null,
          lastActiveTime: data.timestamp,
          fullName: data.driverName
        });
        triggerQueueUpdate();
      });

      return () => {
        socket.off('driverStatusUpdate');
        socket.off('queuePositionUpdate');
        socket.off('driverAssigned');
        socket.off('driverAvailabilityChange');
        socket.off('driverStatusUpdated');
        socket.off('queuePositionsUpdated');
        socket.off('driverOnline');
        socket.off('driverOffline');
      };
    }
  }, []);

  // Auto-refresh drivers when booth changes
  useEffect(() => {
    if (state.selectedBooth) {
      const interval = setInterval(() => {
        fetchAvailableDrivers(state.selectedBooth);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [state.selectedBooth]);

  // Toggle driver status (admin action)
  const toggleDriverStatus = async (driverId, isOnline) => {
    return new Promise((resolve) => {
      const socket = getIO();
      if (!socket) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }

      console.log('[DriverContext] Toggling driver status:', { driverId, isOnline });
      
      // Import and use the admin toggle function
      import('../services/socket').then(({ adminToggleDriverStatus }) => {
        adminToggleDriverStatus(driverId, isOnline, (response) => {
          console.log('[DriverContext] Toggle response:', response);
          resolve(response);
        });
      }).catch(error => {
        console.error('[DriverContext] Error importing socket service:', error);
        resolve({ success: false, error: error.message });
      });
    });
  };

  const value = {
    ...state,
    actions: {
      fetchAvailableDrivers,
      setSelectedBooth,
      updateDriver,
      removeDriver,
      clearError,
      triggerQueueUpdate,
      toggleDriverStatus
    }
  };

  return (
    <DriverContext.Provider value={value}>
      {children}
    </DriverContext.Provider>
  );
};

// Custom hook to use driver context
export const useDriver = () => {
  const context = useContext(DriverContext);
  if (!context) {
    throw new Error('useDriver must be used within a DriverProvider');
  }
  return context;
};

export default DriverContext;