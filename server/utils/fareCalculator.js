// utils/fareCalculator.js

const FareConfig = require('../models/FareConfig');

// Cache for config to avoid frequent DB calls
let cachedConfig = null;
let cacheExpiry = null;

const getConfig = async () => {
  if (cachedConfig && cacheExpiry && cacheExpiry > Date.now()) {
    return cachedConfig;
  }
  
  cachedConfig = await FareConfig.getActiveConfig();
  cacheExpiry = Date.now() + (5 * 60 * 1000); // Cache for 5 minutes
  return cachedConfig;
};

// Clear cache when needed
const clearConfigCache = () => {
  cachedConfig = null;
  cacheExpiry = null;
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
const getCurrentSurgeFactor = async () => {
  const config = await getConfig();
  const now = new Date();
  const currentHour = now.getHours();
  
  // Check if current time falls in surge periods
  for (const surge of config.surgeTimes) {
    if (!surge.isActive) continue;
    
    if (surge.startHour <= surge.endHour) {
      // Normal time period
      if (currentHour >= surge.startHour && currentHour <= surge.endHour) {
        return surge.factor;
      }
    } else {
      // Overnight period (e.g., 22 to 5)
      if (currentHour >= surge.startHour || currentHour <= surge.endHour) {
        return surge.factor;
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
const calculateFare = async (vehicleType, distance, applySurge = true, waitingTime = 0) => {
  const dbConfig = await getConfig();
  const config = dbConfig.vehicleConfigs[vehicleType];
  
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
    surgeFactor = await getCurrentSurgeFactor();
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
const calculateFareEstimates = async (pickupLat, pickupLng, dropLat, dropLng) => {
  const distance = calculateDistance(pickupLat, pickupLng, dropLat, dropLng);
  const config = await getConfig();
  
  const estimates = {};
  
  // Calculate for each vehicle type
  for (const vehicleType of Object.keys(config.vehicleConfigs)) {
    estimates[vehicleType] = await calculateFare(vehicleType, distance, true, 0);
  }
  
  return {
    distance: parseFloat(distance.toFixed(2)),
    estimates,
    surgeFactor: await getCurrentSurgeFactor(),
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
const getDynamicPricingFactor = async (metroStation, onlineDrivers, activeRequests) => {
  const config = await getConfig();
  
  // Base factor
  let factor = 1.0;
  
  // Calculate demand/supply ratio
  const ratio = onlineDrivers > 0 ? activeRequests / onlineDrivers : (activeRequests > 0 ? Infinity : 0);
  
  // Find matching dynamic pricing rule
  for (const pricing of config.dynamicPricing) {
    if (pricing.maxRatio === null || pricing.maxRatio === undefined) {
      // This is for rules like "3+" (no upper limit)
      if (ratio >= pricing.minRatio) {
        factor = pricing.factor;
      }
    } else {
      // This is for ranges like "1-2", "2-3"
      if (ratio >= pricing.minRatio && ratio < pricing.maxRatio) {
        factor = pricing.factor;
        break;
      }
    }
  }
  
  // Special case for no drivers
  if (onlineDrivers === 0 && activeRequests > 0) {
    const noPricingRule = config.dynamicPricing.find(p => p.name === 'No Drivers');
    if (noPricingRule) {
      factor = noPricingRule.factor;
    }
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
  clearConfigCache,
  getConfig
};