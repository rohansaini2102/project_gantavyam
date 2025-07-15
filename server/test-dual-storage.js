const { dualStorageManager } = require('./config/dualStorage');
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Dual Storage System');

// Test dual storage manager initialization
console.log('\n=== Testing Dual Storage Manager ===');
console.log('Manager initialized:', !!dualStorageManager);
console.log('Status:', dualStorageManager.getStatus());

// Test directory creation
console.log('\n=== Testing Directory Structure ===');
const { uploadsDir, driverDocsDir } = require('./config/localStorage');
console.log('Uploads directory exists:', fs.existsSync(uploadsDir));
console.log('Driver docs directory exists:', fs.existsSync(driverDocsDir));

// List all subdirectories
const subDirs = [
  'aadhaar', 'selfies', 'driving-license', 'registration', 
  'permit', 'fitness', 'insurance'
];

subDirs.forEach(subDir => {
  const dirPath = path.join(driverDocsDir, subDir);
  console.log(`  ${subDir}:`, fs.existsSync(dirPath) ? '✅' : '❌');
});

// Test storage manager methods
console.log('\n=== Testing Storage Manager Methods ===');
console.log('Cloudinary folder for aadhaar:', dualStorageManager.getCloudinaryFolder('aadhaarPhotoFront'));
console.log('Local folder for aadhaar:', dualStorageManager.getLocalFolder('aadhaarPhotoFront'));

// Test failure simulation
console.log('\n=== Testing Failure Handling ===');
console.log('Before failure simulation:', dualStorageManager.getStatus());
dualStorageManager.forceLocalStorage();
console.log('After forcing local storage:', dualStorageManager.getStatus());
dualStorageManager.resetCloudinary();
console.log('After reset:', dualStorageManager.getStatus());

console.log('\n✅ Dual storage system test completed successfully!');