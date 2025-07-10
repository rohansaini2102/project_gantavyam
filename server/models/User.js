// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number'],
    unique: true
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  profileImage: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: 'user'
  },
  // Enhanced ride statistics and tracking
  rideHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RideHistory'
  }],
  rideStatistics: {
    totalRides: {
      type: Number,
      default: 0
    },
    completedRides: {
      type: Number,
      default: 0
    },
    cancelledRides: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    favoriteVehicleType: {
      type: String,
      enum: ['bike', 'auto', 'car'],
      default: 'auto'
    },
    lastRideDate: Date,
    longestRide: {
      distance: Number,
      fare: Number,
      date: Date
    },
    preferredMetroStations: [{
      stationName: String,
      usageCount: Number
    }]
  },
  favorites: [{
    name: String,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    }
  }],
  paymentMethods: [{
    type: {
      type: String,
      enum: ['card', 'upi', 'cash'],
      default: 'cash'
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  // User preferences and settings
  preferences: {
    defaultVehicleType: {
      type: String,
      enum: ['bike', 'auto', 'car'],
      default: 'auto'
    },
    notificationSettings: {
      rideUpdates: {
        type: Boolean,
        default: true
      },
      promotions: {
        type: Boolean,
        default: true
      },
      driverLocation: {
        type: Boolean,
        default: true
      }
    },
    privacySettings: {
      shareLocationWithDriver: {
        type: Boolean,
        default: true
      },
      allowRatingFeedback: {
        type: Boolean,
        default: true
      }
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Add geospatial index for favorites locations
UserSchema.index({ 'favorites.location': '2dsphere' });

module.exports = mongoose.model('User', UserSchema);