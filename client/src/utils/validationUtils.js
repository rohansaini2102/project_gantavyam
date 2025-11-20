/**
 * Validation utilities for driver registration
 * Provides consistent normalization and validation across the application
 */

// Normalize Aadhaar to digits only (for database storage and duplicate checks)
export const normalizeAadhaar = (aadhaar) => {
  if (!aadhaar) return '';
  return aadhaar.replace(/[^0-9]/g, '');
};

// Format Aadhaar for display (XXXX-XXXX-XXXX)
export const formatAadhaarDisplay = (aadhaar) => {
  const digits = normalizeAadhaar(aadhaar).slice(0, 12);
  if (digits.length > 8) return `${digits.slice(0,4)}-${digits.slice(4,8)}-${digits.slice(8)}`;
  if (digits.length > 4) return `${digits.slice(0,4)}-${digits.slice(4)}`;
  return digits;
};

// Validate Aadhaar format (must be exactly 12 digits)
export const validateAadhaar = (aadhaar) => {
  const normalized = normalizeAadhaar(aadhaar);
  return normalized.length === 12;
};

// Normalize mobile number (digits only)
export const normalizeMobile = (mobile) => {
  if (!mobile) return '';
  return mobile.replace(/[^0-9]/g, '').slice(0, 10);
};

// Validate mobile number (must be exactly 10 digits)
export const validateMobile = (mobile) => {
  const normalized = normalizeMobile(mobile);
  return normalized.length === 10;
};

// Normalize vehicle number (uppercase alphanumeric)
export const normalizeVehicleNo = (vehicleNo) => {
  if (!vehicleNo) return '';
  return vehicleNo.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
};

// Validate vehicle number format (Indian format)
export const validateVehicleNo = (vehicleNo) => {
  const normalized = normalizeVehicleNo(vehicleNo);
  // Indian vehicle number format: 2-3 letters, 2 digits, 1-2 letters, 1-4 digits
  // Examples: DL01AB1234, MH12DE3456, KA05MH1234
  // Pattern: State code (2 letters) + District code (1-2 digits) + Series (1-2 letters) + Number (1-4 digits)
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{1,4}$/.test(normalized);
};

// Format vehicle number for display (add spaces for readability)
export const formatVehicleDisplay = (vehicleNo) => {
  const normalized = normalizeVehicleNo(vehicleNo);
  // Common Indian vehicle number format: KA01AB1234
  if (normalized.length >= 4) {
    const state = normalized.slice(0, 2);
    const district = normalized.slice(2, 4);
    const series = normalized.slice(4, 6);
    const number = normalized.slice(6);
    return `${state} ${district} ${series} ${number}`.trim();
  }
  return normalized;
};

// Normalize IFSC code (uppercase alphanumeric)
export const normalizeIfscCode = (ifscCode) => {
  if (!ifscCode) return '';
  return ifscCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
};

// Validate IFSC code (must be exactly 11 characters)
export const validateIfscCode = (ifscCode) => {
  const normalized = normalizeIfscCode(ifscCode);
  // IFSC format: First 4 chars are alphabets, 5th is 0, last 6 are alphanumeric
  if (normalized.length !== 11) return false;
  const pattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return pattern.test(normalized);
};

// Normalize account number (digits only)
export const normalizeAccountNumber = (accountNo) => {
  if (!accountNo) return '';
  return accountNo.replace(/[^0-9]/g, '');
};

// Validate account number (between 9 and 18 digits)
export const validateAccountNumber = (accountNo) => {
  const normalized = normalizeAccountNumber(accountNo);
  return normalized.length >= 9 && normalized.length <= 18;
};

// Normalize driving license number (uppercase alphanumeric)
export const normalizeDrivingLicense = (dlNo) => {
  if (!dlNo) return '';
  return dlNo.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

// Validate driving license number format (Indian format)
export const validateDrivingLicense = (dlNo) => {
  const normalized = normalizeDrivingLicense(dlNo);
  // Indian DL format: State code (2 letters) + 13 digits
  // Examples: DL0120230012345, MH1220230067890
  // Total length: 15 characters (2 letters + 13 digits)
  return /^[A-Z]{2}[0-9]{13}$/.test(normalized);
};

// Validate name format (letters and spaces only, minimum 2 characters)
export const validateName = (name) => {
  if (!name) return false;
  const trimmed = name.trim();
  // Must be at least 2 characters, only letters and spaces, not all spaces
  return trimmed.length >= 2 && /^[a-zA-Z\s]+$/.test(trimmed) && /[a-zA-Z]/.test(trimmed);
};

// Generic field formatter for use in input handlers
export const formatField = (fieldName, value) => {
  switch(fieldName) {
    case 'aadhaarNo':
      return formatAadhaarDisplay(value);
    case 'mobileNo':
      return normalizeMobile(value);
    case 'vehicleNo':
      return normalizeVehicleNo(value);
    case 'ifscCode':
      return normalizeIfscCode(value);
    case 'accountNumber':
      return normalizeAccountNumber(value);
    default:
      return value;
  }
};

// Get normalized value for API calls and database operations
export const getNormalizedValue = (fieldName, value) => {
  switch(fieldName) {
    case 'aadhaarNo':
      return normalizeAadhaar(value);
    case 'mobileNo':
      return normalizeMobile(value);
    case 'vehicleNo':
      return normalizeVehicleNo(value);
    case 'ifscCode':
      return normalizeIfscCode(value);
    case 'accountNumber':
      return normalizeAccountNumber(value);
    default:
      return value;
  }
};

// Validate field value
export const validateField = (fieldName, value) => {
  switch(fieldName) {
    case 'aadhaarNo':
      return validateAadhaar(value);
    case 'mobileNo':
      return validateMobile(value);
    case 'vehicleNo':
      return validateVehicleNo(value);
    case 'ifscCode':
      return validateIfscCode(value);
    case 'accountNumber':
      return validateAccountNumber(value);
    case 'drivingLicenseNo':
      return validateDrivingLicense(value);
    case 'fullName':
    case 'accountHolderName':
    case 'bankName':
      return validateName(value);
    default:
      return true;
  }
};

// Get field-specific error message
export const getFieldErrorMessage = (fieldName) => {
  switch(fieldName) {
    case 'aadhaarNo':
      return 'Aadhaar number must be exactly 12 digits';
    case 'mobileNo':
      return 'Mobile number must be exactly 10 digits';
    case 'vehicleNo':
      return 'Vehicle number must be in valid Indian format (e.g., DL01AB1234)';
    case 'ifscCode':
      return 'Invalid IFSC code. Format: 4 letters + 0 + 6 alphanumeric (e.g., SBIN0001234)';
    case 'accountNumber':
      return 'Account number must be between 9 and 18 digits';
    case 'drivingLicenseNo':
      return 'Driving license must be in valid Indian format (e.g., DL0120230012345)';
    case 'fullName':
      return 'Full name must be at least 2 characters (letters only)';
    case 'bankName':
      return 'Bank name must be at least 2 characters (letters only)';
    case 'accountHolderName':
      return 'Account holder name must be at least 2 characters (letters only)';
    case 'password':
      return 'Password must be at least 6 characters';
    case 'confirmPassword':
      return 'Passwords do not match';
    default:
      return `${fieldName.replace(/([A-Z])/g, ' $1').trim()} is required`;
  }
};