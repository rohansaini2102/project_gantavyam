// services/twilioSmsService.js
const axios = require('axios');
const SmsLog = require('../models/SmsLog');

/**
 * Twilio SMS Service for sending OTP messages
 */
class TwilioSmsService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
  }

  /**
   * Validate phone number format (Indian mobile)
   * @param {string} phoneNumber - Phone number to validate
   * @returns {Object} Validation result
   */
  validatePhoneNumber(phoneNumber) {
    // Remove any spaces or special characters
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Check for Indian mobile number patterns
    const indianMobileRegex = /^(\+91|91|0)?[6-9]\d{9}$/;

    if (!indianMobileRegex.test(cleaned)) {
      return {
        isValid: false,
        error: 'Invalid Indian mobile number format. Must be 10 digits starting with 6-9.'
      };
    }

    // Format to international format
    let formatted = cleaned;
    if (formatted.startsWith('0')) {
      formatted = formatted.substring(1);
    }
    if (formatted.startsWith('91')) {
      formatted = '+' + formatted;
    } else if (!formatted.startsWith('+91')) {
      formatted = '+91' + formatted;
    }

    return {
      isValid: true,
      formatted: formatted
    };
  }

  /**
   * Send SMS via Twilio API
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - SMS message content
   * @param {Object} logData - Additional data for SMS logging
   * @returns {Promise<Object>} SMS sending result
   */
  async sendSMS(phoneNumber, message, logData = {}) {
    try {
      // Validate configuration
      if (!this.accountSid || !this.authToken || !this.fromNumber) {
        return {
          success: false,
          error: 'Twilio configuration missing. Check environment variables.',
          errorCode: 'CONFIG_MISSING'
        };
      }

      // Validate phone number
      const phoneValidation = this.validatePhoneNumber(phoneNumber);
      if (!phoneValidation.isValid) {
        return {
          success: false,
          error: phoneValidation.error,
          errorCode: 'INVALID_PHONE'
        };
      }

      console.log(`📱 Sending SMS to ${phoneValidation.formatted}`);

      // Prepare form data
      const formData = new URLSearchParams();
      formData.append('To', phoneValidation.formatted);
      formData.append('From', this.fromNumber);
      formData.append('Body', message);

      // Send request to Twilio
      const response = await axios.post(this.baseUrl, formData, {
        auth: {
          username: this.accountSid,
          password: this.authToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.status === 201) {
        console.log(`✅ SMS sent successfully. Message ID: ${response.data.sid}`);

        // Log successful SMS
        if (logData.rideId) {
          await SmsLog.logSMS({
            rideId: logData.rideId,
            phoneNumber: phoneValidation.formatted,
            messageType: logData.messageType || 'custom',
            message: message,
            startOTP: logData.startOTP,
            endOTP: logData.endOTP,
            status: 'success',
            twilioMessageId: response.data.sid,
            adminId: logData.adminId,
            adminName: logData.adminName,
            cost: 0.75, // Approximate cost in USD cents
            deliveryStatus: response.data.status || 'queued'
          });
        }

        return {
          success: true,
          messageId: response.data.sid,
          status: response.data.status,
          to: response.data.to,
          message: 'SMS sent successfully'
        };
      } else {
        console.error('❌ Unexpected Twilio response status:', response.status);

        // Log failed SMS
        if (logData.rideId) {
          await SmsLog.logSMS({
            rideId: logData.rideId,
            phoneNumber: phoneValidation.formatted,
            messageType: logData.messageType || 'custom',
            message: message,
            startOTP: logData.startOTP,
            endOTP: logData.endOTP,
            status: 'failed',
            errorReason: 'Unexpected response from SMS service',
            errorCode: 'UNEXPECTED_RESPONSE',
            adminId: logData.adminId,
            adminName: logData.adminName
          });
        }

        return {
          success: false,
          error: 'Unexpected response from SMS service',
          errorCode: 'UNEXPECTED_RESPONSE'
        };
      }

    } catch (error) {
      console.error('❌ SMS Service Error:', error.message);

      let errorMessage, errorCode;

      // Parse Twilio error responses
      if (error.response && error.response.data) {
        const twilioError = error.response.data;
        errorMessage = this.parseErrorMessage(twilioError);
        errorCode = twilioError.code || 'TWILIO_ERROR';

        // Log failed SMS with Twilio error
        if (logData.rideId) {
          await SmsLog.logSMS({
            rideId: logData.rideId,
            phoneNumber: phoneValidation?.formatted || phoneNumber,
            messageType: logData.messageType || 'custom',
            message: message,
            startOTP: logData.startOTP,
            endOTP: logData.endOTP,
            status: 'failed',
            errorReason: errorMessage,
            errorCode: errorCode,
            adminId: logData.adminId,
            adminName: logData.adminName
          });
        }

        return {
          success: false,
          error: errorMessage,
          errorCode: errorCode,
          twilioError: twilioError
        };
      }

      // Network or other errors
      errorMessage = this.parseGenericError(error);
      errorCode = 'NETWORK_ERROR';

      // Log failed SMS with generic error
      if (logData.rideId) {
        await SmsLog.logSMS({
          rideId: logData.rideId,
          phoneNumber: phoneValidation?.formatted || phoneNumber,
          messageType: logData.messageType || 'custom',
          message: message,
          startOTP: logData.startOTP,
          endOTP: logData.endOTP,
          status: 'failed',
          errorReason: errorMessage,
          errorCode: errorCode,
          adminId: logData.adminId,
          adminName: logData.adminName
        });
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: errorCode
      };
    }
  }

  /**
   * Parse Twilio error messages into user-friendly format
   * @param {Object} twilioError - Twilio error response
   * @returns {string} User-friendly error message
   */
  parseErrorMessage(twilioError) {
    switch (twilioError.code) {
      case 21211:
        return 'Invalid phone number format';
      case 21608:
        return 'Phone number is not reachable or invalid';
      case 21610:
        return 'Message cannot be sent to this number (blocked or invalid)';
      case 20003:
        return 'Authentication failed - check Twilio credentials';
      case 20005:
        return 'Account not found or suspended';
      case 20429:
        return 'Too many requests - please wait before retrying';
      case 30001:
        return 'Message queue is full - try again later';
      case 30002:
        return 'Account suspended - contact support';
      case 30003:
        return 'Unreachable destination phone number';
      case 30004:
        return 'Message blocked by carrier';
      case 30005:
        return 'Unknown destination phone number';
      case 30006:
        return 'Landline or unreachable carrier';
      case 30007:
        return 'Carrier violation or spam detected';
      case 30008:
        return 'Unknown error from carrier';
      default:
        return twilioError.message || 'SMS service error occurred';
    }
  }

  /**
   * Parse generic errors into user-friendly format
   * @param {Error} error - Generic error object
   * @returns {string} User-friendly error message
   */
  parseGenericError(error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return 'Network connectivity issue - check internet connection';
    }
    if (error.code === 'ETIMEDOUT') {
      return 'Request timeout - SMS service is slow, try again';
    }
    if (error.message.includes('timeout')) {
      return 'Request timeout - please try again';
    }
    return 'SMS service temporarily unavailable';
  }

  /**
   * Send ride booking OTP SMS
   * @param {string} phoneNumber - Customer phone number
   * @param {string} startOTP - Start OTP
   * @param {string} endOTP - End OTP
   * @param {string} driverName - Driver name (optional)
   * @param {Object} logData - Additional logging data
   * @returns {Promise<Object>} SMS sending result
   */
  async sendBookingOTP(phoneNumber, startOTP, endOTP, driverName = null, logData = {}) {
    const driverInfo = driverName ? ` Driver: ${driverName}.` : '';
    const message = `Your ride booking confirmed! Start OTP: ${startOTP}, End OTP: ${endOTP}. Share with driver when requested.${driverInfo}`;

    return this.sendSMS(phoneNumber, message, {
      ...logData,
      messageType: 'booking_confirmation',
      startOTP,
      endOTP
    });
  }

  /**
   * Send driver assignment confirmation SMS
   * @param {string} phoneNumber - Customer phone number
   * @param {string} startOTP - Start OTP
   * @param {string} driverName - Driver name
   * @param {string} vehicleNo - Vehicle number (optional)
   * @param {Object} logData - Additional logging data
   * @returns {Promise<Object>} SMS sending result
   */
  async sendDriverAssignedOTP(phoneNumber, startOTP, driverName, vehicleNo = null, logData = {}) {
    const vehicleInfo = vehicleNo ? ` Vehicle: ${vehicleNo}.` : '';
    const message = `Driver ${driverName} assigned!${vehicleInfo} Use Start OTP: ${startOTP} to begin ride.`;

    return this.sendSMS(phoneNumber, message, {
      ...logData,
      messageType: 'driver_assigned',
      startOTP
    });
  }

  /**
   * Send resend OTP SMS (both start and end)
   * @param {string} phoneNumber - Customer phone number
   * @param {string} startOTP - Start OTP
   * @param {string} endOTP - End OTP
   * @param {Object} logData - Additional logging data
   * @returns {Promise<Object>} SMS sending result
   */
  async sendResendOTP(phoneNumber, startOTP, endOTP, logData = {}) {
    const message = `OTP Reminder - Start: ${startOTP}, End: ${endOTP}. Share with driver as needed for your ride.`;

    return this.sendSMS(phoneNumber, message, {
      ...logData,
      messageType: 'otp_resend',
      startOTP,
      endOTP
    });
  }

  /**
   * Check if SMS service is configured
   * @returns {boolean} True if properly configured
   */
  isConfigured() {
    return !!(this.accountSid && this.authToken && this.fromNumber);
  }

  /**
   * Get configuration status for debugging
   * @returns {Object} Configuration status
   */
  getConfigStatus() {
    return {
      hasAccountSid: !!this.accountSid,
      hasAuthToken: !!this.authToken,
      hasFromNumber: !!this.fromNumber,
      isConfigured: this.isConfigured()
    };
  }
}

module.exports = new TwilioSmsService();