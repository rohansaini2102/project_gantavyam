// models/Driver.js
const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please add a full name']
  },
  mobileNo: {
    type: String,
    required: [true, 'Please add a mobile number'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Mobile number must be exactly 10 digits'
    }
  },
  aadhaarNo: {
    type: String,
    required: [true, 'Please add an Aadhaar number'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{12}$/.test(v);
      },
      message: 'Aadhaar number must be exactly 12 digits'
    }
  },
  aadhaarPhotoFront: {
    type: String,
    required: [true, 'Please upload Aadhaar front photo']
  },
  aadhaarPhotoBack: {
    type: String,
    required: [true, 'Please upload Aadhaar back photo']
  },
  driverSelfie: {
    type: String,
    required: [true, 'Please capture a live photo']
  },
  vehicleNo: {
    type: String,
    required: [true, 'Please add a vehicle number'],
    unique: true,
    validate: {
      validator: function(v) {
        // Indian vehicle number format: 2-3 letters, 2 digits, 1-2 letters, 1-4 digits
        // e.g., DL01AB1234, MH12DE3456, KA05MH1234
        return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{1,4}$/.test(v);
      },
      message: 'Vehicle number must be in valid Indian format (e.g., DL01AB1234)'
    }
  },
  vehicleType: {
    type: String,
    required: [true, 'Please select a vehicle type'],
    enum: ['bike', 'auto', 'car'],
    default: 'auto'
  },
  registrationCertificatePhoto: {
    type: String,
    required: [true, 'Please upload registration certificate photo']
  },
  bankDetails: {
    accountHolderName: {
      type: String,
      required: [true, 'Please add account holder name']
    },
    accountNumber: {
      type: String,
      required: [true, 'Please add account number'],
      validate: {
        validator: function(v) {
          return /^[0-9]{9,18}$/.test(v);
        },
        message: 'Account number must be 9-18 digits'
      }
    },
    ifscCode: {
      type: String,
      required: [true, 'Please add IFSC code'],
      validate: {
        validator: function(v) {
          return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
        },
        message: 'IFSC code must be in valid format (e.g., SBIN0001234)'
      }
    },
    bankName: {
      type: String,
      required: [true, 'Please add bank name']
    }
  },
  drivingLicenseNo: {
    type: String,
    required: [true, 'Please add driving license number']
  },
  drivingLicensePhoto: {
    type: String,
    required: [true, 'Please upload driving license photo']
  },
  permitNo: {
    type: String,
    required: false
  },
  permitPhoto: {
    type: String,
    required: false
  },
  fitnessCertificateNo: {
    type: String,
    required: false
  },
  fitnessCertificatePhoto: {
    type: String,
    required: false
  },
  insurancePolicyNo: {
    type: String,
    required: false
  },
  insurancePolicyPhoto: {
    type: String,
    required: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  lastRenewalDate: {
    type: Date,
    default: Date.now
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  preferences: {
    darkMode: {
      type: Boolean,
      default: false
    }
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  currentMetroBooth: {
    type: String,
    default: null
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRides: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  lastActiveTime: {
    type: Date,
    default: Date.now
  },
  queuePosition: {
    type: Number,
    default: null
  },
  queueEntryTime: {
    type: Date,
    default: null
  },
  currentRide: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RideRequest',
    default: null
  }
}, {
  timestamps: true
});

// Create a geospatial index on the location field
DriverSchema.index({ location: '2dsphere' });

// Add bcrypt for password hashing
const bcrypt = require('bcryptjs');

// Match driver entered password to hashed password in database
DriverSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Driver', DriverSchema);