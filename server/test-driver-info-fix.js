/**
 * Test script to verify driver info persistence fix
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const RideRequest = require('./models/RideRequest');
const RideHistory = require('./models/RideHistory');
const Driver = require('./models/Driver');
const User = require('./models/User');
const RideLifecycleService = require('./services/rideLifecycle');
const DriverInfoRecovery = require('./utils/driverInfoRecovery');

// Mock data for testing
const testData = {
  user: {
    name: 'Test User',
    email: 'testuser@example.com',
    phone: '9876543210'
  },
  driver: {
    fullName: 'Test Driver',
    mobileNo: '9876543211',
    vehicleNo: 'DL01AB1234',
    vehicleType: 'auto',
    rating: 4.5
  },
  ride: {
    userName: 'Test User',
    userPhone: '9876543210',
    pickupLocation: {
      boothName: 'Test Metro Station',
      latitude: 28.6139,
      longitude: 77.2090
    },
    dropLocation: {
      address: 'Test Drop Location',
      latitude: 28.7041,
      longitude: 77.1025
    },
    distance: 15.5,
    fare: 150,
    estimatedFare: 150,
    vehicleType: 'auto',
    rideId: 'TEST-RIDE-' + Date.now()
  }
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected for testing');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function createTestUser() {
  try {
    const user = await User.create(testData.user);
    console.log('✅ Test user created:', user._id);
    return user;
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  }
}

async function createTestDriver() {
  try {
    const driver = await Driver.create(testData.driver);
    console.log('✅ Test driver created:', driver._id);
    return driver;
  } catch (error) {
    console.error('❌ Error creating test driver:', error);
    throw error;
  }
}

async function createTestRideRequest(userId, driverId) {
  try {
    const rideData = {
      ...testData.ride,
      userId: userId,
      driverId: driverId,
      driverName: testData.driver.fullName,
      driverPhone: testData.driver.mobileNo,
      driverVehicleNo: testData.driver.vehicleNo,
      driverRating: testData.driver.rating,
      status: 'ride_ended',
      acceptedAt: new Date(),
      rideStartedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      rideEndedAt: new Date(),
      actualFare: testData.ride.fare,
      paymentStatus: 'collected',
      paymentMethod: 'cash'
    };

    const ride = await RideRequest.create(rideData);
    console.log('✅ Test ride request created:', ride._id);
    console.log('🔍 Driver info in ride request:', {
      driverId: ride.driverId,
      driverName: ride.driverName,
      driverPhone: ride.driverPhone,
      driverVehicleNo: ride.driverVehicleNo
    });
    return ride;
  } catch (error) {
    console.error('❌ Error creating test ride request:', error);
    throw error;
  }
}

async function testRideCompletion(rideId) {
  try {
    console.log('\n=== TESTING RIDE COMPLETION ===');
    console.log('Completing ride:', rideId);

    const result = await RideLifecycleService.completeRide(rideId, {
      status: 'completed',
      paymentMethod: 'cash'
    });

    if (result.success) {
      console.log('✅ Ride completion successful');
      console.log('🔍 Driver info in history:', {
        driverId: result.rideHistory.driverId,
        driverName: result.rideHistory.driverName,
        driverPhone: result.rideHistory.driverPhone,
        driverVehicleNo: result.rideHistory.driverVehicleNo
      });
      
      // Verify driver info is preserved
      if (result.rideHistory.driverId && result.rideHistory.driverName) {
        console.log('✅ Driver information successfully preserved in history');
        return { success: true, rideHistory: result.rideHistory };
      } else {
        console.log('❌ Driver information missing in history');
        return { success: false, error: 'Driver info missing' };
      }
    } else {
      console.log('❌ Ride completion failed:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Error testing ride completion:', error);
    return { success: false, error: error.message };
  }
}

async function testDriverInfoRecovery() {
  try {
    console.log('\n=== TESTING DRIVER INFO RECOVERY ===');
    
    // Get recovery stats
    const stats = await DriverInfoRecovery.getRecoveryStats();
    console.log('📊 Recovery stats:', stats);
    
    // Find rides with missing driver info
    const missingRides = await DriverInfoRecovery.findRidesWithMissingDriverInfo();
    console.log(`🔍 Found ${missingRides.length} rides with missing driver info`);
    
    if (missingRides.length > 0) {
      console.log('Running dry-run recovery...');
      const dryRunResults = await DriverInfoRecovery.runRecoveryProcess(true);
      console.log('📊 Dry-run results:', dryRunResults);
    }
    
    return { success: true, stats, missingRides: missingRides.length };
  } catch (error) {
    console.error('❌ Error testing driver info recovery:', error);
    return { success: false, error: error.message };
  }
}

async function cleanup() {
  try {
    // Clean up test data
    await User.deleteMany({ email: testData.user.email });
    await Driver.deleteMany({ mobileNo: testData.driver.mobileNo });
    await RideRequest.deleteMany({ rideId: { $regex: /^TEST-RIDE-/ } });
    await RideHistory.deleteMany({ rideId: { $regex: /^TEST-RIDE-/ } });
    console.log('🧹 Test data cleaned up');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

async function runTests() {
  console.log('🧪 Starting driver info persistence tests...\n');
  
  try {
    await connectDB();
    
    // Create test data
    const user = await createTestUser();
    const driver = await createTestDriver();
    const ride = await createTestRideRequest(user._id, driver._id);
    
    // Test ride completion
    const completionResult = await testRideCompletion(ride._id);
    
    // Test driver info recovery
    const recoveryResult = await testDriverInfoRecovery();
    
    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log('Ride completion test:', completionResult.success ? '✅ PASSED' : '❌ FAILED');
    console.log('Driver info recovery test:', recoveryResult.success ? '✅ PASSED' : '❌ FAILED');
    
    if (completionResult.success && recoveryResult.success) {
      console.log('🎉 All tests passed! Driver info persistence fix is working.');
    } else {
      console.log('⚠️ Some tests failed. Check the logs above for details.');
    }
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    await cleanup();
    mongoose.connection.close();
    console.log('🏁 Tests completed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testRideCompletion,
  testDriverInfoRecovery
};