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
const Admin = require('./models/Admin');

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

// Set static folder for serving uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log file access for debugging
app.use('/uploads', (req, res, next) => {
  console.log('[File Access]', req.url);
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
.then(async () => {
  console.log('MongoDB Connected');
  // Print database statistics on startup
  printDriverStats();
  // Ensure default admin exists
  await Admin.createDefaultAdmin();
  
  // Setup periodic database monitoring
  setInterval(async () => {
    await printDriverStats();
  }, 30 * 60 * 1000); // Every 30 minutes
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Define Routes
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));

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
  console.log(`\n=========================================================
 GANTAVYAM SERVER STARTED
 Server running on port ${PORT}
 Uploads directory: ${uploadsDir}
 Database: ${process.env.MONGO_URL}
=========================================================
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection:', err.message);
  // Close server & exit process
  // server.close(() => process.exit(1));
});