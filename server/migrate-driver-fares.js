#!/usr/bin/env node

/**
 * Data Migration Script: Populate driverFare field for existing rides
 *
 * This script fixes the driver dashboard fare display issue by ensuring
 * all ride records have the driverFare field properly populated.
 *
 * Run with: node migrate-driver-fares.js
 */

const mongoose = require('mongoose');
const RideRequest = require('./models/RideRequest');
const { calculateFare } = require('./utils/fareCalculator');

// Connect to database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gt3-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Migration function
const migrateFares = async () => {
  try {
    console.log('\n🚀 Starting driver fare migration...\n');

    // Find all rides missing driverFare field or where driverFare is null/0
    const ridesToFix = await RideRequest.find({
      $or: [
        { driverFare: { $exists: false } },
        { driverFare: null },
        { driverFare: 0 }
      ]
    }).limit(1000); // Process in batches of 1000

    console.log(`📊 Found ${ridesToFix.length} rides needing fare migration`);

    if (ridesToFix.length === 0) {
      console.log('✅ No rides need migration. All rides have driverFare field populated.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const ride of ridesToFix) {
      try {
        let driverFare = 0;

        // Strategy 1: If we have distance and vehicleType, recalculate using fare calculator
        if (ride.distance && ride.vehicleType) {
          try {
            // Calculate with applySurge = false to get pure base fare for drivers
            const fareDetails = await calculateFare(ride.vehicleType, ride.distance, false, 0);
            driverFare = fareDetails.driverFare; // Now returns pure base fare (no surge)
            console.log(`✅ Recalculated pure base fare for ride ${ride.rideId}: ₹${driverFare}`);
          } catch (calcError) {
            console.warn(`⚠️  Fare calculation failed for ride ${ride.rideId}, using fallback`);
            // Fall through to fallback strategy
          }
        }

        // Strategy 2: Use existing fare field as fallback (driver earnings)
        if (driverFare === 0 && ride.fare && ride.fare > 0) {
          // For older rides, the 'fare' field often contains driver earnings
          driverFare = ride.fare;
          console.log(`🔄 Using existing fare as driver fare for ride ${ride.rideId}: ₹${driverFare}`);
        }

        // Strategy 3: Reverse calculate from customer fare if available
        if (driverFare === 0 && ride.estimatedFare && ride.estimatedFare > 0) {
          // Reverse calculate to get PURE BASE FARE (remove surge, commission, GST)
          // Assume customer fare includes surge + 10% commission + 5% GST
          // Conservative approach: divide by 1.7 to account for potential surge + charges
          driverFare = Math.round(ride.estimatedFare / 1.7);
          console.log(`🔄 Reverse calculated pure base fare from customer fare for ride ${ride.rideId}: ₹${driverFare}`);
        }

        // Strategy 4: Last resort - use actualFare
        if (driverFare === 0 && ride.actualFare && ride.actualFare > 0) {
          driverFare = ride.actualFare;
          console.log(`🔄 Using actualFare as driver fare for ride ${ride.rideId}: ₹${driverFare}`);
        }

        // Update the ride with driverFare
        if (driverFare > 0) {
          await RideRequest.findByIdAndUpdate(ride._id, {
            driverFare: driverFare,
            // Also populate other missing fields for consistency
            customerFare: ride.customerFare || ride.estimatedFare || (driverFare * 1.155),
            baseFare: ride.baseFare || driverFare
          });

          successCount++;

          if (successCount % 50 === 0) {
            console.log(`📈 Progress: ${successCount}/${ridesToFix.length} rides migrated`);
          }
        } else {
          console.warn(`⚠️  Could not determine driver fare for ride ${ride.rideId} - skipping`);
          errorCount++;
        }

      } catch (error) {
        console.error(`❌ Error processing ride ${ride.rideId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} rides`);
    console.log(`❌ Errors/skipped: ${errorCount} rides`);
    console.log(`📈 Total processed: ${successCount + errorCount} rides`);

    // Verify the migration
    const remainingIssues = await RideRequest.countDocuments({
      $or: [
        { driverFare: { $exists: false } },
        { driverFare: null },
        { driverFare: 0 }
      ]
    });

    console.log(`\n🔍 Verification: ${remainingIssues} rides still need attention`);

    if (remainingIssues === 0) {
      console.log('🎉 Migration completed successfully! All rides now have driverFare field.');
    } else {
      console.log('⚠️  Some rides still need manual review.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Sample query to check current state
const checkCurrentState = async () => {
  try {
    const totalRides = await RideRequest.countDocuments();
    const ridesWithDriverFare = await RideRequest.countDocuments({
      driverFare: { $exists: true, $gt: 0 }
    });
    const ridesMissingDriverFare = await RideRequest.countDocuments({
      $or: [
        { driverFare: { $exists: false } },
        { driverFare: null },
        { driverFare: 0 }
      ]
    });

    console.log('\n📊 Current Database State:');
    console.log(`Total rides: ${totalRides}`);
    console.log(`Rides with driverFare: ${ridesWithDriverFare}`);
    console.log(`Rides missing driverFare: ${ridesMissingDriverFare}`);
    console.log(`Completion rate: ${((ridesWithDriverFare / totalRides) * 100).toFixed(1)}%`);

    return ridesMissingDriverFare > 0;
  } catch (error) {
    console.error('❌ Error checking database state:', error);
    return true; // Assume migration needed on error
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();

    const needsMigration = await checkCurrentState();

    if (needsMigration) {
      await migrateFares();
      await checkCurrentState(); // Verify results
    } else {
      console.log('✅ All rides already have driverFare field populated. No migration needed.');
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { migrateFares, checkCurrentState };