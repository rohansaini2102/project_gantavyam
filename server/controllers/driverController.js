// controllers/driverController.js
const Driver = require('../models/Driver');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const path = require('path');
const mongoose = require('mongoose');

// @desc    Register new driver (by driver signup)
// @route   POST /api/drivers/register
// @access  Public
exports.registerDriver = async (req, res) => {
  try {
    console.log('[Driver Registration] Processing registration request');
    console.log('[Driver Registration] Request body keys:', Object.keys(req.body));
    console.log('[Driver Registration] Request files keys:', req.files ? Object.keys(req.files) : 'No files');
    console.log('[Driver Registration] Full request body:', JSON.stringify(req.body, null, 2));
    
    // Check if files exist in the request
    if (!req.files) {
      console.error('[Driver Registration] No files provided');
      return res.status(400).json({
        success: false,
        error: 'Please upload all required documents'
      });
    }

    // Check for missing files and log them
    const requiredFields = [
      // 'aadhaarPhoto',
      // 'registrationCertificatePhoto',
      // 'drivingLicensePhoto',
      // 'permitPhoto',
      // 'fitnessCertificatePhoto',
      // 'insurancePolicyPhoto'
    ];
    
    const missingFiles = [];
    
    requiredFields.forEach(field => {
      if (!req.files[field] || !req.files[field][0]) {
        console.error(`[Driver Registration] Missing file: ${field}`);
        missingFiles.push(field);
      }
    });
    
    if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required files: ${missingFiles.join(', ')}`
      });
    }

    // Check if driver with mobile number, Aadhaar, or vehicle number already exists
    const existingDriver = await Driver.findOne({
      $or: [
        { mobileNo: req.body.mobileNo },
        { aadhaarNo: req.body.aadhaarNo },
        { vehicleNo: req.body.vehicleNo }
      ]
    });

    if (existingDriver) {
      console.error(`[Driver Registration] Driver already exists with one of the provided details:`, {
        mobileNo: req.body.mobileNo,
        aadhaarNo: req.body.aadhaarNo,
        vehicleNo: req.body.vehicleNo
      });
      return res.status(400).json({
        success: false,
        error: 'Driver with this mobile number, Aadhaar number, or vehicle number already exists'
      });
    }

    // Extract file URLs from dual storage results
    const filePaths = {};
    const uploadErrors = req.uploadErrors || [];
    
    console.log('[Driver Registration] Upload Results Debug:');
    console.log('req.uploadResults:', req.uploadResults);
    console.log('req.uploadErrors:', req.uploadErrors);
    console.log('req.files keys:', req.files ? Object.keys(req.files) : 'No files');
    
    if (req.uploadResults && Object.keys(req.uploadResults).length > 0) {
      console.log('[Driver Registration] Using dual storage results');
      Object.keys(req.uploadResults).forEach(fieldName => {
        filePaths[fieldName] = req.uploadResults[fieldName];
        console.log(`[Driver Registration] Dual storage URL for ${fieldName}:`, filePaths[fieldName]);
      });
    } else {
      console.log('[Driver Registration] Using fallback Cloudinary processing');
      // Fallback to old Cloudinary handling for backward compatibility
      if (req.files) {
        Object.keys(req.files).forEach(fieldName => {
          if (req.files[fieldName] && req.files[fieldName][0]) {
            try {
              filePaths[fieldName] = req.files[fieldName][0].path || req.files[fieldName][0].secure_url;
              console.log(`[Driver Registration] Legacy Cloudinary URL for ${fieldName}:`, filePaths[fieldName]);
              
              if (!filePaths[fieldName] || filePaths[fieldName] === 'undefined') {
                uploadErrors.push(fieldName);
                console.warn(`[Driver Registration] Upload failed for ${fieldName}, no valid URL found`);
              }
            } catch (uploadError) {
              console.error(`[Driver Registration] Error processing upload for ${fieldName}:`, uploadError);
              uploadErrors.push(fieldName);
            }
          } else {
            console.warn(`[Driver Registration] No file found for ${fieldName}`);
            uploadErrors.push(fieldName);
          }
        });
      }
    }
    
    console.log('[Driver Registration] Final filePaths object:', filePaths);
    console.log('[Driver Registration] Upload errors:', uploadErrors);
    
    // Check if we have required files
    const requiredFilesList = ['aadhaarPhotoFront', 'aadhaarPhotoBack', 'driverSelfie', 'registrationCertificatePhoto', 'drivingLicensePhoto'];
    const missingRequiredFiles = requiredFilesList.filter(field => !filePaths[field] || filePaths[field].startsWith('UPLOAD_FAILED'));
    
    if (missingRequiredFiles.length > 0) {
      console.error(`[Driver Registration] Missing required files: ${missingRequiredFiles.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: `Missing required files: ${missingRequiredFiles.join(', ')}`,
        missingFiles: missingRequiredFiles,
        uploadErrors: uploadErrors
      });
    }
    
    // Log upload status
    if (uploadErrors.length > 0) {
      console.warn(`[Driver Registration] ${uploadErrors.length} file uploads failed:`, uploadErrors);
    } else {
      console.log('[Driver Registration] All files uploaded successfully');
    }

    // Process bank details
    let bankDetails;
    if (req.body.bankDetails && typeof req.body.bankDetails === 'string') {
      // Parse from JSON string
      try {
        bankDetails = JSON.parse(req.body.bankDetails);
        console.log('[Driver Registration] Parsed bank details from JSON');
      } catch (err) {
        console.error('[Driver Registration] Failed to parse bank details JSON:', err);
        return res.status(400).json({
          success: false,
          error: 'Invalid bank details format'
        });
      }
    } else {
      // Use individual fields
      bankDetails = {
        accountHolderName: req.body.accountHolderName,
        accountNumber: req.body.accountNumber,
        ifscCode: req.body.ifscCode,
        bankName: req.body.bankName
      };
      console.log('[Driver Registration] Using individual bank detail fields');
    }

    // Check if all bank details are present
    const missingBankDetails = [];
    ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName'].forEach(field => {
      if (!bankDetails[field]) {
        missingBankDetails.push(field);
      }
    });

    if (missingBankDetails.length > 0) {
      console.error(`[Driver Registration] Missing bank details: ${missingBankDetails.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: `Missing bank details: ${missingBankDetails.join(', ')}`
      });
    }

    // Hash the password
    let hashedPassword;
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(req.body.password, salt);
      console.log('[Driver Registration] Password hashed successfully');
    } else {
      console.error('[Driver Registration] No password provided');
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Create driver object
    const driverData = {
      fullName: req.body.fullName,
      mobileNo: req.body.mobileNo,
      aadhaarNo: req.body.aadhaarNo,
      vehicleNo: req.body.vehicleNo,
      aadhaarPhotoFront: filePaths.aadhaarPhotoFront,
      aadhaarPhotoBack: filePaths.aadhaarPhotoBack,
      driverSelfie: filePaths.driverSelfie,
      registrationCertificatePhoto: filePaths.registrationCertificatePhoto,
      bankDetails: bankDetails,
      drivingLicenseNo: req.body.drivingLicenseNo,
      drivingLicensePhoto: filePaths.drivingLicensePhoto,
      permitNo: req.body.permitNo,
      permitPhoto: filePaths.permitPhoto,
      fitnessCertificateNo: req.body.fitnessCertificateNo,
      fitnessCertificatePhoto: filePaths.fitnessCertificatePhoto,
      insurancePolicyNo: req.body.insurancePolicyNo,
      insurancePolicyPhoto: filePaths.insurancePolicyPhoto,
      password: hashedPassword,
      isVerified: (req.user && req.user.role === 'admin') ? true : false
    };

    // Create and save new driver
    console.log('[Driver Registration] Creating driver with data:', JSON.stringify(driverData, null, 2));
    const newDriver = new Driver(driverData);
    
    console.log('[Driver Registration] Validating driver data...');
    await newDriver.validate();
    console.log('[Driver Registration] Validation passed, saving to database...');
    
    const savedDriver = await newDriver.save();
    console.log('[Driver Registration] Driver saved successfully with ID:', savedDriver._id);
    
    console.log(`[Driver Registration] Driver registered successfully with ID: ${savedDriver._id}`);
    
    // Print detailed driver information to the console
    console.log('\n========== NEW DRIVER REGISTERED ==========');
    console.log(`ID: ${savedDriver._id}`);
    console.log(`Name: ${savedDriver.fullName}`);
    console.log(`Mobile: ${savedDriver.mobileNo}`);
    console.log(`Aadhaar: ${savedDriver.aadhaarNo}`);
    console.log(`Vehicle: ${savedDriver.vehicleNo}`);
    console.log('Bank Details:');
    console.log(`  Account Holder: ${savedDriver.bankDetails.accountHolderName}`);
    console.log(`  Account Number: ${savedDriver.bankDetails.accountNumber}`);
    console.log(`  IFSC Code: ${savedDriver.bankDetails.ifscCode}`);
    console.log(`  Bank Name: ${savedDriver.bankDetails.bankName}`);
    console.log('License Information:');
    console.log(`  Driving License: ${savedDriver.drivingLicenseNo}`);
    console.log(`  Permit Number: ${savedDriver.permitNo}`);
    console.log(`  Fitness Certificate: ${savedDriver.fitnessCertificateNo}`);
    console.log(`  Insurance Policy: ${savedDriver.insurancePolicyNo}`);
    console.log('Document Paths:');
    console.log(`  Aadhaar Photo: ${savedDriver.aadhaarPhoto}`);
    console.log(`  Registration Certificate: ${savedDriver.registrationCertificatePhoto}`);
    console.log(`  Driving License Photo: ${savedDriver.drivingLicensePhoto}`);
    console.log(`  Permit Photo: ${savedDriver.permitPhoto}`);
    console.log(`  Fitness Certificate Photo: ${savedDriver.fitnessCertificatePhoto}`);
    console.log(`  Insurance Policy Photo: ${savedDriver.insurancePolicyPhoto}`);
    console.log('Registration Date:', savedDriver.registrationDate);
    console.log('Verification Status:', savedDriver.isVerified ? 'Verified' : 'Not Verified');
    console.log('==========================================\n');
    
    // Log MongoDB collection data
    console.log('[MONGODB] Checking driver collection...');
    try {
      // Query to verify data is in the database
      const allDrivers = await Driver.find({}).select('-password');
      console.log(`[MONGODB] Total drivers in database: ${allDrivers.length}`);
      console.log('[MONGODB] Most recent drivers:');
      
      // Get the 3 most recent drivers
      const recentDrivers = await Driver.find({})
        .sort({ registrationDate: -1 })
        .limit(3)
        .select('_id fullName mobileNo registrationDate');
      
      recentDrivers.forEach((driver, index) => {
        console.log(`[MONGODB] ${index + 1}. ID: ${driver._id}, Name: ${driver.fullName}, Mobile: ${driver.mobileNo}, Registered: ${driver.registrationDate}`);
      });
    } catch (dbError) {
      console.error('[MONGODB] Error querying database:', dbError);
    }

    // Generate JWT token
    const config = require('../config/config');
    const token = jwt.sign(
      {
        id: savedDriver._id,
        role: 'driver'
      },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    // Notify admins of new driver registration
    try {
      const { notifyAdmins } = require('../socket');
      notifyAdmins('driverRegistered', {
        driverId: savedDriver._id,
        fullName: savedDriver.fullName,
        mobileNo: savedDriver.mobileNo,
        vehicleType: savedDriver.vehicleType,
        vehicleNo: savedDriver.vehicleNo,
        registeredAt: new Date().toISOString()
      });
    } catch (socketError) {
      console.warn('[Driver Registration] Failed to notify admins:', socketError.message);
    }

    res.status(201).json({
      success: true,
      message: uploadErrors.length > 0 
        ? `Driver registered successfully. Note: ${uploadErrors.length} file uploads failed and will need to be re-uploaded later.`
        : 'Driver registered successfully',
      token,
      driver: {
        id: savedDriver._id,
        fullName: savedDriver.fullName,
        mobileNo: savedDriver.mobileNo,
        role: 'driver'
      },
      uploadStatus: {
        totalFiles: Object.keys(req.files || {}).length,
        successfulUploads: Object.keys(req.files || {}).length - uploadErrors.length,
        failedUploads: uploadErrors.length,
        failedFiles: uploadErrors.length > 0 ? uploadErrors : undefined
      }
    });
    
  } catch (error) {
    console.error('[Driver Registration] ERROR:', error);
    console.error('[Driver Registration] Error stack:', error.stack);
    console.error('[Driver Registration] Error name:', error.name);
    console.error('[Driver Registration] Error code:', error.code);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      console.log('[Driver Registration] Mongoose validation error detected');
      const validationErrors = {};
      
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
        console.log(`[Driver Registration] Validation error for ${field}: ${error.errors[field].message}`);
      }
      
      console.log('[Driver Registration] All validation errors:', JSON.stringify(validationErrors, null, 2));
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      console.log('[Driver Registration] Duplicate key error detected');
      const field = Object.keys(error.keyValue)[0];
      console.log('[Driver Registration] Duplicate field:', field, 'Value:', error.keyValue[field]);
      return res.status(400).json({
        success: false,
        error: `Driver with this ${field} already exists`
      });
    }
    
    // Handle Cloudinary and network errors
    if (error.message && (error.message.includes('cloudinary') || 
                         error.code === 'ETIMEDOUT' || 
                         error.code === 'ENETUNREACH' ||
                         error.code === 'ECONNRESET' ||
                         error.message.includes('timeout'))) {
      console.log('[Driver Registration] Network/Cloudinary error detected:', {
        message: error.message,
        code: error.code,
        address: error.address,
        port: error.port
      });
      return res.status(500).json({
        success: false,
        error: 'File upload failed due to network connectivity issues. Please check your internet connection and try again.',
        code: 'UPLOAD_NETWORK_ERROR'
      });
    }
    
    // Handle database connection errors
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      console.log('[Driver Registration] Database error detected');
      return res.status(500).json({
        success: false,
        error: 'Database connection error. Please try again.'
      });
    }
    
    console.log('[Driver Registration] Unhandled error type, returning generic 500');
    res.status(500).json({
      success: false,
      error: 'Server error during driver registration',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Driver login
// @route   POST /api/drivers/login
// @access  Public
exports.loginDriver = async (req, res) => {
  try {
    const { mobileNo, password } = req.body;
    
    console.log(`[Driver Login] Login attempt for mobile: ${mobileNo}`);

    // Validate input
    if (!mobileNo || !password) {
      console.error('[Driver Login] Missing mobile number or password');
      return res.status(400).json({
        success: false,
        error: 'Please provide mobile number and password'
      });
    }
    
    // Find driver by mobile number
    const driver = await Driver.findOne({ mobileNo }).select('+password');
    
    // Check if driver exists
    if (!driver) {
      console.error(`[Driver Login] Driver with mobile ${mobileNo} not found`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    console.log(`[Driver Login] Driver found: ${driver._id}, ${driver.fullName}`);

    // Check if password matches
    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      console.error(`[Driver Login] Password mismatch for driver with mobile ${mobileNo}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Check if driver is verified
    if (!driver.isVerified) {
      console.error(`[Driver Login] Driver ${driver._id} is not verified`);
      return res.status(403).json({
        success: false,
        error: 'Your profile is not verified yet. Please wait for admin approval.'
      });
    }
    
    console.log(`[Driver Login] Password match successful for driver ${driver._id}`);

    // Create token
    const token = jwt.sign(
      {
        id: driver._id,
        role: 'driver'
      },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
    
    console.log(`[Driver Login] Login successful for driver ${driver._id}, token generated`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        mobileNo: driver.mobileNo,
        isVerified: driver.isVerified,
        role: 'driver'
      }
    });
  } catch (error) {
    console.error('[Driver Login] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

// @desc    Get driver profile
// @route   GET /api/drivers/profile
// @access  Private
exports.getDriverProfile = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.id).select('-password');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error('Get driver profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching driver profile'
    });
  }
};

// @desc    Update driver location
// @route   PUT /api/drivers/location
// @access  Private
exports.updateDriverLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Please provide latitude and longitude'
      });
    }

    const driver = await Driver.findByIdAndUpdate(
      req.driver.id,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
          lastUpdated: Date.now()
        }
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: driver.location
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating location'
    });
  }
};

// @desc    Reset driver password
// @route   POST /api/drivers/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { mobileNo, newPassword } = req.body;
    
    console.log(`[Password Reset] Attempt for mobile: ${mobileNo}`);
    
    if (!mobileNo || !newPassword) {
      console.error('[Password Reset] Missing mobile number or new password');
      return res.status(400).json({
        success: false,
        error: 'Please provide mobile number and new password'
      });
    }
    
    // Find driver by mobile number
    const driver = await Driver.findOne({ mobileNo });
    
    if (!driver) {
      console.error(`[Password Reset] Driver with mobile ${mobileNo} not found`);
      return res.status(404).json({
        success: false,
        error: 'No driver found with this mobile number'
      });
    }
    
    console.log(`[Password Reset] Driver found: ${driver._id}, ${driver.fullName}`);

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    driver.password = hashedPassword;
    await driver.save({ validateModifiedOnly: true });
    
    console.log(`[Password Reset] Password updated successfully for driver ${driver._id}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('[Password Reset] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
};

// Utility function to print database statistics
exports.printDriverStats = async () => {
  try {
    const totalCount = await Driver.countDocuments();
    console.log(`\n[DRIVER STATISTICS] Total drivers in database: ${totalCount}`);
    
    if (totalCount > 0) {
      // Get recent drivers
      const recentDrivers = await Driver.find()
        .sort({ registrationDate: -1 })
        .limit(5)
        .select('_id fullName mobileNo registrationDate');
      
      console.log('[DRIVER STATISTICS] 5 most recent drivers:');
      recentDrivers.forEach((driver, idx) => {
        console.log(`  ${idx+1}. ${driver.fullName} (${driver.mobileNo}) - Registered: ${driver.registrationDate}`);
      });
      
      // Get verified vs unverified count
      const verifiedCount = await Driver.countDocuments({ isVerified: true });
      console.log(`[DRIVER STATISTICS] Verified: ${verifiedCount}/${totalCount} (${Math.round(verifiedCount/totalCount*100)}%)`);
    }
    
    console.log('[DRIVER STATISTICS] Database connection: ' + (mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'));
  } catch (error) {
    console.error('[DRIVER STATISTICS] Error getting driver stats:', error);
  }
};