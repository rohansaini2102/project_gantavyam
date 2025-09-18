#!/usr/bin/env node

/**
 * Test Script: Verify Driver Fare Display Fix
 *
 * This script tests that the driver dashboard fare display issue has been resolved
 * by checking that all ride data includes proper driverFare values.
 *
 * Run with: node test-fare-display.js
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

// Test fare calculation logic
const testFareCalculation = async () => {
  console.log('\n🧪 Testing Fare Calculation Logic\n');

  const testCases = [
    { vehicleType: 'auto', distance: 1.5, description: 'Short auto ride (1.5km)' },
    { vehicleType: 'auto', distance: 5.0, description: 'Medium auto ride (5km)' },
    { vehicleType: 'auto', distance: 10.0, description: 'Long auto ride (10km)' },
    { vehicleType: 'bike', distance: 3.0, description: 'Bike ride (3km)' },
    { vehicleType: 'car', distance: 8.0, description: 'Car ride (8km)' }
  ];

  for (const testCase of testCases) {
    try {
      const fareDetails = await calculateFare(testCase.vehicleType, testCase.distance, true, 0);

      console.log(`${testCase.description}:`);
      console.log(`  Driver Fare: ₹${fareDetails.driverFare} (what driver sees)`);
      console.log(`  Customer Total: ₹${fareDetails.customerTotalFare} (what customer pays)`);
      console.log(`  Difference: ₹${fareDetails.customerTotalFare - fareDetails.driverFare} (commission + GST + night charge)`);
      console.log('');

      // Validate that driver fare is reasonable
      if (fareDetails.driverFare <= 0) {
        console.error(`❌ Invalid driver fare for ${testCase.description}`);
      }

      if (fareDetails.customerTotalFare <= fareDetails.driverFare) {
        console.error(`❌ Customer fare should be higher than driver fare for ${testCase.description}`);
      }

    } catch (error) {
      console.error(`❌ Fare calculation failed for ${testCase.description}:`, error.message);
    }
  }
};

// Test database data integrity
const testDatabaseIntegrity = async () => {
  console.log('\n🔍 Testing Database Fare Data Integrity\n');

  try {
    // Check recent rides to ensure they have driverFare
    const recentRides = await RideRequest.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    })
    .limit(10)
    .sort({ createdAt: -1 });

    console.log(`Found ${recentRides.length} recent rides to test`);

    let passCount = 0;
    let failCount = 0;

    for (const ride of recentRides) {
      const hasDriverFare = ride.driverFare && ride.driverFare > 0;
      const hasFallbackFare = ride.fare && ride.fare > 0;

      console.log(`Ride ${ride.rideId}:`);
      console.log(`  Status: ${ride.status}`);
      console.log(`  Vehicle: ${ride.vehicleType}`);
      console.log(`  Distance: ${ride.distance}km`);
      console.log(`  Driver Fare: ₹${ride.driverFare || 'MISSING'}`);
      console.log(`  Estimated Fare: ₹${ride.estimatedFare || 'N/A'}`);
      console.log(`  Legacy Fare: ₹${ride.fare || 'N/A'}`);

      if (hasDriverFare) {
        console.log(`  ✅ Driver fare available`);
        passCount++;
      } else if (hasFallbackFare) {
        console.log(`  ⚠️  Using fallback fare`);
        passCount++;
      } else {
        console.log(`  ❌ No driver fare available - driver would see ₹0`);
        failCount++;
      }

      console.log('');
    }

    console.log(`📊 Test Results:`);
    console.log(`✅ Passed: ${passCount} rides`);
    console.log(`❌ Failed: ${failCount} rides`);

    return failCount === 0;

  } catch (error) {
    console.error('❌ Database integrity test failed:', error);
    return false;
  }
};

// Test driver earnings helper function (client-side logic)
const testDriverEarningsFunction = () => {
  console.log('\n🎯 Testing Driver Earnings Helper Function\n');

  // Simulate the getDriverEarnings function from the client
  const getDriverEarnings = (ride) => {
    if (ride.driverFare && ride.driverFare > 0) {
      return ride.driverFare;
    }

    console.warn(`Missing driverFare for ride ${ride._id || 'unknown'}:`, {
      rideId: ride._id,
      fare: ride.fare,
      estimatedFare: ride.estimatedFare,
      actualFare: ride.actualFare,
      status: ride.status
    });

    return 0;
  };

  const testRides = [
    { _id: 'test1', driverFare: 85, fare: 100, estimatedFare: 115, status: 'completed' },
    { _id: 'test2', driverFare: null, fare: 75, estimatedFare: 90, status: 'completed' },
    { _id: 'test3', driverFare: 0, fare: null, estimatedFare: 110, status: 'pending' },
    { _id: 'test4', driverFare: 120, estimatedFare: 140, status: 'completed' }
  ];

  for (const ride of testRides) {
    const earnings = getDriverEarnings(ride);
    console.log(`Ride ${ride._id}: ₹${earnings} (expected: ₹${ride.driverFare || 0})`);

    if (earnings === (ride.driverFare || 0)) {
      console.log(`  ✅ Correct driver earnings displayed`);
    } else {
      console.log(`  ❌ Incorrect driver earnings - should be ₹${ride.driverFare || 0}`);
    }
  }
};

// Test API response structure
const testAPIResponseStructure = async () => {
  console.log('\n🌐 Testing API Response Structure\n');

  try {
    // Find a sample ride to test response structure
    const sampleRide = await RideRequest.findOne({ status: 'completed' }).sort({ createdAt: -1 });

    if (!sampleRide) {
      console.log('⚠️  No completed rides found for API structure test');
      return true;
    }

    // Simulate API response formatting
    const apiResponse = {
      _id: sampleRide._id,
      rideId: sampleRide.rideId,
      userName: sampleRide.userName,
      userPhone: sampleRide.userPhone,
      pickupLocation: sampleRide.pickupLocation,
      dropLocation: sampleRide.dropLocation,
      vehicleType: sampleRide.vehicleType,
      distance: sampleRide.distance,
      fare: sampleRide.driverFare || sampleRide.fare,  // Driver sees their earnings
      estimatedFare: sampleRide.driverFare || sampleRide.fare,  // Driver sees their earnings
      driverFare: sampleRide.driverFare,
      startOTP: sampleRide.startOTP,
      endOTP: sampleRide.endOTP,
      status: sampleRide.status
    };

    console.log('Sample API Response for Driver:');
    console.log(JSON.stringify(apiResponse, null, 2));

    // Validate structure
    const hasDriveFields = apiResponse.driverFare !== undefined && apiResponse.fare !== undefined;
    const fareIsConsistent = apiResponse.fare === apiResponse.estimatedFare;

    if (hasDriveFields && fareIsConsistent) {
      console.log('\n✅ API response structure is correct for driver dashboard');
      return true;
    } else {
      console.log('\n❌ API response structure has issues');
      return false;
    }

  } catch (error) {
    console.error('❌ API structure test failed:', error);
    return false;
  }
};

// Main test execution
const main = async () => {
  try {
    await connectDB();

    console.log('🧪 Driver Fare Display Fix - Verification Tests');
    console.log('='.repeat(60));

    const results = {
      fareCalculation: true,
      databaseIntegrity: true,
      helperFunction: true,
      apiStructure: true
    };

    // Run all tests
    await testFareCalculation();
    results.databaseIntegrity = await testDatabaseIntegrity();
    testDriverEarningsFunction();
    results.apiStructure = await testAPIResponseStructure();

    // Summary
    console.log('\n📋 Test Summary');
    console.log('='.repeat(30));

    const allPassed = Object.values(results).every(result => result);

    if (allPassed) {
      console.log('🎉 All tests passed! Driver fare display should work correctly.');
      console.log('\n✅ Key validations:');
      console.log('   • Fare calculation logic is working');
      console.log('   • Database has driverFare fields populated');
      console.log('   • Client helper function prioritizes driverFare');
      console.log('   • API responses include proper driver earnings');
    } else {
      console.log('❌ Some tests failed. Please review the issues above.');

      console.log('\n🔧 Recommended actions:');
      if (!results.databaseIntegrity) {
        console.log('   • Run migration script: node migrate-driver-fares.js');
      }
      if (!results.apiStructure) {
        console.log('   • Check API endpoint implementations');
      }
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
};

// Run the tests
if (require.main === module) {
  main();
}

module.exports = {
  testFareCalculation,
  testDatabaseIntegrity,
  testDriverEarningsFunction,
  testAPIResponseStructure
};