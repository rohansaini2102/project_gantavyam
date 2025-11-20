/**
 * Middleware to normalize driver data before database operations
 * Ensures consistent data format across all registration methods
 */

const normalizeDriverData = (req, res, next) => {
  console.log('[Normalize Middleware] Processing driver data...');

  // Normalize Aadhaar number - remove all non-digits
  if (req.body.aadhaarNo) {
    const original = req.body.aadhaarNo;
    req.body.aadhaarNo = req.body.aadhaarNo.replace(/[^0-9]/g, '');
    if (original !== req.body.aadhaarNo) {
      console.log(`[Normalize] Aadhaar: ${original} -> ${req.body.aadhaarNo}`);
    }
  }

  // Normalize mobile number - remove all non-digits
  if (req.body.mobileNo) {
    const original = req.body.mobileNo;
    req.body.mobileNo = req.body.mobileNo.replace(/[^0-9]/g, '');
    if (original !== req.body.mobileNo) {
      console.log(`[Normalize] Mobile: ${original} -> ${req.body.mobileNo}`);
    }
  }

  // Normalize vehicle number - uppercase and remove special characters
  if (req.body.vehicleNo) {
    const original = req.body.vehicleNo;
    req.body.vehicleNo = req.body.vehicleNo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (original !== req.body.vehicleNo) {
      console.log(`[Normalize] Vehicle No: ${original} -> ${req.body.vehicleNo}`);
    }
  }

  // Normalize IFSC code - uppercase
  if (req.body.ifscCode) {
    const original = req.body.ifscCode;
    req.body.ifscCode = req.body.ifscCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (original !== req.body.ifscCode) {
      console.log(`[Normalize] IFSC: ${original} -> ${req.body.ifscCode}`);
    }
  }

  // Normalize account number - digits only
  if (req.body.accountNumber) {
    const original = req.body.accountNumber;
    req.body.accountNumber = req.body.accountNumber.replace(/[^0-9]/g, '');
    if (original !== req.body.accountNumber) {
      console.log(`[Normalize] Account Number: ${original} -> ${req.body.accountNumber}`);
    }
  }

  // Normalize driving license number - uppercase and remove special characters
  if (req.body.drivingLicenseNo) {
    const original = req.body.drivingLicenseNo;
    req.body.drivingLicenseNo = req.body.drivingLicenseNo.toUpperCase().replace(/[\s-]/g, '');
    if (original !== req.body.drivingLicenseNo) {
      console.log(`[Normalize] License No: ${original} -> ${req.body.drivingLicenseNo}`);
    }
  }

  // Trim whitespace from text fields
  const textFields = ['fullName', 'bankName', 'accountHolderName'];
  textFields.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      req.body[field] = req.body[field].trim();
    }
  });

  console.log('[Normalize Middleware] Data normalization complete');
  next();
};

// Middleware to normalize query parameters for duplicate checking
const normalizeQueryParams = (req, res, next) => {
  const { field, value } = req.query;

  if (!field || !value) {
    return next();
  }

  let normalizedValue = value;

  switch(field) {
    case 'aadhaarNo':
      // Remove all non-digit characters
      normalizedValue = value.replace(/[^0-9]/g, '');
      break;
    case 'mobileNo':
      // Remove all non-digit characters
      normalizedValue = value.replace(/[^0-9]/g, '');
      break;
    case 'vehicleNo':
      // Uppercase and remove special characters
      normalizedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      break;
  }

  if (normalizedValue !== value) {
    console.log(`[Normalize Query] ${field}: ${value} -> ${normalizedValue}`);
    req.query.value = normalizedValue;
  }

  next();
};

module.exports = {
  normalizeDriverData,
  normalizeQueryParams
};