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
 * Check if current time is in night charge period
 * @returns {boolean} Whether night charge applies
 */
const isNightTime = async () => {
  const config = await getConfig();
  const nightCharge = config.nightCharge;

  if (!nightCharge || !nightCharge.isActive) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();

  if (nightCharge.startHour <= nightCharge.endHour) {
    // Normal period (shouldn't happen for night, but handle it)
    return currentHour >= nightCharge.startHour && currentHour <= nightCharge.endHour;
  } else {
    // Overnight period (e.g., 23 to 5)
    return currentHour >= nightCharge.startHour || currentHour <= nightCharge.endHour;
  }
};

/**
 * Calculate fare for a specific vehicle type with new commission structure
 * @param {string} vehicleType - Type of vehicle (bike, auto, car)
 * @param {number} distance - Distance in kilometers
 * @param {boolean} applySurge - Whether to apply surge pricing
 * @param {number} waitingTime - Waiting time in minutes
 * @returns {Object} Fare calculation details with customer and driver amounts
 */
const calculateFare = async (vehicleType, distance, applySurge = true, waitingTime = 0) => {
  const dbConfig = await getConfig();
  const config = dbConfig.vehicleConfigs[vehicleType];

  if (!config) {
    throw new Error(`Invalid vehicle type: ${vehicleType}`);
  }

  // Calculate base fare according to requirements
  // For auto: ₹40 for up to 2km, then ₹17 per km after that
  let baseFareAmount = config.baseFare; // ₹40 for auto
  let distanceFare = 0;

  if (distance > config.baseKilometers) {
    // Add per km rate only for distance beyond base kilometers
    distanceFare = (distance - config.baseKilometers) * config.perKmRate; // ₹17 per km for auto
  }

  const waitingCharges = waitingTime * config.waitingChargePerMin;

  // Driver's base fare (what driver earns - no GST, no commission)
  let driverBaseFare = baseFareAmount + distanceFare + waitingCharges;

  // Apply minimum fare
  driverBaseFare = Math.max(driverBaseFare, config.minimumFare);

  // Round driver base fare before applying surge
  driverBaseFare = Math.round(driverBaseFare);

  // CRITICAL: Save pure driver base fare BEFORE any surge calculations
  // Driver should see ONLY base fare (₹40 + ₹17/km) - no surge, no GST, no commission
  const pureDriverFare = driverBaseFare;

  // Calculate commission (10%) on BASE fare only (not surged)
  const commissionAmount = Math.round(driverBaseFare * (config.commissionPercentage || 10) / 100);

  // Apply surge pricing if enabled (surge applies to customer pricing, not driver earnings)
  let surgeFactor = 1.0;
  let surgedFare = driverBaseFare;
  if (applySurge) {
    surgeFactor = await getCurrentSurgeFactor();
    surgedFare = Math.round(driverBaseFare * surgeFactor);
  }

  // Calculate GST (5%) on (base fare + commission + surge if any)
  const totalBeforeGST = surgedFare + commissionAmount;
  const gstAmount = Math.round(totalBeforeGST * (config.gstPercentage || 5) / 100);

  // Calculate night charge if applicable (on total before night charge)
  let nightChargeAmount = 0;
  const isNight = await isNightTime();
  if (isNight && dbConfig.nightCharge && dbConfig.nightCharge.isActive) {
    const subtotal = surgedFare + commissionAmount + gstAmount;
    nightChargeAmount = Math.round(subtotal * (dbConfig.nightCharge.percentage || 20) / 100);
  }

  // Calculate customer total (what customer pays)
  // Customer pays: base fare (with surge if any) + commission + GST + night charge
  const customerTotalFare = surgedFare + commissionAmount + gstAmount + nightChargeAmount;

  // Driver earns ONLY the pure base fare (no surge, no GST, no commission, no night charge)
  // This ensures drivers always see consistent base earnings regardless of surge/demand
  const driverFare = pureDriverFare;

  // Backward compatibility: totalFare is driver's earning (pure base fare)
  const totalFare = pureDriverFare;

  return {
    vehicleType,
    distance: parseFloat(distance.toFixed(2)),
    baseFare: baseFareAmount,
    distanceFare: parseFloat(distanceFare.toFixed(2)),
    waitingCharges: parseFloat(waitingCharges.toFixed(2)),
    surgeFactor: parseFloat(surgeFactor.toFixed(2)),
    totalFare, // Driver fare for backward compatibility
    customerTotalFare, // What customer pays (includes all charges)
    driverFare: pureDriverFare, // What driver earns (pure base fare, no surge/GST/commission)
    minimumFare: config.minimumFare,
    // New breakdown for admin/records
    breakdown: {
      baseFare: baseFareAmount,
      distanceFare: parseFloat(distanceFare.toFixed(2)),
      waitingCharges: parseFloat(waitingCharges.toFixed(2)),
      surgeAmount: parseFloat((surgedFare - driverBaseFare).toFixed(2)),
      driverTotal: pureDriverFare,
      surgedFare: surgedFare,
      gstAmount,
      commissionAmount,
      nightChargeAmount,
      customerTotal: customerTotalFare,
      platformEarnings: commissionAmount + gstAmount + nightChargeAmount,
      isNightCharge: isNight
    },
    // Additional fields for clarity
    gstAmount,
    commissionAmount,
    nightChargeAmount,
    isNightCharge: isNight
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