#!/usr/bin/env node

/**
 * Drop-off Location Diagnostic Script
 * 
 * This script analyzes the database to identify issues with drop-off location data
 * and provides detailed insights for debugging admin ride management display.
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

// Analyze drop-off location data
async function analyzeDrop0ffLocations() {
  console.log('\n📊 DROP-OFF LOCATION DIAGNOSTIC REPORT');
  console.log('=' .repeat(60));
  
  try {
    // 1. Check total rides in both collections
    const totalActiveRides = await RideRequest.countDocuments({});
    const totalHistoryRides = await RideHistory.countDocuments({});
    
    console.log('\n📈 RIDE COUNTS:');
    console.log(`  Active Rides (RideRequest): ${totalActiveRides}`);
    console.log(`  History Rides (RideHistory): ${totalHistoryRides}`);
    console.log(`  Total Rides: ${totalActiveRides + totalHistoryRides}`);
    
    // 2. Analyze active rides (RideRequest)
    console.log('\n🔍 ACTIVE RIDES ANALYSIS (RideRequest):');
    
    const activeRides = await RideRequest.find({}).lean().limit(100);
    
    let activeWithDropLocation = 0;
    let activeWithDropAddress = 0;
    let activeWithDestination = 0;
    let activeWithValidCoords = 0;
    
    const activeSamples = [];
    
    activeRides.forEach((ride, index) => {
      // Check dropLocation field
      if (ride.dropLocation) {
        activeWithDropLocation++;
        
        if (ride.dropLocation.address && ride.dropLocation.address.trim() !== '') {
          activeWithDropAddress++;
        }
        
        if (ride.dropLocation.latitude && ride.dropLocation.longitude) {
          activeWithValidCoords++;
        }
      }
      
      // Check destination field
      if (ride.destination && ride.destination.trim() !== '' && ride.destination !== 'Not specified') {
        activeWithDestination++;
      }
      
      // Collect samples for detailed analysis
      if (index < 5) {
        activeSamples.push({
          id: ride._id.toString(),
          status: ride.status,
          createdAt: ride.createdAt,
          hasDropLocation: !!ride.dropLocation,
          dropLocationAddress: ride.dropLocation?.address || 'MISSING',
          hasDestination: !!ride.destination,
          destination: ride.destination || 'MISSING',
          coordinates: ride.dropLocation ? 
            `${ride.dropLocation.latitude}, ${ride.dropLocation.longitude}` : 'MISSING'
        });
      }
    });
    
    console.log(`  Rides with dropLocation field: ${activeWithDropLocation}/${activeRides.length}`);
    console.log(`  Rides with dropLocation.address: ${activeWithDropAddress}/${activeRides.length}`);
    console.log(`  Rides with destination field: ${activeWithDestination}/${activeRides.length}`);
    console.log(`  Rides with valid coordinates: ${activeWithValidCoords}/${activeRides.length}`);
    
    // 3. Analyze recent rides (last 24 hours)
    console.log('\n⏰ RECENT RIDES ANALYSIS (Last 24 Hours):');
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRides = await RideRequest.find({
      createdAt: { $gte: yesterday }
    }).lean();
    
    let recentWithDropAddress = 0;
    let recentWithDestination = 0;
    
    recentRides.forEach(ride => {
      if (ride.dropLocation?.address && ride.dropLocation.address.trim() !== '') {
        recentWithDropAddress++;
      }
      if (ride.destination && ride.destination.trim() !== '' && ride.destination !== 'Not specified') {
        recentWithDestination++;
      }
    });
    
    console.log(`  Recent rides count: ${recentRides.length}`);
    console.log(`  Recent with dropLocation.address: ${recentWithDropAddress}/${recentRides.length}`);
    console.log(`  Recent with destination field: ${recentWithDestination}/${recentRides.length}`);
    
    // 4. Check rides by status
    console.log('\n📊 RIDES BY STATUS (with drop-off data):');
    
    const ridesByStatus = await RideRequest.aggregate([
      {
        $group: {
          _id: '$status',
          total: { $sum: 1 },
          withDropLocation: {
            $sum: {
              $cond: [
                { $and: ['$dropLocation', '$dropLocation.address'] },
                1,
                0
              ]
            }
          },
          withDestination: {
            $sum: {
              $cond: [
                { $and: ['$destination', { $ne: ['$destination', ''] }] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    ridesByStatus.forEach(status => {
      console.log(`  ${status._id}: ${status.total} total, ` +
                 `${status.withDropLocation} with dropLocation, ` +
                 `${status.withDestination} with destination`);
    });
    
    // 5. Sample data inspection
    console.log('\n🔬 SAMPLE DATA INSPECTION:');
    console.log('First 5 active rides:');
    
    activeSamples.forEach((sample, index) => {
      console.log(`\n  Ride ${index + 1}:`);
      console.log(`    ID: ${sample.id}`);
      console.log(`    Status: ${sample.status}`);
      console.log(`    Created: ${sample.createdAt}`);
      console.log(`    Has dropLocation: ${sample.hasDropLocation}`);
      console.log(`    dropLocation.address: "${sample.dropLocationAddress}"`);
      console.log(`    Has destination: ${sample.hasDestination}`);
      console.log(`    destination: "${sample.destination}"`);
      console.log(`    Coordinates: ${sample.coordinates}`);
    });
    
    // 6. Identify problematic rides
    console.log('\n⚠️  PROBLEMATIC RIDES:');
    
    const problematicRides = await RideRequest.find({
      $or: [
        { dropLocation: { $exists: false } },
        { dropLocation: null },
        { 'dropLocation.address': { $exists: false } },
        { 'dropLocation.address': '' },
        { 'dropLocation.address': null },
        { 
          $and: [
            { dropLocation: { $exists: true } },
            { 'dropLocation.address': { $exists: true } },
            { 'dropLocation.address': { $ne: null } },
            { 'dropLocation.address': { $ne: '' } },
            { destination: { $exists: false } }
          ]
        }
      ]
    }).lean().limit(10);
    
    console.log(`  Found ${problematicRides.length} problematic rides (showing first 10):`);
    
    problematicRides.forEach((ride, index) => {
      console.log(`\n    Problem Ride ${index + 1}:`);
      console.log(`      ID: ${ride._id}`);
      console.log(`      Status: ${ride.status}`);
      console.log(`      Created: ${ride.createdAt}`);
      console.log(`      dropLocation exists: ${!!ride.dropLocation}`);
      console.log(`      dropLocation.address: "${ride.dropLocation?.address || 'MISSING'}"`);
      console.log(`      destination: "${ride.destination || 'MISSING'}"`);
      console.log(`      Issue: ${
        !ride.dropLocation ? 'Missing dropLocation' :
        !ride.dropLocation.address ? 'Missing dropLocation.address' :
        !ride.destination ? 'Missing destination field' :
        'Unknown issue'
      }`);
    });
    
    // 7. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    const dropLocationMissing = activeRides.length - activeWithDropLocation;
    const destinationMissing = activeRides.length - activeWithDestination;
    
    if (dropLocationMissing > 0) {
      console.log(`  ⚠️  ${dropLocationMissing} rides missing dropLocation field`);
      console.log(`     → Check ride creation endpoint for dropLocation validation`);
    }
    
    if (destinationMissing > 0) {
      console.log(`  ⚠️  ${destinationMissing} rides missing destination field`);
      console.log(`     → Admin API should map dropLocation.address to destination`);
    }
    
    const recentMissingPercent = recentRides.length > 0 ? 
      Math.round((recentRides.length - recentWithDropAddress) / recentRides.length * 100) : 0;
    
    if (recentMissingPercent > 10) {
      console.log(`  🚨 ${recentMissingPercent}% of recent rides missing drop-off data`);
      console.log(`     → This indicates an ongoing issue with ride creation`);
    } else {
      console.log(`  ✅ Recent rides have good drop-off data coverage (${100 - recentMissingPercent}%)`);
    }
    
    if (problematicRides.length > 0) {
      console.log(`  🔧 ${problematicRides.length} rides need data repair`);
      console.log(`     → Run data migration script to fix these rides`);
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('  1. If recent rides are missing data: Check ride creation endpoint');
    console.log('  2. If old rides are missing data: Run data migration script');
    console.log('  3. If admin not showing destinations: Check frontend display logic');
    console.log('  4. Test ride creation with dropLocation to verify current flow');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Drop-off Location Diagnostic...\n');
  
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }
  
  await analyzeDrop0ffLocations();
  
  console.log('\n✅ Diagnostic complete!');
  console.log('\nTo run this script:');
  console.log('  cd server && node test-dropoff-diagnosis.js');
  
  await mongoose.disconnect();
  process.exit(0);
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

// Run the diagnostic
if (require.main === module) {
  main();
}

module.exports = { connectDB, analyzeDrop0ffLocations };