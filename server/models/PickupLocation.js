const mongoose = require('mongoose');

const pickupLocationSchema = new mongoose.Schema({
  // Unique identifier
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Basic information
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Location type: transportation hubs only
  type: {
    type: String,
    required: true,
    enum: ['metro', 'railway', 'airport', 'bus_terminal'],
    index: true
  },
  
  // Sub-type for additional categorization
  subType: {
    type: String,
    trim: true,
    index: true
  },
  
  // Address information
  address: {
    type: String,
    required: true,
    trim: true
  },
  
  // Geographic coordinates
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere'
    }
  },
  
  // Convenience fields for lat/lng access
  lat: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  
  lng: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  
  // Metro-specific fields
  line: {
    type: String,
    trim: true,
    index: true // For metro stations: red, yellow, blue, etc.
  },
  
  // Operational status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Real-time operational data
  onlineDrivers: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalRides: {
    type: Number,
    default: 0,
    min: 0
  },
  
  avgWaitTime: {
    type: Number,
    default: 5, // in minutes
    min: 0
  },
  
  // Daily statistics
  dailyRideCounter: {
    count: {
      type: Number,
      default: 0
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  
  // Priority/popularity for sorting
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  
  // Additional metadata
  metadata: {
    description: String,
    facilities: [String], // ['parking', 'restroom', 'food', 'atm', etc.]
    openingHours: String,
    contactInfo: String,
    website: String
  }
}, {
  timestamps: true,
  collection: 'pickuplocations'
});

// Indexes for performance
pickupLocationSchema.index({ type: 1, isActive: 1 });
pickupLocationSchema.index({ name: 'text', address: 'text' });
pickupLocationSchema.index({ type: 1, subType: 1 });
pickupLocationSchema.index({ coordinates: '2dsphere' });
pickupLocationSchema.index({ priority: -1, totalRides: -1 });

// Virtual for formatted coordinates
pickupLocationSchema.virtual('location').get(function() {
  return {
    lat: this.lat,
    lng: this.lng
  };
});

// Pre-save middleware to sync coordinates
pickupLocationSchema.pre('save', function(next) {
  if (this.lat && this.lng) {
    this.coordinates = {
      type: 'Point',
      coordinates: [this.lng, this.lat] // GeoJSON format: [longitude, latitude]
    };
  }
  next();
});

// Also handle insertMany operations
pickupLocationSchema.pre('insertMany', function(next, docs) {
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      if (doc.lat && doc.lng) {
        doc.coordinates = {
          type: 'Point',
          coordinates: [doc.lng, doc.lat]
        };
      }
    });
  }
  next();
});

// Static methods
pickupLocationSchema.statics.findByType = function(type, isActive = true) {
  return this.find({ type, isActive }).sort({ priority: -1, name: 1 });
};

pickupLocationSchema.statics.findBySubType = function(subType, isActive = true) {
  return this.find({ subType, isActive }).sort({ priority: -1, name: 1 });
};

pickupLocationSchema.statics.findMetroByLine = function(line, isActive = true) {
  return this.find({ 
    type: 'metro', 
    line: line.toLowerCase(), 
    isActive 
  }).sort({ name: 1 });
};

pickupLocationSchema.statics.findNearest = function(lat, lng, maxDistance = 10000, type = null) {
  const query = {
    coordinates: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance // in meters
      }
    },
    isActive: true
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query).limit(10);
};

pickupLocationSchema.statics.searchLocations = function(searchText, type = null, limit = 20) {
  const query = {
    $or: [
      { name: { $regex: searchText, $options: 'i' } },
      { address: { $regex: searchText, $options: 'i' } },
      { subType: { $regex: searchText, $options: 'i' } }
    ],
    isActive: true
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query)
    .sort({ priority: -1, totalRides: -1, name: 1 })
    .limit(limit);
};

pickupLocationSchema.statics.getPopularLocations = function(type = null, limit = 10) {
  const query = { isActive: true };
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ totalRides: -1, priority: -1 })
    .limit(limit);
};

// Instance methods
pickupLocationSchema.methods.incrementDriverCount = function() {
  this.onlineDrivers += 1;
  return this.save();
};

pickupLocationSchema.methods.decrementDriverCount = function() {
  if (this.onlineDrivers > 0) {
    this.onlineDrivers -= 1;
  }
  return this.save();
};

pickupLocationSchema.methods.incrementRideCount = function() {
  this.totalRides += 1;
  
  // Update daily counter
  const today = new Date();
  const lastUpdate = this.dailyRideCounter.date;
  
  if (today.toDateString() === lastUpdate.toDateString()) {
    this.dailyRideCounter.count += 1;
  } else {
    // New day, reset counter
    this.dailyRideCounter.count = 1;
    this.dailyRideCounter.date = today;
  }
  
  return this.save();
};

pickupLocationSchema.methods.updateWaitTime = function(newWaitTime) {
  // Moving average calculation
  const alpha = 0.3; // Weight for new measurement
  this.avgWaitTime = Math.round(alpha * newWaitTime + (1 - alpha) * this.avgWaitTime);
  return this.save();
};

pickupLocationSchema.methods.toJSON = function() {
  const location = this.toObject();
  
  // Add computed fields
  location.location = {
    lat: this.lat,
    lng: this.lng
  };
  
  // Format for frontend consumption
  return {
    id: location.id,
    name: location.name,
    type: location.type,
    subType: location.subType,
    address: location.address,
    lat: location.lat,
    lng: location.lng,
    line: location.line,
    isActive: location.isActive,
    onlineDrivers: location.onlineDrivers,
    avgWaitTime: location.avgWaitTime,
    priority: location.priority,
    metadata: location.metadata,
    stats: {
      totalRides: location.totalRides,
      dailyRides: location.dailyRideCounter.count
    }
  };
};

module.exports = mongoose.model('PickupLocation', pickupLocationSchema);