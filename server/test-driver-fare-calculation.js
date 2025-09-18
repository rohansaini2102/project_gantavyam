// Test driver fare calculation logic (matches client-side logic)

const calculatePureBaseFare = (distance, vehicleType) => {
  const fareConfig = {
    auto: { baseFare: 40, baseKm: 2, perKmRate: 17, minFare: 40 },
    bike: { baseFare: 30, baseKm: 2, perKmRate: 12, minFare: 30 },
    car: { baseFare: 60, baseKm: 2, perKmRate: 25, minFare: 60 }
  };

  const config = fareConfig[vehicleType] || fareConfig.auto;
  let fare = config.baseFare;

  if (distance > config.baseKm) {
    fare += (distance - config.baseKm) * config.perKmRate;
  }

  return Math.max(Math.round(fare), config.minFare);
};

const getDriverEarnings = (ride) => {
  // Priority 1: Use driverFare field if available
  if (ride.driverFare && ride.driverFare > 0) {
    return ride.driverFare;
  }

  // Priority 2: Calculate pure base fare from distance and vehicle type
  if (ride.distance && ride.vehicleType) {
    return calculatePureBaseFare(ride.distance, ride.vehicleType);
  }

  // Priority 3: For legacy data, check if fare field contains driver earnings
  if (ride.fare && ride.fare > 0) {
    if (ride.fare >= 25 && ride.fare <= 500) {
      return ride.fare;
    } else {
      return getMinimumFareForVehicle(ride.vehicleType || 'auto');
    }
  }

  // Priority 4: Conservative calculation from customer total
  if (ride.estimatedFare && ride.estimatedFare > 0) {
    const driverEarnings = Math.round(ride.estimatedFare * 0.6);
    return Math.max(driverEarnings, getMinimumFareForVehicle(ride.vehicleType || 'auto'));
  }

  return getMinimumFareForVehicle(ride.vehicleType || 'auto');
};

const getMinimumFareForVehicle = (vehicleType) => {
  const minFares = { auto: 40, bike: 30, car: 60 };
  return minFares[vehicleType] || 40;
};

console.log('🧪 TESTING DRIVER FARE CALCULATIONS');
console.log('===================================');

// Test cases
const testRides = [
  // Test with driverFare field (highest priority)
  { userName: 'Test 1', driverFare: 55, distance: 5, vehicleType: 'auto' },

  // Test calculation from distance/vehicle
  { userName: 'Test 2', distance: 1, vehicleType: 'auto' }, // Should be minimum 40
  { userName: 'Test 3', distance: 3, vehicleType: 'auto' }, // 40 + (1 * 17) = 57
  { userName: 'Test 4', distance: 5, vehicleType: 'bike' }, // 30 + (3 * 12) = 66
  { userName: 'Test 5', distance: 4, vehicleType: 'car' }, // 60 + (2 * 25) = 110

  // Test legacy fare field
  { userName: 'Test 6', fare: 45, vehicleType: 'auto' }, // Should use 45
  { userName: 'Test 7', fare: 1500, vehicleType: 'auto' }, // Too high, use minimum

  // Test customer fare conversion
  { userName: 'Test 8', estimatedFare: 100, vehicleType: 'auto' }, // 60% = 60

  // Test minimum fare fallback
  { userName: 'Test 9', vehicleType: 'bike' }, // Should be 30
];

console.log('📋 Test Results:');
testRides.forEach((ride, index) => {
  const earnings = getDriverEarnings(ride);
  console.log(`${index + 1}. ${ride.userName}: ₹${earnings}`);
  console.log(`   Input: driverFare=${ride.driverFare || 'N/A'}, distance=${ride.distance || 'N/A'}km, vehicleType=${ride.vehicleType || 'N/A'}, fare=${ride.fare || 'N/A'}, estimatedFare=${ride.estimatedFare || 'N/A'}`);
  console.log('');
});

console.log('✅ All tests completed');