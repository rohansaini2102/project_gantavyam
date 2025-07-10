// utils/otpUtils.js
const crypto = require('crypto');

/**
 * Generate a random 4-digit OTP
 * @returns {string} 4-digit OTP
 */
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Generate a unique ride ID
 * @returns {string} Unique ride ID with timestamp
 */
const generateRideId = () => {
  const timestamp = Date.now().toString();
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  return `RIDE-${timestamp}-${randomPart}`;
};

/**
 * Generate both start and end OTPs for a ride
 * @returns {Object} Object containing startOTP and endOTP
 */
const generateRideOTPs = () => {
  return {
    startOTP: generateOTP(),
    endOTP: generateOTP()
  };
};

/**
 * Verify OTP (basic validation)
 * @param {string} providedOTP - OTP provided by user
 * @param {string} storedOTP - OTP stored in database
 * @returns {boolean} True if OTP matches
 */
const verifyOTP = (providedOTP, storedOTP) => {
  if (!providedOTP || !storedOTP) {
    return false;
  }
  return providedOTP.toString() === storedOTP.toString();
};

/**
 * Generate a secure random token for additional security
 * @returns {string} Secure random token
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Log ride event with details
 * @param {string} rideId - Unique ride identifier
 * @param {string} event - Event type (e.g., 'ride_started', 'otp_generated')
 * @param {Object} details - Additional event details
 */
const logRideEvent = (rideId, event, details = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] RIDE-EVENT: ${rideId} | ${event} |`, JSON.stringify(details));
};

/**
 * Generate booth-specific ride number
 * @param {string} boothName - Name of the metro booth
 * @returns {string} Booth-specific ride number
 */
const generateBoothRideNumber = async (boothName) => {
  const MetroStation = require('../models/MetroStation');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find the metro station
    const station = await MetroStation.findOne({ name: boothName });
    
    if (!station) {
      throw new Error('Metro station not found: ' + boothName);
    }
    
    // Check if we need to reset the counter for a new day
    if (!station.dailyRideCounter || station.dailyRideCounter.date !== today) {
      station.dailyRideCounter = {
        date: today,
        count: 0
      };
    }
    
    // Increment the counter
    station.dailyRideCounter.count += 1;
    await station.save();
    
    // Generate formatted booth ride number
    // Format: BOOTH-NAME-YYYY-MM-DD-###
    const boothCode = boothName.toUpperCase().replace(/ /g, '-');
    const paddedCount = String(station.dailyRideCounter.count).padStart(3, '0');
    const boothRideNumber = `${boothCode}-${today}-${paddedCount}`;
    
    console.log(`Generated booth ride number: ${boothRideNumber} for ${boothName}`);
    
    // Also increment total rides
    station.totalRides = (station.totalRides || 0) + 1;
    await station.save();
    
    return boothRideNumber;
  } catch (error) {
    console.error('Error generating booth ride number:', error);
    // Fallback to timestamp-based number if error
    const timestamp = Date.now();
    return `${boothName.toUpperCase().replace(/ /g, '-')}-${timestamp}`;
  }
};

module.exports = {
  generateOTP,
  generateRideId,
  generateRideOTPs,
  verifyOTP,
  generateSecureToken,
  logRideEvent,
  generateBoothRideNumber
};