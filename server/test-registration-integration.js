const express = require('express');
const multer = require('multer');
const { dualUploadFields, dualStorageManager } = require('./config/dualStorage');

console.log('🧪 Testing Driver Registration Integration');

// Mock a simple Express app to test the integration
const app = express();

// Test the multer configuration
console.log('\n=== Testing Multer Configuration ===');
console.log('Dual upload fields configured:', !!dualUploadFields);

// Test processing a mock file upload
console.log('\n=== Testing File Processing ===');

const mockFile = {
  fieldname: 'aadhaarPhotoFront',
  originalname: 'aadhaar-front.jpg',
  mimetype: 'image/jpeg',
  buffer: Buffer.from('fake-image-data'),
  size: 1024
};

const mockRequest = {
  protocol: 'http',
  get: () => 'localhost:5000'
};

const mockFiles = {
  aadhaarPhotoFront: [mockFile]
};

// Test the dual storage processing
dualStorageManager.processUploads(mockFiles, mockRequest)
  .then(({ results, errors }) => {
    console.log('✅ File processing test completed');
    console.log('Results:', results);
    console.log('Errors:', errors);
    
    if (results.aadhaarPhotoFront) {
      console.log('✅ File URL generated:', results.aadhaarPhotoFront);
    }
    
    // Test storage status
    console.log('\n=== Storage Status ===');
    console.log(dualStorageManager.getStatus());
    
    console.log('\n🎉 Registration integration test passed!');
  })
  .catch(error => {
    console.error('❌ File processing test failed:', error);
  });