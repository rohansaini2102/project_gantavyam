// client/src/config.js

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';

// Use local URLs in development, production URLs otherwise
const API_URL = isDevelopment 
  ? 'http://localhost:5000/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const SOCKET_URL = isDevelopment 
  ? 'http://localhost:5000'
  : (process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000');

console.log('Environment:', { isDevelopment, API_URL, SOCKET_URL });

export { API_URL, SOCKET_URL }; 