// models/MetroStation.js
const mongoose = require('mongoose');

const MetroStationSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  line: {
    type: String,
    required: true,
    enum: ['Red', 'Yellow', 'Blue', 'Green', 'Violet', 'Pink', 'Magenta', 'Orange']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  onlineDrivers: {
    type: Number,
    default: 0
  },
  totalRides: {
    type: Number,
    default: 0
  },
  avgWaitTime: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
MetroStationSchema.index({ location: '2dsphere' });

// Create index for efficient line-based queries
MetroStationSchema.index({ line: 1 });

// Static method to find stations by line
MetroStationSchema.statics.findByLine = function(lineName) {
  return this.find({ line: lineName, isActive: true });
};

// Static method to find nearest station
MetroStationSchema.statics.findNearest = function(lat, lng, maxDistance = 5000) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance
      }
    },
    isActive: true
  });
};

// Method to increment online drivers count
MetroStationSchema.methods.incrementOnlineDrivers = function() {
  this.onlineDrivers += 1;
  return this.save();
};

// Method to decrement online drivers count
MetroStationSchema.methods.decrementOnlineDrivers = function() {
  this.onlineDrivers = Math.max(0, this.onlineDrivers - 1);
  return this.save();
};

module.exports = mongoose.model('MetroStation', MetroStationSchema);