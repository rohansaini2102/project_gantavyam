// utils/rideLogger.js
const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger for ride events
const rideLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`;
    })
  ),
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File logging for ride events
    new winston.transports.File({
      filename: path.join(logsDir, 'rides.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'ride-errors.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Enhanced ride logging with detailed tracking
class RideEventTracker {
  constructor() {
    this.activeRides = new Map(); // Track active rides in memory
  }

  /**
   * Log ride event with detailed information
   * @param {string} rideId - Unique ride identifier
   * @param {string} event - Event type
   * @param {Object} data - Event data
   * @param {string} level - Log level (info, warn, error)
   */
  logEvent(rideId, event, data = {}, level = 'info') {
    const timestamp = new Date().toISOString();
    const logData = {
      rideId,
      event,
      timestamp,
      ...data
    };

    // Update active ride tracking
    if (!this.activeRides.has(rideId)) {
      this.activeRides.set(rideId, {
        rideId,
        events: [],
        startTime: timestamp,
        status: 'pending'
      });
    }

    const rideTracking = this.activeRides.get(rideId);
    rideTracking.events.push({ event, timestamp, data });
    rideTracking.lastActivity = timestamp;

    // Update status based on event
    switch (event) {
      case 'ride_request_created':
        rideTracking.status = 'pending';
        break;
      case 'ride_accepted':
        rideTracking.status = 'driver_assigned';
        rideTracking.driverId = data.driverId;
        break;
      case 'ride_started':
        rideTracking.status = 'ride_started';
        break;
      case 'ride_ended':
        rideTracking.status = 'completed';
        rideTracking.endTime = timestamp;
        break;
      case 'ride_cancelled':
        rideTracking.status = 'cancelled';
        rideTracking.endTime = timestamp;
        break;
    }

    // Log to Winston
    rideLogger[level](`RIDE-EVENT: ${rideId} | ${event}`, logData);

    // Remove from active tracking if ride is completed
    if (['completed', 'cancelled'].includes(rideTracking.status)) {
      this.logRideSummary(rideId);
      this.activeRides.delete(rideId);
    }
  }

  /**
   * Log detailed ride summary
   * @param {string} rideId - Unique ride identifier
   */
  logRideSummary(rideId) {
    const rideData = this.activeRides.get(rideId);
    if (!rideData) return;

    const summary = {
      rideId: rideData.rideId,
      status: rideData.status,
      totalEvents: rideData.events.length,
      duration: this.calculateDuration(rideData.startTime, rideData.endTime || rideData.lastActivity),
      events: rideData.events.map(e => e.event),
      timeline: rideData.events
    };

    rideLogger.info(`RIDE-SUMMARY: ${rideId}`, summary);
  }

  /**
   * Calculate duration between two timestamps
   * @param {string} start - Start timestamp
   * @param {string} end - End timestamp
   * @returns {string} Duration in human-readable format
   */
  calculateDuration(start, end) {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const durationMs = endTime - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Log status transition with detailed context
   * @param {string} rideId - Unique ride identifier
   * @param {string} fromStatus - Previous status
   * @param {string} toStatus - New status
   * @param {Object} context - Additional context
   */
  logStatusTransition(rideId, fromStatus, toStatus, context = {}) {
    const transitionData = {
      rideId,
      transition: `${fromStatus} → ${toStatus}`,
      fromStatus,
      toStatus,
      timestamp: new Date().toISOString(),
      context
    };

    // Check for valid transitions
    const validTransitions = {
      'pending': ['driver_assigned', 'cancelled'],
      'driver_assigned': ['ride_started', 'cancelled'],
      'ride_started': ['ride_ended', 'cancelled'],
      'ride_ended': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    const allowedTransitions = validTransitions[fromStatus] || [];
    const isValidTransition = allowedTransitions.includes(toStatus);

    if (!isValidTransition) {
      transitionData.warning = 'INVALID_TRANSITION';
      rideLogger.warn(`INVALID-STATUS-TRANSITION: ${rideId} | ${fromStatus} → ${toStatus}`, transitionData);
    } else {
      rideLogger.info(`STATUS-TRANSITION: ${rideId} | ${fromStatus} → ${toStatus}`, transitionData);
    }

    // Track in active rides
    if (this.activeRides.has(rideId)) {
      const rideTracking = this.activeRides.get(rideId);
      rideTracking.statusHistory = rideTracking.statusHistory || [];
      rideTracking.statusHistory.push({
        from: fromStatus,
        to: toStatus,
        timestamp: transitionData.timestamp,
        valid: isValidTransition,
        context
      });
      rideTracking.status = toStatus;
    }

    return { valid: isValidTransition, data: transitionData };
  }

  /**
   * Log socket event delivery status
   * @param {string} rideId - Unique ride identifier
   * @param {string} eventType - Socket event type
   * @param {Object} deliveryStatus - Delivery status details
   */
  logSocketDelivery(rideId, eventType, deliveryStatus) {
    const logData = {
      rideId,
      eventType,
      delivered: deliveryStatus.delivered,
      total: deliveryStatus.total,
      success: deliveryStatus.delivered > 0,
      timestamp: new Date().toISOString()
    };

    if (deliveryStatus.delivered === 0) {
      rideLogger.warn(`SOCKET-DELIVERY-FAILED: ${rideId} | ${eventType}`, logData);
    } else if (deliveryStatus.delivered < deliveryStatus.total) {
      rideLogger.warn(`SOCKET-DELIVERY-PARTIAL: ${rideId} | ${eventType}`, logData);
    } else {
      rideLogger.info(`SOCKET-DELIVERY-SUCCESS: ${rideId} | ${eventType}`, logData);
    }

    return logData;
  }

  /**
   * Get statistics for active rides
   */
  getActiveRideStats() {
    const stats = {
      totalActive: this.activeRides.size,
      byStatus: {},
      longRunning: [],
      recentActivity: []
    };

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [rideId, ride] of this.activeRides) {
      // Count by status
      stats.byStatus[ride.status] = (stats.byStatus[ride.status] || 0) + 1;

      // Check for long-running rides
      const startTime = new Date(ride.startTime);
      if (startTime < oneHourAgo) {
        stats.longRunning.push({
          rideId,
          status: ride.status,
          duration: this.calculateDuration(ride.startTime, new Date().toISOString()),
          events: ride.events.length
        });
      }

      // Recent activity (last 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const lastActivity = new Date(ride.lastActivity);
      if (lastActivity > tenMinutesAgo) {
        stats.recentActivity.push({
          rideId,
          status: ride.status,
          lastEvent: ride.events[ride.events.length - 1]?.event,
          timeSinceLastActivity: this.calculateDuration(ride.lastActivity, new Date().toISOString())
        });
      }
    }

    return stats;
  }

  /**
   * Clear old completed rides from memory (cleanup)
   */
  cleanup() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleaned = 0;

    for (const [rideId, ride] of this.activeRides) {
      const lastActivity = new Date(ride.lastActivity);
      if (lastActivity < cutoffTime) {
        this.activeRides.delete(rideId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      rideLogger.info(`CLEANUP: Removed ${cleaned} old ride records from memory`);
    }

    return cleaned;
  }

  /**
   * Get active rides summary
   * @returns {Object} Active rides statistics
   */
  getActiveRidesSummary() {
    const summary = {
      totalActive: this.activeRides.size,
      byStatus: {},
      rides: []
    };

    this.activeRides.forEach((ride, rideId) => {
      summary.byStatus[ride.status] = (summary.byStatus[ride.status] || 0) + 1;
      summary.rides.push({
        rideId,
        status: ride.status,
        events: ride.events.length,
        duration: this.calculateDuration(ride.startTime, ride.lastActivity),
        driverId: ride.driverId
      });
    });

    return summary;
  }

  /**
   * Log user action
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} data - Action data
   */
  logUserAction(userId, action, data = {}) {
    const logData = {
      userId,
      action,
      timestamp: new Date().toISOString(),
      ...data
    };

    rideLogger.info(`USER-ACTION: ${userId} | ${action}`, logData);
  }

  /**
   * Log driver action
   * @param {string} driverId - Driver ID
   * @param {string} action - Action performed
   * @param {Object} data - Action data
   */
  logDriverAction(driverId, action, data = {}) {
    const logData = {
      driverId,
      action,
      timestamp: new Date().toISOString(),
      ...data
    };

    rideLogger.info(`DRIVER-ACTION: ${driverId} | ${action}`, logData);
  }

  /**
   * Log system metrics
   * @param {Object} metrics - System metrics
   */
  logSystemMetrics(metrics = {}) {
    const systemData = {
      timestamp: new Date().toISOString(),
      activeRides: this.activeRides.size,
      ...metrics
    };

    rideLogger.info('SYSTEM-METRICS', systemData);
  }

  /**
   * Log error with ride context
   * @param {string} rideId - Ride ID (optional)
   * @param {string} error - Error message
   * @param {Object} context - Error context
   */
  logError(rideId, error, context = {}) {
    const errorData = {
      rideId,
      error,
      timestamp: new Date().toISOString(),
      ...context
    };

    rideLogger.error(`RIDE-ERROR: ${rideId || 'SYSTEM'} | ${error}`, errorData);
  }
}

// Create singleton instance
const rideTracker = new RideEventTracker();

// Export convenience functions
const logRideEvent = (rideId, event, data = {}, level = 'info') => {
  rideTracker.logEvent(rideId, event, data, level);
};

const logUserAction = (userId, action, data = {}) => {
  rideTracker.logUserAction(userId, action, data);
};

const logDriverAction = (driverId, action, data = {}) => {
  rideTracker.logDriverAction(driverId, action, data);
};

const logSystemMetrics = (metrics = {}) => {
  rideTracker.logSystemMetrics(metrics);
};

const logError = (rideId, error, context = {}) => {
  rideTracker.logError(rideId, error, context);
};

const getActiveRidesSummary = () => {
  return rideTracker.getActiveRidesSummary();
};

// Enhanced logging functions
const logStatusTransition = (rideId, fromStatus, toStatus, context = {}) => {
  return rideTracker.logStatusTransition(rideId, fromStatus, toStatus, context);
};

const logSocketDelivery = (rideId, eventType, deliveryStatus) => {
  return rideTracker.logSocketDelivery(rideId, eventType, deliveryStatus);
};

const getActiveRideStats = () => {
  return rideTracker.getActiveRideStats();
};

const cleanupOldRides = () => {
  return rideTracker.cleanup();
};

// Log system startup metrics every 5 minutes
setInterval(() => {
  const summary = rideTracker.getActiveRidesSummary();
  logSystemMetrics({
    ...summary,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
}, 5 * 60 * 1000); // 5 minutes

module.exports = {
  rideLogger,
  rideTracker,
  logRideEvent,
  logUserAction,
  logDriverAction,
  logSystemMetrics,
  logError,
  getActiveRidesSummary,
  logStatusTransition,
  logSocketDelivery,
  getActiveRideStats,
  cleanupOldRides
};