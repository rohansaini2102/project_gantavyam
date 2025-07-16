// client/src/config.js

// Get URLs from environment variables
const API_URL_PRODUCTION = process.env.REACT_APP_API_URL_PRODUCTION || 'https://project-gantavyam.onrender.com/api';
const SOCKET_URL_PRODUCTION = process.env.REACT_APP_SOCKET_URL_PRODUCTION || 'https://project-gantavyam.onrender.com';
const API_URL_LOCAL = process.env.REACT_APP_API_URL_LOCAL || 'http://localhost:5000/api';
const SOCKET_URL_LOCAL = process.env.REACT_APP_SOCKET_URL_LOCAL || 'http://localhost:5000';

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';

// Initialize with appropriate URLs based on environment
let API_URL = isDevelopment ? API_URL_LOCAL : API_URL_PRODUCTION;
let SOCKET_URL = isDevelopment ? SOCKET_URL_LOCAL : SOCKET_URL_PRODUCTION;

// Simple configuration without auto-detection to avoid fetch errors
if (process.env.REACT_APP_ENABLE_AUTO_FALLBACK === 'true' && !isDevelopment) {
  // In production with auto-fallback enabled, we'll use a different approach
  // Check if backend is available when actually making API calls
  console.log('Auto-fallback enabled for production');
}

console.log('Environment Config:', { 
  isDevelopment, 
  API_URL, 
  SOCKET_URL,
  autoFallback: process.env.REACT_APP_ENABLE_AUTO_FALLBACK 
});

// Helper function to make API calls with fallback
const apiCall = async (endpoint, options = {}) => {
  let url = API_URL + endpoint;
  
  try {
    const response = await fetch(url, options);
    if (!response.ok && !isDevelopment && process.env.REACT_APP_ENABLE_AUTO_FALLBACK === 'true') {
      // Try localhost as fallback
      console.log('Production API failed, trying localhost fallback');
      url = API_URL_LOCAL + endpoint;
      return await fetch(url, options);
    }
    return response;
  } catch (error) {
    if (!isDevelopment && process.env.REACT_APP_ENABLE_AUTO_FALLBACK === 'true') {
      console.log('Production API error, trying localhost fallback');
      url = API_URL_LOCAL + endpoint;
      return await fetch(url, options);
    }
    throw error;
  }
};

export { API_URL, SOCKET_URL, apiCall };