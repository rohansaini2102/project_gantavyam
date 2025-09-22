// models/SmsLog.js
const mongoose = require('mongoose');

const smsLogSchema = new mongoose.Schema({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RideRequest',
    required: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  messageType: {
    type: String,
    enum: ['booking_confirmation', 'driver_assigned', 'otp_resend', 'custom'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  startOTP: {
    type: String
  },
  endOTP: {
    type: String
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    required: true,
    default: 'pending'
  },
  twilioMessageId: {
    type: String,
    index: true
  },
  errorReason: {
    type: String
  },
  errorCode: {
    type: String
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  adminName: {
    type: String
  },
  cost: {
    type: Number, // Cost in USD cents
    default: 0
  },
  deliveryStatus: {
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'failed', 'unknown'],
    default: 'unknown'
  },
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  deliveredAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'smslogs'
});

// Index for efficient queries
smsLogSchema.index({ rideId: 1, sentAt: -1 });
smsLogSchema.index({ phoneNumber: 1, sentAt: -1 });
smsLogSchema.index({ status: 1, sentAt: -1 });
smsLogSchema.index({ adminId: 1, sentAt: -1 });

// Virtual for formatted phone number
smsLogSchema.virtual('formattedPhone').get(function() {
  if (!this.phoneNumber) return '';
  // Format +919876543210 to +91 98765 43210
  const cleaned = this.phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return this.phoneNumber;
});

// Static method to log SMS attempt
smsLogSchema.statics.logSMS = async function(data) {
  try {
    const smsLog = new this({
      rideId: data.rideId,
      phoneNumber: data.phoneNumber,
      messageType: data.messageType || 'custom',
      message: data.message,
      startOTP: data.startOTP,
      endOTP: data.endOTP,
      status: data.status || 'pending',
      twilioMessageId: data.twilioMessageId,
      errorReason: data.errorReason,
      errorCode: data.errorCode,
      adminId: data.adminId,
      adminName: data.adminName,
      cost: data.cost || 0,
      deliveryStatus: data.deliveryStatus || 'unknown'
    });

    await smsLog.save();
    console.log(`📊 SMS log created: ${smsLog._id}`);
    return smsLog;
  } catch (error) {
    console.error('❌ Failed to create SMS log:', error.message);
    return null;
  }
};

// Static method to get SMS history for a ride
smsLogSchema.statics.getRideHistory = async function(rideId) {
  try {
    return await this.find({ rideId })
      .populate('adminId', 'name email')
      .sort({ sentAt: -1 })
      .lean();
  } catch (error) {
    console.error('❌ Failed to get SMS history:', error.message);
    return [];
  }
};

// Static method to get admin SMS stats
smsLogSchema.statics.getAdminStats = async function(adminId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.aggregate([
      {
        $match: {
          adminId: new mongoose.Types.ObjectId(adminId),
          sentAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCost: { $sum: '$cost' }
        }
      }
    ]);

    return stats;
  } catch (error) {
    console.error('❌ Failed to get admin SMS stats:', error.message);
    return [];
  }
};

module.exports = mongoose.model('SmsLog', smsLogSchema);