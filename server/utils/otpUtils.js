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

module.exports = {
  generateOTP,
  generateRideId,
  generateRideOTPs,
  verifyOTP,
  generateSecureToken,
  logRideEvent
};