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
}, {
  timestamps: true  // This automatically adds createdAt and updatedAt fields
});

// Status transition validation
const validStatusTransitions = {
  'pending': ['driver_assigned', 'cancelled'],
  'driver_assigned': ['ride_started', 'cancelled'],
  'ride_started': ['ride_ended', 'cancelled'],
  'ride_ended': ['completed', 'cancelled'],
  'completed': [], // Terminal state
  'cancelled': []  // Terminal state
};

// Pre-save middleware to validate status transitions and enforce business rules
rideRequestSchema.pre('save', async function(next) {
  if (this.isModified('status') && !this.isNew) {
    try {
      const oldDoc = await this.constructor.findById(this._id);
      if (oldDoc && oldDoc.status !== this.status) {
        const allowedTransitions = validStatusTransitions[oldDoc.status] || [];
        if (!allowedTransitions.includes(this.status)) {
          return next(new Error(`Invalid status transition from ${oldDoc.status} to ${this.status}`));
        }
      }
    } catch (error) {
      return next(error);
    }
  }

  // Validate business rules
  if (this.status === 'driver_assigned' && !this.driverId) {
    return next(new Error('Cannot assign driver status without a driver'));
  }

  if (this.status === 'ride_started') {
    if (!this.driverId) {
      return next(new Error('Cannot start ride without a driver'));
    }
    if (!this.rideStartedAt) {
      this.rideStartedAt = new Date();
    }
  }

  if (this.status === 'ride_ended') {
    if (!this.rideStartedAt) {
      return next(new Error('Cannot end ride that was never started'));
    }
    if (!this.rideEndedAt) {
      this.rideEndedAt = new Date();
    }
  }

  if (this.status === 'completed') {
    if (!this.rideEndedAt) {
      return next(new Error('Cannot complete ride that was not ended'));
    }
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
  }

  if (this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }

  next();
});

// Instance method to safely update status with validation
rideRequestSchema.methods.updateStatus = function(newStatus, additionalData = {}) {
  const currentStatus = this.status;
  const allowedTransitions = validStatusTransitions[currentStatus] || [];
  
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
  }
  
  this.status = newStatus;
  Object.assign(this, additionalData);
  
  return this.save();
};

// Index for efficient booth ride number queries
rideRequestSchema.index({ boothRideNumber: 1 });
rideRequestSchema.index({ paymentStatus: 1 });
rideRequestSchema.index({ 'pickupLocation.boothName': 1, createdAt: -1 });

// Indexes for queue management
rideRequestSchema.index({ queueNumber: 1 });
rideRequestSchema.index({ 'pickupLocation.boothName': 1, queueStatus: 1, queuePosition: 1 });
rideRequestSchema.index({ queueAssignedAt: -1 });

module.exports = mongoose.model('RideRequest', rideRequestSchema); 