require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = `http://localhost:${process.env.PORT || 5000}/api`;

// Create test image buffer
const createTestImage = () => {
  // 1x1 red pixel PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
};

async function testDriverRegistration() {
  try {
    console.log('🚗 Testing Driver Registration API\n');
    
    // Generate unique test data
    const timestamp = Date.now();
    const testData = {
      fullName: `Test Driver ${timestamp}`,
      mobileNo: `9${timestamp.toString().slice(-9)}`,
      aadhaarNo: timestamp.toString().slice(-12).padStart(12, '9'),
      vehicleNo: `DL01T${timestamp.toString().slice(-4)}`,
      vehicleType: 'auto',
      drivingLicenseNo: `DL${timestamp.toString().slice(-10)}`,
      permitNo: `PERMIT${timestamp.toString().slice(-6)}`,
      fitnessCertificateNo: `FITNESS${timestamp.toString().slice(-6)}`,
      insurancePolicyNo: `INSURANCE${timestamp.toString().slice(-6)}`,
      password: 'testPassword123',
      // Bank details as JSON string
      bankDetails: JSON.stringify({
        accountHolderName: `Test Driver ${timestamp}`,
        accountNumber: timestamp.toString().slice(-10).padStart(16, '9'),
        ifscCode: 'TEST0001234',
        bankName: 'Test Bank'
      })
    };
    
    console.log('📋 Test Data:');
    console.log('Mobile:', testData.mobileNo);
    console.log('Aadhaar:', testData.aadhaarNo);
    console.log('Vehicle:', testData.vehicleNo);
    
    // Create form data
    const form = new FormData();
    
    // Add text fields
    Object.keys(testData).forEach(key => {
      form.append(key, testData[key]);
    });
    
    // Add test images
    const testImage = createTestImage();
    const imageFields = [
      'aadhaarPhotoFront',
      'aadhaarPhotoBack',
      'driverSelfie',
      'drivingLicensePhoto',
      'registrationCertificatePhoto',
      'permitPhoto',
      'fitnessCertificatePhoto',
      'insurancePolicyPhoto'
    ];
    
    console.log('\n📸 Adding test images:');
    imageFields.forEach(field => {
      form.append(field, testImage, {
        filename: `${field}.png`,
        contentType: 'image/png'
      });
      console.log(`✅ ${field}`);
    });
    
    // Make registration request
    console.log('\n📤 Sending registration request...');
    const startTime = Date.now();
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/drivers/register`,
        form,
        {
          headers: {
            ...form.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 120000 // 2 minute timeout
        }
      );
      
      const endTime = Date.now();
      console.log(`\n✅ Registration successful! (${endTime - startTime}ms)`);
      console.log('\n📊 Response:');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Test login with the created driver
      if (response.data.success) {
        console.log('\n🔑 Testing login with created driver...');
        
        const loginResponse = await axios.post(`${API_BASE_URL}/drivers/login`, {
          mobileNo: testData.mobileNo,
          password: 'testPassword123'
        });
        
        if (loginResponse.data.success) {
          console.log('✅ Login successful!');
          console.log('Token:', loginResponse.data.token.substring(0, 20) + '...');
        } else {
          console.log('❌ Login failed:', loginResponse.data.error);
        }
      }
      
    } catch (error) {
      const endTime = Date.now();
      console.error(`\n❌ Registration failed! (${endTime - startTime}ms)`);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response:', JSON.stringify(error.response.data, null, 2));
        
        // Detailed error analysis
        if (error.response.data.validationErrors) {
          console.error('\n📋 Validation Errors:');
          Object.entries(error.response.data.validationErrors).forEach(([field, message]) => {
            console.error(`  - ${field}: ${message}`);
          });
        }
        
        if (error.response.data.missingFiles) {
          console.error('\n📁 Missing Files:');
          error.response.data.missingFiles.forEach(file => {
            console.error(`  - ${file}`);
          });
        }
        
        if (error.response.data.uploadErrors) {
          console.error('\n📤 Upload Errors:');
          error.response.data.uploadErrors.forEach(file => {
            console.error(`  - ${file}`);
          });
        }
      } else if (error.request) {
        console.error('No response received:', error.message);
        console.error('This might be a network or server connection issue.');
      } else {
        console.error('Error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Test setup error:', error.message);
  }
}

// Check if server is running
async function checkServer() {
  try {
    // Try to access the drivers endpoint
    await axios.get(`${API_BASE_URL}/drivers/metro-stations`);
    return true;
  } catch (error) {
    // If it returns 401 or any response, server is running
    if (error.response) {
      return true;
    }
    return false;
  }
}

// Main execution
(async () => {
  console.log('🔍 Checking server status...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('❌ Server is not running. Please start the server first.');
    console.log('Run: npm start or npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await testDriverRegistration();
})();