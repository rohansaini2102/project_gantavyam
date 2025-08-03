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
    'http://localhost:3001', // Alternative frontend port
    'https://gt2-seven.vercel.app',
    'https://gantavyam.site',
    'https://www.gantavyam.site', // Main production domain
    'https://gt2-evx6vat1j-rohan-sainis-projects.vercel.app',
    'https://gt2-2.onrender.com',
    'https://gt3-nkqc.onrender.com',
    'https://gt3-nine.vercel.app', // Your frontend on Vercel
    'https://project-gantavyam.onrender.com' // Render backend URL
  ].filter(Boolean),
  
  // File upload paths
  uploadDir: 'uploads',
  profileImagesDir: 'uploads/profile-images',
  
  // Development flag
  isDevelopment,
  
  // Other app-specific settings as needed
};