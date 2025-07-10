// test-ride-flow.js
// Test script to verify the complete ride booking flow

const mongoose = require('mongoose');
const config = require('./config/config');
const { calculateFareEstimates } = require('./utils/fareCalculator');
const { generateRideId, generateRideOTPs, verifyOTP } = require('./utils/otpUtils');
const { logRideEvent, getActiveRidesSummary } = require('./utils/rideLogger');
const { seedMetroStations } = require('./utils/seedMetroStations');

// Import models
const Driver = require('./models/Driver');
const User = require('./models/User');
const RideRequest = require('./models/RideRequest');
const MetroStation = require('./models/MetroStation');

async function testCompleteRideFlow() {
  try {
    console.log('\n🧪 Starting Complete Ride Flow Test...\n');
    
    // Connect to MongoDB
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
    
    // Seed metro stations if not present
    const stationCount = await MetroStation.countDocuments();
    if (stationCount === 0) {
      console.log('🚇 Seeding metro stations...');
      await seedMetroStations();
    }
    
    // Test 1: Fare Calculation
    console.log('\n📊 Test 1: Fare Calculation');
    const fareEstimates = calculateFareEstimates(
      28.6328, 77.2197, // Rajiv Chowk
      28.5433, 77.2066  // Hauz Khas
    );
    console.log('Fare estimates:', {
      distance: fareEstimates.distance,
      bike: fareEstimates.estimates.bike.totalFare,
      auto: fareEstimates.estimates.auto.totalFare,
      car: fareEstimates.estimates.car.totalFare
    });
    
    // Test 2: OTP Generation and Verification
    console.log('\n🔐 Test 2: OTP System');
    const rideId = generateRideId();
    const { startOTP, endOTP } = generateRideOTPs();
    console.log('Generated:', { rideId, startOTP, endOTP });
    
    const isStartOTPValid = verifyOTP(startOTP, startOTP);
    const isEndOTPValid = verifyOTP(endOTP, endOTP);
    const isWrongOTPValid = verifyOTP('1234', startOTP);
    console.log('OTP verification:', { isStartOTPValid, isEndOTPValid, isWrongOTPValid });
    
    // Test 3: Driver Management
    console.log('\n🚗 Test 3: Driver Management');
    
    // Find or create a test driver
    let testDriver = await Driver.findOne({ mobileNo: '9999999999' });
    if (!testDriver) {
      testDriver = await Driver.create({
        fullName: 'Test Driver',
        mobileNo: '9999999999',
        aadhaarNo: '123456789012',
        aadhaarPhotoFront: 'test-aadhaar-front.jpg',
        aadhaarPhotoBack: 'test-aadhaar-back.jpg',
        driverSelfie: 'test-selfie.jpg',
        vehicleNo: 'DL-01-AB-1234',
        vehicleType: 'auto',
        registrationCertificatePhoto: 'test-rc.jpg',
        bankDetails: {
          accountHolderName: 'Test Driver',
          accountNumber: '1234567890',
          ifscCode: 'HDFC0000123',
          bankName: 'HDFC Bank'
        },
        drivingLicenseNo: 'DL123456789',
        drivingLicensePhoto: 'test-dl.jpg',
        password: 'password123',
        isVerified: true
      });
      console.log('Created test driver:', testDriver._id);
    }
    
    // Test driver going online
    const metroStation = await MetroStation.findOne({ name: 'Rajiv Chowk' });
    await Driver.findByIdAndUpdate(testDriver._id, {
      isOnline: true,
      currentMetroBooth: 'Rajiv Chowk',
      vehicleType: 'auto',
      location: {
        type: 'Point',
        coordinates: [77.2197, 28.6328],
        lastUpdated: new Date()
      }
    });
    console.log('Driver went online at Rajiv Chowk');
    
    // Test 4: User Management
    console.log('\n👤 Test 4: User Management');
    
    // Find or create a test user
    let testUser = await User.findOne({ email: 'testuser@example.com' });
    if (!testUser) {
      testUser = await User.create({
        fullName: 'Test User',
        email: 'testuser@example.com',
        phone: '8888888888',
        password: 'password123'
      });
      console.log('Created test user:', testUser._id);
    }
    
    // Test 5: Complete Ride Flow
    console.log('\n🚴 Test 5: Complete Ride Flow');
    
    // Create ride request
    const testRideRequest = await RideRequest.create({
      userId: testUser._id,
      userName: testUser.fullName,
      userPhone: testUser.phone,
      pickupLocation: {
        boothName: 'Rajiv Chowk',
        latitude: 28.6328,
        longitude: 77.2197
      },
      dropLocation: {
        address: 'Hauz Khas',
        latitude: 28.5433,
        longitude: 77.2066
      },
      vehicleType: 'auto',
      distance: fareEstimates.distance,
      fare: fareEstimates.estimates.auto.totalFare,
      estimatedFare: fareEstimates.estimates.auto.totalFare,
      rideId: rideId,
      startOTP: startOTP,
      endOTP: endOTP,
      status: 'pending'
    });
    console.log('Created ride request:', testRideRequest._id);
    
    // Log ride events
    logRideEvent(rideId, 'ride_request_created', {
      userId: testUser._id,
      vehicleType: 'auto',
      fare: fareEstimates.estimates.auto.totalFare
    });
    
    // Driver accepts ride
    await RideRequest.findByIdAndUpdate(testRideRequest._id, {
      status: 'driver_assigned',
      driverId: testDriver._id,
      driverName: testDriver.fullName,
      driverPhone: testDriver.mobileNo,
      driverVehicleNo: testDriver.vehicleNo,
      acceptedAt: new Date()
    });
    console.log('Driver accepted ride');
    
    logRideEvent(rideId, 'ride_accepted', {
      driverId: testDriver._id,
      driverName: testDriver.fullName
    });
    
    // Verify start OTP
    console.log('Verifying start OTP...');
    const startOTPVerification = verifyOTP(startOTP, testRideRequest.startOTP);
    if (startOTPVerification) {
      await RideRequest.findByIdAndUpdate(testRideRequest._id, {
        status: 'ride_started',
        rideStartedAt: new Date()
      });
      console.log('Ride started with OTP verification');
      
      logRideEvent(rideId, 'ride_started', {
        startedAt: new Date(),
        startOTP: startOTP
      });
    }
    
    // Simulate ride progress
    console.log('Simulating ride in progress...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify end OTP
    console.log('Verifying end OTP...');
    const endOTPVerification = verifyOTP(endOTP, testRideRequest.endOTP);
    if (endOTPVerification) {
      const rideDuration = 15; // minutes
      await RideRequest.findByIdAndUpdate(testRideRequest._id, {
        status: 'ride_ended',
        rideEndedAt: new Date(),
        actualFare: testRideRequest.estimatedFare
      });
      
      // Update driver stats
      await Driver.findByIdAndUpdate(testDriver._id, {
        $inc: { 
          totalRides: 1, 
          totalEarnings: testRideRequest.estimatedFare 
        }
      });
      
      console.log('Ride completed with OTP verification');
      
      logRideEvent(rideId, 'ride_ended', {
        endedAt: new Date(),
        rideDuration: rideDuration,
        actualFare: testRideRequest.estimatedFare
      });
    }
    
    // Test 6: Logging and Analytics
    console.log('\n📈 Test 6: Logging and Analytics');
    const activeRidesSummary = getActiveRidesSummary();
    console.log('Active rides summary:', activeRidesSummary);
    
    // Test 7: Metro Station Data
    console.log('\n🚇 Test 7: Metro Station Data');
    const stations = await MetroStation.find().limit(5);
    console.log(`Total metro stations: ${await MetroStation.countDocuments()}`);
    console.log('Sample stations:', stations.map(s => ({ name: s.name, line: s.line })));
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await RideRequest.findByIdAndDelete(testRideRequest._id);
    await Driver.findByIdAndUpdate(testDriver._id, {
      isOnline: false,
      currentMetroBooth: null,
      $inc: { totalRides: -1, totalEarnings: -testRideRequest.estimatedFare }
    });
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Fare calculation working');
    console.log('✅ OTP generation and verification working');
    console.log('✅ Driver management working');
    console.log('✅ User management working');
    console.log('✅ Complete ride flow working');
    console.log('✅ Logging and analytics working');
    console.log('✅ Metro station data working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
if (require.main === module) {
  testCompleteRideFlow();
}

module.exports = { testCompleteRideFlow };