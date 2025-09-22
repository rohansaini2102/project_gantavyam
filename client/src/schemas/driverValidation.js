import { z } from 'zod';

// Enhanced validation patterns with comprehensive rules
const patterns = {
  // Personal Information Patterns
  indianMobile: /^[6-9]\d{9}$/,
  aadhaar: /^\d{12}$/,
  namePattern: /^[a-zA-Z\s.'-]+$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // Vehicle Information Patterns
  vehicleNumber: /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/,

  // Banking Patterns
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  bankAccount: /^\d{9,18}$/,

  // License Patterns
  drivingLicense: /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$|^[A-Z]{2}-[0-9]{13}$/,
  permitNumber: /^[A-Z0-9]{8,20}$/,
  fitnessNumber: /^[A-Z0-9]{8,20}$/,
  insurancePolicy: /^[A-Z0-9]{10,30}$/,

  // Utility Patterns
  pin: /^\d{6}$/,
  panCard: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  year: /^(19|20)\d{2}$/,
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
};

// Field-specific error messages with personalized suggestions
const fieldMessages = {
  fullName: {
    required: 'Driver\'s full name is required for legal documentation',
    tooShort: 'Please provide the complete name (at least 2 characters)',
    tooLong: 'Name is too long (maximum 100 characters)',
    invalid: 'Name can only contain letters, spaces, dots, apostrophes and hyphens',
    suggestion: 'Enter the name exactly as it appears on official documents like Aadhaar or Driving License'
  },
  mobileNo: {
    required: 'Mobile number is essential for driver communication and booking alerts',
    invalid: 'Invalid mobile number format. Must be 10 digits starting with 6, 7, 8, or 9',
    duplicate: 'This mobile number is already registered with another driver',
    suggestion: 'Enter a valid Indian mobile number without +91 prefix (e.g., 9876543210)'
  },
  email: {
    required: 'Email address is required for account verification and notifications',
    invalid: 'Please enter a valid email address format',
    duplicate: 'This email is already registered with another account',
    suggestion: 'Use a valid email like: driver@example.com'
  },
  aadhaarNo: {
    required: 'Aadhaar number is mandatory for identity verification',
    invalid: 'Aadhaar number must be exactly 12 digits',
    duplicate: 'This Aadhaar number is already registered with another driver',
    checksum: 'Invalid Aadhaar number (failed verification check)',
    suggestion: 'Enter the 12-digit number from your Aadhaar card without spaces'
  },
  vehicleNo: {
    required: 'Vehicle registration number is required to verify vehicle ownership',
    invalid: 'Invalid vehicle number format. Use: STATE + DISTRICT + SERIES + NUMBER',
    duplicate: 'This vehicle is already registered with another driver',
    suggestion: 'Enter as shown on RC: MH01AB1234 (2 letters + 2 digits + 1-2 letters + 4 digits)'
  },
  vehicleType: {
    required: 'Please select the type of vehicle you will be driving'
  },
  vehicleModel: {
    required: 'Vehicle model is required for insurance and booking purposes',
    tooShort: 'Please provide the complete vehicle model name',
    suggestion: 'Enter make and model (e.g., Maruti Swift, Tata Indica, Honda City)'
  },
  manufacturingYear: {
    required: 'Manufacturing year is required for vehicle verification',
    invalid: 'Year must be 4 digits between 2000 and current year',
    suggestion: 'Enter the year when your vehicle was manufactured'
  },
  color: {
    required: 'Vehicle color helps passengers identify the correct vehicle',
    tooShort: 'Please specify the vehicle color',
    suggestion: 'Enter primary color (e.g., White, Red, Blue, Silver)'
  },
  bankName: {
    required: 'Bank name is required for payment processing',
    tooShort: 'Please enter the complete bank name',
    suggestion: 'Enter full bank name (e.g., State Bank of India, HDFC Bank)'
  },
  accountNumber: {
    required: 'Bank account number is required for earnings transfer',
    invalid: 'Account number must be 9-18 digits only',
    suggestion: 'Enter the account number from your bank passbook or statement'
  },
  accountHolderName: {
    required: 'Account holder name must match bank records for successful transfers',
    tooShort: 'Please enter the complete name as per bank records',
    mismatch: 'Account holder name should ideally match the driver name',
    suggestion: 'Enter name exactly as it appears in your bank account'
  },
  ifscCode: {
    required: 'IFSC code is essential for bank transfers',
    invalid: 'IFSC format: 4 letters + 0 + 6 alphanumeric characters',
    bankDetected: 'Bank automatically detected from IFSC code',
    suggestion: 'Find this 11-character code on your bank passbook or cheque (e.g., SBIN0001234)'
  },
  drivingLicenseNo: {
    required: 'Valid driving license is mandatory for driver registration',
    invalid: 'Invalid driving license format for Indian licenses',
    tooShort: 'License number appears incomplete',
    duplicate: 'This license number is already registered',
    suggestion: 'Enter the license number from your DL card (format varies by state)'
  },
  permitNo: {
    required: 'Commercial permit is required for passenger vehicle operations',
    invalid: 'Invalid permit number format',
    tooShort: 'Permit number appears incomplete',
    suggestion: 'Enter the permit number from your commercial vehicle permit'
  },
  fitnessNo: {
    required: 'Fitness certificate ensures vehicle safety compliance',
    invalid: 'Invalid fitness certificate format',
    tooShort: 'Fitness certificate number appears incomplete',
    suggestion: 'Enter the certificate number from your vehicle fitness document'
  },
  insurancePolicyNo: {
    required: 'Valid insurance is mandatory for commercial vehicle operation',
    invalid: 'Invalid insurance policy number format',
    tooShort: 'Insurance policy number appears incomplete',
    suggestion: 'Enter the policy number from your current vehicle insurance'
  },
  password: {
    required: 'Password is required to secure your driver account',
    tooShort: 'Password must be at least 8 characters for security',
    weak: 'Password must include uppercase, lowercase, numbers, and special characters',
    suggestion: 'Create a strong password with mixed characters for account security'
  },
  confirmPassword: {
    required: 'Please confirm your password to ensure it was entered correctly',
    mismatch: 'Password confirmation does not match the original password',
    suggestion: 'Re-enter the exact same password to confirm'
  }
};

// Common validation messages (for future use)
// const messages = {
//   required: (field) => fieldMessages[field]?.required || `${field} is required`,
//   invalid: (field) => fieldMessages[field]?.invalid || `Invalid ${field} format`,
//   tooShort: (field, min) => fieldMessages[field]?.tooShort || `${field} must be at least ${min} characters`,
//   tooLong: (field, max) => fieldMessages[field]?.tooLong || `${field} must not exceed ${max} characters`,
//   mismatch: (field) => fieldMessages[field]?.mismatch || `${field} do not match`,
//   duplicate: (field) => fieldMessages[field]?.duplicate || `This ${field} is already registered`
// };

// Enhanced validation schema with personalized field validation
export const driverValidationSchema = z.object({
  // Personal Information with detailed validation
  fullName: z
    .string({ required_error: fieldMessages.fullName.required })
    .min(1, fieldMessages.fullName.required)
    .min(2, fieldMessages.fullName.tooShort)
    .max(100, fieldMessages.fullName.tooLong)
    .regex(patterns.namePattern, fieldMessages.fullName.invalid)
    .refine(
      (name) => {
        const words = name.trim().split(/\s+/);
        return words.length >= 2 && words.every(word => word.length > 0);
      },
      'Please enter both first and last name (minimum 2 words)'
    )
    .refine(
      (name) => !name.includes('  '), // No double spaces
      'Please remove extra spaces between words'
    )
    .refine(
      (name) => !/\d/.test(name), // No numbers
      'Name cannot contain numbers'
    ),

  mobileNo: z
    .string({ required_error: fieldMessages.mobileNo.required })
    .min(1, fieldMessages.mobileNo.required)
    .length(10, 'Mobile number must be exactly 10 digits')
    .regex(patterns.indianMobile, fieldMessages.mobileNo.invalid)
    .refine(
      (mobile) => {
        // Reject common invalid numbers
        const invalidNumbers = [
          '0000000000', '1111111111', '2222222222', '3333333333', '4444444444',
          '5555555555', '6666666666', '7777777777', '8888888888', '9999999999',
          '1234567890', '9876543210', '0123456789'
        ];
        return !invalidNumbers.includes(mobile);
      },
      'Please enter a real mobile number (not a dummy number)'
    )
    .refine(
      (mobile) => {
        // Additional check for valid Indian mobile patterns
        const validPrefixes = ['60', '61', '62', '63', '64', '65', '66', '67', '68', '69',
                              '70', '71', '72', '73', '74', '75', '76', '77', '78', '79',
                              '80', '81', '82', '83', '84', '85', '86', '87', '88', '89',
                              '90', '91', '92', '93', '94', '95', '96', '97', '98', '99'];
        return validPrefixes.some(prefix => mobile.startsWith(prefix));
      },
      'Mobile number format invalid for Indian telecom operators'
    ),

  email: z
    .string({ required_error: fieldMessages.email.required })
    .min(1, fieldMessages.email.required)
    .email('Please enter a valid email address')
    .max(100, 'Email address is too long (maximum 100 characters)')
    .regex(patterns.email, fieldMessages.email.invalid)
    .refine(
      (email) => {
        // Reject temporary/disposable email domains
        const disposableDomains = ['10minutemail.com', 'temp-mail.org', 'guerrillamail.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        return !disposableDomains.includes(domain);
      },
      'Please use a permanent email address (not a temporary email)'
    )
    .refine(
      (email) => !email.includes('..'), // No consecutive dots
      'Email format is invalid (consecutive dots not allowed)'
    ),

  aadhaarNo: z
    .string({ required_error: fieldMessages.aadhaarNo.required })
    .min(1, fieldMessages.aadhaarNo.required)
    .length(12, fieldMessages.aadhaarNo.invalid)
    .regex(patterns.aadhaar, fieldMessages.aadhaarNo.invalid)
    .refine(
      (aadhaar) => {
        // Reject obviously fake Aadhaar numbers
        const invalidPatterns = [
          '000000000000', '111111111111', '222222222222', '123456789012'
        ];
        return !invalidPatterns.includes(aadhaar);
      },
      'Please enter a valid Aadhaar number'
    )
    .refine(
      (aadhaar) => {
        // Enhanced Aadhaar validation using Verhoeff algorithm
        try {
          const verhoeff = [
            [0,1,2,3,4,5,6,7,8,9], [1,2,3,4,0,6,7,8,9,5], [2,3,4,0,1,7,8,9,5,6],
            [3,4,0,1,2,8,9,5,6,7], [4,0,1,2,3,9,5,6,7,8], [5,9,8,7,6,0,4,3,2,1],
            [6,5,9,8,7,1,0,4,3,2], [7,6,5,9,8,2,1,0,4,3], [8,7,6,5,9,3,2,1,0,4],
            [9,8,7,6,5,4,3,2,1,0]
          ];
          const permutation = [
            [0,1,2,3,4,5,6,7,8,9], [1,5,7,6,2,8,3,0,9,4], [5,8,0,3,7,9,6,1,4,2],
            [8,9,1,6,0,4,3,5,2,7], [9,4,5,3,1,2,6,8,7,0], [4,2,8,6,5,7,3,9,0,1],
            [2,7,9,3,8,0,6,4,1,5], [7,0,4,6,9,1,3,2,5,8]
          ];

          let c = 0;
          const reversedArray = aadhaar.split('').map(Number).reverse();

          for (let i = 0; i < reversedArray.length; i++) {
            c = verhoeff[c][permutation[i % 8][reversedArray[i]]];
          }

          return c === 0;
        } catch (error) {
          return false;
        }
      },
      fieldMessages.aadhaarNo.checksum
    ),

  // Vehicle Information with enhanced validation
  vehicleNo: z
    .string({ required_error: fieldMessages.vehicleNo.required })
    .min(1, fieldMessages.vehicleNo.required)
    .regex(patterns.vehicleNumber, fieldMessages.vehicleNo.invalid)
    .refine(
      (vehicleNo) => {
        // Check for valid state codes (major Indian states)
        const validStateCodes = [
          'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JH', 'KA', 'KL',
          'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'RJ', 'SK', 'TN', 'TS',
          'TR', 'UP', 'UK', 'WB', 'AN', 'CH', 'DN', 'DD', 'DL', 'JK', 'LA', 'LD', 'PY'
        ];
        const stateCode = vehicleNo.substring(0, 2);
        return validStateCodes.includes(stateCode);
      },
      'Invalid state code in vehicle number'
    )
    .transform(val => val.toUpperCase().replace(/[\s-]/g, '')),

  vehicleType: z
    .string({ required_error: fieldMessages.vehicleType.required })
    .min(1, fieldMessages.vehicleType.required)
    .refine(
      (type) => ['auto', 'taxi', 'cab', 'bus'].includes(type),
      'Please select a valid vehicle type'
    ),

  vehicleModel: z
    .string({ required_error: fieldMessages.vehicleModel.required })
    .min(1, fieldMessages.vehicleModel.required)
    .min(2, fieldMessages.vehicleModel.tooShort)
    .max(50, 'Vehicle model name is too long (maximum 50 characters)')
    .refine(
      (model) => !/^\s+|\s+$/.test(model), // No leading/trailing whitespace
      'Please remove extra spaces from vehicle model'
    )
    .refine(
      (model) => /^[a-zA-Z0-9\s\-.]+$/.test(model), // Only letters, numbers, spaces, hyphens, dots
      'Vehicle model can only contain letters, numbers, spaces, hyphens, and dots'
    ),

  manufacturingYear: z
    .string({ required_error: fieldMessages.manufacturingYear.required })
    .min(1, fieldMessages.manufacturingYear.required)
    .regex(patterns.year, fieldMessages.manufacturingYear.invalid)
    .refine(
      (year) => {
        const numYear = parseInt(year);
        const currentYear = new Date().getFullYear();
        return numYear >= 1990 && numYear <= currentYear;
      },
      `Vehicle must be manufactured between 1990 and ${new Date().getFullYear()}`
    )
    .refine(
      (year) => {
        const numYear = parseInt(year);
        const currentYear = new Date().getFullYear();
        return numYear >= currentYear - 20; // Not older than 20 years
      },
      'Vehicle cannot be older than 20 years for commercial use'
    ),

  color: z
    .string({ required_error: fieldMessages.color.required })
    .min(1, fieldMessages.color.required)
    .min(2, fieldMessages.color.tooShort)
    .max(20, 'Color name is too long (maximum 20 characters)')
    .regex(/^[a-zA-Z\s]+$/, 'Color can only contain letters and spaces')
    .refine(
      (color) => {
        const commonColors = [
          'white', 'black', 'red', 'blue', 'silver', 'grey', 'gray', 'yellow', 'green',
          'brown', 'orange', 'purple', 'pink', 'gold', 'beige', 'cream', 'maroon'
        ];
        return commonColors.some(c => color.toLowerCase().includes(c));
      },
      'Please enter a common vehicle color (white, black, red, blue, etc.)'
    ),

  // Banking Information with enhanced validation
  bankName: z
    .string({ required_error: fieldMessages.bankName.required })
    .min(1, fieldMessages.bankName.required)
    .min(2, fieldMessages.bankName.tooShort)
    .max(100, 'Bank name is too long (maximum 100 characters)')
    .refine(
      (name) => /bank|cooperative|credit|finance/i.test(name),
      'Please enter a valid bank or financial institution name'
    ),

  accountNumber: z
    .string({ required_error: fieldMessages.accountNumber.required })
    .min(1, fieldMessages.accountNumber.required)
    .regex(patterns.bankAccount, fieldMessages.accountNumber.invalid)
    .refine(
      (account) => {
        // Check for obviously fake account numbers
        const invalidPatterns = [
          '000000000', '111111111', '123456789', '987654321'
        ];
        return !invalidPatterns.some(pattern => account.includes(pattern));
      },
      'Please enter a valid bank account number'
    ),

  accountHolderName: z
    .string({ required_error: fieldMessages.accountHolderName.required })
    .min(1, fieldMessages.accountHolderName.required)
    .min(2, fieldMessages.accountHolderName.tooShort)
    .max(100, 'Account holder name is too long (maximum 100 characters)')
    .regex(patterns.namePattern, 'Account holder name can only contain letters, spaces, dots, apostrophes and hyphens')
    .refine(
      (name) => {
        const words = name.trim().split(/\s+/);
        return words.length >= 1 && words.every(word => word.length > 0);
      },
      'Please enter a complete account holder name'
    ),

  ifscCode: z
    .string({ required_error: fieldMessages.ifscCode.required })
    .min(1, fieldMessages.ifscCode.required)
    .length(11, 'IFSC code must be exactly 11 characters')
    .regex(patterns.ifsc, fieldMessages.ifscCode.invalid)
    .refine(
      (ifsc) => {
        // Validate common bank codes
        const validBankCodes = [
          'SBIN', 'HDFC', 'ICIC', 'UTIB', 'KKBK', 'INDB', 'YESB', 'BARB', 'CNRB', 'PUNB',
          'UBIN', 'BKID', 'CBIN', 'IDIB', 'IDFB', 'FDRL', 'SIBL', 'KVBL', 'TMBL', 'CIUB'
        ];
        const bankCode = ifsc.substring(0, 4);
        return validBankCodes.includes(bankCode);
      },
      'Invalid bank code in IFSC. Please verify from your bank documents'
    )
    .transform(val => val.toUpperCase()),

  // License Information with enhanced validation
  drivingLicenseNo: z
    .string({ required_error: fieldMessages.drivingLicenseNo.required })
    .min(1, fieldMessages.drivingLicenseNo.required)
    .min(8, fieldMessages.drivingLicenseNo.tooShort)
    .max(20, 'Driving license number is too long (maximum 20 characters)')
    .refine(
      (license) => {
        // Indian DL format validation (state codes)
        const validStateCodes = [
          'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JH', 'KA', 'KL',
          'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'RJ', 'SK', 'TN', 'TS',
          'TR', 'UP', 'UK', 'WB', 'AN', 'CH', 'DN', 'DD', 'DL', 'JK', 'LA', 'LD', 'PY'
        ];
        const stateCode = license.substring(0, 2).toUpperCase();
        return validStateCodes.includes(stateCode);
      },
      'Invalid state code in driving license number'
    )
    .transform(val => val.toUpperCase()),

  permitNo: z
    .string({ required_error: fieldMessages.permitNo.required })
    .min(1, fieldMessages.permitNo.required)
    .min(5, fieldMessages.permitNo.tooShort)
    .max(30, 'Permit number is too long (maximum 30 characters)')
    .regex(patterns.permitNumber, fieldMessages.permitNo.invalid)
    .transform(val => val.toUpperCase()),

  fitnessNo: z
    .string({ required_error: fieldMessages.fitnessNo.required })
    .min(1, fieldMessages.fitnessNo.required)
    .min(5, fieldMessages.fitnessNo.tooShort)
    .max(30, 'Fitness certificate number is too long (maximum 30 characters)')
    .regex(patterns.fitnessNumber, fieldMessages.fitnessNo.invalid)
    .transform(val => val.toUpperCase()),

  insurancePolicyNo: z
    .string({ required_error: fieldMessages.insurancePolicyNo.required })
    .min(1, fieldMessages.insurancePolicyNo.required)
    .min(8, fieldMessages.insurancePolicyNo.tooShort)
    .max(30, 'Insurance policy number is too long (maximum 30 characters)')
    .regex(patterns.insurancePolicy, fieldMessages.insurancePolicyNo.invalid)
    .transform(val => val.toUpperCase()),

  // Security with enhanced password validation
  password: z
    .string({ required_error: fieldMessages.password.required })
    .min(1, fieldMessages.password.required)
    .min(8, fieldMessages.password.tooShort)
    .max(128, 'Password is too long (maximum 128 characters)')
    .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter (a-z)')
    .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter (A-Z)')
    .regex(/(?=.*\d)/, 'Password must contain at least one number (0-9)')
    .regex(/(?=.*[@$!%*?&])/, 'Password must contain at least one special character (@$!%*?&)')
    .refine(
      (password) => {
        // Check for common weak passwords
        const weakPasswords = [
          'password', '12345678', 'qwerty123', 'admin123', 'driver123'
        ];
        return !weakPasswords.some(weak => password.toLowerCase().includes(weak));
      },
      'Password is too common. Please choose a more secure password'
    )
    .refine(
      (password) => !/(.)\1{2,}/.test(password), // No 3+ consecutive same characters
      'Password cannot have 3 or more consecutive identical characters'
    ),

  confirmPassword: z
    .string({ required_error: fieldMessages.confirmPassword.required })
    .min(1, fieldMessages.confirmPassword.required)
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  }
);

// File validation schema
export const fileValidationSchema = z.object({
  aadhaarPhotoFront: z.instanceof(File, 'Aadhaar front photo is required'),
  aadhaarPhotoBack: z.instanceof(File, 'Aadhaar back photo is required'),
  driverSelfie: z.instanceof(File, 'Driver selfie is required'),
  drivingLicensePhoto: z.instanceof(File, 'Driving license photo is required'),
  registrationCertificatePhoto: z.instanceof(File, 'RC photo is required'),
  permitPhoto: z.instanceof(File, 'Permit photo is required'),
  fitnessCertificatePhoto: z.instanceof(File, 'Fitness certificate photo is required'),
  insurancePolicyPhoto: z.instanceof(File, 'Insurance policy photo is required')
}).refine(
  (files) => {
    // Validate file types and sizes
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    for (const [fieldName, file] of Object.entries(files)) {
      if (file) {
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`${fieldName}: Only JPG, JPEG, or PNG files are allowed`);
        }
        if (file.size > maxSize) {
          throw new Error(`${fieldName}: File size must be less than 5MB`);
        }
      }
    }
    return true;
  }
);

// Step-wise validation schemas
export const stepSchemas = {
  0: driverValidationSchema.pick({
    fullName: true,
    mobileNo: true,
    email: true,
    aadhaarNo: true
  }),
  1: driverValidationSchema.pick({
    vehicleNo: true,
    vehicleType: true,
    vehicleModel: true,
    manufacturingYear: true,
    color: true
  }),
  2: driverValidationSchema.pick({
    bankName: true,
    accountNumber: true,
    accountHolderName: true,
    ifscCode: true,
    drivingLicenseNo: true,
    permitNo: true,
    fitnessNo: true,
    insurancePolicyNo: true
  }),
  3: driverValidationSchema.pick({
    password: true,
    confirmPassword: true
  })
};

// Enhanced field-level validation function with personalized error handling
export const validateField = (fieldName, value, allValues = {}) => {
  try {
    const fieldSchema = driverValidationSchema.shape[fieldName];
    if (!fieldSchema) return null;

    fieldSchema.parse(value);

    // Special case for confirmPassword
    if (fieldName === 'confirmPassword' && allValues.password) {
      if (value !== allValues.password) {
        return {
          message: fieldMessages.confirmPassword.mismatch,
          type: 'mismatch',
          suggestion: fieldMessages.confirmPassword.suggestion
        };
      }
    }

    return null;
  } catch (error) {
    const errorMessage = error.errors?.[0]?.message || error.message;
    const errorCode = error.errors?.[0]?.code || 'custom';

    return {
      message: errorMessage,
      type: getErrorType(errorCode),
      suggestion: getPersonalizedSuggestion(fieldName, errorMessage, errorCode),
      severity: getErrorSeverity(errorCode)
    };
  }
};

// Enhanced error type classification
const getErrorType = (zodCode) => {
  switch (zodCode) {
    case 'too_small':
    case 'too_big':
      return 'length';
    case 'invalid_string':
    case 'invalid_type':
      return 'format';
    case 'custom':
      return 'validation';
    case 'invalid_email':
      return 'email';
    default:
      return 'error';
  }
};

// Get error severity for UI styling
const getErrorSeverity = (zodCode) => {
  switch (zodCode) {
    case 'too_small':
    case 'too_big':
      return 'warning';
    case 'invalid_string':
    case 'custom':
      return 'error';
    case 'required':
      return 'info';
    default:
      return 'error';
  }
};

// Personalized suggestions based on field and error context
const getPersonalizedSuggestion = (fieldName, errorMessage, errorCode) => {
  const fieldSuggestion = fieldMessages[fieldName]?.suggestion;

  // Return field-specific suggestion if available
  if (fieldSuggestion) {
    return fieldSuggestion;
  }

  // Fallback to error-code-based suggestions
  switch (errorCode) {
    case 'too_small':
      return `Please enter more characters for ${fieldName}`;
    case 'too_big':
      return `Please reduce the length of ${fieldName}`;
    case 'invalid_string':
      return `Please check the format of ${fieldName}`;
    case 'custom':
      return `Please verify the ${fieldName} value`;
    default:
      return 'Please check and correct the entered value';
  }
};

// Enhanced validation utilities
export const validationUtils = {
  // Get field-specific validation context
  getFieldContext: (fieldName) => {
    return {
      message: fieldMessages[fieldName] || {},
      suggestion: fieldMessages[fieldName]?.suggestion || 'Please check the entered value',
      required: Object.keys(fieldMessages).includes(fieldName)
    };
  },

  // Check if field has API validation
  requiresApiValidation: (fieldName) => {
    return ['mobileNo', 'aadhaarNo', 'vehicleNo', 'email', 'drivingLicenseNo'].includes(fieldName);
  },

  // Get field completion percentage
  getCompletionStatus: (fieldName, value) => {
    if (!value) return 0;

    const expectedLengths = {
      mobileNo: 10,
      aadhaarNo: 12,
      ifscCode: 11,
      vehicleNo: 10
    };

    const expectedLength = expectedLengths[fieldName];
    if (expectedLength) {
      return Math.min((value.length / expectedLength) * 100, 100);
    }

    // For other fields, consider non-empty as complete
    return value.trim().length > 0 ? 100 : 0;
  },

  // Validate field dependencies
  validateDependencies: (fieldName, value, allValues) => {
    const dependencies = {
      confirmPassword: ['password'],
      accountHolderName: ['fullName'], // Should ideally match
      vehicleModel: ['vehicleType'],
      manufacturingYear: ['vehicleType']
    };

    const deps = dependencies[fieldName];
    if (!deps) return true;

    return deps.every(dep => allValues[dep] && allValues[dep].trim().length > 0);
  }
};

export default driverValidationSchema;