/**
 * Test script to debug driver registration 500 error
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import required modules
const Driver = require('./models/Driver');
const cloudinary = require('./config/cloudinary').cloudinary;
const bcrypt = require('bcryptjs');

// Test data for driver registration
const testDriverData = {
  fullName: 'Test Driver',
  mobileNo: '9999999999',
  aadhaarNo: '123456789012',
  vehicleNo: 'TEST1234',
  vehicleType: 'auto',
  drivingLicenseNo: 'DL123456789',
  permitNo: 'PER123456',
  fitnessCertificateNo: 'FIT123456',
  insurancePolicyNo: 'INS123456',
  password: 'testpassword123',
  bankDetails: {
    accountHolderName: 'Test Driver',
    accountNumber: '1234567890',
    ifscCode: 'TEST0001234',
    bankName: 'Test Bank'
  },
  // Mock file paths (since we can't test actual file uploads easily)
  aadhaarPhotoFront: 'https://via.placeholder.com/300x200.png',
  aadhaarPhotoBack: 'https://via.placeholder.com/300x200.png',
  driverSelfie: 'https://via.placeholder.com/300x300.png',
  registrationCertificatePhoto: 'https://via.placeholder.com/300x200.png',
  drivingLicensePhoto: 'https://via.placeholder.com/300x200.png',
  permitPhoto: 'https://via.placeholder.com/300x200.png',
  fitnessCertificatePhoto: 'https://via.placeholder.com/300x200.png',
  insurancePolicyPhoto: 'https://via.placeholder.com/300x200.png'
};

async function connectDB() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected for testing');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function testCloudinaryConnection() {
  try {
    console.log('\n🔍 Testing Cloudinary connection...');
    console.log('Cloudinary config:');
    console.log(`  Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`  API Key: ${process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing'}`);
    console.log(`  API Secret: ${process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'}`);
    
    // Test connection by getting cloudinary usage info
    const result = await cloudinary.api.usage();
    console.log('✅ Cloudinary connection successful');
    console.log(`  Used credits: ${result.credits.used_percent}%`);
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection error:', error.message);
    return false;
  }
}

async function testDriverSchemaValidation() {
  try {
    console.log('\n🔍 Testing Driver schema validation...');
    
    // First, check if driver with this mobile already exists
    const existingDriver = await Driver.findOne({ mobileNo: testDriverData.mobileNo });
    if (existingDriver) {
      console.log('🧹 Removing existing test driver...');
      await Driver.deleteOne({ mobileNo: testDriverData.mobileNo });
    }
    
    // Hash password
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(testDriverData.password, salt);
    
    // Create driver data with hashed password
    const driverData = {
      ...testDriverData,
      password: hashedPassword
    };
    
    console.log('📝 Creating driver with data:');
    console.log('  Full Name:', driverData.fullName);
    console.log('  Mobile:', driverData.mobileNo);
    console.log('  Aadhaar:', driverData.aadhaarNo);
    console.log('  Vehicle:', driverData.vehicleNo, driverData.vehicleType);
    console.log('  Bank Details:', driverData.bankDetails);
    console.log('  Document Photos:', {
      aadhaarFront: !!driverData.aadhaarPhotoFront,
      aadhaarBack: !!driverData.aadhaarPhotoBack,
      selfie: !!driverData.driverSelfie,
      registration: !!driverData.registrationCertificatePhoto,
      license: !!driverData.drivingLicensePhoto,
      permit: !!driverData.permitPhoto,
      fitness: !!driverData.fitnessCertificatePhoto,
      insurance: !!driverData.insurancePolicyPhoto
    });
    
    // Create new driver
    const newDriver = new Driver(driverData);
    
    // Validate before save
    console.log('🔍 Validating driver data...');
    await newDriver.validate();
    console.log('✅ Driver data validation passed');
    
    // Save to database
    console.log('💾 Saving driver to database...');
    const savedDriver = await newDriver.save();
    console.log('✅ Driver saved successfully with ID:', savedDriver._id);
    
    // Verify driver was saved correctly
    const verifiedDriver = await Driver.findById(savedDriver._id);
    console.log('✅ Driver verification successful');
    console.log('  Saved driver name:', verifiedDriver.fullName);
    console.log('  Saved driver mobile:', verifiedDriver.mobileNo);
    console.log('  Bank details saved:', !!verifiedDriver.bankDetails);
    
    return { success: true, driver: savedDriver };
    
  } catch (error) {
    console.error('❌ Driver schema validation error:', error);
    
    if (error.name === 'ValidationError') {
      console.log('📋 Validation errors:');
      for (const field in error.errors) {
        console.log(`  ${field}: ${error.errors[field].message}`);
      }
    }
    
    return { success: false, error: error.message, validationErrors: error.errors };
  }
}

async function testDriverRegistrationEndToEnd() {
  try {
    console.log('\n🔍 Testing end-to-end driver registration...');
    
    // Simulate the controller logic
    const { registerDriver } = require('./controllers/driverController');
    
    // Create mock request object
    const mockReq = {
      body: {
        fullName: testDriverData.fullName,
        mobileNo: testDriverData.mobileNo,
        aadhaarNo: testDriverData.aadhaarNo,
        vehicleNo: testDriverData.vehicleNo,
        vehicleType: testDriverData.vehicleType,
        drivingLicenseNo: testDriverData.drivingLicenseNo,
        permitNo: testDriverData.permitNo,
        fitnessCertificateNo: testDriverData.fitnessCertificateNo,
        insurancePolicyNo: testDriverData.insurancePolicyNo,
        password: testDriverData.password,
        // Bank details as individual fields
        accountHolderName: testDriverData.bankDetails.accountHolderName,
        accountNumber: testDriverData.bankDetails.accountNumber,
        ifscCode: testDriverData.bankDetails.ifscCode,
        bankName: testDriverData.bankDetails.bankName
      },
      files: {
        aadhaarPhotoFront: [{ path: testDriverData.aadhaarPhotoFront, secure_url: testDriverData.aadhaarPhotoFront }],
        aadhaarPhotoBack: [{ path: testDriverData.aadhaarPhotoBack, secure_url: testDriverData.aadhaarPhotoBack }],
        driverSelfie: [{ path: testDriverData.driverSelfie, secure_url: testDriverData.driverSelfie }],
        registrationCertificatePhoto: [{ path: testDriverData.registrationCertificatePhoto, secure_url: testDriverData.registrationCertificatePhoto }],
        drivingLicensePhoto: [{ path: testDriverData.drivingLicensePhoto, secure_url: testDriverData.drivingLicensePhoto }],
        permitPhoto: [{ path: testDriverData.permitPhoto, secure_url: testDriverData.permitPhoto }],
        fitnessCertificatePhoto: [{ path: testDriverData.fitnessCertificatePhoto, secure_url: testDriverData.fitnessCertificatePhoto }],
        insurancePolicyPhoto: [{ path: testDriverData.insurancePolicyPhoto, secure_url: testDriverData.insurancePolicyPhoto }]
      }
    };
    
    // Mock response object
    let responseData = null;
    let statusCode = null;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return mockRes;
      },
      json: (data) => {
        responseData = data;
        return mockRes;
      }
    };
    
    console.log('📞 Calling registerDriver controller...');
    await registerDriver(mockReq, mockRes);
    
    console.log('📊 Controller response:');
    console.log('  Status Code:', statusCode);
    console.log('  Response:', responseData);
    
    if (statusCode === 201 && responseData.success) {
      console.log('✅ End-to-end registration test passed');
      return { success: true, response: responseData };
    } else {
      console.log('❌ End-to-end registration test failed');
      return { success: false, statusCode, response: responseData };
    }
    
  } catch (error) {
    console.error('❌ End-to-end registration test error:', error);
    return { success: false, error: error.message };
  }
}

async function cleanup() {
  try {
    // Remove test driver
    await Driver.deleteMany({ 
      $or: [
        { mobileNo: testDriverData.mobileNo },
        { aadhaarNo: testDriverData.aadhaarNo },
        { vehicleNo: testDriverData.vehicleNo }
      ]
    });
    console.log('🧹 Test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

async function runTests() {
  console.log('🧪 Starting driver registration debugging tests...\n');
  
  try {
    // Connect to database
    await connectDB();
    
    // Test 1: Cloudinary connection
    const cloudinaryTest = await testCloudinaryConnection();
    
    // Test 2: Schema validation
    const schemaTest = await testDriverSchemaValidation();
    
    // Test 3: End-to-end registration (if schema test passed)
    let endToEndTest = { success: false, skipped: true };
    if (schemaTest.success) {
      // Clean up first to avoid conflicts
      await cleanup();
      endToEndTest = await testDriverRegistrationEndToEnd();
    }
    
    // Summary
    console.log('\n=== TEST RESULTS SUMMARY ===');
    console.log('1. Cloudinary Connection:', cloudinaryTest ? '✅ PASSED' : '❌ FAILED');
    console.log('2. Schema Validation:', schemaTest.success ? '✅ PASSED' : '❌ FAILED');
    console.log('3. End-to-End Registration:', endToEndTest.skipped ? '⏭️ SKIPPED' : (endToEndTest.success ? '✅ PASSED' : '❌ FAILED'));
    
    if (!cloudinaryTest) {
      console.log('\n🔍 ISSUE FOUND: Cloudinary connection failed');
      console.log('  Check your Cloudinary environment variables');
    }
    
    if (!schemaTest.success) {
      console.log('\n🔍 ISSUE FOUND: Driver schema validation failed');
      console.log('  Error:', schemaTest.error);
      if (schemaTest.validationErrors) {
        console.log('  Validation errors:', Object.keys(schemaTest.validationErrors));
      }
    }
    
    if (!endToEndTest.success && !endToEndTest.skipped) {
      console.log('\n🔍 ISSUE FOUND: Registration controller failed');
      console.log('  Status:', endToEndTest.statusCode);
      console.log('  Error:', endToEndTest.response?.error || endToEndTest.error);
    }
    
    if (cloudinaryTest && schemaTest.success && endToEndTest.success) {
      console.log('\n🎉 All tests passed! Registration should be working.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the issues above.');
    }
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    await cleanup();
    mongoose.connection.close();
    console.log('🏁 Tests completed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };