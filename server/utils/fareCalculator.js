// utils/fareCalculator.js

/**
 * Vehicle type configurations with pricing
 */
const VEHICLE_CONFIGS = {
  bike: {
    baseFare: 15,
    perKmRate: 8,
    minimumFare: 25,
    surgeFactor: 1.2,
    waitingChargePerMin: 1
  },
  auto: {
    baseFare: 25,
    perKmRate: 12,
    minimumFare: 40,
    surgeFactor: 1.3,
    waitingChargePerMin: 2
  },
  car: {
    baseFare: 50,
    perKmRate: 18,
    minimumFare: 80,
    surgeFactor: 1.5,
    waitingChargePerMin: 3
  }
};

/**
 * Time-based surge pricing configuration
 */
const SURGE_TIMES = {
  morning: { start: 7, end: 10, factor: 1.3 },
  evening: { start: 17, end: 20, factor: 1.4 },
  night: { start: 22, end: 5, factor: 1.2 }
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const toRad = (deg) => deg * (Math.PI/180);

/**
 * Get current surge factor based on time
 * @returns {number} Current surge factor
 */
const getCurrentSurgeFactor = () => {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Check if current time falls in surge periods
  for (const [period, config] of Object.entries(SURGE_TIMES)) {
    if (period === 'night') {
      // Night time spans across midnight
      if (currentHour >= config.start || currentHour <= config.end) {
        return config.factor;
      }
    } else {
      if (currentHour >= config.start && currentHour <= config.end) {
        return config.factor;
      }
    }
  }
  
  return 1.0; // No surge
};

/**
 * Calculate fare for a specific vehicle type
 * @param {string} vehicleType - Type of vehicle (bike, auto, car)
 * @param {number} distance - Distance in kilometers
 * @param {boolean} applySurge - Whether to apply surge pricing
 * @param {number} waitingTime - Waiting time in minutes
 * @returns {Object} Fare calculation details
 */
const calculateFare = (vehicleType, distance, applySurge = true, waitingTime = 0) => {
  const config = VEHICLE_CONFIGS[vehicleType];
  
  if (!config) {
    throw new Error(`Invalid vehicle type: ${vehicleType}`);
  }
  
  // Base calculation
  const baseFare = config.baseFare;
  const distanceFare = distance * config.perKmRate;
  const waitingCharges = waitingTime * config.waitingChargePerMin;
  
  let totalFare = baseFare + distanceFare + waitingCharges;
  
  // Apply minimum fare
  totalFare = Math.max(totalFare, config.minimumFare);
  
  // Apply surge pricing if enabled
  let surgeFactor = 1.0;
  if (applySurge) {
    surgeFactor = getCurrentSurgeFactor();
    totalFare = totalFare * surgeFactor;
  }
  
  // Round to nearest rupee
  totalFare = Math.round(totalFare);
  
  return {
    vehicleType,
    distance: parseFloat(distance.toFixed(2)),
    baseFare,
    distanceFare: parseFloat(distanceFare.toFixed(2)),
    waitingCharges: parseFloat(waitingCharges.toFixed(2)),
    surgeFactor: parseFloat(surgeFactor.toFixed(2)),
    totalFare,
    minimumFare: config.minimumFare,
    breakdown: {
      baseFare,
      distanceFare: parseFloat(distanceFare.toFixed(2)),
      waitingCharges: parseFloat(waitingCharges.toFixed(2)),
      surgeAmount: parseFloat(((totalFare / surgeFactor) * (surgeFactor - 1)).toFixed(2))
    }
  };
};

/**
 * Calculate fare estimates for all vehicle types
 * @param {number} pickupLat - Pickup latitude
 * @param {number} pickupLng - Pickup longitude
 * @param {number} dropLat - Drop latitude
 * @param {number} dropLng - Drop longitude
 * @returns {Object} Fare estimates for all vehicle types
 */
const calculateFareEstimates = (pickupLat, pickupLng, dropLat, dropLng) => {
  const distance = calculateDistance(pickupLat, pickupLng, dropLat, dropLng);
  
  const estimates = {};
  
  // Calculate for each vehicle type
  Object.keys(VEHICLE_CONFIGS).forEach(vehicleType => {
    estimates[vehicleType] = calculateFare(vehicleType, distance, true, 0);
  });
  
  return {
    distance: parseFloat(distance.toFixed(2)),
    estimates,
    surgeFactor: getCurrentSurgeFactor(),
    timestamp: new Date().toISOString()
  };
};

/**
 * Get dynamic pricing based on demand
 * @param {string} metroStation - Metro station name
 * @param {number} onlineDrivers - Number of online drivers
 * @param {number} activeRequests - Number of active ride requests
 * @returns {number} Dynamic pricing factor
 */
const getDynamicPricingFactor = (metroStation, onlineDrivers, activeRequests) => {
  // Base factor
  let factor = 1.0;
  
  // Demand vs supply ratio
  if (onlineDrivers > 0) {
    const demandSupplyRatio = activeRequests / onlineDrivers;
    
    if (demandSupplyRatio > 3) {
      factor = 1.5; // High demand
    } else if (demandSupplyRatio > 2) {
      factor = 1.3; // Medium demand
    } else if (demandSupplyRatio > 1) {
      factor = 1.2; // Low demand
    }
  } else if (activeRequests > 0) {
    factor = 1.8; // No drivers available
  }
  
  return parseFloat(factor.toFixed(2));
};

/**
 * Log fare calculation details
 * @param {string} rideId - Unique ride identifier
 * @param {Object} fareDetails - Fare calculation details
 */
const logFareCalculation = (rideId, fareDetails) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] FARE-CALC: ${rideId} |`, JSON.stringify(fareDetails));
};

module.exports = {
  calculateDistance,
  calculateFare,
  calculateFareEstimates,
  getCurrentSurgeFactor,
  getDynamicPricingFactor,
  logFareCalculation,
  VEHICLE_CONFIGS
};