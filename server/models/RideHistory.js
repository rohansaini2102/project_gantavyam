const mongoose = require('mongoose');

const rideHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  fare: {
    type: Number,
    required: true
  },
  distance: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled'],
    required: true
  },
  driverName: {
    type: String,
    required: true
  },
  driverPhone: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RideHistory', rideHistorySchema); 