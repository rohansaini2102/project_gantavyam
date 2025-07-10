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
  getActiveRidesSummary
};