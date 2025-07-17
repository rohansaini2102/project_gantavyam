#!/usr/bin/env node

/**
 * Drop-off Location Data Migration Script
 * 
 * This script fixes rides with missing or incomplete drop-off location data
 * by attempting to recover the information from various sources.
 */

const mongoose = require('mongoose');
const RideRequest = require('./models/RideRequest');
const RideHistory = require('./models/RideHistory');

// Database connection
async function connectDB() {
  try {
    let dbURI;
    
    // Try different possible database URIs
    if (process.env.MONGODB_URI) {
      dbURI = process.env.MONGODB_URI;
    } else if (process.env.MONGO_URI) {
      dbURI = process.env.MONGO_URI;
    } else {
      dbURI = 'mongodb://localhost:27017/gt3-app'; // Default fallback
    }
    
    console.log('🔌 Connecting to database...');
    await mongoose.connect(dbURI);
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Find rides with missing drop-off data
async function findProblematicRides() {
  console.log('\n🔍 FINDING RIDES WITH MISSING DROP-OFF DATA');
  console.log('=' .repeat(50));
  
  try {
    // Find rides missing dropLocation field
    const missingDropLocation = await RideRequest.find({
      $or: [
        { dropLocation: { $exists: false } },
        { dropLocation: null }
      ]
    }).lean().limit(100);
    
    // Find rides missing dropLocation.address
    const missingDropAddress = await RideRequest.find({
      dropLocation: { $exists: true },
      $or: [
        { 'dropLocation.address': { $exists: false } },
        { 'dropLocation.address': null },
        { 'dropLocation.address': '' }
      ]
    }).lean().limit(100);
    
    // Find rides with dropLocation but missing destination field
    const missingDestination = await RideRequest.find({
      dropLocation: { $exists: true },
      'dropLocation.address': { $exists: true, $ne: null, $ne: '' },
      $or: [
        { destination: { $exists: false } },
        { destination: null },
        { destination: '' }
      ]
    }).lean().limit(100);
    
    console.log(`📊 Analysis Results:`);
    console.log(`  Rides missing dropLocation field: ${missingDropLocation.length}`);
    console.log(`  Rides missing dropLocation.address: ${missingDropAddress.length}`);
    console.log(`  Rides missing destination field: ${missingDestination.length}`);
    
    return {
      missingDropLocation,
      missingDropAddress,
      missingDestination
    };
    
  } catch (error) {
    console.error('❌ Error finding problematic rides:', error);
    return { missingDropLocation: [], missingDropAddress: [], missingDestination: [] };
  }
}

// Try to recover drop-off location from various sources
function tryRecoverDropLocation(ride) {
  // Strategy 1: Check if there's a destination field that could be the address
  if (ride.destination && ride.destination !== 'Not specified' && ride.destination.length > 3) {
    return {
      address: ride.destination,
      latitude: null, // Will need manual geocoding
      longitude: null
    };
  }
  
  // Strategy 2: Check for any text fields that might contain address
  const textFields = [
    ride.dropLocationText,
    ride.destinationAddress,
    ride.destination,
    ride.notes,
    ride.description
  ];
  
  for (const field of textFields) {
    if (field && typeof field === 'string' && field.length > 10) {
      // Check if it looks like an address (contains common address words)
      const addressWords = ['road', 'street', 'colony', 'sector', 'market', 'delhi', 'new delhi', 'metro', 'station'];
      const lowerField = field.toLowerCase();
      
      if (addressWords.some(word => lowerField.includes(word))) {
        return {
          address: field,
          latitude: null,
          longitude: null
        };
      }
    }
  }
  
  // Strategy 3: Generate placeholder based on ride info
  if (ride.vehicleType || ride.fare) {
    return {
      address: `Destination (${ride.vehicleType || 'Unknown'} ride for ₹${ride.fare || 'Unknown'})`,
      latitude: null,
      longitude: null,
      isPlaceholder: true
    };
  }
  
  return null;
}

// Fix rides with missing destination field
async function fixMissingDestinations(rides) {
  console.log('\n🔧 FIXING MISSING DESTINATION FIELDS');
  console.log('=' .repeat(45));
  
  let fixed = 0;
  
  for (const ride of rides) {
    try {
      if (ride.dropLocation && ride.dropLocation.address) {
        await RideRequest.updateOne(
          { _id: ride._id },
          { $set: { destination: ride.dropLocation.address } }
        );
        
        console.log(`✅ Fixed destination for ride ${ride._id}: "${ride.dropLocation.address}"`);
        fixed++;
      }
    } catch (error) {
      console.error(`❌ Error fixing ride ${ride._id}:`, error.message);
    }
  }
  
  console.log(`\n📊 Fixed ${fixed}/${rides.length} rides with missing destination field`);
  return fixed;
}

// Fix rides with missing dropLocation
async function fixMissingDropLocations(rides) {
  console.log('\n🔧 FIXING MISSING DROP LOCATIONS');
  console.log('=' .repeat(40));
  
  let fixed = 0;
  let placeholders = 0;
  
  for (const ride of rides) {
    try {
      const recoveredLocation = tryRecoverDropLocation(ride);
      
      if (recoveredLocation) {
        const updateData = {
          dropLocation: recoveredLocation
        };
        
        // Also set destination field
        if (!ride.destination) {
          updateData.destination = recoveredLocation.address;
        }
        
        await RideRequest.updateOne(
          { _id: ride._id },
          { $set: updateData }
        );
        
        if (recoveredLocation.isPlaceholder) {
          console.log(`🔧 Added placeholder dropLocation for ride ${ride._id}: "${recoveredLocation.address}"`);
          placeholders++;
        } else {
          console.log(`✅ Recovered dropLocation for ride ${ride._id}: "${recoveredLocation.address}"`);
        }
        
        fixed++;
      } else {
        console.log(`❓ Could not recover dropLocation for ride ${ride._id}`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ride ${ride._id}:`, error.message);
    }
  }
  
  console.log(`\n📊 Fixed ${fixed}/${rides.length} rides with missing dropLocation`);
  console.log(`   - ${fixed - placeholders} with recovered data`);
  console.log(`   - ${placeholders} with placeholder data`);
  
  return fixed;
}

// Fix rides with missing dropLocation.address
async function fixMissingDropAddresses(rides) {
  console.log('\n🔧 FIXING MISSING DROP ADDRESSES');
  console.log('=' .repeat(40));
  
  let fixed = 0;
  
  for (const ride of rides) {
    try {
      const recoveredLocation = tryRecoverDropLocation(ride);
      
      if (recoveredLocation) {
        const updateData = {
          'dropLocation.address': recoveredLocation.address
        };
        
        // Also set destination field if missing
        if (!ride.destination) {
          updateData.destination = recoveredLocation.address;
        }
        
        await RideRequest.updateOne(
          { _id: ride._id },
          { $set: updateData }
        );
        
        console.log(`✅ Added address to dropLocation for ride ${ride._id}: "${recoveredLocation.address}"`);
        fixed++;
      } else {
        // Add a placeholder address
        const placeholderAddress = `Destination for ride ${ride._id.toString().slice(-6)}`;
        
        await RideRequest.updateOne(
          { _id: ride._id },
          { $set: { 
            'dropLocation.address': placeholderAddress,
            destination: placeholderAddress
          }}
        );
        
        console.log(`🔧 Added placeholder address for ride ${ride._id}: "${placeholderAddress}"`);
        fixed++;
      }
    } catch (error) {
      console.error(`❌ Error fixing ride ${ride._id}:`, error.message);
    }
  }
  
  console.log(`\n📊 Fixed ${fixed}/${rides.length} rides with missing dropLocation.address`);
  return fixed;
}

// Verify fixes
async function verifyFixes() {
  console.log('\n✅ VERIFYING FIXES');
  console.log('=' .repeat(25));
  
  try {
    // Count remaining problematic rides
    const stillMissingDropLocation = await RideRequest.countDocuments({
      $or: [
        { dropLocation: { $exists: false } },
        { dropLocation: null }
      ]
    });
    
    const stillMissingAddress = await RideRequest.countDocuments({
      dropLocation: { $exists: true },
      $or: [
        { 'dropLocation.address': { $exists: false } },
        { 'dropLocation.address': null },
        { 'dropLocation.address': '' }
      ]
    });
    
    const stillMissingDestination = await RideRequest.countDocuments({
      dropLocation: { $exists: true },
      'dropLocation.address': { $exists: true, $ne: null, $ne: '' },
      $or: [
        { destination: { $exists: false } },
        { destination: null },
        { destination: '' }
      ]
    });
    
    console.log(`📊 Remaining Issues:`);
    console.log(`  Rides still missing dropLocation: ${stillMissingDropLocation}`);
    console.log(`  Rides still missing dropLocation.address: ${stillMissingAddress}`);
    console.log(`  Rides still missing destination field: ${stillMissingDestination}`);
    
    // Test admin API simulation
    const sampleRides = await RideRequest.find({}).lean().limit(10);
    let adminReadyRides = 0;
    
    sampleRides.forEach(ride => {
      // Simulate admin API destination mapping
      const destination = ride.destination || ride.dropLocation?.address || 'Not specified';
      if (destination && destination !== 'Not specified') {
        adminReadyRides++;
      }
    });
    
    console.log(`\n📈 Admin Interface Readiness:`);
    console.log(`  Sample rides that would show destinations: ${adminReadyRides}/${sampleRides.length}`);
    
    if (stillMissingDropLocation === 0 && stillMissingAddress === 0 && stillMissingDestination === 0) {
      console.log('\n🎉 All drop-off location issues have been resolved!');
    } else {
      console.log('\n⚠️  Some issues remain. Consider running the script again or manual intervention.');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Main migration function
async function runMigration() {
  console.log('🚀 DROP-OFF LOCATION DATA MIGRATION');
  console.log('=' .repeat(40));
  console.log('This script will attempt to fix rides with missing drop-off location data.\n');
  
  try {
    const problematicRides = await findProblematicRides();
    
    let totalFixed = 0;
    
    // Fix missing destination fields (easiest fix)
    if (problematicRides.missingDestination.length > 0) {
      const fixed = await fixMissingDestinations(problematicRides.missingDestination);
      totalFixed += fixed;
    }
    
    // Fix missing dropLocation.address
    if (problematicRides.missingDropAddress.length > 0) {
      const fixed = await fixMissingDropAddresses(problematicRides.missingDropAddress);
      totalFixed += fixed;
    }
    
    // Fix completely missing dropLocation
    if (problematicRides.missingDropLocation.length > 0) {
      const fixed = await fixMissingDropLocations(problematicRides.missingDropLocation);
      totalFixed += fixed;
    }
    
    console.log(`\n📊 MIGRATION SUMMARY:`);
    console.log(`  Total rides fixed: ${totalFixed}`);
    
    await verifyFixes();
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Check the admin ride management interface');
    console.log('2. Verify that drop-off locations now appear correctly');
    console.log('3. Run diagnostic script to confirm: node test-dropoff-diagnosis.js');
    console.log('4. Consider geocoding placeholder addresses if needed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Dry run function
async function dryRun() {
  console.log('🧪 DRY RUN MODE - NO CHANGES WILL BE MADE');
  console.log('=' .repeat(45));
  
  const problematicRides = await findProblematicRides();
  
  console.log('\n📋 PLANNED FIXES:');
  
  if (problematicRides.missingDestination.length > 0) {
    console.log(`\n  Missing destination field (${problematicRides.missingDestination.length} rides):`);
    problematicRides.missingDestination.slice(0, 5).forEach((ride, i) => {
      console.log(`    ${i + 1}. ${ride._id} → destination: "${ride.dropLocation?.address || 'Not available'}"`);
    });
  }
  
  if (problematicRides.missingDropAddress.length > 0) {
    console.log(`\n  Missing dropLocation.address (${problematicRides.missingDropAddress.length} rides):`);
    problematicRides.missingDropAddress.slice(0, 5).forEach((ride, i) => {
      const recovered = tryRecoverDropLocation(ride);
      console.log(`    ${i + 1}. ${ride._id} → address: "${recovered?.address || 'Placeholder needed'}"`);
    });
  }
  
  if (problematicRides.missingDropLocation.length > 0) {
    console.log(`\n  Missing dropLocation (${problematicRides.missingDropLocation.length} rides):`);
    problematicRides.missingDropLocation.slice(0, 5).forEach((ride, i) => {
      const recovered = tryRecoverDropLocation(ride);
      console.log(`    ${i + 1}. ${ride._id} → dropLocation: "${recovered?.address || 'Recovery needed'}"`);
    });
  }
  
  console.log('\nTo execute the migration, run:');
  console.log('node fix-dropoff-migration.js --execute');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }
  
  try {
    if (args.includes('--execute')) {
      await runMigration();
    } else {
      await dryRun();
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Migration script complete!');
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { runMigration, findProblematicRides, verifyFixes };