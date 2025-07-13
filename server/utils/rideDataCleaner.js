const mongoose = require('mongoose');
const RideRequest = require('../models/RideRequest');

/**
 * Utility to clean up inconsistent ride records in the database
 * This script identifies and fixes common data inconsistencies
 */
class RideDataCleaner {
  
  /**
   * Find and fix rides with status 'ride_started' but no driver assigned
   */
  static async fixRidesWithoutDriver() {
    console.log('🔍 Searching for rides with status "ride_started" but no driver...');
    
    const inconsistentRides = await RideRequest.find({
      status: 'ride_started',
      $or: [
        { driverId: null },
        { driverId: { $exists: false } },
        { driverName: null },
        { driverName: '' },
        { driverName: 'No driver' }
      ]
    });

    console.log(`📊 Found ${inconsistentRides.length} inconsistent rides`);

    const fixes = [];
    for (const ride of inconsistentRides) {
      try {
        // If ride has been "started" but no driver, it should be reverted to pending
        ride.status = 'pending';
        ride.rideStartedAt = null;
        ride.queueStatus = 'queued';
        
        await ride.save();
        fixes.push({
          rideId: ride.rideId,
          action: 'reverted_to_pending',
          reason: 'no_driver_assigned'
        });
        
        console.log(`✅ Fixed ride ${ride.rideId}: reverted to pending (no driver)`);
      } catch (error) {
        console.error(`❌ Failed to fix ride ${ride.rideId}:`, error.message);
        fixes.push({
          rideId: ride.rideId,
          action: 'failed',
          error: error.message
        });
      }
    }

    return fixes;
  }

  /**
   * Fix rides that are marked as 'ride_ended' but not completed
   */
  static async fixUncompletedRides() {
    console.log('🔍 Searching for rides with status "ride_ended" but not completed...');
    
    const endedRides = await RideRequest.find({
      status: 'ride_ended',
      paymentStatus: 'pending'
    });

    console.log(`📊 Found ${endedRides.length} ended but uncompleted rides`);

    const fixes = [];
    for (const ride of endedRides) {
      try {
        // Auto-complete rides that ended more than 1 hour ago
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        if (ride.rideEndedAt && ride.rideEndedAt < oneHourAgo) {
          ride.status = 'completed';
          ride.paymentStatus = 'collected';
          ride.paymentMethod = 'cash';
          ride.paymentCollectedAt = ride.rideEndedAt;
          ride.completedAt = ride.rideEndedAt;
          
          await ride.save();
          fixes.push({
            rideId: ride.rideId,
            action: 'auto_completed',
            reason: 'ended_over_1_hour_ago'
          });
          
          console.log(`✅ Auto-completed ride ${ride.rideId}`);
        }
      } catch (error) {
        console.error(`❌ Failed to fix ride ${ride.rideId}:`, error.message);
        fixes.push({
          rideId: ride.rideId,
          action: 'failed',
          error: error.message
        });
      }
    }

    return fixes;
  }

  /**
   * Fix missing timestamps for status changes
   */
  static async fixMissingTimestamps() {
    console.log('🔍 Fixing missing timestamps for status changes...');
    
    const fixes = [];

    // Fix missing rideStartedAt for rides with status 'ride_started'
    const startedRides = await RideRequest.find({
      status: { $in: ['ride_started', 'ride_ended', 'completed'] },
      rideStartedAt: { $exists: false }
    });

    for (const ride of startedRides) {
      try {
        // Use acceptedAt as fallback, or createdAt + 10 minutes
        ride.rideStartedAt = ride.acceptedAt || new Date(ride.createdAt.getTime() + 10 * 60 * 1000);
        await ride.save();
        fixes.push({
          rideId: ride.rideId,
          action: 'added_rideStartedAt',
          timestamp: ride.rideStartedAt
        });
      } catch (error) {
        console.error(`❌ Failed to fix timestamps for ride ${ride.rideId}:`, error.message);
      }
    }

    // Fix missing rideEndedAt for completed rides
    const completedRides = await RideRequest.find({
      status: { $in: ['ride_ended', 'completed'] },
      rideEndedAt: { $exists: false }
    });

    for (const ride of completedRides) {
      try {
        // Use completedAt as fallback, or rideStartedAt + 30 minutes
        ride.rideEndedAt = ride.completedAt || new Date(ride.rideStartedAt.getTime() + 30 * 60 * 1000);
        await ride.save();
        fixes.push({
          rideId: ride.rideId,
          action: 'added_rideEndedAt',
          timestamp: ride.rideEndedAt
        });
      } catch (error) {
        console.error(`❌ Failed to fix timestamps for ride ${ride.rideId}:`, error.message);
      }
    }

    console.log(`✅ Fixed ${fixes.length} missing timestamps`);
    return fixes;
  }

  /**
   * Generate a comprehensive report of data inconsistencies
   */
  static async generateInconsistencyReport() {
    console.log('📊 Generating ride data inconsistency report...');

    const report = {
      timestamp: new Date(),
      inconsistencies: {
        rides_started_without_driver: 0,
        rides_ended_not_completed: 0,
        missing_timestamps: 0,
        invalid_status_combinations: 0
      },
      details: []
    };

    // Check for rides started without driver
    const ridesWithoutDriver = await RideRequest.countDocuments({
      status: 'ride_started',
      $or: [
        { driverId: null },
        { driverId: { $exists: false } },
        { driverName: null },
        { driverName: '' },
        { driverName: 'No driver' }
      ]
    });
    report.inconsistencies.rides_started_without_driver = ridesWithoutDriver;

    // Check for rides ended but not completed
    const ridesEndedNotCompleted = await RideRequest.countDocuments({
      status: 'ride_ended',
      paymentStatus: 'pending'
    });
    report.inconsistencies.rides_ended_not_completed = ridesEndedNotCompleted;

    // Check for missing timestamps
    const missingStartTimestamps = await RideRequest.countDocuments({
      status: { $in: ['ride_started', 'ride_ended', 'completed'] },
      rideStartedAt: { $exists: false }
    });
    const missingEndTimestamps = await RideRequest.countDocuments({
      status: { $in: ['ride_ended', 'completed'] },
      rideEndedAt: { $exists: false }
    });
    report.inconsistencies.missing_timestamps = missingStartTimestamps + missingEndTimestamps;

    // Check for invalid status combinations
    const invalidCombinations = await RideRequest.countDocuments({
      $or: [
        { status: 'driver_assigned', driverId: { $exists: false } },
        { status: 'ride_started', rideStartedAt: { $exists: false } },
        { status: 'ride_ended', rideEndedAt: { $exists: false } },
        { status: 'completed', completedAt: { $exists: false } }
      ]
    });
    report.inconsistencies.invalid_status_combinations = invalidCombinations;

    return report;
  }

  /**
   * Run all cleanup operations
   */
  static async runFullCleanup() {
    console.log('🧹 Starting full ride data cleanup...');
    
    try {
      const results = {
        started: new Date(),
        operations: []
      };

      // Generate initial report
      console.log('\n📊 Initial inconsistency report:');
      const initialReport = await this.generateInconsistencyReport();
      console.log(JSON.stringify(initialReport.inconsistencies, null, 2));
      results.operations.push({ type: 'initial_report', data: initialReport });

      // Fix rides without drivers
      console.log('\n🔧 Fixing rides without drivers...');
      const driverFixes = await this.fixRidesWithoutDriver();
      results.operations.push({ type: 'driver_fixes', count: driverFixes.length, data: driverFixes });

      // Fix uncompleted rides
      console.log('\n🔧 Fixing uncompleted rides...');
      const completionFixes = await this.fixUncompletedRides();
      results.operations.push({ type: 'completion_fixes', count: completionFixes.length, data: completionFixes });

      // Fix missing timestamps
      console.log('\n🔧 Fixing missing timestamps...');
      const timestampFixes = await this.fixMissingTimestamps();
      results.operations.push({ type: 'timestamp_fixes', count: timestampFixes.length, data: timestampFixes });

      // Generate final report
      console.log('\n📊 Final inconsistency report:');
      const finalReport = await this.generateInconsistencyReport();
      console.log(JSON.stringify(finalReport.inconsistencies, null, 2));
      results.operations.push({ type: 'final_report', data: finalReport });

      results.completed = new Date();
      results.duration = results.completed - results.started;

      console.log(`\n✅ Cleanup completed in ${results.duration}ms`);
      return results;

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }
}

module.exports = RideDataCleaner;

// If running this script directly
if (require.main === module) {
  require('dotenv').config();
  
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ride-booking')
    .then(() => {
      console.log('📡 Connected to MongoDB');
      return RideDataCleaner.runFullCleanup();
    })
    .then(results => {
      console.log('🎉 Cleanup completed successfully');
      console.log('Results:', JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Cleanup failed:', error);
      process.exit(1);
    });
}