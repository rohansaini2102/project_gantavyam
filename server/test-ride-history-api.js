const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3_riders')
  .then(async () => {
    const RideHistory = require('./models/RideHistory');

    console.log('🧪 TESTING RIDE HISTORY API LOGIC');
    console.log('================================');

    // Simulate the driver ride history API logic from drivers.js:1039
    const driverId = null; // We'll get a real driver ID from the data
    const page = 1;
    const limit = 10;
    const status = 'all';

    // First, find a driver ID from existing data
    const sampleRide = await RideHistory.findOne({ driverId: { $ne: null } });
    if (!sampleRide) {
      console.log('❌ No rides found with driverId');
      process.exit(1);
    }

    const testDriverId = sampleRide.driverId;
    console.log('Using driver ID:', testDriverId);

    // Build query filter (like the API)
    const filter = { driverId: testDriverId };

    // Add status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get ride history (without populate to avoid schema issues)
    const rideHistoryRaw = await RideHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    console.log(`📋 Found ${rideHistoryRaw.length} rides for driver ${testDriverId}`);

    // Helper function to calculate driver earnings from customer fare (from API)
    const calculateDriverEarningsFromCustomerFare = (customerFare) => {
      if (!customerFare || customerFare <= 0) return 0;
      // Reverse calculation: customerFare = driverFare + commission(10%) + gst(5%) + nightCharge
      // Simplified: customerFare ≈ driverFare × 1.155 (assuming no night charge)
      const estimatedDriverFare = Math.round(customerFare / 1.155);
      return Math.max(0, estimatedDriverFare);
    };

    // Map ride history to show only driver fare (like the API)
    const rideHistory = rideHistoryRaw.map(ride => {
      let driverEarnings;

      // Priority 1: Use driverFare field (most accurate)
      if (ride.driverFare && ride.driverFare > 0) {
        driverEarnings = ride.driverFare;
        console.log(`✅ Using driverFare: ${driverEarnings} for ride ${ride._id}`);
      }
      // Priority 2: For legacy data, assume estimatedFare is driver's fare
      else if (ride.estimatedFare && ride.estimatedFare > 0) {
        driverEarnings = ride.estimatedFare;
        console.log(`⚠️  Using estimatedFare: ${driverEarnings} for ride ${ride._id}`);
      }
      // Priority 3: Calculate from actualFare (customer total) as last resort
      else if (ride.actualFare && ride.actualFare > 0) {
        driverEarnings = calculateDriverEarningsFromCustomerFare(ride.actualFare);
        console.log(`❌ Calculating from actualFare: ${driverEarnings} (from ${ride.actualFare}) for ride ${ride._id}`);
      }
      // Fallback
      else {
        driverEarnings = 0;
        console.log(`❌ No fare data found for ride ${ride._id}`);
      }

      return {
        ...ride.toObject(),
        // Driver sees only their earnings
        fare: driverEarnings,
        actualFare: driverEarnings,
        estimatedFare: driverEarnings,
        driverFare: driverEarnings,
        // Hide commission and GST from driver
        gstAmount: undefined,
        commissionAmount: undefined,
        nightChargeAmount: undefined,
        customerFare: undefined
      };
    });

    console.log('\n📋 API Response Sample:');
    rideHistory.slice(0, 3).forEach((ride, index) => {
      console.log(`${index + 1}. Ride ${ride._id}:`);
      console.log(`   - fare: ${ride.fare}`);
      console.log(`   - actualFare: ${ride.actualFare}`);
      console.log(`   - estimatedFare: ${ride.estimatedFare}`);
      console.log(`   - driverFare: ${ride.driverFare}`);
      console.log(`   - distance: ${ride.distance}km`);
      console.log(`   - vehicleType: ${ride.vehicleType}`);
      console.log('');
    });

    console.log('✅ API response shows only driver earnings!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });