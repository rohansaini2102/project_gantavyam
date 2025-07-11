// client/src/services/socket.js
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.serverUrl = SOCKET_URL;
    this.reconnectionAttempts = 5;
    this.reconnectionDelay = 1000;
    this.initializePromise = null; // Track initialization
  }

  // Initialize socket connection with authentication token
  initialize(token) {
    if (!token) {
      console.error('Cannot initialize socket: No token provided');
      return null;
    }

    // Check if we already have a connection
    if (this.socket && this.socket.connected) {
      console.log('Reusing existing socket connection');
      return this.socket;
    }

    // Check if initialization is in progress
    if (this.initializePromise) {
      console.log('Socket initialization already in progress');
      return this.initializePromise;
    }

    // Clean up any existing socket before creating a new one
    this.disconnect();

    // Create new socket connection
    console.log('[SocketService] 🔌 Initializing new socket connection with token');
    console.log('[SocketService] 🔌 Server URL:', this.serverUrl);
    
    this.initializePromise = new Promise((resolve) => {
      this.socket = io(this.serverUrl, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: this.reconnectionAttempts,
        reconnectionDelay: this.reconnectionDelay,
        transports: ['websocket', 'polling']
      });

      // Set up event listeners
      this._setupEventListeners();
      
      // Wait for connection
      this.socket.once('connect', () => {
        this.initializePromise = null;
        resolve(this.socket);
      });
      
      // Handle connection error
      this.socket.once('connect_error', (error) => {
        this.initializePromise = null;
        console.error('Failed to connect:', error);
        resolve(null);
      });
    });

    return this.socket;
  }

  // Set up socket event listeners
  _setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to socket server with ID:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('connectionSuccess', (data) => {
      console.log('✅ Server confirmed authentication:', data);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      this.connected = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
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
      console.error('Cannot subscribe: Socket not initialized');
      return;
    }
    
    console.log('Subscribing to driver updates');
    
    // Driver-specific events
    if (callbacks.onNewRideRequest) {
      this.socket.on('newRideRequest', callbacks.onNewRideRequest);
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
    this.socket.off('newRideRequest');
    this.socket.off('rideRequestClosed');
    this.socket.off('rideAcceptConfirmed');
    this.socket.off('queueNumberAssigned');
    this.socket.off('rideAcceptError');
    this.socket.off('driverOnlineConfirmed');
    this.socket.off('driverOfflineConfirmed');
    this.socket.off('rideStarted');
    this.socket.off('rideEnded');
    this.socket.off('rideCancelled');
    this.socket.off('otpVerificationSuccess');
    this.socket.off('otpVerificationError');
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

  // Driver accepts a ride
  driverAcceptRide(rideData, callback) {
    if (!this.socket) {
      console.error('Cannot accept ride: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Driver accepting ride:', rideData);
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
}

// Create singleton instance
const socketService = new SocketService();

// Export instance methods
export const initializeSocket = (token) => socketService.initialize(token);
export const disconnectSocket = () => socketService.disconnect();
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

// Generic method
export const emitEvent = (eventName, data, callback) => socketService.emitEvent(eventName, data, callback);

export default socketService;