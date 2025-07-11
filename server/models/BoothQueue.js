const mongoose = require('mongoose');

const boothQueueSchema = new mongoose.Schema({
  boothName: {
    type: String,
    required: true,
    index: true
  },
  boothCode: {
    type: String,
    required: true,
    uppercase: true,
    maxlength: 4
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  dailyCounter: {
    type: Number,
    default: 0,
    min: 0
  },
  activeRides: [{
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RideRequest'
    },
    queueNumber: String,
    queuePosition: Number,
    status: {
      type: String,
      enum: ['queued', 'in_progress', 'completed'],
      default: 'queued'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],
  totalToday: {
    type: Number,
    default: 0,
    min: 0
  },
  currentlyServing: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient booth-date queries
boothQueueSchema.index({ boothName: 1, date: 1 }, { unique: true });

// Index for active rides queries
boothQueueSchema.index({ 'activeRides.rideId': 1 });
boothQueueSchema.index({ 'activeRides.status': 1 });

// Update lastUpdated on save
boothQueueSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Method to get current queue status
boothQueueSchema.methods.getQueueStatus = function() {
  const queuedRides = this.activeRides.filter(ride => ride.status === 'queued');
  const inProgressRides = this.activeRides.filter(ride => ride.status === 'in_progress');
  
  return {
    boothName: this.boothName,
    boothCode: this.boothCode,
    date: this.date,
    totalToday: this.totalToday,
    currentlyServing: this.currentlyServing,
    queuedCount: queuedRides.length,
    inProgressCount: inProgressRides.length,
    totalActive: this.activeRides.length,
    nextQueueNumber: this.dailyCounter + 1,
    estimatedWaitTime: queuedRides.length * 3 // Rough estimate: 3 minutes per ride
  };
};

// Method to add ride to queue
boothQueueSchema.methods.addToQueue = function(rideId) {
  this.dailyCounter += 1;
  this.totalToday += 1;
  
  const queuePosition = this.dailyCounter;
  const queueNumber = `${this.boothCode}-${this.date.replace(/-/g, '')}-Q${String(queuePosition).padStart(3, '0')}`;
  
  this.activeRides.push({
    rideId: rideId,
    queueNumber: queueNumber,
    queuePosition: queuePosition,
    status: 'queued'
  });
  
  return {
    queueNumber,
    queuePosition,
    totalInQueue: this.activeRides.filter(ride => ride.status === 'queued').length
  };
};

// Method to update ride status in queue
boothQueueSchema.methods.updateRideStatus = function(rideId, newStatus) {
  const ride = this.activeRides.find(ride => ride.rideId.toString() === rideId.toString());
  if (ride) {
    ride.status = newStatus;
    if (newStatus === 'in_progress') {
      this.currentlyServing = ride.queuePosition;
    }
    return true;
  }
  return false;
};

// Method to remove ride from queue
boothQueueSchema.methods.removeFromQueue = function(rideId) {
  const initialLength = this.activeRides.length;
  this.activeRides = this.activeRides.filter(ride => ride.rideId.toString() !== rideId.toString());
  return this.activeRides.length < initialLength;
};

// Static method to get booth code from booth name
boothQueueSchema.statics.getBoothCode = function(boothName) {
  const boothCodes = {
    'kashmere gate': 'KASH',
    'kashmere': 'KASH',
    'rajiv chowk': 'RAJV',
    'rajiv': 'RAJV',
    'connaught place': 'CP',
    'new delhi': 'NDLS',
    'central secretariat': 'CSEC',
    'hauz khas': 'HAUZ',
    'dwarka sector 21': 'DWRK',
    'dwarka': 'DWRK',
    'noida city centre': 'NOID',
    'noida': 'NOID',
    'chandni chowk': 'CCHK',
    'indira gandhi international airport': 'IGIA',
    'airport': 'AIRP',
    'anand vihar': 'ANVH',
    'sarai kale khan': 'SSKH'
  };
  
  const lowerName = boothName.toLowerCase();
  
  // Try exact match first
  if (boothCodes[lowerName]) {
    return boothCodes[lowerName];
  }
  
  // Try partial matches
  for (const [key, code] of Object.entries(boothCodes)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return code;
    }
  }
  
  // Fallback: use first 4 characters of name
  return boothName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4) || 'UNKN';
};

module.exports = mongoose.model('BoothQueue', boothQueueSchema);