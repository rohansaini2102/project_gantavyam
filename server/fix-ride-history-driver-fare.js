const mongoose = require('mongoose');
require('dotenv').config();

// Function to calculate driver fare from distance and vehicle type (matches FareConfig)
const calculateDriverFareFromDistance = (distance, vehicleType) => {
  const fareConfig = {
    auto: { baseFare: 40, baseKm: 2, perKmRate: 17, minFare: 40 },
    bike: { baseFare: 30, baseKm: 2, perKmRate: 12, minFare: 30 },
    car: { baseFare: 60, baseKm: 2, perKmRate: 25, minFare: 60 }
  };

  const config = fareConfig[vehicleType] || fareConfig.auto;
  let fare = config.baseFare;

  if (distance && distance > config.baseKm) {
    fare += (distance - config.baseKm) * config.perKmRate;
  }

  return Math.max(Math.round(fare), config.minFare);
};

// Function to estimate driver fare from customer fare
const estimateDriverFareFromCustomerFare = (customerFare) => {
  if (!customerFare || customerFare <= 0) return 0;
  // Customer fare includes: driverFare + commission(~10%) + GST(~5%) + platform fee
  // Conservative estimate: driverFare ≈ 60% of customer fare
  return Math.round(customerFare * 0.6);
};

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/gt3_riders')
  .then(async () => {
    const RideHistory = require('./models/RideHistory');

    console.log('🔧 FIXING RIDE HISTORY DRIVER FARE DATA');
    console.log('======================================');

    // Find all rides with missing driverFare
    const ridesWithoutDriverFare = await RideHistory.find({
      $or: [
        { driverFare: null },
        { driverFare: { $exists: false } },
        { driverFare: 0 }
      ]
    });

    console.log(`📋 Found ${ridesWithoutDriverFare.length} rides without proper driverFare`);

    let updated = 0;
    let errors = 0;

    for (const ride of ridesWithoutDriverFare) {
      try {
        let driverFare = 0;

        // Priority 1: Calculate from distance and vehicle type (most accurate)
        if (ride.distance && ride.vehicleType) {
          driverFare = calculateDriverFareFromDistance(ride.distance, ride.vehicleType);
          console.log(`✅ ${ride._id}: Using distance calculation - ${driverFare} (${ride.distance}km, ${ride.vehicleType})`);
        }
        // Priority 2: Estimate from customer fare
        else if (ride.actualFare && ride.actualFare > 0) {
          driverFare = estimateDriverFareFromCustomerFare(ride.actualFare);
          console.log(`⚠️  ${ride._id}: Using customer fare estimate - ${driverFare} (from ${ride.actualFare})`);
        }
        // Priority 3: Use estimatedFare as fallback (might be customer fare, but better than nothing)
        else if (ride.estimatedFare && ride.estimatedFare > 0) {
          driverFare = estimateDriverFareFromCustomerFare(ride.estimatedFare);
          console.log(`⚠️  ${ride._id}: Using estimated fare fallback - ${driverFare} (from ${ride.estimatedFare})`);
        }
        // Priority 4: Use minimum fare for vehicle type
        else {
          const vehicleType = ride.vehicleType || 'auto';
          const minFares = { auto: 40, bike: 30, car: 60 };
          driverFare = minFares[vehicleType] || 40;
          console.log(`❌ ${ride._id}: Using minimum fare fallback - ${driverFare} (${vehicleType})`);
        }

        // Update the ride
        await RideHistory.findByIdAndUpdate(ride._id, {
          driverFare: driverFare
        });

        updated++;
      } catch (error) {
        console.error(`❌ Error updating ride ${ride._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`- Total rides processed: ${ridesWithoutDriverFare.length}`);
    console.log(`- Successfully updated: ${updated}`);
    console.log(`- Errors: ${errors}`);

    // Verify the fix
    console.log('\n🔍 VERIFICATION:');
    const updatedRides = await RideHistory.find({}).limit(5).select('driverFare actualFare estimatedFare distance vehicleType');
    updatedRides.forEach(ride => {
      console.log(`- ${ride._id}: driverFare=${ride.driverFare}, actualFare=${ride.actualFare}, distance=${ride.distance}km`);
    });

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });