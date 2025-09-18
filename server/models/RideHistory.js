const mongoose = require('mongoose');

const rideHistorySchema = new mongoose.Schema({
  // Basic ride information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  rideId: {
    type: String,
    required: true,
    unique: true
  },
  boothRideNumber: {
    type: String,
    required: true
  },
  
  // Location information
  pickupLocation: {
    boothName: String,
    latitude: Number,
    longitude: Number
  },
  dropLocation: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  
  // Ride details
  vehicleType: {
    type: String,
    enum: ['bike', 'auto', 'car'],
    required: true
  },
  distance: {
    type: Number,
    required: true
  },
  estimatedFare: {
    type: Number,
    required: true
  },
  actualFare: {
    type: Number,
    required: true
  },

  // New fare fields for commission system
  driverFare: {
    type: Number,
    default: null // Driver's base earnings (without GST/commission)
  },
  customerFare: {
    type: Number,
    default: null // Total customer payment
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  commissionAmount: {
    type: Number,
    default: 0
  },
  nightChargeAmount: {
    type: Number,
    default: 0
  },
  fareBreakdown: {
    base: Number,
    gst: Number,
    commission: Number,
    nightCharge: Number,
    total: Number,
    driverEarning: Number
  },
  
  // Status and completion
  status: {
    type: String,
    enum: ['completed', 'cancelled'],
    required: true
  },
  cancellationReason: String,
  cancelledBy: {
    type: String,
    enum: ['user', 'driver', 'system']
  },
  
  // Driver information
  driverName: String,
  driverPhone: String,
  driverVehicleNo: String,
  driverRating: {
    type: Number,
    min: 0,
    max: 5
  },
  
  // Journey timeline
  timestamps: {
    requested: {
      type: Date,
      required: true
    },
    driverAssigned: Date,
    rideStarted: Date,
    rideEnded: Date,
    completed: Date,
    cancelled: Date
  },
  
  // Payment information
  paymentStatus: {
    type: String,
    enum: ['pending', 'collected', 'online'],
    default: 'collected'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'online', 'upi'],
    default: 'cash'
  },
  paymentCollectedAt: Date,
  
  // OTP information
  startOTP: {
    type: String,
    required: false
  },
  endOTP: {
    type: String,
    required: false
  },
  
  // Ratings and feedback
  userRating: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  driverRatingForUser: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  
  // Journey statistics
  journeyStats: {
    totalDuration: Number, // in minutes
    waitingTime: Number, // time from request to ride start
    rideDuration: Number, // actual ride time
    averageSpeed: Number,
    routeEfficiency: Number // percentage compared to optimal route
  },
  
  // System metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RideHistory', rideHistorySchema); 