// Enhanced input formatters for real-time field formatting

/**
 * Mobile number formatter - only digits, max 10 characters
 */
export const formatMobileNumber = (value) => {
  if (!value) return '';

  // Remove all non-digits
  const numbers = value.replace(/\D/g, '');

  // Limit to 10 digits
  const limited = numbers.slice(0, 10);

  // Format as XXX-XXX-XXXX for display (optional)
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
};

/**
 * Mobile number formatter (simple) - only digits, no formatting
 */
export const formatMobileSimple = (value) => {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, 10);
};

/**
 * Aadhaar number formatter - only digits, max 12 characters
 */
export const formatAadhaar = (value) => {
  if (!value) return '';

  // Remove all non-digits
  const numbers = value.replace(/\D/g, '');

  // Limit to 12 digits
  const limited = numbers.slice(0, 12);

  // Format as XXXX-XXXX-XXXX for display
  if (limited.length <= 4) return limited;
  if (limited.length <= 8) return `${limited.slice(0, 4)}-${limited.slice(4)}`;
  return `${limited.slice(0, 4)}-${limited.slice(4, 8)}-${limited.slice(8)}`;
};

/**
 * Aadhaar number formatter (simple) - only digits, no formatting
 */
export const formatAadhaarSimple = (value) => {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, 12);
};

/**
 * Vehicle number formatter - uppercase, specific pattern
 */
export const formatVehicleNumber = (value) => {
  if (!value) return '';

  // Remove spaces and hyphens, convert to uppercase
  let cleaned = value.toUpperCase().replace(/[\s-]/g, '');

  // Remove non-alphanumeric characters
  cleaned = cleaned.replace(/[^A-Z0-9]/g, '');

  // Limit to reasonable length
  cleaned = cleaned.slice(0, 10);

  // Apply Indian vehicle number pattern: AA00AA0000
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}${cleaned.slice(2)}`;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}${cleaned.slice(2, 4)}${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 2)}${cleaned.slice(2, 4)}${cleaned.slice(4, 6)}${cleaned.slice(6)}`;
};

/**
 * IFSC code formatter - uppercase, 11 characters
 */
export const formatIFSC = (value) => {
  if (!value) return '';

  // Convert to uppercase, remove spaces
  let cleaned = value.toUpperCase().replace(/\s/g, '');

  // Remove non-alphanumeric characters
  cleaned = cleaned.replace(/[^A-Z0-9]/g, '');

  // Limit to 11 characters
  cleaned = cleaned.slice(0, 11);

  // Format as AAAA0AAAAAA
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 4)}${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)}${cleaned.slice(4, 5)}${cleaned.slice(5)}`;
};

/**
 * Bank account number formatter - only digits
 */
export const formatBankAccount = (value) => {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, 18);
};

/**
 * Name formatter - proper case, single spaces
 */
export const formatName = (value) => {
  if (!value) return '';

  // Remove extra spaces and convert to proper case
  return value
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^a-zA-Z\s.'-]/g, '') // Remove invalid characters
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
};

/**
 * License number formatter - uppercase, remove special chars
 */
export const formatLicenseNumber = (value) => {
  if (!value) return '';

  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '') // Allow only letters, numbers, and hyphens
    .slice(0, 20);
};

/**
 * Permit/Fitness/Insurance number formatter - uppercase
 */
export const formatCertificateNumber = (value) => {
  if (!value) return '';

  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // Allow only letters and numbers
    .slice(0, 30);
};

/**
 * Email formatter - lowercase, trim
 */
export const formatEmail = (value) => {
  if (!value) return '';

  return value
    .toLowerCase()
    .trim()
    .replace(/\s/g, ''); // Remove any spaces
};

/**
 * Year formatter - only 4 digits
 */
export const formatYear = (value) => {
  if (!value) return '';

  const numbers = value.replace(/\D/g, '');
  return numbers.slice(0, 4);
};

/**
 * Alpha-only formatter (for colors, etc.)
 */
export const formatAlphaOnly = (value) => {
  if (!value) return '';

  return value
    .replace(/[^a-zA-Z\s]/g, '') // Only letters and spaces
    .replace(/\s+/g, ' ') // Single spaces
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim()
    .slice(0, 20);
};

/**
 * Vehicle model formatter
 */
export const formatVehicleModel = (value) => {
  if (!value) return '';

  return value
    .replace(/[^a-zA-Z0-9\s\-.]/g, '') // Allow letters, numbers, spaces, hyphens, dots
    .replace(/\s+/g, ' ') // Single spaces
    .trim()
    .slice(0, 50);
};

/**
 * Password formatter - no formatting, just length limit
 */
export const formatPassword = (value) => {
  if (!value) return '';
  return value.slice(0, 128);
};

/**
 * Phone number display formatter (for read-only display)
 */
export const displayMobileNumber = (value) => {
  if (!value || value.length !== 10) return value;
  return `+91 ${value.slice(0, 5)}-${value.slice(5)}`;
};

/**
 * Aadhaar display formatter (masked for security)
 */
export const displayAadhaar = (value, maskMiddle = true) => {
  if (!value || value.length !== 12) return value;

  if (maskMiddle) {
    return `${value.slice(0, 4)}-XXXX-${value.slice(-4)}`;
  }

  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
};

/**
 * Bank account display formatter (masked)
 */
export const displayBankAccount = (value) => {
  if (!value || value.length < 4) return value;

  const masked = 'X'.repeat(value.length - 4);
  return `${masked}${value.slice(-4)}`;
};

/**
 * File size formatter
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Currency formatter (for future use)
 */
export const formatCurrency = (value, currency = 'INR') => {
  if (!value) return '';

  const number = parseFloat(value.replace(/[^0-9.-]/g, ''));

  if (isNaN(number)) return '';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(number);
};

/**
 * Percentage formatter
 */
export const formatPercentage = (value, decimals = 0) => {
  if (!value && value !== 0) return '';

  const number = parseFloat(value);
  if (isNaN(number)) return '';

  return `${number.toFixed(decimals)}%`;
};

/**
 * Time formatter (HH:MM)
 */
export const formatTime = (value) => {
  if (!value) return '';

  // Remove non-digits
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) {
    const hours = numbers.slice(0, 2);
    const minutes = numbers.slice(2, 4);

    // Validate hours (00-23) and minutes (00-59)
    const h = Math.min(parseInt(hours) || 0, 23);
    const m = Math.min(parseInt(minutes) || 0, 59);

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  return numbers.slice(0, 4);
};

/**
 * Date formatter (DD/MM/YYYY)
 */
export const formatDate = (value) => {
  if (!value) return '';

  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  if (numbers.length <= 8) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }

  return numbers.slice(0, 8);
};

// Export all formatters as an object for easy importing
export const formatters = {
  mobileNo: formatMobileSimple,
  aadhaarNo: formatAadhaarSimple,
  vehicleNo: formatVehicleNumber,
  ifscCode: formatIFSC,
  accountNumber: formatBankAccount,
  fullName: formatName,
  accountHolderName: formatName,
  email: formatEmail,
  manufacturingYear: formatYear,
  color: formatAlphaOnly,
  vehicleModel: formatVehicleModel,
  drivingLicenseNo: formatLicenseNumber,
  permitNo: formatCertificateNumber,
  fitnessNo: formatCertificateNumber,
  insurancePolicyNo: formatCertificateNumber,
  password: formatPassword,
  confirmPassword: formatPassword,
  bankName: formatName
};

// Export display formatters
export const displayFormatters = {
  mobileNo: displayMobileNumber,
  aadhaarNo: displayAadhaar,
  accountNumber: displayBankAccount,
  fileSize: formatFileSize,
  currency: formatCurrency,
  percentage: formatPercentage,
  time: formatTime,
  date: formatDate
};

// Validation helpers
export const inputMasks = {
  mobileNo: '999-999-9999',
  aadhaarNo: '9999-9999-9999',
  ifscCode: 'AAAA0AAAAAA',
  vehicleNo: 'AA00AA0000',
  manufacturingYear: '9999',
  time: '99:99',
  date: '99/99/9999'
};

// Field-specific input restrictions
export const inputRestrictions = {
  mobileNo: { type: 'tel', maxLength: 10, pattern: '[0-9]*' },
  aadhaarNo: { type: 'text', maxLength: 12, pattern: '[0-9]*' },
  vehicleNo: { type: 'text', maxLength: 10, style: { textTransform: 'uppercase' } },
  ifscCode: { type: 'text', maxLength: 11, style: { textTransform: 'uppercase' } },
  accountNumber: { type: 'text', maxLength: 18, pattern: '[0-9]*' },
  email: { type: 'email', maxLength: 100, style: { textTransform: 'lowercase' } },
  manufacturingYear: { type: 'number', min: 1990, max: new Date().getFullYear() },
  password: { type: 'password', maxLength: 128 },
  confirmPassword: { type: 'password', maxLength: 128 }
};

export default {
  formatters,
  displayFormatters,
  inputMasks,
  inputRestrictions,
  // Individual formatters
  formatMobileNumber,
  formatMobileSimple,
  formatAadhaar,
  formatAadhaarSimple,
  formatVehicleNumber,
  formatIFSC,
  formatBankAccount,
  formatName,
  formatLicenseNumber,
  formatCertificateNumber,
  formatEmail,
  formatYear,
  formatAlphaOnly,
  formatVehicleModel,
  formatPassword,
  // Display formatters
  displayMobileNumber,
  displayAadhaar,
  displayBankAccount,
  formatFileSize,
  formatCurrency,
  formatPercentage,
  formatTime,
  formatDate
};