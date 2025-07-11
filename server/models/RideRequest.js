const mongoose = require('mongoose');

const rideRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userPhone: {
    type: String,
    required: true
  },
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
  distance: {
    type: Number,
    required: true
  },
  fare: {
    type: Number,
    required: true
  },
  vehicleType: {
    type: String,
    required: [true, 'Please select a vehicle type'],
    enum: ['bike', 'auto', 'car']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'driver_assigned', 'driver_arrived', 'ride_started', 'ride_ended', 'completed', 'cancelled'],
    default: 'pending'
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  driverLocation: {
    latitude: Number,
    longitude: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  startOTP: {
    type: String,
    length: 4
  },
  endOTP: {
    type: String,
    length: 4
  },
  rideId: {
    type: String,
    unique: true,
    required: true
  },
  driverArrivedAt: Date,
  rideStartedAt: Date,
  rideEndedAt: Date,
  estimatedFare: {
    type: Number,
    required: true
  },
  actualFare: {
    type: Number
  },
  driverName: String,
  driverPhone: String,
  driverVehicleNo: String,
  driverRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  boothRideNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  // New queue management fields
  queueNumber: {
    type: String,
    sparse: true,
    index: true
  },
  queuePosition: {
    type: Number,
    min: 1
  },
  queueAssignedAt: {
    type: Date
  },
  queueStatus: {
    type: String,
    enum: ['queued', 'in_progress', 'completed'],
    default: 'queued'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'collected', 'online'],
    default: 'pending'
  },
  paymentCollectedAt: Date,
  paymentMethod: {
    type: String,
    enum: ['cash', 'online', 'upi'],
    default: 'cash'
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'driver', 'system']
  },
  driversNotified: Number,
  broadcastAt: Date,
  broadcastMethod: String
});

// Index for efficient booth ride number queries
rideRequestSchema.index({ boothRideNumber: 1 });
rideRequestSchema.index({ paymentStatus: 1 });
rideRequestSchema.index({ 'pickupLocation.boothName': 1, timestamp: -1 });

// Indexes for queue management
rideRequestSchema.index({ queueNumber: 1 });
rideRequestSchema.index({ 'pickupLocation.boothName': 1, queueStatus: 1, queuePosition: 1 });
rideRequestSchema.index({ queueAssignedAt: -1 });

module.exports = mongoose.model('RideRequest', rideRequestSchema); 