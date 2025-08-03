import { useCallback, useEffect } from 'react';
import { useDriverState } from '../contexts/DriverStateContext';
import { getSocket } from '../services/socket';

// Custom hook for queue position management
export const useQueuePosition = () => {
  const { 
    driver,
    socket,
    socketConnected,
    isOnline,
    queuePosition,
    selectedPickupLocation,
    actions
  } = useDriverState();

  // Get queue position display text
  const getQueueDisplayText = useCallback(() => {
    if (!isOnline) {
      return 'Offline';
    }
    
    if (queuePosition === null || queuePosition === undefined) {
      return 'Not in queue';
    }
    
    if (queuePosition === 1) {
      return 'Next in line! 🚀';
    }
    
    return `Queue Position: ${queuePosition}`;
  }, [isOnline, queuePosition]);

  // Get queue status color
  const getQueueStatusColor = useCallback(() => {
    if (!isOnline) {
      return 'gray';
    }
    
    if (queuePosition === null || queuePosition === undefined) {
      return 'yellow';
    }
    
    if (queuePosition === 1) {
      return 'green';
    }
    
    if (queuePosition <= 3) {
      return 'blue';
    }
    
    return 'indigo';
  }, [isOnline, queuePosition]);

  // Setup socket listeners for queue updates (with throttling)
  useEffect(() => {
    if (socket && socketConnected) {
      console.log('[useQueuePosition] Setting up queue position listeners...');
      
      const handleQueueUpdate = (data) => {
        // Reduce logging frequency to prevent spam
        if (Math.random() < 0.1) { // Only log 10% of updates
          console.log('[useQueuePosition] Queue update received:', data);
        }
        
        // Update queue position if it's for this driver
        if (data.driverId === driver?.id || data.driver?._id === driver?.id) {
          actions.setQueuePosition(data.queuePosition || data.position);
        }
        
        // Handle queue position updates array
        if (data.queueUpdates && Array.isArray(data.queueUpdates)) {
          const driverUpdate = data.queueUpdates.find(
            update => update.driverId === driver?.id || update.driver?._id === driver?.id
          );
          
          if (driverUpdate) {
            actions.setQueuePosition(driverUpdate.queuePosition || driverUpdate.position);
          }
        }
      };
      
      const handleQueueNumberAssigned = (data) => {
        console.log('[useQueuePosition] Queue number assigned:', data);
        actions.setQueuePosition(data.queuePosition || data.position);
      };
      
      const handleQueuePositionsUpdated = (data) => {
        console.log('[useQueuePosition] Queue positions updated:', data);
        
        if (data.queueUpdates && Array.isArray(data.queueUpdates)) {
          const driverUpdate = data.queueUpdates.find(
            update => update.driverId === driver?.id || update.driver?._id === driver?.id
          );
          
          if (driverUpdate) {
            actions.setQueuePosition(driverUpdate.queuePosition || driverUpdate.position);
          }
        }
      };
      
      // Subscribe to queue-related events
      socket.on('queuePositionUpdate', handleQueueUpdate);
      socket.on('queueNumberAssigned', handleQueueNumberAssigned);
      socket.on('queuePositionsUpdated', handleQueuePositionsUpdated);
      
      return () => {
        console.log('[useQueuePosition] Cleaning up queue position listeners');
        socket.off('queuePositionUpdate', handleQueueUpdate);
        socket.off('queueNumberAssigned', handleQueueNumberAssigned);
        socket.off('queuePositionsUpdated', handleQueuePositionsUpdated);
      };
    }
  }, [socket, socketConnected, driver?.id, actions.setQueuePosition]); // More specific dependencies

  // Recovery mechanism for queue position
  const recoverQueuePosition = useCallback(async () => {
    if (!driver || !isOnline || !socketConnected) {
      return;
    }
    
    console.log('[useQueuePosition] Attempting to recover queue position...');
    
    try {
      // TODO: Implement API call to get current queue position
      // For now, we'll use the stored position
      const storedPosition = localStorage.getItem('driverQueuePosition');
      if (storedPosition) {
        const position = JSON.parse(storedPosition);
        console.log('[useQueuePosition] Recovered queue position:', position);
        actions.setQueuePosition(position);
      }
    } catch (error) {
      console.error('[useQueuePosition] Error recovering queue position:', error);
    }
  }, [driver, isOnline, socketConnected, actions]);

  // Auto-recovery on socket reconnection
  useEffect(() => {
    if (socketConnected && isOnline && queuePosition === null) {
      recoverQueuePosition();
    }
  }, [socketConnected, isOnline, queuePosition, recoverQueuePosition]);

  return {
    // Queue state
    queuePosition,
    isOnline,
    
    // Display helpers
    queueDisplayText: getQueueDisplayText(),
    queueStatusColor: getQueueStatusColor(),
    
    // Status checks
    isNextInLine: queuePosition === 1,
    isInQueue: queuePosition !== null && queuePosition !== undefined,
    isHighPriority: queuePosition && queuePosition <= 3,
    
    // Actions
    recoverQueuePosition,
    
    // Computed values
    estimatedWaitTime: queuePosition ? Math.max(0, (queuePosition - 1) * 10) : 0, // Rough estimate: 10 min per position
    positionText: queuePosition ? `${queuePosition}` : '--',
    statusBadgeProps: {
      color: getQueueStatusColor(),
      text: getQueueDisplayText()
    }
  };
};

export default useQueuePosition;