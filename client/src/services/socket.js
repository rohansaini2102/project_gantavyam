// client/src/services/socket.js
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { getToken } from './tokenService';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.serverUrl = SOCKET_URL;
    this.reconnectionAttempts = 5;
    this.reconnectionDelay = 1000;
    this.initializePromise = null; // Track initialization
    this.blacklistedTokens = new Set(); // Track permanently blocked tokens
    this.cleanupInProgress = false; // Prevent multiple cleanup attempts
  }

  // Initialize socket connection with authentication token
  initialize(token = null) {
    // Use unified token service if no token provided
    if (!token) {
      token = getToken();
      if (!token) {
        console.error('[SocketService] ❌ Cannot initialize socket: No token found');
        return null;
      }
    }

    // Skip token validation for driver pages
    const isDriverPath = window.location.pathname.includes('/driver');
    
    if (isDriverPath) {
      console.log('[SocketService] ✅ Driver page detected - skipping token validation');
    } else {
      // Validate token before attempting connection (non-driver pages only)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        const timeUntilExpiry = payload.exp - currentTime;
        const knownExpiredTime = new Date('2025-07-18T01:35:34.000Z').getTime() / 1000;
        
        // Check for specific problematic token
        if (payload.exp === knownExpiredTime) {
          console.error('[SocketService] 🚫 BLOCKED: Known problematic token detected');
          console.error('[SocketService] 🚫 This token has been permanently blocked');
          console.error('[SocketService] 🚫 Token expired at:', new Date(payload.exp * 1000).toISOString());
          
          // Add to blacklist
          this.blacklistedTokens.add(token);
          
          // Prevent multiple cleanup attempts
          if (!this.cleanupInProgress) {
            this.cleanupInProgress = true;
            
            // Import and use nuclear cleanup immediately
            import('../utils/tokenUtils').then(({ nukeAllTokens }) => {
              nukeAllTokens();
              alert('Your session has expired. Please clear your browser cache and login again.');
              window.location.reload();
            });
          }
          
          return null;
        }
        
        // Check if token is blacklisted
        if (this.blacklistedTokens.has(token)) {
          console.error('[SocketService] 🚫 BLOCKED: Token is blacklisted');
          return null;
        }
        
        if (timeUntilExpiry < 0) {
          console.error('[SocketService] ❌ Token is expired, cannot initialize socket');
          console.error('[SocketService] ❌ Token expired at:', new Date(payload.exp * 1000).toISOString());
          console.error('[SocketService] ❌ Current time:', new Date().toISOString());
          
          // Clear expired token using unified service
          import('./tokenService').then(({ clearAllTokens }) => {
            clearAllTokens();
          });
          return null;
        }
        
        if (timeUntilExpiry < 300) { // Less than 5 minutes
          console.warn('[SocketService] ⚠️ Token expires soon:', Math.floor(timeUntilExpiry), 'seconds');
        }
        
        console.log('[SocketService] ✅ Using unified token service - token validated successfully');
      } catch (error) {
        console.error('[SocketService] ❌ Invalid token format:', error);
        return null;
      }
    }

    // Check if we already have a healthy connection
    if (this.socket && this.socket.connected && this.connected) {
      console.log('[SocketService] ✅ Reusing existing healthy socket connection');
      return this.socket;
    }

    // Check if initialization is in progress
    if (this.initializePromise) {
      console.log('[SocketService] ⏳ Socket initialization already in progress');
      return this.initializePromise;
    }

    // Clean up any existing socket before creating a new one
    this.disconnect();

    // Create new socket connection
    console.log('[SocketService] 🔌 Initializing new socket connection');
    console.log('[SocketService] 🔌 Server URL:', this.serverUrl);
    console.log('[SocketService] 🔌 Token provided:', !!token);
    
    this.initializePromise = new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          auth: { token },
          reconnection: true,
          reconnectionAttempts: this.reconnectionAttempts,
          reconnectionDelay: this.reconnectionDelay,
          reconnectionDelayMax: 5000,
          timeout: 10000,
          transports: ['websocket', 'polling'],
          upgrade: true,
          rememberUpgrade: true
        });

        // Set up event listeners
        this._setupEventListeners();
        
        // Set up token cleanup event listeners
        this._setupTokenCleanupListeners();
        
        // Set up timeout for connection
        const connectionTimeout = setTimeout(() => {
          console.error('[SocketService] ❌ Connection timeout after 10 seconds');
          this.initializePromise = null;
          resolve(null);
        }, 10000);
        
        // Resolve immediately with socket instance
        // The socket will connect asynchronously
        clearTimeout(connectionTimeout);
        console.log('[SocketService] 🔌 Socket instance created, connection pending...');
        this.initializePromise = null;
        resolve(this.socket);
        
        // Handle connection error
        this.socket.once('connect_error', (error) => {
          clearTimeout(connectionTimeout);
          this.initializePromise = null;
          console.error('[SocketService] ❌ Failed to connect:', error.message || error);
          resolve(null); // Resolve with null instead of rejecting
        });

      } catch (error) {
        console.error('[SocketService] ❌ Error creating socket:', error);
        this.initializePromise = null;
        resolve(null);
      }
    });

    return this.initializePromise;
  }

  // Set up socket event listeners
  _setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[SocketService] ✅ Connected to socket server with ID:', this.socket.id);
      this.connected = true;
      
      // For driver pages, emit rejoin event on reconnection
      const isDriverPage = window.location.pathname.includes('/driver');
      if (isDriverPage) {
        const driverData = localStorage.getItem('driver');
        if (driverData) {
          try {
            const driver = JSON.parse(driverData);
            console.log('[SocketService] 🚗 Driver reconnected, emitting rejoin event');
            this.socket.emit('driverRoomRejoin', {
              driverId: driver._id || driver.id,
              driverName: driver.fullName || driver.name,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('[SocketService] Error parsing driver data for rejoin:', error);
          }
        }
      }
    });

    this.socket.on('tokenExpired', (data) => {
      console.error('[SocketService] ❌ Server reported token expired:', data);
      
      // Skip token expiration handling for driver pages
      const isDriverPage = window.location.pathname.includes('/driver');
      if (isDriverPage) {
        console.log('⚠️ [SocketService] Ignoring token expiration for driver page');
        return;
      }
      
      this._handleTokenExpiration();
      // Force a page reload to clear everything
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });

    this.socket.on('forceTokenCleanup', async (data) => {
      console.error('[SocketService] 🔥 Server demands force token cleanup:', data);
      
      // Skip ALL cleanup for driver pages
      const isDriverPage = window.location.pathname.includes('/driver');
      
      if (isDriverPage) {
        console.log('⚠️ [SocketService] Ignoring ALL server cleanup requests for driver page');
        return;
      }
      
      // Prevent multiple cleanup attempts
      if (this.cleanupInProgress) {
        console.log('[SocketService] 🔥 Cleanup already in progress, skipping');
        return;
      }
      
      this.cleanupInProgress = true;
      
      // Import and use the nuclear option
      try {
        const { nukeAllTokens } = await import('../utils/tokenUtils');
        nukeAllTokens();
        
        // Show alert to user
        alert('Your authentication has expired. Please clear your browser cache and login again.');
        
        // Force reload immediately
        window.location.reload();
      } catch (error) {
        console.error('[SocketService] Error during force cleanup:', error);
        // Fallback: just reload
        window.location.reload();
      }
    });

    this.socket.on('connectionSuccess', (data) => {
      console.log('[SocketService] ✅ Server confirmed authentication:', data);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketService] ❌ Socket connection error:', error.message || error);
      this.connected = false;
      
      // Check if error is due to token expiration
      if (error.message && error.message.includes('jwt expired')) {
        console.log('[SocketService] 🔄 Token expired, clearing stored token');
        
        // Skip token expiration handling for driver pages
        const isDriverPage = window.location.pathname.includes('/driver');
        if (isDriverPage) {
          console.log('⚠️ [SocketService] Ignoring JWT expiration for driver page');
          return;
        }
        
        // Clear expired token and notify components
        this._handleTokenExpiration();
      }
      
      // Check if error is due to blocked token
      if (error.message && (error.message.includes('Known expired token') || error.message.includes('Rate limited'))) {
        console.error('[SocketService] 🚫 Connection blocked due to expired token');
        // Disable reconnection for blocked tokens
        if (this.socket) {
          this.socket.disconnect();
        }
        return;
      }
      
      // Log additional connection debugging info
      console.log('[SocketService] 🔍 Connection debugging info:', {
        serverUrl: this.serverUrl,
        connected: this.connected,
        socketExists: !!this.socket,
        errorType: error.type,
        errorDescription: error.description
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[SocketService] ⚠️ Socket disconnected:', reason);
      this.connected = false;
      
      // Log reconnection info
      if (reason === 'io server disconnect') {
        console.log('[SocketService] 🔄 Server initiated disconnect - will not auto-reconnect');
      } else {
        console.log('[SocketService] 🔄 Client initiated disconnect or connection lost - will auto-reconnect');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[SocketService] 🔄 Reconnected after', attemptNumber, 'attempts');
      this.connected = true;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[SocketService] 🔄 Reconnection attempt', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('[SocketService] ❌ Reconnection error:', error.message || error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[SocketService] ❌ Reconnection failed after', this.reconnectionAttempts, 'attempts');
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('[SocketService] ❌ Socket error:', error);
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      console.log('Manually disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.initializePromise = null;
    }
  }

  // Force disconnect and clear all cached connections
  forceDisconnect() {
    console.log('[SocketService] 🔄 Force disconnecting all connections');
    
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connected = false;
    this.initializePromise = null;
  }

  // Get current socket instance
  getSocket() {
    if (!this.socket) {
      console.warn('Attempted to get socket but it is not initialized');
    }
    return this.socket;
  }

  // Check if socket is connected
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }

  // Handle token expiration
  _handleTokenExpiration() {
    // Determine which token to clear based on current path
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('/admin/')) {
      localStorage.removeItem('adminToken');
      console.log('[SocketService] 🔄 Cleared expired admin token');
      // Notify about token expiration
      window.dispatchEvent(new CustomEvent('adminTokenExpired'));
    } else if (currentPath.includes('/driver/')) {
      console.log('[SocketService] 🔒 Skipping driver token clearing to preserve session');
      // Driver tokens are never cleared to prevent logout
    } else if (currentPath.includes('/user/')) {
      localStorage.removeItem('userToken');
      console.log('[SocketService] 🔄 Cleared expired user token');
      window.dispatchEvent(new CustomEvent('userTokenExpired'));
    }
    
    // Disconnect socket to prevent reconnection attempts with expired token
    this.disconnect();
  }

  // Clear expired token from localStorage
  _clearExpiredToken() {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('/admin/')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('admin');
      localStorage.removeItem('adminRole');
      sessionStorage.removeItem('adminToken');
      console.log('[SocketService] 🔄 Cleared expired admin token');
      window.dispatchEvent(new CustomEvent('adminTokenExpired'));
    } else if (currentPath.includes('/driver/')) {
      console.log('[SocketService] 🔒 Skipping driver token clearing to preserve session');
      // Driver tokens and data are never cleared to prevent logout
    } else if (currentPath.includes('/user/')) {
      localStorage.removeItem('userToken');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      sessionStorage.removeItem('userToken');
      console.log('[SocketService] 🔄 Cleared expired user token');
      window.dispatchEvent(new CustomEvent('userTokenExpired'));
    }
  }

  // Subscribe to user ride updates  
  subscribeToUserRideUpdates(callbacks = {}) {
    if (!this.socket) {
      console.error('Cannot subscribe: Socket not initialized');
      return;
    }
    
    console.log('[SocketService] 📝 Subscribing to user ride updates');
    console.log('[SocketService] 📝 Available callbacks:', Object.keys(callbacks));
    
    // User-specific ride events
    if (callbacks.onRideAccepted) {
      this.socket.on('rideAccepted', callbacks.onRideAccepted);
    }
    
    if (callbacks.onQueueNumberAssigned) {
      console.log('[SocketService] 🎫 Setting up queueNumberAssigned listener');
      this.socket.on('queueNumberAssigned', (data) => {
        console.log('[SocketService] 🎫 Received queueNumberAssigned event:', data);
        callbacks.onQueueNumberAssigned(data);
      });
    }
    
    if (callbacks.onRideStarted) {
      this.socket.on('rideStarted', callbacks.onRideStarted);
    }
    
    if (callbacks.onRideEnded) {
      this.socket.on('rideEnded', callbacks.onRideEnded);
    }
    
    if (callbacks.onRideCompleted) {
      this.socket.on('rideCompleted', callbacks.onRideCompleted);
    }
    
    if (callbacks.onRideCancelled) {
      this.socket.on('rideCancelled', callbacks.onRideCancelled);
    }
    
    if (callbacks.onDriverLocationUpdate) {
      this.socket.on('driverLocationUpdated', callbacks.onDriverLocationUpdate);
    }
    
    if (callbacks.onOTPVerificationSuccess) {
      this.socket.on('otpVerificationSuccess', callbacks.onOTPVerificationSuccess);
    }
    
    if (callbacks.onOTPVerificationError) {
      this.socket.on('otpVerificationError', callbacks.onOTPVerificationError);
    }
    
    if (callbacks.onPaymentCollected) {
      this.socket.on('paymentCollected', callbacks.onPaymentCollected);
    }
  }

  // Subscribe to driver ride requests and updates
  subscribeToDriverUpdates(callbacks = {}) {
    if (!this.socket) {
      console.error('[SocketService] ❌ Cannot subscribe to driver updates: Socket not initialized');
      return;
    }
    
    console.log('[SocketService] 📡 Subscribing to driver updates...');
    console.log('[SocketService] Socket ID:', this.socket.id);
    console.log('[SocketService] Socket connected:', this.socket.connected);
    
    // Driver-specific events
    if (callbacks.onNewRideRequest) {
      console.log('[SocketService] 🚕 Setting up newRideRequest listener');
      this.socket.on('newRideRequest', (data, ack) => {
        console.log('[SocketService] 📨 Received newRideRequest event:', data);
        console.log('[SocketService] Event data details:');
        console.log('   - Ride ID:', data._id || data.rideId);
        console.log('   - Pickup:', data.pickupLocation?.boothName);
        console.log('   - Customer:', data.userName);
        console.log('   - Vehicle Type:', data.vehicleType);
        console.log('   - Fare:', data.estimatedFare);
        console.log('   - Is Manual Booking:', data.isManualBooking);
        
        // Send acknowledgment if callback provided
        if (typeof ack === 'function') {
          console.log('[SocketService] 📨 Sending acknowledgment for ride request');
          ack({ 
            received: true, 
            rideId: data._id || data.rideId,
            timestamp: new Date().toISOString()
          });
        }
        
        callbacks.onNewRideRequest(data);
      });
    }
    
    if (callbacks.onRideAssigned) {
      console.log('[SocketService] 🚗 Setting up rideAssigned listener for auto-assignment');
      this.socket.on('rideAssigned', (data) => {
        console.log('[SocketService] 📨 Received rideAssigned event:', data);
        callbacks.onRideAssigned(data);
      });
    }
    
    if (callbacks.onRideRequestClosed) {
      this.socket.on('rideRequestClosed', callbacks.onRideRequestClosed);
    }
    
    if (callbacks.onRideAcceptConfirmed) {
      this.socket.on('rideAcceptConfirmed', callbacks.onRideAcceptConfirmed);
    }
    
    if (callbacks.onQueueNumberAssigned) {
      console.log('[SocketService] 🎫 Setting up queueNumberAssigned listener');
      this.socket.on('queueNumberAssigned', (data) => {
        console.log('[SocketService] 🎫 Received queueNumberAssigned event:', data);
        callbacks.onQueueNumberAssigned(data);
      });
    }
    
    if (callbacks.onRideAcceptError) {
      this.socket.on('rideAcceptError', callbacks.onRideAcceptError);
    }
    
    if (callbacks.onDriverOnlineConfirmed) {
      this.socket.on('driverOnlineConfirmed', callbacks.onDriverOnlineConfirmed);
    }
    
    if (callbacks.onDriverOfflineConfirmed) {
      this.socket.on('driverOfflineConfirmed', callbacks.onDriverOfflineConfirmed);
    }
    
    if (callbacks.onRideStarted) {
      this.socket.on('rideStarted', callbacks.onRideStarted);
    }
    
    if (callbacks.onRideEnded) {
      this.socket.on('rideEnded', callbacks.onRideEnded);
    }
    
    if (callbacks.onRideCompleted) {
      this.socket.on('rideCompleted', callbacks.onRideCompleted);
    }
    
    if (callbacks.onRideCancelled) {
      this.socket.on('rideCancelled', callbacks.onRideCancelled);
    }
    
    if (callbacks.onOTPVerificationSuccess) {
      this.socket.on('otpVerificationSuccess', callbacks.onOTPVerificationSuccess);
    }
    
    if (callbacks.onOTPVerificationError) {
      this.socket.on('otpVerificationError', callbacks.onOTPVerificationError);
    }
    
    // Admin-initiated status changes
    if (callbacks.onStatusChangedByAdmin) {
      this.socket.on('statusChangedByAdmin', callbacks.onStatusChangedByAdmin);
    }
    
    // Queue position updates
    if (callbacks.onQueuePositionUpdated) {
      this.socket.on('queuePositionUpdated', callbacks.onQueuePositionUpdated);
    }
    
    // Real-time driver status updates
    if (callbacks.onDriverStatusUpdated) {
      this.socket.on('driverStatusUpdated', callbacks.onDriverStatusUpdated);
    }
  }

  // Unsubscribe from user ride updates
  unsubscribeFromUserRideUpdates() {
    if (!this.socket) return;
    
    console.log('Unsubscribing from user ride updates');
    this.socket.off('rideAccepted');
    this.socket.off('queueNumberAssigned');
    this.socket.off('rideStarted');
    this.socket.off('rideEnded');
    this.socket.off('rideCancelled');
    this.socket.off('driverLocationUpdated');
    this.socket.off('otpVerificationSuccess');
    this.socket.off('otpVerificationError');
    this.socket.off('paymentCollected');
  }

  // Unsubscribe from driver updates
  unsubscribeFromDriverUpdates() {
    if (!this.socket) return;
    
    console.log('Unsubscribing from driver updates');
    this.socket.off('rideAssigned');
    this.socket.off('rideRequestClosed');
    this.socket.off('queueNumberAssigned');
    this.socket.off('driverOnlineConfirmed');
    this.socket.off('driverOfflineConfirmed');
    this.socket.off('rideStarted');
    this.socket.off('rideEnded');
    this.socket.off('rideCancelled');
    this.socket.off('otpVerificationSuccess');
    this.socket.off('otpVerificationError');
    this.socket.off('statusChangedByAdmin');
    this.socket.off('queuePositionUpdated');
    this.socket.off('driverStatusUpdated');
  }

  // Driver goes online with metro booth selection
  driverGoOnline(onlineData, callback) {
    if (!this.socket) {
      console.error('Cannot go online: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Driver going online:', onlineData);
    if (callback) {
      this.socket.emit('driverGoOnline', onlineData, callback);
    } else {
      this.socket.emit('driverGoOnline', onlineData);
    }
  }

  // Driver goes offline
  driverGoOffline(callback) {
    if (!this.socket) {
      console.error('Cannot go offline: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Driver going offline');
    if (callback) {
      this.socket.emit('driverGoOffline', {}, callback);
    } else {
      this.socket.emit('driverGoOffline', {});
    }
  }

  // Driver accepts a customer ride request
  driverAcceptRide(rideData, callback) {
    if (!this.socket) {
      console.error('Cannot accept ride: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Driver accepting customer ride:', rideData);
    if (callback) {
      this.socket.emit('driverAcceptRide', rideData, callback);
    } else {
      this.socket.emit('driverAcceptRide', rideData);
    }
  }

  // Verify start OTP
  verifyStartOTP(otpData, callback) {
    if (!this.socket) {
      console.error('Cannot verify start OTP: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Verifying start OTP:', otpData);
    if (callback) {
      this.socket.emit('verifyStartOTP', otpData, callback);
    } else {
      this.socket.emit('verifyStartOTP', otpData);
    }
  }

  // Verify end OTP
  verifyEndOTP(otpData, callback) {
    if (!this.socket) {
      console.error('Cannot verify end OTP: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Verifying end OTP:', otpData);
    if (callback) {
      this.socket.emit('verifyEndOTP', otpData, callback);
    } else {
      this.socket.emit('verifyEndOTP', otpData);
    }
  }

  // Cancel ride
  cancelRide(cancelData, callback) {
    if (!this.socket) {
      console.error('Cannot cancel ride: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Cancelling ride:', cancelData);
    if (callback) {
      this.socket.emit('cancelRide', cancelData, callback);
    } else {
      this.socket.emit('cancelRide', cancelData);
    }
  }

  // Update driver location
  updateDriverLocation(locationData, callback) {
    if (!this.socket) {
      console.error('Cannot update location: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    // Don't log location updates as frequently to avoid spam
    if (callback) {
      this.socket.emit('updateDriverLocation', locationData, callback);
    } else {
      this.socket.emit('updateDriverLocation', locationData);
    }
  }

  // Admin toggles driver status
  adminToggleDriverStatus(driverId, isOnline, callback) {
    if (!this.socket) {
      console.error('Cannot toggle driver status: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Admin toggling driver status:', { driverId, isOnline });
    const data = { driverId, isOnline };
    
    if (callback) {
      this.socket.emit('adminToggleDriverStatus', data, callback);
    } else {
      this.socket.emit('adminToggleDriverStatus', data);
    }
  }

  // Generic method to emit events with error handling
  emitEvent(eventName, data, callback) {
    if (!this.socket) {
      console.error(`Cannot emit ${eventName}: Socket not initialized`);
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log(`Emitting ${eventName} event:`, data);
    if (callback) {
      this.socket.emit(eventName, data, callback);
    } else {
      this.socket.emit(eventName, data);
    }
  }

  // Set up token cleanup event listeners
  _setupTokenCleanupListeners() {
    if (!this.socket) return;
    
    // Listen for token cleanup events from server
    this.socket.on('forceTokenCleanup', async (data) => {
      console.error('[SocketService] 🔥 Server demands force token cleanup:', data);
      
      // Skip ALL cleanup for driver pages
      const isDriverPage = window.location.pathname.includes('/driver');
      
      if (isDriverPage) {
        console.log('⚠️ [SocketService] Ignoring ALL server cleanup requests for driver page');
        return;
      }
      
      // Prevent multiple cleanup attempts
      if (this.cleanupInProgress) {
        console.log('[SocketService] 🔥 Cleanup already in progress, ignoring...');
        return;
      }
      
      this.cleanupInProgress = true;
      
      try {
        // Import and use nuclear cleanup
        const { forceTokenCleanup } = await import('../utils/tokenCleanup');
        await forceTokenCleanup();
        
        // Show user notification
        const message = data.severity === 'CRITICAL' ? 
          'CRITICAL: Your session has expired. Please clear your browser cache and login again.' :
          'Your session has expired. Please login again.';
        
        alert(message);
        
        // Force page reload
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
      } catch (error) {
        console.error('[SocketService] Error during cleanup:', error);
        alert('Session expired. Please refresh the page and login again.');
        window.location.reload();
      }
    });
    
    // Listen for token expired events
    this.socket.on('tokenExpired', (data) => {
      console.error('[SocketService] ❌ Server reported token expired:', data);
      this._handleTokenExpiration();
    });
  }
}

// Create singleton instance
const socketService = new SocketService();

// Export instance methods
export const initializeSocket = (token) => socketService.initialize(token);
export const disconnectSocket = () => socketService.disconnect();
export const forceDisconnectSocket = () => socketService.forceDisconnect();
export const getSocket = () => socketService.getSocket();
export const isSocketConnected = () => socketService.isConnected();

// User methods
export const subscribeToUserRideUpdates = (callbacks) => socketService.subscribeToUserRideUpdates(callbacks);
export const unsubscribeFromUserRideUpdates = () => socketService.unsubscribeFromUserRideUpdates();

// Driver methods
export const subscribeToDriverUpdates = (callbacks) => socketService.subscribeToDriverUpdates(callbacks);
export const unsubscribeFromDriverUpdates = () => socketService.unsubscribeFromDriverUpdates();
export const driverGoOnline = (onlineData, callback) => socketService.driverGoOnline(onlineData, callback);
export const driverGoOffline = (callback) => socketService.driverGoOffline(callback);
export const driverAcceptRide = (rideData, callback) => socketService.driverAcceptRide(rideData, callback);
export const updateDriverLocation = (locationData, callback) => socketService.updateDriverLocation(locationData, callback);

// OTP methods
export const verifyStartOTP = (otpData, callback) => socketService.verifyStartOTP(otpData, callback);
export const verifyEndOTP = (otpData, callback) => socketService.verifyEndOTP(otpData, callback);

// Ride management
export const cancelRide = (cancelData, callback) => socketService.cancelRide(cancelData, callback);

// Admin methods
export const adminToggleDriverStatus = (driverId, isOnline, callback) => socketService.adminToggleDriverStatus(driverId, isOnline, callback);

// Generic method
export const emitEvent = (eventName, data, callback) => socketService.emitEvent(eventName, data, callback);

export default socketService;