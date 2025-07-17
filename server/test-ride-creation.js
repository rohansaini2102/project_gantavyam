#!/usr/bin/env node

/**
 * Test Ride Creation Script
 * 
 * This script creates test rides to verify the drop-off location flow
 * and tests how they appear in the admin ride management interface.
 */

const mongoose = require('mongoose');
const RideRequest = require('./models/RideRequest');
const User = require('./models/User');

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

// Generate test ride data
function generateTestRideData() {
  const testDestinations = [
    {
      address: 'Connaught Place, New Delhi, Delhi 110001',
      lat: 28.6315,
      lng: 77.2167
    },
    {
      address: 'India Gate, Rajpath, New Delhi, Delhi 110003',
      lat: 28.6129,
      lng: 77.2295
    },
    {
      address: 'Red Fort, Lal Qila, Chandni Chowk, New Delhi, Delhi 110006',
      lat: 28.6562,
      lng: 77.2410
    },
    {
      address: 'Lotus Temple, Lotus Temple Rd, Bahapur, New Delhi, Delhi 110019',
      lat: 28.5535,
      lng: 77.2588
    },
    {
      address: 'Humayun Tomb, Mathura Rd, Nizamuddin, New Delhi, Delhi 110013',
      lat: 28.5933,
      lng: 77.2507
    }
  ];
  
  const vehicleTypes = ['bike', 'auto', 'car'];
  
  return testDestinations.map((dest, index) => ({
    pickupStation: 'Hauz Khas Metro Gate No 1',
    dropLocation: dest,
    vehicleType: vehicleTypes[index % vehicleTypes.length],
    estimatedFare: 50 + (index * 20), // 50, 70, 90, 110, 130
    testRideNumber: index + 1
  }));
}

// Generate unique ride ID
function generateRideId() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8);
  return `GT${timestamp.slice(-6)}${random.toUpperCase()}`;
}

// Generate OTPs
function generateRideOTPs() {
  const startOTP = Math.floor(1000 + Math.random() * 9000).toString();
  const endOTP = Math.floor(1000 + Math.random() * 9000).toString();
  return { startOTP, endOTP };
}

// Create test user if needed
async function getOrCreateTestUser() {
  let testUser = await User.findOne({ email: 'test.dropoff@example.com' });
  
  if (!testUser) {
    console.log('👤 Creating test user...');
    testUser = await User.create({
      name: 'Drop-off Test User',
      email: 'test.dropoff@example.com',
      phone: '+919999888777',
      password: 'testpassword123',
      isVerified: true
    });
    console.log('✅ Test user created:', testUser._id);
  } else {
    console.log('👤 Using existing test user:', testUser._id);
  }
  
  return testUser;
}

// Create test rides
async function createTestRides() {
  console.log('\n🚀 CREATING TEST RIDES');
  console.log('=' .repeat(50));
  
  try {
    const testUser = await getOrCreateTestUser();
    const testRideData = generateTestRideData();
    
    console.log(`\n📝 Creating ${testRideData.length} test rides...`);
    
    const createdRides = [];
    
    for (const rideData of testRideData) {
      const rideId = generateRideId();
      const { startOTP, endOTP } = generateRideOTPs();
      
      console.log(`\n🔨 Creating test ride ${rideData.testRideNumber}:`);
      console.log(`  Destination: ${rideData.dropLocation.address}`);
      console.log(`  Vehicle: ${rideData.vehicleType}`);
      console.log(`  Fare: ₹${rideData.estimatedFare}`);
      
      const rideRequest = await RideRequest.create({
        userId: testUser._id,
        userName: testUser.name,
        userPhone: testUser.phone,
        pickupLocation: {
          boothName: rideData.pickupStation,
          latitude: 28.5433,
          longitude: 77.2066
        },
        dropLocation: {
          address: rideData.dropLocation.address,
          latitude: rideData.dropLocation.lat,
          longitude: rideData.dropLocation.lng
        },
        vehicleType: rideData.vehicleType,
        distance: 5.5 + (rideData.testRideNumber * 0.5), // Varying distances
        fare: rideData.estimatedFare,
        estimatedFare: rideData.estimatedFare,
        rideId: rideId,
        boothRideNumber: `TEST-${rideData.testRideNumber}`,
        startOTP: startOTP,
        endOTP: endOTP,
        status: 'pending',
        createdAt: new Date()
      });
      
      createdRides.push(rideRequest);
      
      console.log(`  ✅ Created ride: ${rideRequest._id}`);
      console.log(`  📍 Drop Location: ${JSON.stringify(rideRequest.dropLocation)}`);
    }
    
    console.log(`\n✅ Successfully created ${createdRides.length} test rides!`);
    
    // Verify the created rides
    console.log('\n🔍 VERIFYING CREATED RIDES:');
    
    for (const ride of createdRides) {
      const verifyRide = await RideRequest.findById(ride._id).lean();
      
      console.log(`\n  Ride ${verifyRide.boothRideNumber}:`);
      console.log(`    ID: ${verifyRide._id}`);
      console.log(`    Status: ${verifyRide.status}`);
      console.log(`    Has dropLocation: ${!!verifyRide.dropLocation}`);
      console.log(`    dropLocation.address: "${verifyRide.dropLocation?.address || 'MISSING'}"`);
      console.log(`    Coordinates: ${verifyRide.dropLocation?.latitude}, ${verifyRide.dropLocation?.longitude}`);
      console.log(`    Created: ${verifyRide.createdAt}`);
      
      // Check if this ride would show a destination in admin
      const wouldShowDestination = verifyRide.dropLocation?.address || 'Not specified';
      console.log(`    Admin would show destination: "${wouldShowDestination}"`);
      
      if (!verifyRide.dropLocation || !verifyRide.dropLocation.address) {
        console.log(`    ❌ PROBLEM: Missing dropLocation.address!`);
      } else {
        console.log(`    ✅ Drop-off location data is complete`);
      }
    }
    
    return createdRides;
    
  } catch (error) {
    console.error('❌ Error creating test rides:', error);
    throw error;
  }
}

// Test admin API response
async function testAdminAPI(createdRides) {
  console.log('\n🔍 TESTING ADMIN API RESPONSE');
  console.log('=' .repeat(50));
  
  try {
    // Simulate what the admin API does
    const rides = await RideRequest.find({
      _id: { $in: createdRides.map(r => r._id) }
    }).lean();
    
    console.log(`\n📊 Found ${rides.length} test rides in admin query`);
    
    // Apply the same normalization as admin API
    rides.forEach(ride => {
      // Ensure destination field is set from dropLocation.address
      if (!ride.destination && ride.dropLocation?.address) {
        ride.destination = ride.dropLocation.address;
      } else if (!ride.destination) {
        ride.destination = 'Not specified';
      }
    });
    
    console.log('\n📋 Admin API Response Simulation:');
    rides.forEach((ride, index) => {
      console.log(`\n  Test Ride ${index + 1}:`);
      console.log(`    _id: ${ride._id}`);
      console.log(`    status: ${ride.status}`);
      console.log(`    pickupLocation: ${ride.pickupLocation?.boothName || 'Unknown'}`);
      console.log(`    destination: "${ride.destination}"`);
      console.log(`    dropLocation.address: "${ride.dropLocation?.address || 'MISSING'}"`);
      console.log(`    vehicleType: ${ride.vehicleType}`);
      console.log(`    estimatedFare: ₹${ride.estimatedFare}`);
      console.log(`    ✅ Would appear in admin with destination: "${ride.destination}"`);
    });
    
    const ridesWithDestination = rides.filter(r => r.destination && r.destination !== 'Not specified');
    console.log(`\n📈 Results: ${ridesWithDestination.length}/${rides.length} rides would show destinations in admin`);
    
    if (ridesWithDestination.length === rides.length) {
      console.log('✅ All test rides would display destinations correctly in admin!');
    } else {
      console.log('❌ Some test rides would not display destinations in admin!');
    }
    
  } catch (error) {
    console.error('❌ Error testing admin API:', error);
  }
}

// Clean up test rides
async function cleanupTestRides(rides) {
  console.log('\n🧹 CLEANUP OPTIONS');
  console.log('=' .repeat(30));
  
  console.log(`\nCreated ${rides.length} test rides with IDs:`);
  rides.forEach((ride, index) => {
    console.log(`  ${index + 1}. ${ride._id} (${ride.boothRideNumber})`);
  });
  
  console.log('\nTo clean up these test rides, run:');
  console.log('node test-ride-creation.js --cleanup');
  
  console.log('\nOr manually delete them:');
  const idsString = rides.map(r => `"${r._id}"`).join(', ');
  console.log(`db.riderequests.deleteMany({_id: {$in: [${idsString}]}})`);
}

// Cleanup function
async function cleanup() {
  console.log('\n🧹 CLEANING UP TEST RIDES');
  console.log('=' .repeat(40));
  
  try {
    // Delete test rides
    const deleteResult = await RideRequest.deleteMany({
      boothRideNumber: { $regex: /^TEST-/ }
    });
    
    console.log(`✅ Deleted ${deleteResult.deletedCount} test rides`);
    
    // Optionally delete test user
    const testUser = await User.findOne({ email: 'test.dropoff@example.com' });
    if (testUser) {
      console.log('👤 Test user still exists. To delete:');
      console.log(`   User ID: ${testUser._id}`);
      console.log('   Email: test.dropoff@example.com');
      console.log('   (Not automatically deleted for safety)');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    console.log('🧹 Running cleanup mode...\n');
    const connected = await connectDB();
    if (!connected) process.exit(1);
    
    await cleanup();
    await mongoose.disconnect();
    process.exit(0);
  }
  
  console.log('🧪 TEST RIDE CREATION FOR DROP-OFF LOCATION VERIFICATION');
  console.log('=' .repeat(60));
  console.log('This script will create test rides to verify drop-off location display in admin.\n');
  
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }
  
  try {
    const createdRides = await createTestRides();
    await testAdminAPI(createdRides);
    await cleanupTestRides(createdRides);
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Check the admin ride management interface');
    console.log('2. Verify that the test rides show destinations');
    console.log('3. If destinations are missing, check browser console for errors');
    console.log('4. Run the diagnostic script: node test-dropoff-diagnosis.js');
    console.log('5. Clean up test rides when done: node test-ride-creation.js --cleanup');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Test complete!');
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

// Run the test
if (require.main === module) {
  main();
}

module.exports = { createTestRides, testAdminAPI, cleanup };