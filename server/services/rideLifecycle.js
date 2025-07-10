const RideRequest = require('../models/RideRequest');
const RideHistory = require('../models/RideHistory');
const User = require('../models/User');
const Driver = require('../models/Driver');
const { logRideEvent } = require('../utils/rideLogger');

class RideLifecycleService {
  /**
   * Complete a ride and move data to history
   * @param {string} rideId - MongoDB ObjectId or unique ride ID
   * @param {Object} completionData - Additional completion data
   */
  static async completeRide(rideId, completionData = {}) {
    try {
      console.log('\n=== COMPLETING RIDE ===');
      console.log('Ride ID:', rideId);
      
      // Find the ride request with fallback logic
      let rideRequest = null;
      try {
        rideRequest = await RideRequest.findById(rideId).populate('userId driverId');
      } catch (error) {
        rideRequest = await RideRequest.findOne({ rideId: rideId }).populate('userId driverId');
      }
      
      if (!rideRequest) {
        throw new Error('Ride request not found');
      }
      
      console.log('Found ride request:', rideRequest.rideId);
      
      // Create comprehensive ride history entry
      const rideHistoryData = {
        // Basic ride information
        userId: rideRequest.userId._id,
        driverId: rideRequest.driverId ? rideRequest.driverId._id : null,
        rideId: rideRequest.rideId,
        boothRideNumber: rideRequest.boothRideNumber,
        
        // Location information
        pickupLocation: {
          boothName: rideRequest.pickupLocation.boothName,
          latitude: rideRequest.pickupLocation.latitude,
          longitude: rideRequest.pickupLocation.longitude
        },
        dropLocation: {
          address: rideRequest.dropLocation.address,
          latitude: rideRequest.dropLocation.latitude,
          longitude: rideRequest.dropLocation.longitude
        },
        
        // Ride details
        vehicleType: rideRequest.vehicleType,
        distance: rideRequest.distance,
        estimatedFare: rideRequest.estimatedFare,
        actualFare: rideRequest.actualFare || rideRequest.fare,
        
        // Status and completion
        status: completionData.status || 'completed',
        cancellationReason: completionData.cancellationReason,
        cancelledBy: completionData.cancelledBy,
        
        // Driver information
        driverName: rideRequest.driverName,
        driverPhone: rideRequest.driverPhone,
        driverVehicleNo: rideRequest.driverVehicleNo,
        driverRating: rideRequest.driverRating,
        
        // Journey timeline
        timestamps: {
          requested: rideRequest.timestamp,
          driverAssigned: rideRequest.acceptedAt,
          rideStarted: rideRequest.rideStartedAt,
          rideEnded: rideRequest.rideEndedAt,
          completed: completionData.status === 'completed' ? new Date() : null,
          cancelled: completionData.status === 'cancelled' ? (rideRequest.cancelledAt || new Date()) : null
        },
        
        // Payment information
        paymentStatus: rideRequest.paymentStatus || 'collected',
        paymentMethod: rideRequest.paymentMethod || 'cash',
        paymentCollectedAt: rideRequest.paymentCollectedAt || new Date(),
        
        // Ratings and feedback
        userRating: completionData.userRating,
        driverRatingForUser: completionData.driverRatingForUser,
        
        // Journey statistics
        journeyStats: this.calculateJourneyStats(rideRequest, completionData)
      };
      
      // Create ride history entry
      const rideHistory = await RideHistory.create(rideHistoryData);
      console.log('✅ Ride history created:', rideHistory._id);
      
      // Update user statistics
      await this.updateUserStatistics(rideRequest.userId._id, rideHistoryData);
      
      // Update driver statistics
      if (rideRequest.driverId) {
        await this.updateDriverStatistics(rideRequest.driverId._id, rideHistoryData);
      }
      
      // Remove from active ride requests
      await RideRequest.findByIdAndDelete(rideRequest._id);
      console.log('✅ Ride request removed from active collection');
      
      // Log completion event
      logRideEvent(rideRequest.rideId, 'ride_completed', {
        status: rideHistoryData.status,
        actualFare: rideHistoryData.actualFare,
        duration: rideHistoryData.journeyStats.totalDuration
      });
      
      return {
        success: true,
        rideHistory: rideHistory,
        message: 'Ride completed and moved to history successfully'
      };
      
    } catch (error) {
      console.error('❌ Error completing ride:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Calculate journey statistics
   */
  static calculateJourneyStats(rideRequest, completionData) {
    const stats = {
      totalDuration: 0,
      waitingTime: 0,
      rideDuration: 0,
      averageSpeed: 0,
      routeEfficiency: 100
    };
    
    try {
      // Calculate total duration (from request to completion)
      const requestTime = new Date(rideRequest.timestamp);
      const completionTime = new Date();
      stats.totalDuration = Math.round((completionTime - requestTime) / (1000 * 60)); // in minutes
      
      // Calculate waiting time (from request to ride start)
      if (rideRequest.rideStartedAt) {
        const rideStartTime = new Date(rideRequest.rideStartedAt);
        stats.waitingTime = Math.round((rideStartTime - requestTime) / (1000 * 60));
      }
      
      // Calculate ride duration (from start to end)
      if (rideRequest.rideStartedAt && rideRequest.rideEndedAt) {
        const startTime = new Date(rideRequest.rideStartedAt);
        const endTime = new Date(rideRequest.rideEndedAt);
        stats.rideDuration = Math.round((endTime - startTime) / (1000 * 60));
        
        // Calculate average speed (distance / time)
        if (stats.rideDuration > 0) {
          stats.averageSpeed = Math.round((rideRequest.distance / (stats.rideDuration / 60)) * 100) / 100;
        }
      }
      
      // Route efficiency (can be enhanced with actual route data)
      stats.routeEfficiency = completionData.routeEfficiency || 95;
      
    } catch (error) {
      console.error('Error calculating journey stats:', error);
    }
    
    return stats;
  }
  
  /**
   * Update user ride statistics
   */
  static async updateUserStatistics(userId, rideData) {
    try {
      const user = await User.findById(userId);
      if (!user) return;
      
      // Initialize statistics if not exists
      if (!user.rideStatistics) {
        user.rideStatistics = {
          totalRides: 0,
          completedRides: 0,
          cancelledRides: 0,
          totalSpent: 0,
          averageRating: 0,
          favoriteVehicleType: 'auto',
          preferredMetroStations: []
        };
      }
      
      // Update ride counts
      user.rideStatistics.totalRides += 1;
      
      if (rideData.status === 'completed') {
        user.rideStatistics.completedRides += 1;
        user.rideStatistics.totalSpent += rideData.actualFare;
        user.rideStatistics.lastRideDate = new Date();
        
        // Update longest ride if applicable
        if (!user.rideStatistics.longestRide || 
            rideData.distance > user.rideStatistics.longestRide.distance) {
          user.rideStatistics.longestRide = {
            distance: rideData.distance,
            fare: rideData.actualFare,
            date: new Date()
          };
        }
      } else if (rideData.status === 'cancelled') {
        user.rideStatistics.cancelledRides += 1;
      }
      
      // Update preferred metro stations
      const stationName = rideData.pickupLocation.boothName;
      let stationEntry = user.rideStatistics.preferredMetroStations.find(
        station => station.stationName === stationName
      );
      
      if (stationEntry) {
        stationEntry.usageCount += 1;
      } else {
        user.rideStatistics.preferredMetroStations.push({
          stationName: stationName,
          usageCount: 1
        });
      }
      
      // Sort preferred stations by usage
      user.rideStatistics.preferredMetroStations.sort((a, b) => b.usageCount - a.usageCount);
      
      // Update favorite vehicle type based on most used
      const vehicleTypeCounts = {};
      // This would ideally be calculated from all ride history, but for now use current
      user.rideStatistics.favoriteVehicleType = rideData.vehicleType;
      
      // Add to ride history references
      await user.save();
      
      console.log('✅ User statistics updated for:', user.name);
      
    } catch (error) {
      console.error('❌ Error updating user statistics:', error);
    }
  }
  
  /**
   * Update driver ride statistics
   */
  static async updateDriverStatistics(driverId, rideData) {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) return;
      
      // Update basic driver stats
      if (rideData.status === 'completed') {
        driver.totalRides += 1;
        driver.totalEarnings += rideData.actualFare;
        
        // Update rating if provided
        if (rideData.userRating && rideData.userRating.rating) {
          const currentRating = driver.rating || 0;
          const totalRides = driver.totalRides;
          
          // Calculate new average rating
          const newRating = ((currentRating * (totalRides - 1)) + rideData.userRating.rating) / totalRides;
          driver.rating = Math.round(newRating * 100) / 100; // Round to 2 decimal places
        }
      }
      
      driver.lastActiveTime = new Date();
      await driver.save();
      
      console.log('✅ Driver statistics updated for:', driver.fullName);
      
    } catch (error) {
      console.error('❌ Error updating driver statistics:', error);
    }
  }
  
  /**
   * Cancel a ride and move to history
   */
  static async cancelRide(rideId, cancellationData) {
    return await this.completeRide(rideId, {
      status: 'cancelled',
      cancellationReason: cancellationData.reason,
      cancelledBy: cancellationData.cancelledBy
    });
  }
  
  /**
   * Get ride analytics for a user
   */
  static async getUserRideAnalytics(userId) {
    try {
      const user = await User.findById(userId).populate('rideHistory');
      if (!user) throw new Error('User not found');
      
      const analytics = {
        totalRides: user.rideStatistics?.totalRides || 0,
        completedRides: user.rideStatistics?.completedRides || 0,
        cancelledRides: user.rideStatistics?.cancelledRides || 0,
        totalSpent: user.rideStatistics?.totalSpent || 0,
        averageRating: user.rideStatistics?.averageRating || 0,
        favoriteVehicleType: user.rideStatistics?.favoriteVehicleType || 'auto',
        lastRideDate: user.rideStatistics?.lastRideDate,
        longestRide: user.rideStatistics?.longestRide,
        preferredStations: user.rideStatistics?.preferredMetroStations || []
      };
      
      return {
        success: true,
        analytics: analytics
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get ride analytics for a driver
   */
  static async getDriverRideAnalytics(driverId) {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) throw new Error('Driver not found');
      
      const analytics = {
        totalRides: driver.totalRides || 0,
        totalEarnings: driver.totalEarnings || 0,
        averageRating: driver.rating || 0,
        lastActiveTime: driver.lastActiveTime
      };
      
      // Get additional analytics from ride history
      const rideHistory = await RideHistory.find({ driverId: driverId });
      
      if (rideHistory.length > 0) {
        analytics.averageRideDuration = rideHistory.reduce((sum, ride) => 
          sum + (ride.journeyStats?.rideDuration || 0), 0) / rideHistory.length;
        
        analytics.averageDistance = rideHistory.reduce((sum, ride) => 
          sum + ride.distance, 0) / rideHistory.length;
      }
      
      return {
        success: true,
        analytics: analytics
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = RideLifecycleService;