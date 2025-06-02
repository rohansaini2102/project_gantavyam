// config.js - Configuration settings for the ride-sharing app
require('dotenv').config(); // Load environment variables from .env file

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.MONGO_URL;

module.exports = {
  // MongoDB connection URI - use local MongoDB in development, cloud in production
  mongoURI: isDevelopment 
    ? 'mongodb://localhost:27017/gantavyam'
    : process.env.MONGO_URL,

  // JWT secret key for authentication
  jwtSecret: process.env.JWT_SECRET || 'fallback_jwt_secret_key',

  // Server configuration
  port: process.env.PORT || 5000,
  
  // CORS origins - include both local and production
  allowedOrigins: [
    'http://localhost:3000', // Frontend development server
    'https://gt2-seven.vercel.app',
    'https://gantavyam.site',
    'https://www.gantavyam.site',
    'https://gt2-evx6vat1j-rohan-sainis-projects.vercel.app',
    'https://gt2-2.onrender.com',
    'https://gt3-nkqc.onrender.com' // New backend URL
  ],
  
  // File upload paths
  uploadDir: 'uploads',
  profileImagesDir: 'uploads/profile-images',
  
  // Development flag
  isDevelopment,
  
  // Other app-specific settings as needed
};