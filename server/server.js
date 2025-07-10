// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { printDriverStats } = require('./controllers/driverController');
const http = require('http');
const { initializeSocket } = require('./socket');
const config = require('./config/config');
const Admin = require('./models/Admin');
const { createContextLogger } = require('./config/logger');
const requestLogger = require('./middleware/requestLogger');
const { seedMetroStations } = require('./utils/seedMetroStations');

const logger = createContextLogger('Server');

console.log('Current working directory:', process.cwd());
console.log('server.js directory:', __dirname);
console.log('Does .env exist?', fs.existsSync(path.join(__dirname, '.env')));
if (fs.existsSync(path.join(__dirname, '.env'))) {
  console.log('Contents of .env:', fs.readFileSync(path.join(__dirname, '.env'), 'utf8'));
} else {
  console.log('.env file not found in server directory.');
}
require('dotenv').config({ path: path.join(__dirname, '.env') });
console.log('Loaded MONGO_URL:', process.env.MONGO_URL); // Debug print

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize express app
const app = express();

// Middleware
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware
app.use(requestLogger);

// Set static folder for serving uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log file access for debugging
app.use('/uploads', (req, res, next) => {
  console.log('[File Access]', req.url);
  next();
});

// Connect to MongoDB
const mongoOptions = {
  serverSelectionTimeoutMS: 10000, // 10 seconds
  socketTimeoutMS: 45000,
};

mongoose.connect(process.env.MONGO_URL, mongoOptions)
.then(async () => {
  logger.info('MongoDB Connected successfully', { 
    mongoUrl: process.env.MONGO_URL?.replace(/:([^:@]{1,})@/, ':***@') // Hide password in logs
  });
  // Print database statistics on startup
  printDriverStats();
  // Ensure default admin exists
  await Admin.createDefaultAdmin();
  
  // Seed metro stations if not present
  try {
    const MetroStation = require('./models/MetroStation');
    const stationCount = await MetroStation.countDocuments();
    
    if (stationCount === 0) {
      logger.info('No metro stations found, seeding data...');
      await seedMetroStations();
      logger.info('Metro stations seeded successfully');
    } else {
      logger.info(`Metro stations already exist (${stationCount} stations)`);
    }
  } catch (error) {
    logger.error('Error checking/seeding metro stations:', error);
  }
  
  // Setup periodic database monitoring
  setInterval(async () => {
    await printDriverStats();
  }, 30 * 60 * 1000); // Every 30 minutes
})
.catch(err => {
  logger.error('MongoDB connection error', { 
    error: err.message, 
    stack: err.stack 
  });
  logger.error('MongoDB Connection Failed - Possible solutions:');
  logger.error('1. Check your internet connection');
  logger.error('2. Verify MongoDB Atlas is accessible (not blocked by firewall)');
  logger.error('3. Check if your IP is whitelisted in MongoDB Atlas');
  logger.error('4. Try using a local MongoDB instance for development');
  
  // Don't exit immediately, allow for retry
  setTimeout(() => {
    logger.info('Retrying MongoDB connection...');
    mongoose.connect(process.env.MONGO_URL, mongoOptions)
      .then(() => logger.info('MongoDB Connected on retry'))
      .catch(() => {
        logger.error('MongoDB retry failed. Exiting...');
        process.exit(1);
      });
  }, 5000);
});

// Define Routes
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ride-requests', require('./routes/rideRequests'));
app.use('/api/ride-history', require('./routes/rideHistory'));
app.use('/api/fare', require('./routes/fareEstimation'));
app.use('/api/otp', require('./routes/otpVerification'));

// Basic route for API status
app.get('/', (req, res) => {
  res.send('API is running...');
});

// MongoDB monitoring route
app.get('/api/status', async (req, res) => {
  try {
    const Driver = mongoose.model('Driver');
    const totalDrivers = await Driver.countDocuments();
    const recentDrivers = await Driver.find()
      .sort({ registrationDate: -1 })
      .limit(5)
      .select('fullName mobileNo registrationDate');
    
    res.json({
      status: 'success',
      mongodb: {
        connected: mongoose.connection.readyState === 1,
        state: mongoose.STATES[mongoose.connection.readyState]
      },
      data: {
        totalDrivers,
        recentDrivers
      }
    });
  } catch (error) {
    console.error('Status API error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Could not fetch database status'
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Server error',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
// Initialize Socket.IO
initializeSocket(server);
server.listen(PORT, () => {
  logger.info('GANTAVYAM SERVER STARTED', {
    port: PORT,
    uploadsDirectory: uploadsDir,
    database: process.env.MONGO_URL?.replace(/:([^:@]{1,})@/, ':***@'), // Hide password in logs
    nodeEnv: process.env.NODE_ENV || 'development'
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection', { 
    error: err.message, 
    stack: err.stack 
  });
  // Close server & exit process
  // server.close(() => process.exit(1));
});