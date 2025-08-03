import { useCallback, useEffect } from 'react';
import { useDriverState } from '../contexts/DriverStateContext';
import { 
  driverGoOnline, 
  driverGoOffline, 
  subscribeToDriverUpdates, 
  unsubscribeFromDriverUpdates 
} from '../services/socket';

// Custom hook for driver status management
export const useDriverStatus = () => {
  const { 
    driver,
    socket,
    socketConnected,
    isOnline,
    isGoingOnline,
    queuePosition,
    vehicleType,
    selectedPickupLocation,
    statusError,
    actions
  } = useDriverState();

  // Toggle online/offline status
  const toggleOnlineStatus = useCallback(async () => {
    console.log('[useDriverStatus] toggleOnlineStatus called', {
      socketConnected,
      isOnline,
      vehicleType,
      driver: driver ? driver.id : 'null'
    });
    
    if (!socketConnected) {
      console.log('[useDriverStatus] ❌ Socket not connected');
      actions.setStatusError('Socket connection required');
      return;
    }

    if (!isOnline) {
      // Going online
      if (!vehicleType) {
        console.log('[useDriverStatus] ❌ No vehicle type selected');
        actions.setStatusError('Please select vehicle type');
        return;
      }
      
      if (!driver || !driver.id) {
        console.log('[useDriverStatus] ❌ Driver data missing');
        actions.setStatusError('Driver information missing');
        return;
      }
      
      actions.setStatusError('');
      actions.setGoingOnline(true);
      console.log('[useDriverStatus] ✅ Going online...');
      
      // Use fixed pickup location
      const fixedLocation = "Hauz Khas Metro Gate No 1";
      
      // Use default location coordinates
      const locationToUse = {
        lat: 28.5433, // Hauz Khas Metro coordinates
        lng: 77.2066
      };
      
      console.log('[useDriverStatus] 🚀 Calling driverGoOnline with:', {
        metroBooth: fixedLocation,
        vehicleType: vehicleType,
        driverId: driver.id,
        location: locationToUse
      });
      
      driverGoOnline({
        metroBooth: fixedLocation,
        vehicleType: vehicleType,
        driverId: driver.id,
        location: locationToUse
      });
      
      // Set a timeout to reset the loading state if no response
      setTimeout(() => {
        if (isGoingOnline) {
          console.log('[useDriverStatus] ⚠️ Timeout waiting for online confirmation');
          actions.setStatusError('Failed to go online - please try again');
          actions.setGoingOnline(false);
        }
      }, 10000); // 10 second timeout
      
    } else {
      // Going offline
      console.log('[useDriverStatus] Going offline...');
      driverGoOffline();
    }
  }, [socketConnected, isOnline, vehicleType, driver, actions, isGoingOnline]);

  // Setup socket listeners for status updates
  useEffect(() => {
    if (socket && socketConnected) {
      console.log('[useDriverStatus] Setting up socket listeners...');
      
      const callbacks = {
        onDriverOnlineConfirmed: (data) => {
          console.log('[useDriverStatus] Driver online confirmed:', data);
          actions.setOnlineStatus(true);
          actions.setQueuePosition(data.queuePosition || null);
          actions.setStatusError('');
          actions.setGoingOnline(false);
        },
        
        onDriverOfflineConfirmed: (data) => {
          console.log('[useDriverStatus] Driver offline confirmed:', data);
          actions.setOnlineStatus(false);
          actions.setQueuePosition(null);
          actions.setRideRequests([]);
          actions.setActiveRide(null);
        },
        
        onQueuePositionUpdate: (data) => {
          console.log('[useDriverStatus] Queue position updated:', data);
          actions.setQueuePosition(data.queuePosition || data.position);
        },
        
        onQueueNumberAssigned: (data) => {
          console.log('[useDriverStatus] Queue number assigned:', data);
          actions.setQueuePosition(data.queuePosition || data.position);
        },
        
        onError: (error) => {
          console.error('[useDriverStatus] Socket error:', error);
          actions.setStatusError(error.message || 'Socket communication error');
          
          // If we're trying to go online and get an error, show it in status
          if (isGoingOnline) {
            actions.setStatusError(error.message || 'Failed to go online');
            actions.setGoingOnline(false);
          }
        }
      };
      
      subscribeToDriverUpdates(callbacks);
      
      return () => {
        console.log('[useDriverStatus] Cleaning up socket subscriptions');
        unsubscribeFromDriverUpdates();
      };
    }
  }, [socket, socketConnected, actions, isGoingOnline]);

  // Sync state with server on reconnection
  useEffect(() => {
    if (socketConnected && driver && (isOnline || queuePosition)) {
      console.log('[useDriverStatus] Socket reconnected, attempting server state recovery...');
      
      // Try to recover state from server
      actions.recoverFromServer().then(recovered => {
        if (recovered) {
          console.log('[useDriverStatus] State recovered from server successfully');
        } else {
          console.log('[useDriverStatus] No state to recover from server');
        }
      }).catch(error => {
        console.error('[useDriverStatus] Error recovering state from server:', error);
      });
    }
  }, [socketConnected, driver, isOnline, queuePosition, actions]);

  return {
    // Status state
    isOnline,
    isGoingOnline,
    queuePosition,
    vehicleType,
    selectedPickupLocation,
    statusError,
    
    // Actions
    toggleOnlineStatus,
    setVehicleType: actions.setVehicleType,
    clearStatusError: () => actions.setStatusError(''),
    
    // Computed values
    canGoOnline: socketConnected && !isGoingOnline && vehicleType && driver,
    statusText: isGoingOnline ? 'Going Online...' : (isOnline ? 'Online' : 'Offline'),
    queuePositionText: queuePosition ? `Queue Position: ${queuePosition}` : 'Not in queue'
  };
};

export default useDriverStatus;