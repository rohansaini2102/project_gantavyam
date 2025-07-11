// client/src/services/api.js
import axios from 'axios';
import { API_URL } from '../config';

// Create axios instance for JSON requests
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Create axios instance for multipart/form-data requests (file uploads)
const fileClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Longer timeout for file uploads
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});

// Add authentication token to requests with context-aware selection
const addAuthToken = (config) => {
  let token = null;
  let tokenType = 'none';
  
  // Determine which token to use based on the request URL
  const url = config.url || '';
  
  // Skip token for metro stations endpoints (they're public)
  if (url.includes('/metro-stations')) {
    // Don't add any token for metro stations
    return config;
  }
  
  if (url.includes('/admin/')) {
    token = localStorage.getItem('adminToken');
    tokenType = 'admin';
  } else if (url.includes('/drivers/')) {
    token = localStorage.getItem('driverToken');
    tokenType = 'driver';
  } else if (url.includes('/users/')) {
    token = localStorage.getItem('userToken');
    tokenType = 'user';
  } else {
    // For generic routes, try to determine from current context
    const currentPath = window.location.pathname;
    if (currentPath.includes('/admin')) {
      token = localStorage.getItem('adminToken');
      tokenType = 'admin';
    } else if (currentPath.includes('/driver')) {
      token = localStorage.getItem('driverToken');
      tokenType = 'driver';
    } else {
      token = localStorage.getItem('userToken');
      tokenType = 'user';
    }
  }
  
  // Validate token before using it
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 <= Date.now();
      
      if (isExpired) {
        console.log(`[API] ${tokenType} token is expired, removing from localStorage`);
        localStorage.removeItem(`${tokenType}Token`);
        token = null;
      }
    } catch (error) {
      console.error(`[API] Invalid ${tokenType} token format, removing from localStorage:`, error);
      localStorage.removeItem(`${tokenType}Token`);
      token = null;
    }
  }
  
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    console.log('[API] Adding auth token to request:', {
      url: config.url,
      method: config.method,
      tokenType: tokenType,
      hasToken: !!token,
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + '...'
    });
  } else {
    console.log('[API] No valid token found for request:', {
      url: config.url,
      method: config.method,
      expectedTokenType: tokenType,
      availableTokens: {
        admin: !!localStorage.getItem('adminToken'),
        user: !!localStorage.getItem('userToken'),
        driver: !!localStorage.getItem('driverToken')
      }
    });
  }
  return config;
};

// Add interceptors to both clients
[apiClient, fileClient].forEach(client => {
  // Request interceptor
  client.interceptors.request.use(
    addAuthToken,
    error => Promise.reject(error)
  );

  // Response interceptor
  client.interceptors.response.use(
    response => response,
    error => {
      // Extract error message from response
      const errorMessage = 
        error.response?.data?.error || 
        error.response?.data?.message || 
        error.message || 
        'Unknown error occurred';
      
      console.log('[API] Response error details:', {
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method,
        message: errorMessage,
        hasAuthHeader: !!error.config?.headers?.Authorization,
        authHeaderStart: error.config?.headers?.Authorization?.substring(0, 20) + '...'
      });
      
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        console.error('[API] 401 Authentication error:', {
          message: errorMessage,
          url: error.config?.url,
          hasToken: !!error.config?.headers?.Authorization
        });
        
        // Don't automatically logout on 401 errors
        // Let individual components handle authentication failures
        // This prevents unexpected logouts during normal operations
        
        // Only log the error, don't clear tokens or redirect
        console.warn('[API] 401 error detected, but not automatically logging out. Let component handle it.');
      }
      
      // Return error in normalized format
      return Promise.reject({
        error: errorMessage,
        status: error.response?.status
      });
    }
  );
});

// Authentication APIs
export const auth = {
  // User authentication
  userLogin: async (credentials) => {
    try {
      const response = await apiClient.post('/users/login', credentials);
      // Store token in localStorage
      if (response.data.token) {
        console.log('[API] Storing new user token after login');
        localStorage.setItem('userToken', response.data.token);
        localStorage.setItem('userRole', 'user');
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Force refresh of axios interceptors to use new token
        console.log('[API] Token stored, next requests will use new token');
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  userRegister: async (userData) => {
    try {
      const response = await apiClient.post('/users/register', userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Driver authentication
  driverLogin: async (credentials) => {
    try {
      const response = await apiClient.post('/drivers/login', credentials);
      // Store token in localStorage
      if (response.data.token) {
        localStorage.setItem('driverToken', response.data.token);
        localStorage.setItem('driverRole', 'driver');
        localStorage.setItem('driver', JSON.stringify({
          ...response.data.driver,
          role: 'driver'
        }));
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Admin authentication
  adminLogin: async (credentials) => {
    try {
      const response = await apiClient.post('/admin/login', credentials);
      // Store token in localStorage
      if (response.data.token) {
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminRole', 'admin');
        localStorage.setItem('admin', JSON.stringify(response.data.admin));
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Driver APIs
export const drivers = {
  // Driver registration (with file uploads)
  driverSignup: async (formData, options = {}) => {
    try {
      console.log('Sending driver registration data');
      let response;
      if (options.isAdmin) {
        // Use admin endpoint for immediate approval
        response = await fileClient.post('/admin/drivers', formData);
      } else {
        response = await fileClient.post('/drivers/register', formData);
      }
      // Store token if provided in response
      if (response.data.token) {
        localStorage.setItem('driverToken', response.data.token);
        localStorage.setItem('driverRole', 'driver');
        localStorage.setItem('driver', JSON.stringify(response.data.driver));
      }
      return response.data;
    } catch (error) {
      console.error('Driver signup error:', error);
      throw error;
    }
  },
  
  getDriverProfile: async () => {
    try {
      const response = await apiClient.get('/drivers/profile');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all metro stations for driver metro booth selection (legacy)
  getMetroStations: async () => {
    try {
      const response = await apiClient.get('/drivers/metro-stations');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all pickup locations for driver booth selection
  getPickupLocations: async () => {
    try {
      const response = await apiClient.get('/drivers/pickup-locations');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get driver dashboard data
  getDashboard: async () => {
    try {
      const response = await apiClient.get('/drivers/dashboard');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateDriverLocation: async (locationData) => {
    try {
      const response = await apiClient.put('/drivers/location', locationData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Collect payment for a completed ride
  collectPayment: async (paymentData) => {
    try {
      const response = await apiClient.post('/drivers/collect-payment', paymentData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Admin APIs
export const admin = {
  // Register driver (by admin)
  registerDriver: async (formData) => {
    try {
      console.log('Sending driver registration data (admin)');
      const response = await fileClient.post('/admin/drivers', formData);
      return response.data;
    } catch (error) {
      console.error('Admin driver registration error:', error);
      throw error;
    }
  },
  
  getAllDrivers: async () => {
    try {
      const response = await apiClient.get('/admin/drivers');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getAllUsers: async () => {
    try {
      const response = await apiClient.get('/admin/users');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getUserById: async (id) => {
    try {
      const response = await apiClient.get(`/admin/users/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  getDriverById: async (id) => {
    try {
      const response = await apiClient.get(`/admin/drivers/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Approve or reject driver
  verifyDriver: async (id, isVerified) => {
    try {
      const response = await apiClient.put(`/admin/drivers/${id}/verify`, { isVerified });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete driver
  deleteDriver: async (id) => {
    try {
      const response = await apiClient.delete(`/admin/drivers/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// User APIs
export const users = {
  // Get all metro stations for pickup selection
  getMetroStations: async () => {
    try {
      const response = await apiClient.get('/users/metro-stations');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get fare estimates for a trip
  getFareEstimate: async (fareData) => {
    try {
      const response = await apiClient.post('/users/fare-estimate', fareData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Book a ride
  bookRide: async (bookingData) => {
    try {
      const response = await apiClient.post('/users/book-ride', bookingData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user's active rides
  getActiveRides: async () => {
    try {
      const response = await apiClient.get('/users/active-rides');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user's ride history
  getRideHistory: async (page = 1, limit = 10) => {
    try {
      const response = await apiClient.get(`/users/ride-history?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user profile
  getProfile: async () => {
    try {
      const response = await apiClient.get('/users/profile');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await apiClient.put('/users/profile', profileData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Driver APIs enhancement
const driverEnhancements = {
  // Go online at a specific metro booth
  goOnline: async (onlineData) => {
    try {
      const response = await apiClient.post('/drivers/go-online', onlineData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Go offline
  goOffline: async () => {
    try {
      const response = await apiClient.post('/drivers/go-offline');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update vehicle type
  updateVehicleType: async (vehicleTypeData) => {
    try {
      const response = await apiClient.put('/drivers/vehicle-type', vehicleTypeData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get driver dashboard data
  getDashboard: async () => {
    try {
      const response = await apiClient.get('/drivers/dashboard');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get driver ride history
  getRideHistory: async (page = 1, limit = 10, status = 'all') => {
    try {
      // Try new driver-specific endpoint first, fallback to analytics
      try {
        const response = await apiClient.get(`/drivers/ride-history?page=${page}&limit=${limit}&status=${status}`);
        return response.data;
      } catch (driverError) {
        console.log('[API] Falling back to analytics endpoint for ride history');
        const response = await apiClient.get(`/analytics/driver/detailed-history?page=${page}&limit=${limit}&status=${status}`);
        return response.data;
      }
    } catch (error) {
      throw error;
    }
  },

  // Get driver statistics
  getStatistics: async () => {
    try {
      const response = await apiClient.get('/analytics/driver/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get driver earnings for a specific date range
  getEarningsHistory: async (startDate, endDate) => {
    try {
      const response = await apiClient.get(`/analytics/driver/detailed-history?startDate=${startDate}&endDate=${endDate}&status=completed`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Merge enhancements into drivers object
Object.assign(drivers, driverEnhancements);

// OTP Verification APIs
export const otp = {
  // Verify start OTP
  verifyStartOTP: async (otpData) => {
    try {
      const response = await apiClient.post('/otp/verify-start', otpData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Verify end OTP
  verifyEndOTP: async (otpData) => {
    try {
      const response = await apiClient.post('/otp/verify-end', otpData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get ride details with OTP status
  getRideDetails: async (rideId) => {
    try {
      const response = await apiClient.get(`/otp/ride/${rideId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get active rides with OTPs
  getActiveRides: async () => {
    try {
      const response = await apiClient.get('/otp/active-rides');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Export individual functions for backward compatibility
export const driverSignup = drivers.driverSignup;
export const driverLogin = auth.driverLogin;
export const adminLogin = auth.adminLogin;
export const getDriverProfile = drivers.getDriverProfile;
export const updateDriverLocation = drivers.updateDriverLocation;
export const getAllDrivers = admin.getAllDrivers;
export const getAllUsers = admin.getAllUsers;
export const getDriverById = admin.getDriverById;
export const getUserById = admin.getUserById;
export const registerDriver = admin.registerDriver;

// Fixed default export
const api = {
  auth,
  drivers,
  admin,
  users,
  otp
};

export default api;