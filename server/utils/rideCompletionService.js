/**
 * Service to handle automatic ride completion and fallback mechanisms
 * Ensures rides don't get stuck in intermediate states
 */

const RideRequest = require('../models/RideRequest');
const RideLifecycleService = require('../services/rideLifecycle');
const { logRideEvent } = require('./rideLogger');

class RideCompletionService {
  constructor(notificationService = null) {
    this.notificationService = notificationService;
    this.autoCompletionEnabled = true;
    this.timeouts = {
      pendingToCancel: 30 * 60 * 1000, // 30 minutes
      assignedToCancel: 15 * 60 * 1000, // 15 minutes  
      startedToEnd: 60 * 60 * 1000,     // 60 minutes
      endedToComplete: 60 * 60 * 1000   // 60 minutes
    };
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Check and fix rides that are stuck in various states
   */
  async checkAndFixStuckRides() {
    console.log('🔍 [Auto Completion] Checking for stuck rides...');
    
    try {
      const fixes = {
        cancelledPendingRides: await this.cancelLongPendingRides(),
        cancelledAssignedRides: await this.cancelLongAssignedRides(),
        endedLongStartedRides: await this.endLongStartedRides(),
        completedLongEndedRides: await this.completeLongEndedRides()
      };

      const totalFixed = Object.values(fixes).reduce((sum, arr) => sum + arr.length, 0);
      
      if (totalFixed > 0) {
        console.log(`✅ [Auto Completion] Fixed ${totalFixed} stuck rides:`, fixes);
      } else {
        console.log('✅ [Auto Completion] No stuck rides found');
      }

      return fixes;
    } catch (error) {
      console.error('❌ [Auto Completion] Error during cleanup:', error);
      return null;
    }
  }

  /**
   * Cancel rides that have been pending for too long
   */
  async cancelLongPendingRides() {
    const cutoffTime = new Date(Date.now() - this.timeouts.pendingToCancel);
    
    const stuckRides = await RideRequest.find({
      status: 'pending',
      createdAt: { $lt: cutoffTime }
    });

    const cancelled = [];
    for (const ride of stuckRides) {
      try {
        await this.updateRideWithNotification(ride, 'cancelled', {
          cancelledAt: new Date(),
          cancelledBy: 'system',
          cancellationReason: 'No driver found within time limit'
        });
        
        cancelled.push(ride.rideId);
        console.log(`🚫 [Auto Cancel] Cancelled pending ride ${ride.rideId} - no driver found`);
      } catch (error) {
        console.error(`❌ [Auto Cancel] Failed to cancel ride ${ride.rideId}:`, error.message);
      }
    }

    return cancelled;
  }

  /**
   * Cancel rides that have been assigned but not started for too long
   */
  async cancelLongAssignedRides() {
    const cutoffTime = new Date(Date.now() - this.timeouts.assignedToCancel);
    
    const stuckRides = await RideRequest.find({
      status: 'driver_assigned',
      acceptedAt: { $lt: cutoffTime }
    });

    const cancelled = [];
    for (const ride of stuckRides) {
      try {
        await this.updateRideWithNotification(ride, 'cancelled', {
          cancelledAt: new Date(),
          cancelledBy: 'system',
          cancellationReason: 'Driver did not start ride within time limit'
        });
        
        cancelled.push(ride.rideId);
        console.log(`🚫 [Auto Cancel] Cancelled assigned ride ${ride.rideId} - driver did not start`);
      } catch (error) {
        console.error(`❌ [Auto Cancel] Failed to cancel ride ${ride.rideId}:`, error.message);
      }
    }

    return cancelled;
  }

  /**
   * Auto-end rides that have been started for too long
   */
  async endLongStartedRides() {
    const cutoffTime = new Date(Date.now() - this.timeouts.startedToEnd);
    
    const stuckRides = await RideRequest.find({
      status: 'ride_started',
      rideStartedAt: { $lt: cutoffTime }
    });

    const ended = [];
    for (const ride of stuckRides) {
      try {
        await this.updateRideWithNotification(ride, 'ride_ended', {
          rideEndedAt: new Date(),
          actualFare: ride.estimatedFare,
          paymentStatus: 'collected',
          paymentMethod: 'cash',
          paymentCollectedAt: new Date(),
          autoEnded: true,
          autoEndReason: 'Ride exceeded maximum duration'
        });
        
        ended.push(ride.rideId);
        console.log(`⏱️ [Auto End] Auto-ended long running ride ${ride.rideId}`);
      } catch (error) {
        console.error(`❌ [Auto End] Failed to end ride ${ride.rideId}:`, error.message);
      }
    }

    return ended;
  }

  /**
   * Auto-complete rides that have been ended for too long
   */
  async completeLongEndedRides() {
    const cutoffTime = new Date(Date.now() - this.timeouts.endedToComplete);
    
    const stuckRides = await RideRequest.find({
      status: 'ride_ended',
      rideEndedAt: { $lt: cutoffTime }
    });

    const completed = [];
    for (const ride of stuckRides) {
      try {
        // Use RideLifecycleService to properly complete the ride
        const completionResult = await RideLifecycleService.completeRide(ride._id, {
          status: 'completed',
          paymentMethod: ride.paymentMethod || 'cash',
          autoCompleted: true,
          autoCompleteReason: 'Payment collection timeout'
        });

        if (completionResult.success) {
          completed.push(ride.rideId);
          console.log(`✅ [Auto Complete] Auto-completed ended ride ${ride.rideId}`);
          
          // Notify admins of auto-completion
          if (this.notificationService) {
            this.notificationService.notifyAdmins('rideCompleted', {
              rideId: ride._id.toString(),
              uniqueRideId: ride.rideId,
              userName: ride.userName,
              driverName: ride.driverName,
              pickupLocation: ride.pickupLocation,
              status: 'completed',
              completedAt: new Date().toISOString(),
              autoCompleted: true,
              actualFare: ride.actualFare || ride.estimatedFare,
              paymentMethod: ride.paymentMethod || 'cash'
            });
          }
        }
      } catch (error) {
        console.error(`❌ [Auto Complete] Failed to complete ride ${ride.rideId}:`, error.message);
      }
    }

    return completed;
  }

  /**
   * Update ride status with proper notifications
   */
  async updateRideWithNotification(ride, newStatus, additionalData = {}) {
    const previousStatus = ride.status;
    
    // Update ride status
    Object.assign(ride, additionalData);
    ride.status = newStatus;
    await ride.save();

    // Log the event
    logRideEvent(ride.rideId, `auto_${newStatus}`, {
      previousStatus,
      newStatus,
      reason: additionalData.cancellationReason || additionalData.autoEndReason || additionalData.autoCompleteReason,
      timestamp: new Date()
    });

    // Notify admins if notification service available
    if (this.notificationService) {
      const eventType = this.getEventTypeFromStatus(newStatus);
      this.notificationService.notifyAdmins(eventType, {
        rideId: ride._id.toString(),
        uniqueRideId: ride.rideId,
        userName: ride.userName,
        driverName: ride.driverName,
        pickupLocation: ride.pickupLocation,
        status: newStatus,
        previousStatus,
        automated: true,
        timestamp: new Date().toISOString(),
        ...additionalData
      });
    }
  }

  /**
   * Manual completion for admin tools
   */
  async manuallyCompleteRide(rideId, adminId, reason = 'Manual admin completion') {
    try {
      const ride = await RideRequest.findById(rideId);
      if (!ride) {
        throw new Error('Ride not found');
      }

      if (ride.status === 'completed') {
        return { success: false, message: 'Ride already completed' };
      }

      // Force completion regardless of current status
      const completionData = {
        status: 'completed',
        paymentMethod: ride.paymentMethod || 'cash',
        paymentStatus: 'collected',
        manualCompletion: true,
        completedBy: adminId,
        completionReason: reason,
        completedAt: new Date()
      };

      if (ride.status !== 'ride_ended') {
        // If not ended, set end time too
        completionData.rideEndedAt = new Date();
        completionData.actualFare = ride.estimatedFare;
      }

      const result = await RideLifecycleService.completeRide(ride._id, completionData);
      
      if (result.success) {
        // Notify admins of manual completion
        if (this.notificationService) {
          this.notificationService.notifyAdmins('rideCompleted', {
            rideId: ride._id.toString(),
            uniqueRideId: ride.rideId,
            userName: ride.userName,
            driverName: ride.driverName,
            pickupLocation: ride.pickupLocation,
            status: 'completed',
            completedAt: new Date().toISOString(),
            manualCompletion: true,
            completedBy: adminId,
            reason
          });
        }

        logRideEvent(ride.rideId, 'manual_completion', {
          adminId,
          reason,
          previousStatus: ride.status
        });
      }

      return result;
    } catch (error) {
      console.error('❌ [Manual Complete] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get event type from status
   */
  getEventTypeFromStatus(status) {
    const statusEventMap = {
      'cancelled': 'rideCancelled',
      'ride_ended': 'rideEnded',
      'completed': 'rideCompleted'
    };

    return statusEventMap[status] || 'rideStatusUpdated';
  }

  /**
   * Start periodic cleanup job
   */
  startPeriodicCleanup() {
    if (!this.autoCompletionEnabled) {
      return;
    }

    // Run cleanup every 10 minutes
    setInterval(() => {
      this.checkAndFixStuckRides().catch(error => {
        console.error('❌ [Periodic Cleanup] Error:', error);
      });
    }, 10 * 60 * 1000);

    console.log('⏰ [Auto Completion] Periodic cleanup started (every 10 minutes)');
  }

  /**
   * Get service statistics
   */
  async getStats() {
    const now = new Date();
    const stats = {};

    // Count rides in each problematic state
    stats.pendingRides = await RideRequest.countDocuments({
      status: 'pending',
      createdAt: { $lt: new Date(now - this.timeouts.pendingToCancel) }
    });

    stats.stuckAssignedRides = await RideRequest.countDocuments({
      status: 'driver_assigned',
      acceptedAt: { $lt: new Date(now - this.timeouts.assignedToCancel) }
    });

    stats.longRunningRides = await RideRequest.countDocuments({
      status: 'ride_started',
      rideStartedAt: { $lt: new Date(now - this.timeouts.startedToEnd) }
    });

    stats.uncompletedEndedRides = await RideRequest.countDocuments({
      status: 'ride_ended',
      rideEndedAt: { $lt: new Date(now - this.timeouts.endedToComplete) }
    });

    stats.totalProblematic = stats.pendingRides + stats.stuckAssignedRides + 
                            stats.longRunningRides + stats.uncompletedEndedRides;

    return stats;
  }

  /**
   * Update configuration
   */
  updateConfig(newTimeouts) {
    this.timeouts = { ...this.timeouts, ...newTimeouts };
    console.log('⚙️ [Auto Completion] Configuration updated:', this.timeouts);
  }

  /**
   * Enable/disable automatic completion
   */
  setAutoCompletionEnabled(enabled) {
    this.autoCompletionEnabled = enabled;
    console.log(`⚙️ [Auto Completion] Auto-completion ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = RideCompletionService;