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
    console.log('Initializing new socket connection with token');
    
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

  // Subscribe to driver updates for a specific ride
  subscribeToDriverUpdates(rideId, callbacks = {}) {
    if (!this.socket) {
      console.error('Cannot subscribe: Socket not initialized');
      return;
    }
    
    console.log(`Subscribing to driver updates for ride ${rideId}`);
    
    // Set up callbacks for each event type
    if (callbacks.onLocationUpdate) {
      this.socket.on('driverLocationUpdated', callbacks.onLocationUpdate);
    }
    
    if (callbacks.onRideAccepted) {
      this.socket.on('rideAccepted', callbacks.onRideAccepted);
    }
    
    if (callbacks.onRideCompleted) {
      this.socket.on('rideCompleted', callbacks.onRideCompleted);
    }
    
    if (callbacks.onRideCancelled) {
      this.socket.on('rideCancelled', callbacks.onRideCancelled);
    }
    
    if (callbacks.onDriverArrival) {
      this.socket.on('driverArrived', callbacks.onDriverArrival);
    }
    
    if (callbacks.onMessage) {
      this.socket.on('newMessage', callbacks.onMessage);
    }
  }

  // Unsubscribe from driver updates
  unsubscribeFromDriverUpdates() {
    if (!this.socket) return;
    
    console.log('Unsubscribing from driver updates');
    this.socket.off('driverLocationUpdated');
    this.socket.off('rideAccepted');
    this.socket.off('rideCompleted');
    this.socket.off('rideCancelled');
    this.socket.off('driverArrived');
    this.socket.off('newMessage');
  }

  // Send a ride request to available drivers
  sendRideRequest(rideRequest, callback) {
    if (!this.socket) {
      console.error('Cannot send ride request: Socket not initialized');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return;
    }
    
    console.log('Sending ride request:', rideRequest);
    if (callback) {
      this.socket.emit('userRideRequest', rideRequest, callback);
    } else {
      this.socket.emit('userRideRequest', rideRequest);
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
export const subscribeToDriverUpdates = (rideId, callbacks) => socketService.subscribeToDriverUpdates(rideId, callbacks);
export const unsubscribeFromDriverUpdates = () => socketService.unsubscribeFromDriverUpdates();
export const sendRideRequest = (rideRequest, callback) => socketService.sendRideRequest(rideRequest, callback);
export const emitEvent = (eventName, data, callback) => socketService.emitEvent(eventName, data, callback);

export default socketService;