const mongoose = require('mongoose');

const vehicleConfigSchema = new mongoose.Schema({
  baseFare: {
    type: Number,
    required: true,
    min: 0
  },
  perKmRate: {
    type: Number,
    required: true,
    min: 0
  },
  minimumFare: {
    type: Number,
    required: true,
    min: 0
  },
  waitingChargePerMin: {
    type: Number,
    required: true,
    min: 0
  },
  // New fields for commission system
  baseKilometers: {
    type: Number,
    default: 2 // First 2 km included in base fare
  },
  gstPercentage: {
    type: Number,
    default: 5,
    min: 0,
    max: 100
  },
  commissionPercentage: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  }
});

const surgeTimeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  startHour: {
    type: Number,
    required: true,
    min: 0,
    max: 23
  },
  endHour: {
    type: Number,
    required: true,
    min: 0,
    max: 23
  },
  factor: {
    type: Number,
    required: true,
    min: 1.0,
    max: 3.0
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const dynamicPricingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  minRatio: {
    type: Number,
    required: true,
    min: 0
  },
  maxRatio: {
    type: Number,
    min: 0
  },
  factor: {
    type: Number,
    required: true,
    min: 1.0,
    max: 3.0
  },
  description: String
});

const fareConfigSchema = new mongoose.Schema({
  vehicleConfigs: {
    bike: {
      type: vehicleConfigSchema,
      required: true
    },
    auto: {
      type: vehicleConfigSchema,
      required: true
    },
    car: {
      type: vehicleConfigSchema,
      required: true
    }
  },
  surgeTimes: [surgeTimeSchema],
  dynamicPricing: [dynamicPricingSchema],
  // Night charge settings
  nightCharge: {
    isActive: {
      type: Boolean,
      default: true
    },
    startHour: {
      type: Number,
      default: 23, // 11 PM
      min: 0,
      max: 23
    },
    endHour: {
      type: Number,
      default: 5, // 5 AM
      min: 0,
      max: 23
    },
    percentage: {
      type: Number,
      default: 20, // 20% night charge
      min: 0,
      max: 100
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedByName: String,
  version: {
    type: Number,
    default: 1
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  notes: String
}, {
  timestamps: true
});

// Create history when fare config is updated
fareConfigSchema.pre('save', async function(next) {
  if (!this.isNew) {
    this.version = this.version + 1;
  }
  next();
});

// Static method to get active config
fareConfigSchema.statics.getActiveConfig = async function() {
  let config = await this.findOne({ isActive: true }).sort('-createdAt');
  
  // If no config exists, create default one
  if (!config) {
    config = await this.create({
      vehicleConfigs: {
        bike: {
          baseFare: 30, // For first 2 km
          perKmRate: 12, // After 2 km
          minimumFare: 30,
          waitingChargePerMin: 1,
          baseKilometers: 2,
          gstPercentage: 5,
          commissionPercentage: 10
        },
        auto: {
          baseFare: 40, // For first 2 km
          perKmRate: 17, // After 2 km
          minimumFare: 40,
          waitingChargePerMin: 2,
          baseKilometers: 2,
          gstPercentage: 5,
          commissionPercentage: 10
        },
        car: {
          baseFare: 60, // For first 2 km
          perKmRate: 25, // After 2 km
          minimumFare: 60,
          waitingChargePerMin: 3,
          baseKilometers: 2,
          gstPercentage: 5,
          commissionPercentage: 10
        }
      },
      surgeTimes: [
        {
          name: 'Morning Peak',
          startHour: 8,
          endHour: 10,
          factor: 1.3,
          isActive: true
        },
        {
          name: 'Evening Peak',
          startHour: 17,
          endHour: 20,
          factor: 1.4,
          isActive: true
        },
        {
          name: 'Night',
          startHour: 22,
          endHour: 5,
          factor: 1.2,
          isActive: true
        }
      ],
      dynamicPricing: [
        {
          name: 'No Drivers',
          minRatio: 0,
          maxRatio: 0,
          factor: 1.8,
          description: 'When no drivers are available'
        },
        {
          name: 'High Demand',
          minRatio: 3,
          maxRatio: null,
          factor: 1.5,
          description: 'More than 3 requests per driver'
        },
        {
          name: 'Medium Demand',
          minRatio: 2,
          maxRatio: 3,
          factor: 1.3,
          description: '2-3 requests per driver'
        },
        {
          name: 'Low Demand',
          minRatio: 1,
          maxRatio: 2,
          factor: 1.2,
          description: '1-2 requests per driver'
        },
        {
          name: 'Normal',
          minRatio: 0,
          maxRatio: 1,
          factor: 1.0,
          description: 'Less than 1 request per driver'
        }
      ],
      nightCharge: {
        isActive: true,
        startHour: 23,
        endHour: 5,
        percentage: 20
      },
      isActive: true
    });
  }
  
  return config;
};

const FareConfig = mongoose.model('FareConfig', fareConfigSchema);

module.exports = FareConfig;