const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3_riders')
  .then(async () => {
    const RideRequest = require('./models/RideRequest');
    const RideHistory = require('./models/RideHistory');

    console.log('🔍 CHECKING ALL RIDE DATA');
    console.log('========================');

    // Check RideRequest collection
    const rideRequests = await RideRequest.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('driverFare fare estimatedFare actualFare distance vehicleType userName status createdAt');

    console.log('📋 Recent RideRequests:');
    console.log('=======================');
    rideRequests.forEach((ride, index) => {
      console.log(`${index + 1}. ${ride.userName || 'Unknown'} - ${ride.vehicleType || 'auto'} - ${ride.status}`);
      console.log(`   - driverFare: ${ride.driverFare || 'NULL'}`);
      console.log(`   - fare: ${ride.fare || 'NULL'}`);
      console.log(`   - estimatedFare: ${ride.estimatedFare || 'NULL'}`);
      console.log(`   - actualFare: ${ride.actualFare || 'NULL'}`);
      console.log(`   - distance: ${ride.distance || 'NULL'} km`);
      console.log('');
    });

    // Check RideHistory collection
    const rideHistory = await RideHistory.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('driverFare fare estimatedFare actualFare distance vehicleType userName status createdAt');

    console.log('📋 Recent RideHistory:');
    console.log('======================');
    rideHistory.forEach((ride, index) => {
      console.log(`${index + 1}. ${ride.userName || 'Unknown'} - ${ride.vehicleType || 'auto'} - ${ride.status}`);
      console.log(`   - driverFare: ${ride.driverFare || 'NULL'}`);
      console.log(`   - fare: ${ride.fare || 'NULL'}`);
      console.log(`   - estimatedFare: ${ride.estimatedFare || 'NULL'}`);
      console.log(`   - actualFare: ${ride.actualFare || 'NULL'}`);
      console.log(`   - distance: ${ride.distance || 'NULL'} km`);
      console.log('');
    });

    console.log(`📊 SUMMARY:`);
    console.log(`- Total RideRequests: ${await RideRequest.countDocuments({})}`);
    console.log(`- Total RideHistory: ${await RideHistory.countDocuments({})}`);
    console.log(`- Completed RideRequests: ${await RideRequest.countDocuments({status: 'completed'})}`);
    console.log(`- Completed RideHistory: ${await RideHistory.countDocuments({status: 'completed'})}`);

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });