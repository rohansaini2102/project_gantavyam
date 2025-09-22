import * as yup from 'yup';

// Enhanced validation patterns
const patterns = {
  indianMobile: /^[6-9]\d{9}$/,
  aadhaar: /^\d{12}$/,
  namePattern: /^[a-zA-Z\s.'-]+$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  vehicleNumber: /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  bankAccount: /^\d{9,18}$/,
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
};

// Enhanced error messages with suggestions
const messages = {
  fullName: {
    required: 'Driver\'s full name is required for legal documentation',
    min: 'Please provide the complete name (at least 2 characters)',
    max: 'Name is too long (maximum 100 characters)',
    matches: 'Name can only contain letters, spaces, dots, apostrophes and hyphens',
    suggestion: 'Enter the name exactly as it appears on official documents like Aadhaar or Driving License'
  },
  mobileNo: {
    required: 'Mobile number is essential for driver communication and booking alerts',
    matches: 'Invalid mobile number format. Must be 10 digits starting with 6, 7, 8, or 9',
    length: 'Mobile number must be exactly 10 digits',
    suggestion: 'Enter a valid Indian mobile number without +91 prefix (e.g., 9876543210)'
  },
  email: {
    required: 'Email address is required for account verification and notifications',
    email: 'Please enter a valid email address format',
    suggestion: 'Use a valid email like: driver@example.com'
  },
  aadhaarNo: {
    required: 'Aadhaar number is mandatory for identity verification',
    matches: 'Aadhaar number must be exactly 12 digits',
    length: 'Aadhaar number must be exactly 12 digits',
    suggestion: 'Enter the 12-digit number from your Aadhaar card without spaces'
  },
  vehicleNo: {
    required: 'Vehicle registration number is required to verify vehicle ownership',
    matches: 'Invalid vehicle number format. Use: STATE + DISTRICT + SERIES + NUMBER',
    suggestion: 'Enter as shown on RC: MH01AB1234 (2 letters + 2 digits + 1-2 letters + 4 digits)'
  },
  vehicleType: {
    required: 'Please select the type of vehicle you will be driving'
  },
  vehicleModel: {
    required: 'Vehicle model is required for insurance and booking purposes',
    min: 'Please provide the complete vehicle model name',
    suggestion: 'Enter make and model (e.g., Maruti Swift, Tata Indica, Honda City)'
  },
  manufacturingYear: {
    required: 'Manufacturing year is required for vehicle verification',
    min: 'Vehicle must be manufactured after 1990',
    max: `Vehicle cannot be manufactured in the future`,
    typeError: 'Year must be a valid number',
    suggestion: 'Enter the year when your vehicle was manufactured'
  },
  color: {
    required: 'Vehicle color helps passengers identify the correct vehicle',
    min: 'Please specify the vehicle color',
    suggestion: 'Enter primary color (e.g., White, Red, Blue, Silver)'
  },
  bankName: {
    required: 'Bank name is required for payment processing',
    min: 'Please enter the complete bank name',
    suggestion: 'Enter full bank name (e.g., State Bank of India, HDFC Bank)'
  },
  accountNumber: {
    required: 'Bank account number is required for earnings transfer',
    matches: 'Account number must be 9-18 digits only',
    suggestion: 'Enter the account number from your bank passbook or statement'
  },
  accountHolderName: {
    required: 'Account holder name must match bank records for successful transfers',
    min: 'Please enter the complete name as per bank records',
    suggestion: 'Enter name exactly as it appears in your bank account'
  },
  ifscCode: {
    required: 'IFSC code is essential for bank transfers',
    matches: 'IFSC format: 4 letters + 0 + 6 alphanumeric characters',
    length: 'IFSC code must be exactly 11 characters',
    suggestion: 'Find this 11-character code on your bank passbook or cheque (e.g., SBIN0001234)'
  },
  drivingLicenseNo: {
    required: 'Valid driving license is mandatory for driver registration',
    min: 'License number appears incomplete',
    suggestion: 'Enter the license number from your DL card (format varies by state)'
  },
  permitNo: {
    required: 'Commercial permit is required for passenger vehicle operations',
    min: 'Permit number appears incomplete',
    suggestion: 'Enter the permit number from your commercial vehicle permit'
  },
  fitnessNo: {
    required: 'Fitness certificate ensures vehicle safety compliance',
    min: 'Fitness certificate number appears incomplete',
    suggestion: 'Enter the certificate number from your vehicle fitness document'
  },
  insurancePolicyNo: {
    required: 'Valid insurance is mandatory for commercial vehicle operation',
    min: 'Insurance policy number appears incomplete',
    suggestion: 'Enter the policy number from your current vehicle insurance'
  },
  password: {
    required: 'Password is required to secure your driver account',
    min: 'Password must be at least 8 characters for security',
    matches: 'Password must include uppercase, lowercase, numbers, and special characters',
    suggestion: 'Create a strong password with mixed characters for account security'
  },
  confirmPassword: {
    required: 'Please confirm your password to ensure it was entered correctly',
    oneOf: 'Password confirmation does not match the original password',
    suggestion: 'Re-enter the exact same password to confirm'
  }
};

// Helper functions for custom validation
const validateIndianMobile = (mobile) => {
  if (!mobile) return false;

  // Check pattern
  if (!patterns.indianMobile.test(mobile)) return false;

  // Reject common invalid numbers
  const invalidNumbers = [
    '0000000000', '1111111111', '2222222222', '3333333333', '4444444444',
    '5555555555', '6666666666', '7777777777', '8888888888', '9999999999',
    '1234567890', '9876543210', '0123456789'
  ];

  if (invalidNumbers.includes(mobile)) return false;

  // Check valid prefixes
  const validPrefixes = ['60', '61', '62', '63', '64', '65', '66', '67', '68', '69',
                        '70', '71', '72', '73', '74', '75', '76', '77', '78', '79',
                        '80', '81', '82', '83', '84', '85', '86', '87', '88', '89',
                        '90', '91', '92', '93', '94', '95', '96', '97', '98', '99'];

  return validPrefixes.some(prefix => mobile.startsWith(prefix));
};

const validateAadhaar = (aadhaar) => {
  if (!aadhaar || aadhaar.length !== 12) return false;

  // Basic pattern check
  if (!patterns.aadhaar.test(aadhaar)) return false;

  // Reject obviously fake numbers
  const invalidPatterns = [
    '000000000000', '111111111111', '222222222222', '123456789012'
  ];

  if (invalidPatterns.includes(aadhaar)) return false;

  // Simplified Aadhaar validation (basic checksum)
  try {
    const digits = aadhaar.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      sum += digits[i] * (12 - i);
    }
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? remainder : 11 - remainder;
    return checkDigit === digits[11];
  } catch {
    return false;
  }
};

const validateVehicleNumber = (vehicleNo) => {
  if (!vehicleNo) return false;

  const cleaned = vehicleNo.toUpperCase().replace(/[\s-]/g, '');
  if (!patterns.vehicleNumber.test(cleaned)) return false;

  // Check for valid state codes
  const validStateCodes = [
    'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JH', 'KA', 'KL',
    'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'RJ', 'SK', 'TN', 'TS',
    'TR', 'UP', 'UK', 'WB', 'AN', 'CH', 'DN', 'DD', 'DL', 'JK', 'LA', 'LD', 'PY'
  ];

  const stateCode = cleaned.substring(0, 2);
  return validStateCodes.includes(stateCode);
};

const validateIFSC = (ifsc) => {
  if (!ifsc || ifsc.length !== 11) return false;

  const cleaned = ifsc.toUpperCase();
  if (!patterns.ifsc.test(cleaned)) return false;

  // Check common bank codes
  const validBankCodes = [
    'SBIN', 'HDFC', 'ICIC', 'UTIB', 'KKBK', 'INDB', 'YESB', 'BARB', 'CNRB', 'PUNB',
    'UBIN', 'BKID', 'CBIN', 'IDIB', 'IDFB', 'FDRL', 'SIBL', 'KVBL', 'TMBL', 'CIUB'
  ];

  const bankCode = cleaned.substring(0, 4);
  return validBankCodes.includes(bankCode);
};

// Step-wise validation schemas
export const personalInfoSchema = yup.object({
  fullName: yup
    .string()
    .required(messages.fullName.required)
    .min(2, messages.fullName.min)
    .max(100, messages.fullName.max)
    .matches(patterns.namePattern, messages.fullName.matches)
    .test('valid-name', 'Please enter both first and last name', (value) => {
      if (!value) return false;
      const words = value.trim().split(/\s+/);
      return words.length >= 2 && words.every(word => word.length > 0);
    })
    .test('no-numbers', 'Name cannot contain numbers', (value) => {
      return value ? !/\d/.test(value) : true;
    }),

  mobileNo: yup
    .string()
    .required(messages.mobileNo.required)
    .length(10, messages.mobileNo.length)
    .test('valid-mobile', messages.mobileNo.matches, validateIndianMobile),

  email: yup
    .string()
    .required(messages.email.required)
    .email(messages.email.email)
    .max(100, 'Email address is too long (maximum 100 characters)')
    .test('no-disposable', 'Please use a permanent email address', (value) => {
      if (!value) return true;
      const disposableDomains = ['10minutemail.com', 'temp-mail.org', 'guerrillamail.com'];
      const domain = value.split('@')[1]?.toLowerCase();
      return !disposableDomains.includes(domain);
    }),

  aadhaarNo: yup
    .string()
    .required(messages.aadhaarNo.required)
    .length(12, messages.aadhaarNo.length)
    .test('valid-aadhaar', messages.aadhaarNo.matches, validateAadhaar)
});

export const vehicleInfoSchema = yup.object({
  vehicleNo: yup
    .string()
    .required(messages.vehicleNo.required)
    .test('valid-vehicle', messages.vehicleNo.matches, validateVehicleNumber)
    .transform(val => val ? val.toUpperCase().replace(/[\s-]/g, '') : val),

  vehicleType: yup
    .string()
    .required(messages.vehicleType.required)
    .oneOf(['auto', 'taxi', 'cab', 'bus'], 'Please select a valid vehicle type'),

  vehicleModel: yup
    .string()
    .required(messages.vehicleModel.required)
    .min(2, messages.vehicleModel.min)
    .max(50, 'Vehicle model name is too long (maximum 50 characters)')
    .matches(/^[a-zA-Z0-9\s\-.]+$/, 'Vehicle model can only contain letters, numbers, spaces, hyphens, and dots'),

  manufacturingYear: yup
    .number()
    .required(messages.manufacturingYear.required)
    .typeError(messages.manufacturingYear.typeError)
    .min(1990, messages.manufacturingYear.min)
    .max(new Date().getFullYear(), messages.manufacturingYear.max)
    .test('not-too-old', 'Vehicle cannot be older than 20 years for commercial use', (value) => {
      return value ? value >= new Date().getFullYear() - 20 : true;
    }),

  color: yup
    .string()
    .required(messages.color.required)
    .min(2, messages.color.min)
    .max(20, 'Color name is too long (maximum 20 characters)')
    .matches(/^[a-zA-Z\s]+$/, 'Color can only contain letters and spaces')
    .test('common-color', 'Please enter a common vehicle color', (value) => {
      if (!value) return true;
      const commonColors = [
        'white', 'black', 'red', 'blue', 'silver', 'grey', 'gray', 'yellow', 'green',
        'brown', 'orange', 'purple', 'pink', 'gold', 'beige', 'cream', 'maroon'
      ];
      return commonColors.some(c => value.toLowerCase().includes(c));
    })
});

export const bankingInfoSchema = yup.object({
  bankName: yup
    .string()
    .required(messages.bankName.required)
    .min(2, messages.bankName.min)
    .max(100, 'Bank name is too long (maximum 100 characters)')
    .test('valid-bank', 'Please enter a valid bank or financial institution name', (value) => {
      return value ? /bank|cooperative|credit|finance/i.test(value) : true;
    }),

  accountNumber: yup
    .string()
    .required(messages.accountNumber.required)
    .matches(patterns.bankAccount, messages.accountNumber.matches)
    .test('not-fake', 'Please enter a valid bank account number', (value) => {
      if (!value) return true;
      const invalidPatterns = ['000000000', '111111111', '123456789', '987654321'];
      return !invalidPatterns.some(pattern => value.includes(pattern));
    }),

  accountHolderName: yup
    .string()
    .required(messages.accountHolderName.required)
    .min(2, messages.accountHolderName.min)
    .max(100, 'Account holder name is too long (maximum 100 characters)')
    .matches(patterns.namePattern, 'Account holder name can only contain letters, spaces, dots, apostrophes and hyphens'),

  ifscCode: yup
    .string()
    .required(messages.ifscCode.required)
    .length(11, messages.ifscCode.length)
    .test('valid-ifsc', messages.ifscCode.matches, validateIFSC)
    .transform(val => val ? val.toUpperCase() : val),

  drivingLicenseNo: yup
    .string()
    .required(messages.drivingLicenseNo.required)
    .min(8, messages.drivingLicenseNo.min)
    .max(20, 'Driving license number is too long (maximum 20 characters)')
    .test('valid-dl-state', 'Invalid state code in driving license number', (value) => {
      if (!value || value.length < 2) return true;
      const validStateCodes = [
        'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JH', 'KA', 'KL',
        'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'RJ', 'SK', 'TN', 'TS',
        'TR', 'UP', 'UK', 'WB', 'AN', 'CH', 'DN', 'DD', 'DL', 'JK', 'LA', 'LD', 'PY'
      ];
      const stateCode = value.substring(0, 2).toUpperCase();
      return validStateCodes.includes(stateCode);
    })
    .transform(val => val ? val.toUpperCase() : val),

  permitNo: yup
    .string()
    .required(messages.permitNo.required)
    .min(5, messages.permitNo.min)
    .max(30, 'Permit number is too long (maximum 30 characters)')
    .transform(val => val ? val.toUpperCase() : val),

  fitnessNo: yup
    .string()
    .required(messages.fitnessNo.required)
    .min(5, messages.fitnessNo.min)
    .max(30, 'Fitness certificate number is too long (maximum 30 characters)')
    .transform(val => val ? val.toUpperCase() : val),

  insurancePolicyNo: yup
    .string()
    .required(messages.insurancePolicyNo.required)
    .min(8, messages.insurancePolicyNo.min)
    .max(30, 'Insurance policy number is too long (maximum 30 characters)')
    .transform(val => val ? val.toUpperCase() : val)
});

export const securityInfoSchema = yup.object({
  password: yup
    .string()
    .required(messages.password.required)
    .min(8, messages.password.min)
    .max(128, 'Password is too long (maximum 128 characters)')
    .matches(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter (a-z)')
    .matches(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter (A-Z)')
    .matches(/(?=.*\d)/, 'Password must contain at least one number (0-9)')
    .matches(/(?=.*[@$!%*?&])/, 'Password must contain at least one special character (@$!%*?&)')
    .test('not-weak', 'Password is too common. Please choose a more secure password', (value) => {
      if (!value) return true;
      const weakPasswords = ['password', '12345678', 'qwerty123', 'admin123', 'driver123'];
      return !weakPasswords.some(weak => value.toLowerCase().includes(weak));
    })
    .test('no-repeats', 'Password cannot have 3 or more consecutive identical characters', (value) => {
      return value ? !/(.)\1{2,}/.test(value) : true;
    }),

  confirmPassword: yup
    .string()
    .required(messages.confirmPassword.required)
    .oneOf([yup.ref('password')], messages.confirmPassword.oneOf)
});

// Combined schema for final validation
export const completeDriverSchema = personalInfoSchema
  .concat(vehicleInfoSchema)
  .concat(bankingInfoSchema)
  .concat(securityInfoSchema);

// File validation
export const fileValidationRules = {
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png'],
  maxSize: 5 * 1024 * 1024, // 5MB
  minSize: 10 * 1024, // 10KB

  validateFile: (file, fieldName) => {
    if (!file) return { isValid: false, error: `${fieldName} is required` };

    if (!fileValidationRules.allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Only JPG, JPEG, or PNG files are allowed',
        suggestion: 'Please select an image file in JPG, JPEG, or PNG format'
      };
    }

    if (file.size > fileValidationRules.maxSize) {
      return {
        isValid: false,
        error: 'File size must be less than 5MB',
        suggestion: 'Please compress your image or select a smaller file'
      };
    }

    if (file.size < fileValidationRules.minSize) {
      return {
        isValid: false,
        error: 'File size is too small (minimum 10KB)',
        suggestion: 'Please select a higher quality image'
      };
    }

    return { isValid: true };
  }
};

// Step schemas that match the form structure
export const personalStepSchema = yup.object({
  fullName: yup
    .string()
    .required(messages.fullName.required)
    .min(2, messages.fullName.min)
    .max(100, messages.fullName.max)
    .matches(patterns.namePattern, messages.fullName.matches)
    .test('valid-name', 'Please enter both first and last name', (value) => {
      if (!value) return false;
      const words = value.trim().split(/\s+/);
      return words.length >= 2 && words.every(word => word.length > 0);
    }),

  mobileNo: yup
    .string()
    .required(messages.mobileNo.required)
    .length(10, messages.mobileNo.length)
    .test('valid-mobile', messages.mobileNo.matches, validateIndianMobile),

  email: yup
    .string()
    .required(messages.email.required)
    .email(messages.email.email)
    .max(100, 'Email address is too long (maximum 100 characters)'),

  aadhaarNo: yup
    .string()
    .required(messages.aadhaarNo.required)
    .length(12, messages.aadhaarNo.length)
    .test('valid-aadhaar', messages.aadhaarNo.matches, validateAadhaar),

  vehicleNo: yup
    .string()
    .required(messages.vehicleNo.required)
    .test('valid-vehicle', messages.vehicleNo.matches, validateVehicleNumber)
    .transform(val => val ? val.toUpperCase().replace(/[\s-]/g, '') : val)
});

export const bankStepSchema = yup.object({
  bankName: yup
    .string()
    .required(messages.bankName.required)
    .min(2, messages.bankName.min)
    .max(100, 'Bank name is too long (maximum 100 characters)'),

  ifscCode: yup
    .string()
    .required(messages.ifscCode.required)
    .length(11, messages.ifscCode.length)
    .test('valid-ifsc', messages.ifscCode.matches, validateIFSC)
    .transform(val => val ? val.toUpperCase() : val),

  accountNumber: yup
    .string()
    .required(messages.accountNumber.required)
    .matches(patterns.bankAccount, messages.accountNumber.matches),

  accountHolderName: yup
    .string()
    .required(messages.accountHolderName.required)
    .min(2, messages.accountHolderName.min)
    .max(100, 'Account holder name is too long (maximum 100 characters)')
    .matches(patterns.namePattern, 'Account holder name can only contain letters, spaces, dots, apostrophes and hyphens')
});

export const licenseStepSchema = yup.object({
  drivingLicenseNo: yup
    .string()
    .required(messages.drivingLicenseNo.required)
    .min(8, messages.drivingLicenseNo.min)
    .max(20, 'Driving license number is too long (maximum 20 characters)')
    .transform(val => val ? val.toUpperCase() : val),

  permitNo: yup
    .string()
    .required(messages.permitNo.required)
    .min(5, messages.permitNo.min)
    .max(30, 'Permit number is too long (maximum 30 characters)')
    .transform(val => val ? val.toUpperCase() : val),

  fitnessNo: yup
    .string()
    .required(messages.fitnessNo.required)
    .min(5, messages.fitnessNo.min)
    .max(30, 'Fitness certificate number is too long (maximum 30 characters)')
    .transform(val => val ? val.toUpperCase() : val),

  insurancePolicyNo: yup
    .string()
    .required(messages.insurancePolicyNo.required)
    .min(8, messages.insurancePolicyNo.min)
    .max(30, 'Insurance policy number is too long (maximum 30 characters)')
    .transform(val => val ? val.toUpperCase() : val)
});

export const securityStepSchema = yup.object({
  password: yup
    .string()
    .required(messages.password.required)
    .min(8, messages.password.min)
    .max(128, 'Password is too long (maximum 128 characters)')
    .matches(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter (a-z)')
    .matches(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter (A-Z)')
    .matches(/(?=.*\d)/, 'Password must contain at least one number (0-9)')
    .matches(/(?=.*[@$!%*?&])/, 'Password must contain at least one special character (@$!%*?&)'),

  confirmPassword: yup
    .string()
    .required(messages.confirmPassword.required)
    .oneOf([yup.ref('password')], messages.confirmPassword.oneOf)
});

// Get step schema by step name
export const getStepSchema = (stepName) => {
  switch (stepName) {
    case 'personal':
      return personalStepSchema;
    case 'bank':
      return bankStepSchema;
    case 'license':
      return licenseStepSchema;
    case 'security':
      return securityStepSchema;
    default:
      return personalStepSchema;
  }
};

// Validation utilities
export const validationUtils = {
  getFieldSuggestion: (fieldName) => {
    return messages[fieldName]?.suggestion || 'Please check the entered value';
  },

  requiresApiValidation: (fieldName) => {
    return ['mobileNo', 'aadhaarNo', 'vehicleNo', 'email', 'drivingLicenseNo'].includes(fieldName);
  },

  getCompletionPercentage: (data, schema) => {
    try {
      schema.validateSync(data, { abortEarly: false });
      return 100;
    } catch (error) {
      const totalFields = Object.keys(schema.fields).length;
      const validFields = totalFields - error.errors.length;
      return Math.round((validFields / totalFields) * 100);
    }
  },

  formatFieldValue: (fieldName, value) => {
    switch (fieldName) {
      case 'mobileNo':
        return value.replace(/\D/g, '').slice(0, 10);
      case 'aadhaarNo':
        return value.replace(/\D/g, '').slice(0, 12);
      case 'vehicleNo':
        return value.toUpperCase().replace(/[\s-]/g, '');
      case 'ifscCode':
        return value.toUpperCase().replace(/\s/g, '');
      case 'drivingLicenseNo':
      case 'permitNo':
      case 'fitnessNo':
      case 'insurancePolicyNo':
        return value.toUpperCase();
      case 'fullName':
      case 'accountHolderName':
        return value.replace(/\s+/g, ' ').trim();
      default:
        return value;
    }
  }
};

export { messages };

export default {
  personalInfoSchema,
  vehicleInfoSchema,
  bankingInfoSchema,
  securityInfoSchema,
  completeDriverSchema,
  getStepSchema,
  validationUtils,
  fileValidationRules,
  messages
};