// client/src/services/api.js
import axios from 'axios';
import { API_URL } from '../config';
import { getToken, setToken } from './tokenService';
import { driverStateThrottler } from '../utils/throttle';
import { logSync } from '../utils/syncDebugger';

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
  timeout: 180000, // 3 minutes timeout for file uploads
  headers: {
    'Content-Type': 'multipart/form-data'
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity
});

// Add authentication token to requests with context-aware selection
const addAuthToken = (config) => {
  let token = null;
  let tokenType = 'none';
  
  // Determine which token to use based on the request URL
  const url = config.url || '';
  
  // Skip token for metro stations and pickup locations endpoints (they're public)
  if (url.includes('/metro-stations') || url.includes('/pickup-locations')) {
    // Don't add any token for metro stations and pickup locations
    return config;
  }
  
  // Determine context from URL
  let context = null;
  if (url.includes('/admin/')) {
    context = '/admin';
    tokenType = 'admin';
  } else if (url.includes('/drivers/')) {
    context = '/driver';
    tokenType = 'driver';
  } else if (url.includes('/users/')) {
    context = '/user';
    tokenType = 'user';
  } else {
    // For generic routes, use current path
    context = window.location.pathname;
    if (context.includes('/admin')) {
      tokenType = 'admin';
    } else if (context.includes('/driver')) {
      tokenType = 'driver';
    } else {
      tokenType = 'user';
    }
  }
  
  // Use unified token service
  token = getToken(context);
  
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
      context: context
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
      // Store token using unified service
      if (response.data.token) {
        console.log('[API] Storing new user token after login');
        setToken('user', response.data.token, { user: response.data.user });
        
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
      // Store token using unified service
      if (response.data.token) {
        setToken('driver', response.data.token, { 
          user: {
            ...response.data.driver,
            role: 'driver'
          }
        });
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Admin authentication
  adminLogin: async (credentials) => {
    try {
      console.log('🔐 [API] Admin login request:', credentials.email);
      console.log('🔐 [API] Using API URL:', apiClient.defaults.baseURL);
      
      // Use the correct auth endpoint
      const response = await apiClient.post('/auth/admin/login', credentials);
      console.log('🔐 [API] Admin login response:', response.data);
      
      // Store token using unified service
      if (response.data.token) {
        setToken('admin', response.data.token, { user: response.data.admin });
        console.log('🔐 [API] Token stored successfully');
      } else {
        console.error('🔐 [API] No token in response!');
      }
      return response.data;
    } catch (error) {
      console.error('🔐 [API] Admin login error:', error);
      console.error('🔐 [API] Error response:', error.response?.data);
      throw error;
    }
  }
};

// Driver APIs
export const drivers = {
  // Driver registration (with file uploads)
  driverSignup: async (formData, onProgress = null, options = {}) => {
    const startTime = performance.now();
    const maxRetries = 2;
    let attempt = 0;
    
    // Safely call progress callback
    const safeProgressCallback = (progress) => {
      if (typeof onProgress === 'function') {
        try {
          onProgress(Math.min(100, Math.max(0, Math.round(progress))));
        } catch (error) {
          console.error('[Driver Signup] Progress callback error:', error);
        }
      }
    };

    while (attempt <= maxRetries) {
      try {
        console.log(`[Driver Signup] Attempt ${attempt + 1}/${maxRetries + 1} - Sending driver registration data`);
        
        // Configure upload progress tracking with improved handling
        const config = {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = (progressEvent.loaded / progressEvent.total) * 100;
              safeProgressCallback(progress);
              
              // Log progress for debugging
              if (progress % 20 === 0 || progress === 100) {
                console.log(`[Driver Signup] Upload progress: ${progress.toFixed(1)}%`);
              }
            }
          },
          // Add retry-specific timeouts
          timeout: attempt === 0 ? 180000 : 120000, // First attempt longer timeout
          validateStatus: (status) => {
            // Accept 2xx status codes
            return status >= 200 && status < 300;
          }
        };
        
        let response;
        if (options.isAdmin) {
          // Use admin endpoint for immediate approval
          response = await fileClient.post('/admin/drivers', formData, config);
        } else {
          response = await fileClient.post('/drivers/register', formData, config);
        }
        
        const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`[Driver Signup] Registration successful after ${processingTime}s`);
        
        // Store token if provided in response
        if (response.data.token) {
          setToken('driver', response.data.token, { user: response.data.driver });
        }
        
        // Ensure 100% progress is reported
        safeProgressCallback(100);
        
        return response.data;
        
      } catch (error) {
        const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
        console.error(`[Driver Signup] Attempt ${attempt + 1} failed after ${processingTime}s:`, error);
        
        attempt++;
        
        // Check if we should retry
        const shouldRetry = attempt <= maxRetries && (
          error.code === 'ECONNABORTED' || // Timeout
          error.code === 'NETWORK_ERROR' || // Network error
          (error.response && error.response.status >= 500) // Server error
        );
        
        if (shouldRetry) {
          console.log(`[Driver Signup] Retrying in 2 seconds... (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // No more retries or non-retryable error
        console.error(`[Driver Signup] Final failure after ${attempt} attempts:`, error);
        
        // Enhanced error handling
        let errorMessage = 'Registration failed. Please try again.';
        
        if (error.response) {
          // Server responded with error
          errorMessage = error.response.data?.error || 
                        error.response.data?.message || 
                        `Server error (${error.response.status})`;
        } else if (error.code === 'ECONNABORTED') {
          errorMessage = 'Upload timeout. Please check your internet connection and try again.';
        } else if (error.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error. Please check your internet connection.';
        }
        
        throw {
          error: errorMessage,
          status: error.response?.status,
          attempts: attempt
        };
      }
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
  },

  // Driver State Synchronization with throttling
  syncDriverState: async (stateData) => {
    try {
      // Check rate limiting
      if (driverStateThrottler.isRateLimited('driver_state_sync', 10, 60000)) {
        const error = new Error('Rate limit exceeded for driver state sync');
        error.rateLimited = true;
        logSync('RATE_LIMITED', 'Driver state sync rate limit exceeded', { limit: 10, windowMs: 60000 });
        throw error;
      }
      
      console.log('[API] Syncing driver state:', stateData);
      
      // Use exponential backoff for reliability
      const response = await driverStateThrottler.withBackoff(
        'driver_state_sync_request',
        async () => {
          return await apiClient.post('/drivers/sync-state', stateData);
        },
        {
          maxRetries: 2,
          backoffMultiplier: 1.5
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('[API] Error syncing driver state:', error);
      
      // Don't log rate limit errors as errors
      if (error.rateLimited) {
        console.warn('[API] Driver state sync rate limited');
        logSync('RATE_LIMITED', 'API rate limit response', { error: error.message });
        return { 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.',
          rateLimited: true 
        };
      }
      
      throw error;
    }
  },

  // Refresh driver token
  refreshToken: async () => {
    try {
      const response = await apiClient.post('/drivers/refresh-token');
      if (response.data.success && response.data.token) {
        // Update stored token
        localStorage.setItem('driverToken', response.data.token);
        // Update axios headers
        apiClient.defaults.headers.Authorization = `Bearer ${response.data.token}`;
        console.log('[API] Driver token refreshed successfully');
      }
      return response.data;
    } catch (error) {
      console.error('[API] Error refreshing driver token:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to refresh token'
      };
    }
  },

  // Get Driver Current Status with throttling
  getDriverStatus: async () => {
    try {
      // Apply throttling to prevent excessive status checks
      const result = await driverStateThrottler.throttle(
        'driver_status_check',
        async () => {
          console.log('[API] Getting driver status');
          const response = await apiClient.get('/drivers/status');
          return response.data;
        },
        {
          minInterval: 10000 // 10 seconds minimum between status checks
        }
      );
      
      if (result.throttled) {
        console.log('[API] Driver status check throttled:', result.message);
        logSync('THROTTLED', 'Driver status check throttled', { message: result.message });
        return { 
          success: false, 
          error: result.message,
          throttled: true 
        };
      }
      
      return result;
    } catch (error) {
      console.error('[API] Error getting driver status:', error);
      throw error;
    }
  },

  getPendingRides: async () => {
    const token = localStorage.getItem('driverToken');
    const response = await fetch(`${API_URL}/drivers/pending-rides`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
  },

  getRideHistory: async (page = 1, limit = 10, status = 'all') => {
    const token = localStorage.getItem('driverToken');
    const response = await fetch(`${API_URL}/drivers/ride-history?page=${page}&limit=${limit}&status=${status}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
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
  },

  // Ride Management APIs
  getRides: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await apiClient.get(`/admin/rides?${queryParams}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getRideDetails: async (rideId) => {
    try {
      const response = await apiClient.get(`/admin/rides/${rideId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getBoothRides: async (boothName, filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await apiClient.get(`/admin/rides/booth/${boothName}?${queryParams}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateRideStatus: async (rideId, statusData) => {
    try {
      const response = await apiClient.put(`/admin/rides/${rideId}/status`, statusData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getRideAnalytics: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await apiClient.get(`/admin/rides/analytics/summary?${queryParams}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getBoothsList: async () => {
    try {
      const response = await apiClient.get('/admin/rides/booths/list');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Dashboard and statistics
  getDashboardStats: async () => {
    try {
      const response = await apiClient.get('/admin/dashboard/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getBoothPerformance: async (days = 7) => {
    try {
      const response = await apiClient.get(`/admin/booths/performance?days=${days}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Manual Booking APIs
  createManualBooking: async (bookingData) => {
    try {
      const response = await apiClient.post('/admin/manual-booking', bookingData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  checkUserByPhone: async (phone) => {
    try {
      const response = await apiClient.get(`/admin/check-user/${phone}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  registerCustomer: async (customerData) => {
    try {
      const response = await apiClient.post('/admin/register-customer', customerData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  sendPaymentLinkSMS: async (paymentData) => {
    try {
      const response = await apiClient.post('/admin/send-payment-link', paymentData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getManualBookingDetails: async (bookingId) => {
    try {
      const response = await apiClient.get(`/admin/manual-booking/${bookingId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get fare estimates for manual booking (admin context)
  getFareEstimate: async (fareData) => {
    try {
      // Admin always gets detailed breakdown
      const response = await apiClient.post('/fare/estimate', {
        ...fareData,
        detailed: true // Admin gets full breakdown
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

,

  // Fare Management APIs
  getFareConfig: async () => {
    try {
      const response = await apiClient.get('/admin/fare/fare-config');
      return response.data;
    } catch (error) {
      console.error('Get fare config error:', error);
      throw error;
    }
  },

  getFareHistory: async () => {
    try {
      const response = await apiClient.get('/admin/fare/fare-config/history');
      return response.data;
    } catch (error) {
      console.error('Get fare history error:', error);
      throw error;
    }
  },

  updateVehicleFare: async (vehicleType, config) => {
    try {
      const response = await apiClient.put(`/admin/fare/fare-config/vehicle/${vehicleType}`, config);
      return response.data;
    } catch (error) {
      console.error('Update vehicle fare error:', error);
      throw error;
    }
  },

  updateAllVehicleFares: async (data) => {
    try {
      const response = await apiClient.put('/admin/fare/fare-config/vehicles', data);
      return response.data;
    } catch (error) {
      console.error('Update all vehicles fare error:', error);
      throw error;
    }
  },

  updateSurgePricing: async (data) => {
    try {
      const response = await apiClient.put('/admin/fare/fare-config/surge', data);
      return response.data;
    } catch (error) {
      console.error('Update surge pricing error:', error);
      throw error;
    }
  },

  updateDynamicPricing: async (data) => {
    try {
      const response = await apiClient.put('/admin/fare/fare-config/dynamic', data);
      return response.data;
    } catch (error) {
      console.error('Update dynamic pricing error:', error);
      throw error;
    }
  },

  simulateFare: async (data) => {
    try {
      const response = await apiClient.post('/admin/fare/fare-config/simulate', data);
      return response.data;
    } catch (error) {
      console.error('Simulate fare error:', error);
      throw error;
    }
  },

  // Financial Management APIs
  getFinancialSummary: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/admin/financial/summary?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Get financial summary error:', error);
      throw error;
    }
  },

  getRevenueTrends: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/admin/financial/trends?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Get revenue trends error:', error);
      throw error;
    }
  },

  getPaymentAnalytics: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/admin/financial/payment-analytics?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Get payment analytics error:', error);
      throw error;
    }
  },

  getTopRoutes: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/admin/financial/top-routes?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Get top routes error:', error);
      throw error;
    }
  },

  exportFinancialReport: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/admin/financial/export?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Export financial report error:', error);
      throw error;
    }
  },

  restoreFareConfig: async (configId) => {
    try {
      const response = await apiClient.post(`/admin/fare/fare-config/restore/${configId}`);
      return response.data;
    } catch (error) {
      console.error('Restore fare config error:', error);
      throw error;
    }
  }
};

// User APIs
export const users = {
  // Get all metro stations for pickup selection (legacy)
  getMetroStations: async () => {
    try {
      const response = await apiClient.get('/users/metro-stations');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all pickup locations for pickup selection 
  getPickupLocations: async () => {
    try {
      const response = await apiClient.get('/users/pickup-locations');
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
      const response = await apiClient.get(`/ride-history/user-rides?page=${page}&limit=${limit}`);
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
  },

  // Check for pending assignments (fallback for missed socket events)
  checkPendingAssignments: async () => {
    try {
      const response = await apiClient.get('/drivers/check-pending-assignments');
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

// Export additional functions used in RideManagement
export const getMetroStations = users.getMetroStations;
export const getAdminRides = admin.getRides;
export const getRideStats = admin.getDashboardStats;
export const getRideDetails = admin.getRideDetails;

// Utility function to clear axios headers (for token cleanup)
export const clearAxiosHeaders = () => {
  [apiClient, fileClient].forEach(client => {
    if (client.defaults.headers.Authorization) {
      delete client.defaults.headers.Authorization;
      console.log('[API] Cleared authorization header');
    }
  });
};

// Fixed default export
const api = {
  auth,
  drivers,
  admin,
  users,
  otp,
  clearAxiosHeaders
};

export default api;