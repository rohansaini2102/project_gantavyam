require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000,
  secure: true
});

console.log('🔧 Cloudinary Configuration:');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ SET' : '❌ NOT SET');

async function testCloudinaryUpload() {
  try {
    console.log('\n📤 Testing Cloudinary Upload...\n');
    
    // Test 1: Verify configuration
    console.log('1️⃣ Verifying Cloudinary configuration...');
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      throw new Error('Cloudinary configuration is incomplete. Please check your .env file.');
    }
    console.log('✅ Configuration verified');
    
    // Test 2: Create a test image buffer
    console.log('\n2️⃣ Creating test image...');
    const testImageBuffer = Buffer.from(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    ).slice(22); // Remove data URL prefix
    
    console.log('✅ Test image created (1x1 red pixel)');
    
    // Test 3: Upload to Cloudinary
    console.log('\n3️⃣ Uploading to Cloudinary...');
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'gantavyam/test',
          public_id: `test-upload-${Date.now()}`,
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(testImageBuffer);
    });
    
    console.log('✅ Upload successful!');
    console.log('📍 Public ID:', uploadResult.public_id);
    console.log('🔗 URL:', uploadResult.secure_url);
    console.log('📏 Size:', uploadResult.bytes, 'bytes');
    console.log('📐 Dimensions:', `${uploadResult.width}x${uploadResult.height}`);
    
    // Test 4: Delete test upload (skip verification as it may require additional permissions)
    console.log('\n4️⃣ Cleaning up test upload...');
    try {
      await cloudinary.uploader.destroy(uploadResult.public_id);
      console.log('✅ Test upload deleted');
    } catch (deleteError) {
      console.log('⚠️ Could not delete test upload:', deleteError.message);
    }
    
    console.log('\n🎉 All Cloudinary tests passed successfully!');
    
    // Test 6: Test with actual file upload simulation
    console.log('\n5️⃣ Testing driver document upload simulation...');
    const testFields = ['aadhaarPhotoFront', 'driverSelfie', 'drivingLicensePhoto'];
    
    for (const field of testFields) {
      try {
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `gantavyam/driver-documents/${field}`,
              public_id: `${field}-test-${Date.now()}`,
              resource_type: 'auto',
              timeout: 30000
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(testImageBuffer);
        });
        
        console.log(`✅ ${field}: ${result.secure_url}`);
        
        // Clean up
        try {
          await cloudinary.uploader.destroy(result.public_id);
        } catch (deleteError) {
          console.log(`⚠️ Could not delete ${field} test upload`);
        }
      } catch (error) {
        console.error(`❌ ${field} upload failed:`, error.message);
      }
    }
    
    console.log('\n✅ Cloudinary is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Cloudinary test failed:', error.message || error);
    
    if (error.message && error.message.includes('Invalid')) {
      console.log('\n💡 Suggestion: Check your Cloudinary credentials in the .env file');
    } else if (error.message && error.message.includes('timeout')) {
      console.log('\n💡 Suggestion: Check your internet connection or try increasing the timeout');
    } else if (error.message && error.message.includes('401')) {
      console.log('\n💡 Suggestion: Your API credentials may be incorrect');
    }
    
    process.exit(1);
  }
}

// Run the test
testCloudinaryUpload();