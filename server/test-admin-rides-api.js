const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3_riders')
  .then(async () => {
    const RideHistory = require('./models/RideHistory');
    const RideRequest = require('./models/RideRequest');

    console.log('🧪 TESTING ADMIN RIDES API LOGIC');
    console.log('===============================');

    // Simulate the admin rides API logic
    const filter = {};
    const historyFilter = {};

    // Helper function to calculate customer fare from driver fare (from admin API)
    const calculateCustomerFareFromDriverFare = (driverFare, vehicleType = 'auto') => {
      if (!driverFare || driverFare <= 0) return 0;

      // Customer fare = driverFare + commission(~10%) + GST(~5%) + platform fee(~3%)
      // Total markup ≈ 18-20%, so customer pays ≈ 1.18-1.2x driver fare
      const markup = 1.18; // Conservative 18% markup
      const customerFare = Math.round(driverFare * markup);

      // Ensure minimum customer fare based on vehicle type
      const minCustomerFares = { auto: 46, bike: 35, car: 70 };
      const minFare = minCustomerFares[vehicleType] || 46;

      return Math.max(customerFare, minFare);
    };

    // Query RideHistory (completed/cancelled rides) - limit to 5 for testing
    const historyRides = await RideHistory.find(historyFilter).limit(5).lean();

    console.log(`📋 Found ${historyRides.length} RideHistory records`);

    // Test the normalization logic (like the admin API)
    const normalizedHistoryRides = historyRides.map(ride => {
      console.log(`\n🔍 Processing ride ${ride._id}:`);
      console.log(`  - Original driverFare: ${ride.driverFare}`);
      console.log(`  - Original customerFare: ${ride.customerFare}`);
      console.log(`  - Original estimatedFare: ${ride.estimatedFare}`);
      console.log(`  - Vehicle type: ${ride.vehicleType}`);

      // Calculate customer fare if missing (FIXED FOR ADMIN)
      let customerFare = ride.customerFare;
      if (!customerFare && ride.driverFare && ride.driverFare > 0) {
        customerFare = calculateCustomerFareFromDriverFare(ride.driverFare, ride.vehicleType);
        console.log(`  ✅ Calculated customerFare from driverFare: ${customerFare}`);
      } else if (!customerFare && ride.estimatedFare && ride.estimatedFare > 0) {
        // If estimatedFare exists but no customerFare, use estimatedFare as fallback
        customerFare = ride.estimatedFare;
        console.log(`  ⚠️  Using estimatedFare as customerFare: ${customerFare}`);
      } else if (customerFare) {
        console.log(`  ℹ️  Using existing customerFare: ${customerFare}`);
      } else {
        console.log(`  ❌ No fare data available`);
      }

      const gstAmount = ride.gstAmount || Math.round((customerFare || 0) * 0.05);
      const commissionAmount = ride.commissionAmount || Math.round((ride.driverFare || 0) * 0.10);

      console.log(`  📊 Final fare breakdown:`);
      console.log(`    - Driver Fare: ₹${ride.driverFare || 0}`);
      console.log(`    - Customer Fare: ₹${customerFare || 0}`);
      console.log(`    - GST: ₹${gstAmount}`);
      console.log(`    - Commission: ₹${commissionAmount}`);

      return {
        _id: ride._id,
        driverFare: ride.driverFare || ride.fare,
        customerFare: customerFare,
        estimatedFare: customerFare, // Show customer fare as estimated fare for admin
        actualFare: customerFare, // Show customer fare as actual fare for admin
        gstAmount: gstAmount,
        commissionAmount: commissionAmount,
        nightChargeAmount: ride.nightChargeAmount || 0,
        vehicleType: ride.vehicleType,
        distance: ride.distance
      };
    });

    console.log('\n📋 FINAL API RESPONSE SAMPLE:');
    console.log('============================');
    normalizedHistoryRides.forEach((ride, index) => {
      console.log(`${index + 1}. Ride ${ride._id}:`);
      console.log(`   - Driver Fare: ₹${ride.driverFare || 0}`);
      console.log(`   - Customer Fare: ₹${ride.customerFare || 0}`);
      console.log(`   - Estimated Fare: ₹${ride.estimatedFare || 0}`);
      console.log(`   - Actual Fare: ₹${ride.actualFare || 0}`);
      console.log(`   - GST Amount: ₹${ride.gstAmount || 0}`);
      console.log(`   - Commission: ₹${ride.commissionAmount || 0}`);
      console.log('');
    });

    // Check if any rides still have zero customer fare
    const ridesWithZeroCustomerFare = normalizedHistoryRides.filter(r => !r.customerFare || r.customerFare === 0);
    if (ridesWithZeroCustomerFare.length > 0) {
      console.log(`❌ WARNING: ${ridesWithZeroCustomerFare.length} rides still have zero customer fare!`);
    } else {
      console.log(`✅ SUCCESS: All rides now have proper customer fare breakdown!`);
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });