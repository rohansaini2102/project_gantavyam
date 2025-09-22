// Auto-formatting utilities for different field types

export const formatters = {
  // Mobile number formatter
  mobileNo: (value) => {
    // Remove all non-digits
    let cleaned = value.replace(/\D/g, '');

    // Remove common prefixes
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Limit to 10 digits
    return cleaned.substring(0, 10);
  },

  // Aadhaar number formatter
  aadhaarNo: (value) => {
    // Remove all non-digits and limit to 12
    return value.replace(/\D/g, '').substring(0, 12);
  },

  // Vehicle number formatter
  vehicleNo: (value) => {
    // Remove spaces and convert to uppercase
    let cleaned = value.replace(/\s/g, '').toUpperCase();

    // Remove any non-alphanumeric characters except hyphens
    cleaned = cleaned.replace(/[^A-Z0-9-]/g, '');

    return cleaned;
  },

  // Name formatter (capitalize first letter of each word)
  name: (value) => {
    return value
      .replace(/[^a-zA-Z\s.'-]/g, '') // Only letters, spaces, dots, apostrophes, hyphens
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\b\w/g, char => char.toUpperCase()); // Title case
  },

  // IFSC code formatter
  ifscCode: (value) => {
    return value
      .replace(/[^A-Z0-9]/gi, '') // Only alphanumeric
      .toUpperCase()
      .substring(0, 11); // Limit to 11 characters
  },

  // Account number formatter
  accountNumber: (value) => {
    return value.replace(/\D/g, ''); // Only digits
  },

  // PAN card formatter
  panCard: (value) => {
    return value
      .replace(/[^A-Z0-9]/gi, '') // Only alphanumeric
      .toUpperCase()
      .substring(0, 10); // Limit to 10 characters
  },

  // PIN code formatter
  pinCode: (value) => {
    return value.replace(/\D/g, '').substring(0, 6); // Only digits, limit to 6
  },

  // License number formatter
  licenseNo: (value) => {
    return value
      .replace(/[^A-Z0-9]/gi, '') // Only alphanumeric
      .toUpperCase()
      .substring(0, 20); // Reasonable limit
  },

  // Year formatter
  year: (value) => {
    return value.replace(/\D/g, '').substring(0, 4); // Only digits, limit to 4
  },

  // Currency formatter (for amounts)
  currency: (value) => {
    // Remove all non-digits and decimal points
    let cleaned = value.replace(/[^\d.]/g, '');

    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      cleaned = parts[0] + '.' + parts[1].substring(0, 2);
    }

    return cleaned;
  },

  // Phone number formatter with formatting
  phoneFormatted: (value) => {
    const cleaned = formatters.mobileNo(value);

    // Format as (XXX) XXX-XXXX
    if (cleaned.length >= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length >= 3) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return cleaned;
    }
  },

  // Aadhaar with formatting
  aadhaarFormatted: (value) => {
    const cleaned = formatters.aadhaarNo(value);

    // Format as XXXX XXXX XXXX
    if (cleaned.length >= 8) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
    } else if (cleaned.length >= 4) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    } else {
      return cleaned;
    }
  },

  // Vehicle number with formatting
  vehicleFormatted: (value) => {
    const cleaned = formatters.vehicleNo(value);

    // Format as XX00XX0000 -> XX-00-XX-0000
    if (cleaned.match(/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/)) {
      const match = cleaned.match(/^([A-Z]{2})(\d{2})([A-Z]{1,2})(\d{4})$/);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}-${match[4]}`;
      }
    }

    return cleaned;
  }
};

// Smart paste detection and formatting
export const smartPaste = (fieldName, pastedValue) => {
  const formatMap = {
    mobileNo: formatters.mobileNo,
    aadhaarNo: formatters.aadhaarNo,
    vehicleNo: formatters.vehicleNo,
    fullName: formatters.name,
    accountHolderName: formatters.name,
    ifscCode: formatters.ifscCode,
    accountNumber: formatters.accountNumber,
    panCard: formatters.panCard,
    pinCode: formatters.pinCode,
    drivingLicenseNo: formatters.licenseNo,
    permitNo: formatters.licenseNo,
    fitnessNo: formatters.licenseNo,
    insurancePolicyNo: formatters.licenseNo,
    manufacturingYear: formatters.year
  };

  const formatter = formatMap[fieldName];
  return formatter ? formatter(pastedValue) : pastedValue;
};

// Input masks for real-time formatting
export const inputMasks = {
  mobile: {
    pattern: /^\d{0,10}$/,
    placeholder: '9876543210',
    format: formatters.phoneFormatted
  },

  aadhaar: {
    pattern: /^\d{0,12}$/,
    placeholder: '123456789012',
    format: formatters.aadhaarFormatted
  },

  vehicle: {
    pattern: /^[A-Z0-9]{0,10}$/,
    placeholder: 'MH01AB1234',
    format: formatters.vehicleFormatted
  },

  ifsc: {
    pattern: /^[A-Z0-9]{0,11}$/,
    placeholder: 'SBIN0001234',
    format: (value) => value.toUpperCase()
  },

  pan: {
    pattern: /^[A-Z0-9]{0,10}$/,
    placeholder: 'ABCDE1234F',
    format: (value) => value.toUpperCase()
  },

  pin: {
    pattern: /^\d{0,6}$/,
    placeholder: '400001',
    format: (value) => value
  }
};

// Validation helpers
export const validationHelpers = {
  // Check if value matches expected pattern
  isValidFormat: (fieldName, value) => {
    const patterns = {
      mobileNo: /^[6-9]\d{9}$/,
      aadhaarNo: /^\d{12}$/,
      vehicleNo: /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/,
      ifscCode: /^[A-Z]{4}0[A-Z0-9]{6}$/,
      panCard: /^[A-Z]{5}\d{4}[A-Z]$/,
      pinCode: /^\d{6}$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    };

    const pattern = patterns[fieldName];
    return pattern ? pattern.test(value) : true;
  },

  // Get completion percentage
  getCompletionPercentage: (fieldName, value) => {
    const expectedLengths = {
      mobileNo: 10,
      aadhaarNo: 12,
      vehicleNo: 10,
      ifscCode: 11,
      panCard: 10,
      pinCode: 6
    };

    const expectedLength = expectedLengths[fieldName];
    if (!expectedLength || !value) return 0;

    return Math.min((value.length / expectedLength) * 100, 100);
  },

  // Generate helpful suggestions
  getSuggestion: (fieldName, value, error) => {
    const suggestions = {
      mobileNo: {
        tooShort: `Add ${10 - (value?.length || 0)} more digits`,
        invalid: 'Must start with 6, 7, 8, or 9',
        empty: 'Enter your 10-digit mobile number'
      },
      aadhaarNo: {
        tooShort: `Add ${12 - (value?.length || 0)} more digits`,
        invalid: 'Must be exactly 12 digits',
        empty: 'Enter your 12-digit Aadhaar number'
      },
      vehicleNo: {
        tooShort: 'Enter complete vehicle number',
        invalid: 'Format: STATE + DISTRICT + SERIES + NUMBER',
        empty: 'Enter your vehicle registration number'
      },
      ifscCode: {
        tooShort: `Add ${11 - (value?.length || 0)} more characters`,
        invalid: 'Format: BANK + 0 + BRANCH (e.g., SBIN0001234)',
        empty: 'Enter your bank IFSC code'
      }
    };

    const fieldSuggestions = suggestions[fieldName];
    if (!fieldSuggestions) return null;

    if (!value) return fieldSuggestions.empty;
    if (error?.type === 'format') return fieldSuggestions.invalid;
    if (error?.type === 'length') return fieldSuggestions.tooShort;

    return null;
  }
};

// Advanced formatting options
export const advancedFormatters = {
  // Format currency with Indian numbering system
  indianCurrency: (amount) => {
    if (!amount) return '';

    const num = parseFloat(amount.toString().replace(/[^\d.-]/g, ''));
    if (isNaN(num)) return '';

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  },

  // Format date in Indian format
  indianDate: (date) => {
    if (!date) return '';

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  },

  // Format time in 12-hour format
  time12Hour: (time) => {
    if (!time) return '';

    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(`2000-01-01T${time}`));
  }
};

export default formatters;