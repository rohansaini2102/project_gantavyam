const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { initializeSocket } = require('./socket');
const config = require('./config/config');
const fs = require('fs');
const multer = require('multer');
const { seedMetroStations } = require('./utils/seedMetroStations');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const driverRoutes = require('./routes/drivers');
const rideRequestRoutes = require('./routes/rideRequests');
const rideHistoryRoutes = require('./routes/rideHistory');
const fareEstimationRoutes = require('./routes/fareEstimation');
const otpVerificationRoutes = require('./routes/otpVerification');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with server instance
const io = initializeSocket(server);

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000', // Frontend development server
      'https://gt2-seven.vercel.app',
      'https://gantavyam.site',
      'https://www.gantavyam.site',
      'https://gt2-evx6vat1j-rohan-sainis-projects.vercel.app',
      'https://gt2-2.onrender.com',
      'https://gt3-nkqc.onrender.com',
      'https://gt3-nine.vercel.app', // Your new frontend URL
      'https://project-gantavyam.onrender.com' // Render backend URL
    ];
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // For now, allow all Vercel deployments for testing
      if (origin.includes('.vercel.app') || origin.includes('localhost')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
const profileImagesDir = path.join(uploadDir, 'profile-images');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('Connected to MongoDB');
  
  // Seed metro stations data on first run
  try {
    const MetroStation = require('./models/MetroStation');
    const stationCount = await MetroStation.countDocuments();
    
    if (stationCount === 0) {
      console.log('No metro stations found, seeding data...');
      await seedMetroStations();
    } else {
      console.log(`✅ Metro stations already exist (${stationCount} stations)`);
    }
  } catch (error) {
    console.error('Error checking/seeding metro stations:', error);
  }
})
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/ride-requests', rideRequestRoutes);
app.use('/api/ride-history', rideHistoryRoutes);
app.use('/api/fare', fareEstimationRoutes);
app.use('/api/otp', otpVerificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + err.message
    });
  }
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ====================================
  Server running on port ${PORT}
  Socket.IO initialized
  MongoDB connected
  ====================================
  `);
});