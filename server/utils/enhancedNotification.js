/**
 * Enhanced notification system for ride status updates
 * Provides reliable real-time updates with fallback mechanisms
 */

class EnhancedNotificationService {
  constructor(io) {
    this.io = io;
    this.notificationQueue = [];
    this.failedNotifications = [];
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Enhanced admin notification with comprehensive logging and retry mechanism
   */
  notifyAdmins(eventType, data, options = {}) {
    const notification = {
      id: this.generateNotificationId(),
      eventType,
      data,
      timestamp: new Date().toISOString(),
      attempts: 0,
      maxAttempts: options.maxAttempts || this.retryAttempts,
      priority: options.priority || 'normal'
    };

    return this.sendNotification(notification);
  }

  /**
   * Send notification with retry mechanism
   */
  async sendNotification(notification) {
    try {
      if (!this.io) {
        throw new Error('Socket.IO not initialized');
      }

      notification.attempts++;
      
      console.log(`📢 [Enhanced Admin Notification] ${notification.eventType} (Attempt ${notification.attempts}/${notification.maxAttempts}):`, notification.data);
      
      // Get admin room info for debugging
      const adminsRoom = this.io.sockets.adapter.rooms.get('admins');
      const adminCount = adminsRoom ? adminsRoom.size : 0;
      console.log(`👥 [Admin Debug] ${adminCount} admin(s) connected in 'admins' room`);

      if (adminCount === 0) {
        console.warn(`⚠️ [Admin Warning] No admins connected for ${notification.eventType}`);
        // Store notification for when admins reconnect
        this.storeOfflineNotification(notification);
      }

      // Primary notification - standardized format for admin panel
      const adminNotification = {
        type: notification.eventType,
        data: notification.data,
        timestamp: notification.timestamp,
        id: notification.id
      };

      // Send standardized rideUpdate event (used by admin panel)
      const rideUpdateResult = await this.emitWithAck('admins', 'rideUpdate', adminNotification);
      
      // Also send specific event for backward compatibility
      const specificEventResult = await this.emitWithAck('admins', notification.eventType, notification.data);

      // Log delivery status
      console.log(`✅ [Admin Debug] Notification ${notification.id} sent for ${notification.eventType}`);
      console.log(`📊 [Delivery Stats] rideUpdate: ${rideUpdateResult.delivered}/${rideUpdateResult.total}, ${notification.eventType}: ${specificEventResult.delivered}/${specificEventResult.total}`);
      
      // Log to enhanced logging system if available
      if (notification.data.rideId) {
        try {
          const { logSocketDelivery } = require('./rideLogger');
          logSocketDelivery(notification.data.rideId, notification.eventType, {
            delivered: Math.max(rideUpdateResult.delivered, specificEventResult.delivered),
            total: Math.max(rideUpdateResult.total, specificEventResult.total)
          });
        } catch (logError) {
          // Silently handle logging errors
        }
      }

      // If delivery failed and we have retry attempts left
      if ((rideUpdateResult.delivered === 0 || specificEventResult.delivered === 0) && 
          notification.attempts < notification.maxAttempts) {
        console.log(`🔄 [Retry] Scheduling retry for notification ${notification.id} in ${this.retryDelay}ms`);
        setTimeout(() => this.sendNotification(notification), this.retryDelay);
      } else if (notification.attempts >= notification.maxAttempts) {
        console.error(`❌ [Failed] Notification ${notification.id} failed after ${notification.attempts} attempts`);
        this.failedNotifications.push(notification);
      }

      return {
        success: true,
        notificationId: notification.id,
        delivered: Math.max(rideUpdateResult.delivered, specificEventResult.delivered),
        total: Math.max(rideUpdateResult.total, specificEventResult.total)
      };

    } catch (error) {
      console.error(`❌ [Notification Error] Failed to send ${notification.eventType}:`, error.message);
      
      if (notification.attempts < notification.maxAttempts) {
        setTimeout(() => this.sendNotification(notification), this.retryDelay);
      } else {
        this.failedNotifications.push({ ...notification, error: error.message });
      }

      return {
        success: false,
        error: error.message,
        notificationId: notification.id
      };
    }
  }

  /**
   * Emit event with acknowledgment tracking
   */
  emitWithAck(room, event, data) {
    return new Promise((resolve) => {
      const sockets = this.io.sockets.adapter.rooms.get(room);
      const totalSockets = sockets ? sockets.size : 0;
      let deliveredCount = 0;
      let responseCount = 0;

      if (totalSockets === 0) {
        return resolve({ delivered: 0, total: 0 });
      }

      // Set timeout for acknowledgments
      const timeout = setTimeout(() => {
        resolve({ delivered: deliveredCount, total: totalSockets });
      }, 5000); // 5 second timeout

      // Send with acknowledgment
      this.io.to(room).emit(event, data, (ack) => {
        if (ack && ack.received) {
          deliveredCount++;
        }
        responseCount++;
        
        // If all sockets responded, resolve early
        if (responseCount >= totalSockets) {
          clearTimeout(timeout);
          resolve({ delivered: deliveredCount, total: totalSockets });
        }
      });

      // Also send without acknowledgment for compatibility
      this.io.to(room).emit(event, data);
      
      // Assume delivery if no acknowledgment system
      if (totalSockets > 0) {
        deliveredCount = totalSockets;
      }
    });
  }

  /**
   * Store notifications for offline admins
   */
  storeOfflineNotification(notification) {
    // Keep only last 50 notifications
    if (this.notificationQueue.length >= 50) {
      this.notificationQueue.shift();
    }
    
    this.notificationQueue.push({
      ...notification,
      storedAt: new Date().toISOString()
    });
    
    console.log(`💾 [Offline Storage] Stored notification ${notification.id} for offline admins`);
  }

  /**
   * Send queued notifications when admin reconnects
   */
  sendQueuedNotifications(adminSocketId) {
    if (this.notificationQueue.length === 0) {
      return;
    }

    console.log(`📨 [Reconnect] Sending ${this.notificationQueue.length} queued notifications to admin ${adminSocketId}`);
    
    const batchData = {
      type: 'offlineNotificationsBatch',
      notifications: this.notificationQueue,
      count: this.notificationQueue.length,
      timestamp: new Date().toISOString()
    };

    this.io.to(adminSocketId).emit('offlineNotifications', batchData);
    
    // Clear queue after sending
    this.notificationQueue = [];
  }

  /**
   * Enhanced ride status update notification
   */
  notifyRideStatusUpdate(rideData, previousStatus, newStatus) {
    const eventType = this.getEventTypeFromStatus(newStatus);
    
    const enhancedData = {
      ...rideData,
      previousStatus,
      newStatus,
      statusTransition: `${previousStatus} → ${newStatus}`,
      timestamp: new Date().toISOString(),
      source: 'enhanced_notification_service'
    };

    return this.notifyAdmins(eventType, enhancedData, { priority: 'high' });
  }

  /**
   * Map status to event type
   */
  getEventTypeFromStatus(status) {
    const statusEventMap = {
      'pending': 'newRideRequest',
      'driver_assigned': 'rideAccepted',
      'ride_started': 'rideStarted',
      'ride_ended': 'rideEnded',
      'completed': 'rideCompleted',
      'cancelled': 'rideCancelled'
    };

    return statusEventMap[status] || 'rideStatusUpdated';
  }

  /**
   * Generate unique notification ID
   */
  generateNotificationId() {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      queuedNotifications: this.notificationQueue.length,
      failedNotifications: this.failedNotifications.length,
      lastFailures: this.failedNotifications.slice(-5)
    };
  }

  /**
   * Health check for notification system
   */
  healthCheck() {
    const adminsRoom = this.io?.sockets.adapter.rooms.get('admins');
    const adminCount = adminsRoom ? adminsRoom.size : 0;
    
    return {
      socketIoStatus: this.io ? 'connected' : 'disconnected',
      connectedAdmins: adminCount,
      queuedNotifications: this.notificationQueue.length,
      failedNotifications: this.failedNotifications.length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = EnhancedNotificationService;