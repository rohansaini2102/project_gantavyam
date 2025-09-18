const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3_riders')
  .then(async () => {
    const RideRequest = require('./models/RideRequest');

    console.log('🔍 CHECKING RIDE FARES IN DATABASE');
    console.log('=================================');

    // Get recent completed rides
    const recentRides = await RideRequest.find({
      status: 'completed'
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('driverFare fare estimatedFare actualFare distance vehicleType userName status createdAt');

    console.log('📋 Recent Completed Rides:');
    console.log('===========================');

    recentRides.forEach((ride, index) => {
      console.log(`${index + 1}. ${ride.userName || 'Unknown'} - ${ride.vehicleType || 'auto'}`);
      console.log(`   - driverFare: ${ride.driverFare || 'NULL'}`);
      console.log(`   - fare: ${ride.fare || 'NULL'}`);
      console.log(`   - estimatedFare: ${ride.estimatedFare || 'NULL'}`);
      console.log(`   - actualFare: ${ride.actualFare || 'NULL'}`);
      console.log(`   - distance: ${ride.distance || 'NULL'} km`);
      console.log(`   - createdAt: ${ride.createdAt}`);
      console.log('');
    });

    // Check which rides have driverFare
    const ridesWithDriverFare = recentRides.filter(r => r.driverFare && r.driverFare > 0);
    const ridesWithoutDriverFare = recentRides.filter(r => !r.driverFare || r.driverFare === 0);

    console.log(`📊 SUMMARY:`);
    console.log(`- Total rides: ${recentRides.length}`);
    console.log(`- Rides with driverFare: ${ridesWithDriverFare.length}`);
    console.log(`- Rides without driverFare: ${ridesWithoutDriverFare.length}`);

    if (ridesWithoutDriverFare.length > 0) {
      console.log('\n⚠️ RIDES WITHOUT DRIVER FARE:');
      ridesWithoutDriverFare.forEach(ride => {
        console.log(`- ${ride.userName}: fare=${ride.fare}, estimatedFare=${ride.estimatedFare}`);
      });
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });