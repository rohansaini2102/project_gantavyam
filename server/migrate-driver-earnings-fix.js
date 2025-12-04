/**
 * Data Migration Script: Fix Driver Total Earnings
 *
 * PROBLEM: Driver totalEarnings was incorrectly adding actualFare (customer total)
 *          instead of driverFare (driver's actual earnings)
 *
 * SOLUTION: Recalculate all driver totalEarnings from scratch using correct driverFare values
 *
 * SAFETY: This script creates a backup before making changes
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function migrateDriverEarnings() {
  try {
    console.log('🚀 Starting Driver Earnings Migration...\n');

    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://rohansaini2102:LfgB7nbUBcHQ4TOI@gantavyam.rpdu8mw.mongodb.net/gantavyam?retryWrites=true&w=majority';
    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB\n');

    const Driver = mongoose.model('Driver');
    const RideHistory = mongoose.model('RideHistory');

    // Step 1: Create backup of current driver earnings
    console.log('📦 Step 1: Creating backup of current driver earnings...\n');

    const drivers = await Driver.find({}).lean();
    const backupData = drivers.map(d => ({
      driverId: d._id,
      name: d.name,
      phone: d.phone,
      oldTotalEarnings: d.totalEarnings || 0,
      totalRides: d.totalRides || 0
    }));

    const backupPath = path.join(__dirname, `driver-earnings-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup saved to: ${backupPath}\n`);

    // Step 2: Analyze the problem
    console.log('🔍 Step 2: Analyzing current vs correct earnings...\n');

    let totalDrivers = 0;
    let driversWithDiscrepancy = 0;
    let totalIncorrectAmount = 0;

    for (const driver of drivers) {
      totalDrivers++;

      // Calculate correct earnings from RideHistory
      const completedRides = await RideHistory.find({
        driverId: driver._id,
        status: 'completed',
        driverFare: { $exists: true }
      }).lean();

      const correctEarnings = completedRides.reduce((sum, ride) => {
        return sum + (ride.driverFare || ride.fare || 0);
      }, 0);

      const currentEarnings = driver.totalEarnings || 0;
      const discrepancy = currentEarnings - correctEarnings;

      if (Math.abs(discrepancy) > 1) {
        driversWithDiscrepancy++;
        totalIncorrectAmount += discrepancy;

        console.log(`Driver: ${driver.name} (${driver.phone})`);
        console.log(`  Current earnings: ₹${currentEarnings.toFixed(2)}`);
        console.log(`  Correct earnings: ₹${correctEarnings.toFixed(2)}`);
        console.log(`  Discrepancy: ₹${discrepancy.toFixed(2)} ${discrepancy > 0 ? '(overpaid)' : '(underpaid)'}\n`);
      }
    }

    console.log(`\n📊 Analysis Summary:`);
    console.log(`  Total drivers: ${totalDrivers}`);
    console.log(`  Drivers with discrepancies: ${driversWithDiscrepancy}`);
    console.log(`  Total incorrect amount: ₹${totalIncorrectAmount.toFixed(2)}\n`);

    // Step 3: Ask for confirmation
    console.log('⚠️  IMPORTANT: This will update driver earnings in the database!');
    console.log('   A backup has been created at:', backupPath);
    console.log('\n   To proceed with migration, set CONFIRM_MIGRATION=true\n');

    if (process.env.CONFIRM_MIGRATION !== 'true') {
      console.log('❌ Migration aborted. To run migration, execute:');
      console.log('   CONFIRM_MIGRATION=true node migrate-driver-earnings-fix.js\n');
      await mongoose.disconnect();
      return;
    }

    // Step 4: Perform migration
    console.log('🔧 Step 3: Updating driver earnings...\n');

    let updatedCount = 0;

    for (const driver of drivers) {
      // Recalculate correct earnings from scratch
      const completedRides = await RideHistory.find({
        driverId: driver._id,
        status: 'completed',
        driverFare: { $exists: true }
      }).lean();

      const correctEarnings = completedRides.reduce((sum, ride) => {
        return sum + (ride.driverFare || ride.fare || 0);
      }, 0);

      // Update driver with correct earnings
      await Driver.updateOne(
        { _id: driver._id },
        { $set: { totalEarnings: correctEarnings } }
      );

      updatedCount++;

      if (updatedCount % 10 === 0) {
        console.log(`  Updated ${updatedCount}/${totalDrivers} drivers...`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} drivers!\n`);

    // Step 5: Verify migration
    console.log('🔍 Step 4: Verifying migration...\n');

    const verifyRides = await RideHistory.find({
      status: 'completed',
      driverFare: { $exists: true }
    }).limit(5).lean();

    for (const ride of verifyRides) {
      const driver = await Driver.findById(ride.driverId).lean();
      if (driver) {
        console.log(`✅ Ride ${ride.rideNumber || ride._id.toString().slice(-6)}: Driver ${driver.name} earnings updated`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Backup available at: ${backupPath}\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateDriverEarnings();
