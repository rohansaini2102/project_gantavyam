import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { initializeSocket, getSocket, isSocketConnected } from '../services/socket';
import { drivers } from '../services/api';
import { driverStateThrottler } from '../utils/throttle';
import { logSync, checkSyncFrequency } from '../utils/syncDebugger';

// Storage keys for persistence
const STORAGE_KEYS = {
  DRIVER_STATUS: 'driverStatus',
  QUEUE_POSITION: 'driverQueuePosition',
  ACTIVE_RIDE: 'driverActiveRide',
  LAST_KNOWN_STATE: 'driverLastKnownState'
};

// Initial state
const initialState = {
  // Driver info
  driver: null,
  
  // Connection state
  socket: null,
  socketConnected: false,
  
  // Driver status
  isOnline: false,
  isGoingOnline: false,
  queuePosition: null,
  selectedPickupLocation: 'Hauz Khas Metro Gate No 1', // Fixed location
  vehicleType: 'auto',
  
  // Ride state
  activeRide: null,
  rideRequests: [],
  
  // Errors
  statusError: '',
  rideError: '',
  
  // State persistence
  lastStateSync: null,
  stateRecovered: false,
  
  // Throttling state
  lastServerSync: null,
  syncInProgress: false
};

// Action types
const DRIVER_STATE_ACTIONS = {
  // Driver info
  SET_DRIVER: 'SET_DRIVER',
  
  // Connection
  SET_SOCKET: 'SET_SOCKET',
  SET_SOCKET_CONNECTED: 'SET_SOCKET_CONNECTED',
  
  // Status
  SET_ONLINE_STATUS: 'SET_ONLINE_STATUS',
  SET_GOING_ONLINE: 'SET_GOING_ONLINE',
  SET_QUEUE_POSITION: 'SET_QUEUE_POSITION',
  SET_VEHICLE_TYPE: 'SET_VEHICLE_TYPE',
  
  // Rides
  SET_ACTIVE_RIDE: 'SET_ACTIVE_RIDE',
  SET_RIDE_REQUESTS: 'SET_RIDE_REQUESTS',
  ADD_RIDE_REQUEST: 'ADD_RIDE_REQUEST',
  REMOVE_RIDE_REQUEST: 'REMOVE_RIDE_REQUEST',
  
  // Errors
  SET_STATUS_ERROR: 'SET_STATUS_ERROR',
  SET_RIDE_ERROR: 'SET_RIDE_ERROR',
  CLEAR_ERRORS: 'CLEAR_ERRORS',
  
  // State management
  RESTORE_STATE: 'RESTORE_STATE',
  SYNC_STATE: 'SYNC_STATE',
  CLEAR_STATE: 'CLEAR_STATE',
  SET_SYNC_STATUS: 'SET_SYNC_STATUS'
};

// Reducer
const driverStateReducer = (state, action) => {
  switch (action.type) {
    case DRIVER_STATE_ACTIONS.SET_DRIVER:
      return { ...state, driver: action.payload };
    
    case DRIVER_STATE_ACTIONS.SET_SOCKET:
      return { ...state, socket: action.payload };
    
    case DRIVER_STATE_ACTIONS.SET_SOCKET_CONNECTED:
      return { ...state, socketConnected: action.payload };
    
    case DRIVER_STATE_ACTIONS.SET_ONLINE_STATUS:
      return { ...state, isOnline: action.payload, lastStateSync: new Date().toISOString() };
    
    case DRIVER_STATE_ACTIONS.SET_GOING_ONLINE:
      return { ...state, isGoingOnline: action.payload };
    
    case DRIVER_STATE_ACTIONS.SET_QUEUE_POSITION:
      return { ...state, queuePosition: action.payload, lastStateSync: new Date().toISOString() };
    
    case DRIVER_STATE_ACTIONS.SET_VEHICLE_TYPE:
      return { ...state, vehicleType: action.payload };
    
    case DRIVER_STATE_ACTIONS.SET_ACTIVE_RIDE:
      return { ...state, activeRide: action.payload, lastStateSync: new Date().toISOString() };
    
    case DRIVER_STATE_ACTIONS.SET_RIDE_REQUESTS:
      return { ...state, rideRequests: action.payload };
    
    case DRIVER_STATE_ACTIONS.ADD_RIDE_REQUEST:
      return { 
        ...state, 
        rideRequests: [...state.rideRequests, action.payload] 
      };
    
    case DRIVER_STATE_ACTIONS.REMOVE_RIDE_REQUEST:
      return { 
        ...state, 
        rideRequests: state.rideRequests.filter(r => r._id !== action.payload) 
      };
    
    case DRIVER_STATE_ACTIONS.SET_STATUS_ERROR:
      return { ...state, statusError: action.payload };
    
    case DRIVER_STATE_ACTIONS.SET_RIDE_ERROR:
      return { ...state, rideError: action.payload };
    
    case DRIVER_STATE_ACTIONS.CLEAR_ERRORS:
      return { ...state, statusError: '', rideError: '' };
    
    case DRIVER_STATE_ACTIONS.RESTORE_STATE:
      // CRITICAL: Don't overwrite activeRide if current has more data
      const incomingActiveRide = action.payload.activeRide;
      const currentActiveRide = state.activeRide;
      
      let finalActiveRide = incomingActiveRide;
      
      // If both exist and have same ID, keep the one with more data
      if (currentActiveRide && incomingActiveRide && 
          currentActiveRide._id === incomingActiveRide._id) {
        // Check data completeness
        const currentHasOTP = currentActiveRide.startOTP || currentActiveRide.endOTP;
        const incomingHasOTP = incomingActiveRide.startOTP || incomingActiveRide.endOTP;
        
        if (currentHasOTP && !incomingHasOTP) {
          console.log('[DriverState] RESTORE_STATE: Preserving current activeRide with OTP data');
          finalActiveRide = currentActiveRide;
        }
      }
      
      return { 
        ...state, 
        ...action.payload,
        activeRide: finalActiveRide, // Use the validated activeRide
        stateRecovered: true,
        lastStateSync: new Date().toISOString()
      };
    
    case DRIVER_STATE_ACTIONS.SYNC_STATE:
      return { ...state, lastStateSync: new Date().toISOString() };
    
    case DRIVER_STATE_ACTIONS.CLEAR_STATE:
      return { 
        ...initialState, 
        driver: state.driver, // Keep driver info
        socket: state.socket, // Keep socket
        socketConnected: state.socketConnected // Keep connection status
      };
    
    case DRIVER_STATE_ACTIONS.SET_SYNC_STATUS:
      return { 
        ...state, 
        syncInProgress: action.payload.syncInProgress,
        lastServerSync: action.payload.lastServerSync || state.lastServerSync
      };
    
    default:
      return state;
  }
};

// Create context
const DriverStateContext = createContext();

// Provider component
export const DriverStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(driverStateReducer, initialState);
  const syncTimeoutRef = useRef(null);
  const lastSyncDataRef = useRef(null);

  // Persistence functions
  const saveToStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`[DriverState] Error saving to storage:`, error);
    }
  };

  const loadFromStorage = (key) => {
    try {
      const data = localStorage.getItem(key);
      // Safety check for undefined or "undefined" string
      if (!data || data === 'undefined' || data === 'null') {
        return null;
      }
      return JSON.parse(data);
    } catch (error) {
      console.error(`[DriverState] Error loading from storage:`, error);
      return null;
    }
  };

  const clearStorage = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  };

  // State recovery function
  const recoverState = () => {
    console.log('[DriverState] Attempting to recover state...');
    
    // First check if driver is logged in
    const driverToken = localStorage.getItem('driverToken');
    const driverData = localStorage.getItem('driver');
    
    if (!driverToken || !driverData) {
      console.log('[DriverState] No driver authentication found, skipping state recovery');
      return false;
    }
    
    // Parse driver data if it exists
    let driverInfo = null;
    try {
      if (driverData) {
        driverInfo = JSON.parse(driverData);
        console.log('[DriverState] Driver data parsed successfully:', driverInfo);
      }
    } catch (error) {
      console.error('[DriverState] Error parsing driver data:', error);
    }
    
    // Skip token validation entirely - trust that token exists
    console.log('[DriverState] Skipping token validation - trusting driver token exists');
    
    const lastKnownState = loadFromStorage(STORAGE_KEYS.LAST_KNOWN_STATE);
    const driverStatus = loadFromStorage(STORAGE_KEYS.DRIVER_STATUS);
    const queuePosition = loadFromStorage(STORAGE_KEYS.QUEUE_POSITION);
    const activeRide = loadFromStorage(STORAGE_KEYS.ACTIVE_RIDE);
    
    if (lastKnownState || driverStatus || queuePosition || activeRide || driverInfo) {
      console.log('[DriverState] State found, recovering...', {
        driverInfo,
        lastKnownState,
        driverStatus,
        queuePosition,
        activeRide
      });
      
      // Don't overwrite active ride if it already exists and has data
      const currentActiveRide = state.activeRide;
      const shouldUseCurrentRide = currentActiveRide && currentActiveRide._id && 
                                   (currentActiveRide.startOTP || currentActiveRide.endOTP);
      
      const recoveredState = {
        driver: driverInfo,  // Include driver object in recovered state
        isOnline: driverStatus?.isOnline || false,
        queuePosition: queuePosition || null,
        // Preserve current active ride if it has OTP data, otherwise use recovered
        activeRide: shouldUseCurrentRide ? currentActiveRide : (activeRide || null),
        vehicleType: driverStatus?.vehicleType || 'auto',
        selectedPickupLocation: driverStatus?.selectedPickupLocation || 'Hauz Khas Metro Gate No 1',
        ...lastKnownState
      };
      
      if (shouldUseCurrentRide) {
        console.log('[DriverState] Preserving current active ride with OTP data during recovery');
      }
      
      dispatch({ type: DRIVER_STATE_ACTIONS.RESTORE_STATE, payload: recoveredState });
      return true;
    }
    
    console.log('[DriverState] No state to recover');
    return false;
  };

  // Save state to storage whenever important state changes
  useEffect(() => {
    if (state.stateRecovered || state.lastStateSync) {
      const stateToSave = {
        isOnline: state.isOnline,
        queuePosition: state.queuePosition,
        activeRide: state.activeRide,
        vehicleType: state.vehicleType,
        selectedPickupLocation: state.selectedPickupLocation,
        lastStateSync: state.lastStateSync
      };
      
      saveToStorage(STORAGE_KEYS.LAST_KNOWN_STATE, stateToSave);
      saveToStorage(STORAGE_KEYS.DRIVER_STATUS, {
        isOnline: state.isOnline,
        vehicleType: state.vehicleType,
        selectedPickupLocation: state.selectedPickupLocation
      });
      saveToStorage(STORAGE_KEYS.QUEUE_POSITION, state.queuePosition);
      saveToStorage(STORAGE_KEYS.ACTIVE_RIDE, state.activeRide);
    }
  }, [state.isOnline, state.queuePosition, state.activeRide, state.vehicleType, state.selectedPickupLocation, state.lastStateSync]);

  // Smart state sync with throttling
  const syncWithServer = async (force = false) => {
    // Skip if sync is already in progress
    if (state.syncInProgress && !force) {
      console.log('[DriverState] Sync already in progress, skipping...');
      return;
    }
    
    // Check if we need to sync (only if state actually changed)
    const currentStateData = {
      isOnline: state.isOnline,
      queuePosition: state.queuePosition,
      activeRideId: state.activeRide?._id || null,
      vehicleType: state.vehicleType,
      selectedPickupLocation: state.selectedPickupLocation,
      lastStateSync: state.lastStateSync
    };
    
    // Compare with last sync data to avoid unnecessary syncs
    const stateDataString = JSON.stringify(currentStateData);
    const lastSyncDataString = JSON.stringify(lastSyncDataRef.current);
    
    if (!force && stateDataString === lastSyncDataString) {
      console.log('[DriverState] No state changes detected, skipping sync');
      logSync('SKIPPED', 'No state changes detected', currentStateData);
      return;
    }
    
    // FIX 5: Skip sync if we have an active ride with OTP data (critical operation in progress)
    if (state.activeRide && (state.activeRide.startOTP || state.activeRide.endOTP)) {
      const timeSinceLastSync = state.lastServerSync ? 
        Date.now() - new Date(state.lastServerSync).getTime() : 
        61000; // If no last sync, set to > 60s to allow first sync
      
      // Only force sync if it's been more than 60 seconds (instead of normal 15-30s)
      if (timeSinceLastSync < 60000) {
        console.log('[DriverState] Skipping sync - active ride with OTP data', {
          hasStartOTP: !!state.activeRide.startOTP,
          hasEndOTP: !!state.activeRide.endOTP,
          timeSinceLastSync: Math.round(timeSinceLastSync / 1000) + 's'
        });
        return;
      }
    }
    
    console.log('[DriverState] State changed, preparing to sync:', currentStateData);
    
    // Check sync frequency
    const frequencyCheck = checkSyncFrequency();
    if (frequencyCheck.highFrequency) {
      logSync('HIGH_FREQUENCY', `High sync frequency detected: ${frequencyCheck.attempts} attempts in last minute`);
    }
    
    try {
      // Use throttling to prevent excessive API calls
      const result = await driverStateThrottler.throttleAndDebounce(
        'driver_state_sync',
        async () => {
          dispatch({ 
            type: DRIVER_STATE_ACTIONS.SET_SYNC_STATUS, 
            payload: { syncInProgress: true } 
          });
          
          console.log('[DriverState] Syncing state with server (throttled):', currentStateData);
          
          try {
            const response = await drivers.syncDriverState(currentStateData);
            
            if (response.success) {
              console.log('[DriverState] State sync successful:', response.data);
              
              // Update local state with server response if there are conflicts
              if (response.data.needsUpdate) {
                const syncedState = response.data.syncedState;
                
                // CRITICAL FIX: Don't overwrite activeRide if current one has more complete data
                let activeRideToUse = state.activeRide;
                
                // Check if we should update activeRide
                if (syncedState.activeRideId) {
                  // Server says we have an active ride
                  if (!state.activeRide || !state.activeRide._id) {
                    // We don't have an active ride locally, use server's ID
                    activeRideToUse = { _id: syncedState.activeRideId };
                    console.log('[DriverState] Setting activeRide from server ID:', syncedState.activeRideId);
                  } else if (state.activeRide._id !== syncedState.activeRideId) {
                    // Different ride ID, server's is probably newer
                    activeRideToUse = { _id: syncedState.activeRideId };
                    console.log('[DriverState] Updating activeRide ID from server:', syncedState.activeRideId);
                  } else {
                    // Same ride ID - Enhanced data preservation logic
                    const localHasOTP = state.activeRide.startOTP || state.activeRide.endOTP;
                    const localHasFare = state.activeRide.fare || state.activeRide.estimatedFare;
                    const localHasUserData = state.activeRide.userName && state.activeRide.userPhone;
                    
                    // CRITICAL: Never overwrite local data if it has OTPs or critical fields
                    if (localHasOTP || localHasFare || localHasUserData) {
                      console.log('[DriverState] PRESERVING local activeRide - has critical data', {
                        hasOTP: localHasOTP,
                        hasFare: localHasFare,
                        hasUserData: localHasUserData
                      });
                      
                      // Merge server ID with local data (keep local data, only update ID if needed)
                      activeRideToUse = {
                        ...state.activeRide,
                        _id: syncedState.activeRideId || state.activeRide._id
                      };
                    } else {
                      // Only use server data if local has no critical data
                      activeRideToUse = { _id: syncedState.activeRideId };
                    }
                  }
                } else if (syncedState.activeRideId === null && state.activeRide && state.activeRide._id) {
                  // Server says no active ride, but we have one locally with data
                  if (state.activeRide.startOTP || state.activeRide.endOTP || state.activeRide.status === 'accepted') {
                    console.warn('[DriverState] Server wants to clear activeRide but local has OTP data - KEEPING LOCAL');
                    activeRideToUse = state.activeRide; // Don't clear if we have OTP data
                  } else {
                    activeRideToUse = null; // Clear if no important data
                  }
                } else {
                  activeRideToUse = null; // Both agree there's no ride
                }
                
                dispatch({ 
                  type: DRIVER_STATE_ACTIONS.RESTORE_STATE, 
                  payload: {
                    isOnline: syncedState.isOnline,
                    queuePosition: syncedState.queuePosition,
                    activeRide: activeRideToUse, // Use the preserved/validated activeRide
                    vehicleType: syncedState.vehicleType,
                    selectedPickupLocation: syncedState.selectedPickupLocation
                  }
                });
                
                console.log('[DriverState] State updated from sync, activeRide preserved:', !!activeRideToUse);
              }
              
              // Update sync status
              dispatch({ 
                type: DRIVER_STATE_ACTIONS.SET_SYNC_STATUS, 
                payload: { 
                  syncInProgress: false,
                  lastServerSync: new Date().toISOString() 
                } 
              });
              
              // Store successful sync data
              lastSyncDataRef.current = currentStateData;
              
              return response;
            } else {
              throw new Error(response.error || 'Sync failed');
            }
          } catch (error) {
            logSync('ERROR', 'Inner sync request failed', { error: error.message });
            dispatch({ 
              type: DRIVER_STATE_ACTIONS.SET_SYNC_STATUS, 
              payload: { syncInProgress: false } 
            });
            throw error;
          }
        },
        { 
          // FIX 3: Less aggressive sync for active rides
          minInterval: state.activeRide ? 30000 : 15000, // 30s with ride, 15s without
          debounceDelay: state.activeRide ? 5000 : 2000  // 5s with ride, 2s without
        }
      );
      
      if (result.throttled) {
        console.log('[DriverState] Sync throttled:', result.message);
        logSync('THROTTLED', result.message, { remainingTime: result.remainingTime });
      } else if (result.success) {
        logSync('SUCCESS', 'State sync completed successfully', result.data);
      }
      
    } catch (error) {
      console.error('[DriverState] State sync failed:', error);
      logSync('ERROR', 'State sync failed', { error: error.message, stack: error.stack });
      dispatch({ 
        type: DRIVER_STATE_ACTIONS.SET_SYNC_STATUS, 
        payload: { syncInProgress: false } 
      });
    }
  };
  
  // Socket reconnection and state sync with throttling
  useEffect(() => {
    if (state.socketConnected && state.stateRecovered && state.driver) {
      console.log('[DriverState] Socket reconnected, scheduling state sync...');
      
      // Clear any existing timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      // Delay initial sync to allow socket to stabilize
      syncTimeoutRef.current = setTimeout(() => {
        syncWithServer(false); // Don't force, let throttling handle it
      }, 3000); // 3 second delay
    }
    
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [state.socketConnected, state.stateRecovered, state.driver]);

  // Set up socket event listeners for admin-initiated changes
  useEffect(() => {
    if (state.socket && state.socketConnected) {
      console.log('[DriverState] Setting up socket event listeners for admin changes...');
      
      // Listen for admin-initiated status changes
      const handleStatusChangedByAdmin = (data) => {
        console.log('[DriverState] Status changed by admin:', data);
        dispatch({ type: DRIVER_STATE_ACTIONS.SET_ONLINE_STATUS, payload: data.isOnline });
        
        // Show notification to driver
        if (data.message) {
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_STATUS_ERROR, payload: data.message });
          // Clear the message after 5 seconds
          setTimeout(() => {
            dispatch({ type: DRIVER_STATE_ACTIONS.CLEAR_ERRORS });
          }, 5000);
        }
      };

      // Listen for queue position updates
      const handleQueuePositionUpdate = (data) => {
        console.log('[DriverState] Queue position updated:', data);
        if (data.queuePosition !== undefined) {
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_QUEUE_POSITION, payload: data.queuePosition });
        }
      };

      // Listen for driver status updates (from other sources)
      const handleDriverStatusUpdate = (data) => {
        console.log('[DriverState] Driver status updated:', data);
        if (data.driverId === state.driver?._id) {
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_ONLINE_STATUS, payload: data.isOnline });
          if (data.queuePosition !== undefined) {
            dispatch({ type: DRIVER_STATE_ACTIONS.SET_QUEUE_POSITION, payload: data.queuePosition });
          }
        }
      };

      // Listen for online confirmation with conflict handling
      const handleOnlineConfirmed = (data) => {
        console.log('[DriverState] Online confirmation received:', data);
        if (data.success) {
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_ONLINE_STATUS, payload: true });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_GOING_ONLINE, payload: false });
          dispatch({ type: DRIVER_STATE_ACTIONS.CLEAR_ERRORS });
        } else if (data.conflict) {
          // Handle conflict by updating to server state
          console.log('[DriverState] Conflict detected, updating to server state');
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_ONLINE_STATUS, payload: data.currentState.isOnline });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_QUEUE_POSITION, payload: data.currentState.queuePosition });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_GOING_ONLINE, payload: false });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_STATUS_ERROR, payload: data.message });
        } else {
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_GOING_ONLINE, payload: false });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_STATUS_ERROR, payload: data.error || 'Failed to go online' });
        }
      };

      // Listen for offline confirmation with conflict handling
      const handleOfflineConfirmed = (data) => {
        console.log('[DriverState] Offline confirmation received:', data);
        if (data.success) {
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_ONLINE_STATUS, payload: false });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_QUEUE_POSITION, payload: null });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_GOING_ONLINE, payload: false });
          dispatch({ type: DRIVER_STATE_ACTIONS.CLEAR_ERRORS });
        } else if (data.conflict) {
          // Handle conflict by updating to server state
          console.log('[DriverState] Conflict detected, updating to server state');
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_ONLINE_STATUS, payload: data.currentState.isOnline });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_QUEUE_POSITION, payload: data.currentState.queuePosition });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_GOING_ONLINE, payload: false });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_STATUS_ERROR, payload: data.message });
        } else {
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_GOING_ONLINE, payload: false });
          dispatch({ type: DRIVER_STATE_ACTIONS.SET_STATUS_ERROR, payload: data.error || 'Failed to go offline' });
        }
      };

      // Subscribe to socket events
      state.socket.on('statusChangedByAdmin', handleStatusChangedByAdmin);
      state.socket.on('queuePositionUpdated', handleQueuePositionUpdate);
      state.socket.on('driverStatusUpdated', handleDriverStatusUpdate);
      state.socket.on('driverOnlineConfirmed', handleOnlineConfirmed);
      state.socket.on('driverOfflineConfirmed', handleOfflineConfirmed);

      // Cleanup listeners on unmount or socket change
      return () => {
        if (state.socket) {
          state.socket.off('statusChangedByAdmin', handleStatusChangedByAdmin);
          state.socket.off('queuePositionUpdated', handleQueuePositionUpdate);
          state.socket.off('driverStatusUpdated', handleDriverStatusUpdate);
          state.socket.off('driverOnlineConfirmed', handleOnlineConfirmed);
          state.socket.off('driverOfflineConfirmed', handleOfflineConfirmed);
        }
      };
    }
  }, [state.socket, state.socketConnected, state.driver]);
  
  // Sync when important state changes (with throttling)
  useEffect(() => {
    if (state.stateRecovered && state.driver && state.socketConnected) {
      // Use a longer delay for state change syncs to batch multiple changes
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        syncWithServer(false);
      }, 5000); // 5 second delay for state changes
    }
  }, [state.isOnline, state.queuePosition, state.activeRide, state.vehicleType, state.selectedPickupLocation]);

  // Actions
  const actions = {
    // Driver management
    setDriver: (driver) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_DRIVER, payload: driver });
    },
    
    // Socket management
    setSocket: (socket) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_SOCKET, payload: socket });
    },
    
    setSocketConnected: (connected) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_SOCKET_CONNECTED, payload: connected });
    },
    
    // Status management
    setOnlineStatus: (isOnline) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_ONLINE_STATUS, payload: isOnline });
    },
    
    setGoingOnline: (isGoingOnline) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_GOING_ONLINE, payload: isGoingOnline });
    },
    
    setQueuePosition: (position) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_QUEUE_POSITION, payload: position });
    },
    
    setVehicleType: (type) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_VEHICLE_TYPE, payload: type });
    },
    
    // Ride management
    setActiveRide: (ride) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_ACTIVE_RIDE, payload: ride });
    },
    
    setRideRequests: (requests) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_RIDE_REQUESTS, payload: requests });
    },
    
    addRideRequest: (request) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.ADD_RIDE_REQUEST, payload: request });
    },
    
    removeRideRequest: (requestId) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.REMOVE_RIDE_REQUEST, payload: requestId });
    },
    
    // Error management
    setStatusError: (error) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_STATUS_ERROR, payload: error });
    },
    
    setRideError: (error) => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SET_RIDE_ERROR, payload: error });
    },
    
    clearErrors: () => {
      dispatch({ type: DRIVER_STATE_ACTIONS.CLEAR_ERRORS });
    },
    
    // State management
    recoverState,
    clearState: () => {
      clearStorage();
      driverStateThrottler.clearAll(); // Clear throttling data
      dispatch({ type: DRIVER_STATE_ACTIONS.CLEAR_STATE });
    },
    
    syncState: () => {
      dispatch({ type: DRIVER_STATE_ACTIONS.SYNC_STATE });
    },
    
    // Manual sync with force option
    forceSyncWithServer: () => {
      console.log('[DriverState] Force sync requested');
      syncWithServer(true);
    },
    
    // Get sync status
    getSyncStatus: () => {
      return {
        syncInProgress: state.syncInProgress,
        lastServerSync: state.lastServerSync,
        throttlingStatus: driverStateThrottler.getThrottlingStatus('driver_state_sync')
      };
    },
    
    // Server state recovery
    recoverFromServer: async () => {
      try {
        console.log('[DriverState] Recovering state from server...');
        const response = await drivers.getDriverStatus();
        
        if (response.success) {
          const serverState = response.data;
          console.log('[DriverState] Server state recovered:', serverState);
          
          const recoveredState = {
            isOnline: serverState.isOnline,
            queuePosition: serverState.queuePosition,
            activeRide: serverState.activeRide || null,
            vehicleType: serverState.vehicleType,
            selectedPickupLocation: serverState.currentMetroBooth || 'Hauz Khas Metro Gate No 1'
          };
          
          dispatch({ type: DRIVER_STATE_ACTIONS.RESTORE_STATE, payload: recoveredState });
          return true;
        }
        return false;
      } catch (error) {
        console.error('[DriverState] Error recovering state from server:', error);
        return false;
      }
    }
  };

  // Initialize state recovery on mount
  useEffect(() => {
    if (!state.stateRecovered) {
      recoverState();
    }
  }, []);

  // Handle page refresh/reload to preserve driver session
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // Save critical driver state before page unload
      if (state.driver && state.stateRecovered) {
        const criticalState = {
          driverId: state.driver._id,
          isOnline: state.isOnline,
          queuePosition: state.queuePosition,
          activeRideId: state.activeRide?._id || null,
          lastActive: new Date().toISOString(),
          sessionPreserved: true
        };
        
        try {
          sessionStorage.setItem('driverSessionPreserved', JSON.stringify(criticalState));
          console.log('[DriverState] Session preserved before page unload');
        } catch (error) {
          console.error('[DriverState] Error preserving session:', error);
        }
      }
    };

    const handlePageLoad = () => {
      // Check if we have a preserved session
      try {
        const preserved = sessionStorage.getItem('driverSessionPreserved');
        if (preserved) {
          const criticalState = JSON.parse(preserved);
          console.log('[DriverState] Found preserved session:', criticalState);
          
          // IMPORTANT: Don't use preserved session if we already have an active ride
          // This prevents overwriting newly accepted rides
          if (state.activeRide && state.activeRide._id) {
            console.log('[DriverState] Active ride exists, skipping preserved session to avoid data loss');
            sessionStorage.removeItem('driverSessionPreserved');
            return;
          }
          
          // Validate that the preserved session is recent (within 5 minutes)
          const lastActive = new Date(criticalState.lastActive);
          const now = new Date();
          const timeDiff = (now - lastActive) / 1000; // seconds
          
          if (timeDiff < 300) { // 5 minutes
            console.log('[DriverState] Preserved session is recent, will use for recovery');
            // Clear it after reading to prevent reuse
            sessionStorage.removeItem('driverSessionPreserved');
          } else {
            console.log('[DriverState] Preserved session is too old, clearing');
            sessionStorage.removeItem('driverSessionPreserved');
          }
        }
      } catch (error) {
        console.error('[DriverState] Error checking preserved session:', error);
      }
    };

    // Set up event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Check for preserved session on component mount
    handlePageLoad();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.driver, state.stateRecovered, state.isOnline, state.queuePosition, state.activeRide]);

  // Monitor driver token and try to restore if it gets cleared
  useEffect(() => {
    const monitorDriverToken = () => {
      const driverToken = localStorage.getItem('driverToken');
      const driverData = localStorage.getItem('driver');
      
      // If we have a driver state but no token, try to restore from sessionStorage
      if (state.driver && !driverToken) {
        console.log('[DriverState] Driver token missing, attempting restoration...');
        
        // Check if we have a preserved session
        try {
          const preserved = sessionStorage.getItem('driverSessionPreserved');
          if (preserved) {
            const criticalState = JSON.parse(preserved);
            if (criticalState.driverId === state.driver._id) {
              console.log('[DriverState] Found matching preserved session, but token is still missing');
              // Try to recover from server if possible
              actions.recoverFromServer();
            }
          }
        } catch (error) {
          console.error('[DriverState] Error during token restoration:', error);
        }
      }
    };

    // Monitor token every 30 seconds
    const tokenMonitor = setInterval(monitorDriverToken, 30000);

    return () => {
      clearInterval(tokenMonitor);
    };
  }, [state.driver, actions]);

  // Disable automatic token refresh for drivers - trust tokens indefinitely
  useEffect(() => {
    if (!state.driver || !state.socketConnected) return;

    console.log('[DriverState] Skipping token refresh mechanism - trusting driver token');
    
    // No token validation or refresh for drivers
    return () => {};
  }, [state.driver, state.socketConnected]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const value = {
    ...state,
    actions
  };

  return (
    <DriverStateContext.Provider value={value}>
      {children}
    </DriverStateContext.Provider>
  );
};

// Custom hook to use driver state context
export const useDriverState = () => {
  const context = useContext(DriverStateContext);
  if (!context) {
    throw new Error('useDriverState must be used within a DriverStateProvider');
  }
  return context;
};

export default DriverStateContext;