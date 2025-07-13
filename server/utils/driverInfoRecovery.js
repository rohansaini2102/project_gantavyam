/**
 * Driver Information Recovery Tool
 * Fixes completed rides that are missing driver information
 */

const RideHistory = require('../models/RideHistory');
const RideRequest = require('../models/RideRequest');
const Driver = require('../models/Driver');
const { logRideEvent } = require('./rideLogger');

class DriverInfoRecovery {
  
  /**
   * Find all ride history entries missing driver information
   */
  static async findRidesWithMissingDriverInfo() {
    try {
      console.log('🔍 [Driver Recovery] Searching for rides with missing driver info...');
      
      const ridesWithMissingInfo = await RideHistory.find({
        $or: [
          { driverId: null },
          { driverId: { $exists: false } },
          { driverName: null },
          { driverName: { $exists: false } },
          { driverName: '' }
        ]
      }).lean();
      
      console.log(`🔍 [Driver Recovery] Found ${ridesWithMissingInfo.length} rides with missing driver info`);
      
      return ridesWithMissingInfo;
    } catch (error) {
      console.error('❌ [Driver Recovery] Error finding rides with missing driver info:', error);
      throw error;
    }
  }
  
  /**
   * Attempt to recover driver information from various sources
   */
  static async recoverDriverInfo(rideHistory) {
    const recovery = {
      success: false,
      source: null,
      driverInfo: {},
      originalRideId: rideHistory.rideId
    };
    
    try {
      // Method 1: Check if ride still exists in active requests
      console.log(`🔍 [Driver Recovery] Checking active requests for ride: ${rideHistory.rideId}`);
      const activeRide = await RideRequest.findOne({ rideId: rideHistory.rideId });
      
      if (activeRide && activeRide.driverId) {
        recovery.driverInfo = {
          driverId: activeRide.driverId,
          driverName: activeRide.driverName,
          driverPhone: activeRide.driverPhone,
          driverVehicleNo: activeRide.driverVehicleNo,
          driverRating: activeRide.driverRating
        };
        recovery.source = 'active_ride_request';
        recovery.success = true;
        console.log(`✅ [Driver Recovery] Found driver info in active request for ride: ${rideHistory.rideId}`);
        return recovery;
      }
      
      // Method 2: Check other completed rides from same time period
      console.log(`🔍 [Driver Recovery] Checking nearby completed rides...`);
      const timeBuffer = 2 * 60 * 60 * 1000; // 2 hours
      const rideTime = rideHistory.timestamps?.requested || rideHistory.createdAt;
      
      if (rideTime) {
        const nearbyRides = await RideHistory.find({
          _id: { $ne: rideHistory._id },
          'timestamps.requested': {
            $gte: new Date(rideTime.getTime() - timeBuffer),
            $lte: new Date(rideTime.getTime() + timeBuffer)
          },
          'pickupLocation.boothName': rideHistory.pickupLocation?.boothName,
          vehicleType: rideHistory.vehicleType,
          driverId: { $exists: true, $ne: null },
          driverName: { $exists: true, $ne: null, $ne: '' }
        }).limit(5);
        
        if (nearbyRides.length > 0) {
          // Use the most common driver from nearby rides
          const driverCounts = {};
          nearbyRides.forEach(ride => {
            if (ride.driverId) {
              const key = ride.driverId.toString();
              if (!driverCounts[key]) {
                driverCounts[key] = {
                  count: 0,
                  driverInfo: {
                    driverId: ride.driverId,
                    driverName: ride.driverName,
                    driverPhone: ride.driverPhone,
                    driverVehicleNo: ride.driverVehicleNo,
                    driverRating: ride.driverRating
                  }
                };
              }
              driverCounts[key].count++;
            }
          });
          
          const mostLikelyDriver = Object.values(driverCounts)
            .sort((a, b) => b.count - a.count)[0];
          
          if (mostLikelyDriver) {
            recovery.driverInfo = mostLikelyDriver.driverInfo;
            recovery.source = 'nearby_rides_inference';
            recovery.success = true;
            console.log(`✅ [Driver Recovery] Inferred driver from nearby rides for: ${rideHistory.rideId}`);
            return recovery;
          }
        }
      }
      
      // Method 3: Try to find driver based on pickup location and vehicle type
      console.log(`🔍 [Driver Recovery] Searching drivers by location and vehicle type...`);
      if (rideHistory.pickupLocation?.boothName && rideHistory.vehicleType) {
        const potentialDrivers = await Driver.find({
          vehicleType: rideHistory.vehicleType,
          // Add any location-based filtering if available
        }).limit(1);
        
        if (potentialDrivers.length > 0) {
          const driver = potentialDrivers[0];
          recovery.driverInfo = {
            driverId: driver._id,
            driverName: driver.fullName,
            driverPhone: driver.mobileNo,
            driverVehicleNo: driver.vehicleNo,
            driverRating: driver.rating
          };
          recovery.source = 'location_vehicle_match';
          recovery.success = true;
          console.log(`⚠️ [Driver Recovery] Best guess driver match for: ${rideHistory.rideId}`);
          return recovery;
        }
      }
      
      console.log(`❌ [Driver Recovery] Could not recover driver info for ride: ${rideHistory.rideId}`);
      return recovery;
      
    } catch (error) {
      console.error(`❌ [Driver Recovery] Error recovering driver info for ride ${rideHistory.rideId}:`, error);
      return recovery;
    }
  }
  
  /**
   * Update ride history with recovered driver information
   */
  static async updateRideHistoryWithDriverInfo(rideHistoryId, driverInfo, source) {
    try {
      const updateData = {
        ...driverInfo,
        updatedAt: new Date(),
        driverInfoRecovery: {
          recovered: true,
          source: source,
          recoveredAt: new Date()
        }
      };
      
      const updatedRide = await RideHistory.findByIdAndUpdate(
        rideHistoryId,
        { $set: updateData },
        { new: true }
      );
      
      if (updatedRide) {
        console.log(`✅ [Driver Recovery] Updated ride history ${rideHistoryId} with driver info from ${source}`);
        logRideEvent(updatedRide.rideId, 'driver_info_recovered', {
          source: source,
          driverInfo: driverInfo
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ [Driver Recovery] Error updating ride history ${rideHistoryId}:`, error);
      return false;
    }
  }
  
  /**
   * Run complete recovery process
   */
  static async runRecoveryProcess(dryRun = true) {
    try {
      console.log(`🔧 [Driver Recovery] Starting recovery process (dry run: ${dryRun})`);
      
      const ridesWithMissingInfo = await this.findRidesWithMissingDriverInfo();
      
      if (ridesWithMissingInfo.length === 0) {
        console.log('✅ [Driver Recovery] No rides found with missing driver info');
        return { processed: 0, recovered: 0, failed: 0 };
      }
      
      const results = {
        processed: 0,
        recovered: 0,
        failed: 0,
        recoveryDetails: []
      };
      
      for (const ride of ridesWithMissingInfo) {
        results.processed++;
        console.log(`\n🔄 [Driver Recovery] Processing ride ${results.processed}/${ridesWithMissingInfo.length}: ${ride.rideId}`);
        
        const recovery = await this.recoverDriverInfo(ride);
        
        if (recovery.success) {
          if (!dryRun) {
            const updated = await this.updateRideHistoryWithDriverInfo(
              ride._id,
              recovery.driverInfo,
              recovery.source
            );
            
            if (updated) {
              results.recovered++;
            } else {
              results.failed++;
            }
          } else {
            results.recovered++; // Count as recovered in dry run
          }
          
          results.recoveryDetails.push({
            rideId: ride.rideId,
            rideHistoryId: ride._id,
            source: recovery.source,
            driverInfo: recovery.driverInfo,
            updated: !dryRun
          });
        } else {
          results.failed++;
          results.recoveryDetails.push({
            rideId: ride.rideId,
            rideHistoryId: ride._id,
            error: 'Could not recover driver information'
          });
        }
      }
      
      console.log(`\n✅ [Driver Recovery] Process completed:`);
      console.log(`   Processed: ${results.processed}`);
      console.log(`   Recovered: ${results.recovered}`);
      console.log(`   Failed: ${results.failed}`);
      console.log(`   Dry Run: ${dryRun}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ [Driver Recovery] Error in recovery process:', error);
      throw error;
    }
  }
  
  /**
   * Get statistics about missing driver info
   */
  static async getRecoveryStats() {
    try {
      const total = await RideHistory.countDocuments({});
      const missingDriverId = await RideHistory.countDocuments({
        $or: [
          { driverId: null },
          { driverId: { $exists: false } }
        ]
      });
      const missingDriverName = await RideHistory.countDocuments({
        $or: [
          { driverName: null },
          { driverName: { $exists: false } },
          { driverName: '' }
        ]
      });
      
      return {
        totalRides: total,
        missingDriverId,
        missingDriverName,
        percentageMissingDriverId: total > 0 ? Math.round((missingDriverId / total) * 100) : 0,
        percentageMissingDriverName: total > 0 ? Math.round((missingDriverName / total) * 100) : 0
      };
    } catch (error) {
      console.error('❌ [Driver Recovery] Error getting stats:', error);
      throw error;
    }
  }
}

module.exports = DriverInfoRecovery;