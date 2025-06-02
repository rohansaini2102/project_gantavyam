const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { initializeSocket } = require('./socket');
const config = require('./config/config');
const fs = require('fs');
const multer = require('multer');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const driverRoutes = require('./routes/drivers');
const rideRequestRoutes = require('./routes/rideRequests');
const rideHistoryRoutes = require('./routes/rideHistory');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with server instance
const io = initializeSocket(server);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', // Frontend development server
    'https://gt2-seven.vercel.app',
    'https://gantavyam.site',
    'https://www.gantavyam.site',
    'https://gt2-evx6vat1j-rohan-sainis-projects.vercel.app',
    'https://gt2-2.onrender.com'
  ],
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
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/ride-requests', rideRequestRoutes);
app.use('/api/ride-history', rideHistoryRoutes);

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