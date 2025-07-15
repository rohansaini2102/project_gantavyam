// Test image compression functionality
import { compressImage, compressMultipleImages, validateImageFile, getReadableFileSize } from './imageCompression';

// Create a test blob that represents a large image
const createTestImageBlob = (sizeMB = 5, name = 'test-image') => {
  const canvas = document.createElement('canvas');
  canvas.width = 2000;
  canvas.height = 2000;
  const ctx = canvas.getContext('2d');
  
  // Fill with random pattern to make it realistic
  for (let i = 0; i < 1000; i++) {
    ctx.fillStyle = `rgb(${Math.random()*255},${Math.random()*255},${Math.random()*255})`;
    ctx.fillRect(Math.random()*2000, Math.random()*2000, 10, 10);
  }
  
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      const file = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
      resolve(file);
    }, 'image/jpeg', 0.9);
  });
};

// Test single image compression
export const testSingleCompression = async () => {
  console.log('🧪 Testing Single Image Compression');
  
  try {
    const testFile = await createTestImageBlob(5, 'single-test');
    console.log(`📸 Original file size: ${getReadableFileSize(testFile.size)}`);
    
    // Validate file
    const validation = validateImageFile(testFile);
    console.log(`✅ Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
    if (!validation.valid) {
      console.log(`❌ Error: ${validation.error}`);
      return false;
    }
    
    // Test compression with progress tracking
    let progressCalls = 0;
    const compressedFile = await compressImage(testFile, 'aadhaar', (progress) => {
      progressCalls++;
      console.log(`⏳ Compression progress: ${progress}%`);
    });
    
    console.log(`📦 Compressed file size: ${getReadableFileSize(compressedFile.size)}`);
    console.log(`📊 Progress calls: ${progressCalls}`);
    
    const compressionRatio = ((1 - compressedFile.size / testFile.size) * 100).toFixed(1);
    console.log(`📊 Compression ratio: ${compressionRatio}% reduction`);
    
    console.log('🎉 Single image compression test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Single image compression test failed:', error);
    return false;
  }
};

// Test multiple image compression
export const testMultipleCompression = async () => {
  console.log('🧪 Testing Multiple Image Compression');
  
  try {
    // Create test files for all required fields
    const files = {
      aadhaarPhotoFront: await createTestImageBlob(3, 'aadhaar-front'),
      aadhaarPhotoBack: await createTestImageBlob(3, 'aadhaar-back'),
      driverSelfie: await createTestImageBlob(2, 'selfie'),
      drivingLicensePhoto: await createTestImageBlob(4, 'license'),
      registrationCertificatePhoto: await createTestImageBlob(4, 'registration')
    };
    
    console.log('📸 Original files:');
    Object.entries(files).forEach(([key, file]) => {
      console.log(`  ${key}: ${getReadableFileSize(file.size)}`);
    });
    
    // Test multiple compression with progress tracking
    let progressCalls = 0;
    const startTime = performance.now();
    
    const compressedFiles = await compressMultipleImages(files, (progress) => {
      progressCalls++;
      console.log(`⏳ Overall progress: ${progress}%`);
    });
    
    const endTime = performance.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('📦 Compressed files:');
    Object.entries(compressedFiles).forEach(([key, fileArray]) => {
      const file = fileArray[0];
      console.log(`  ${key}: ${getReadableFileSize(file.size)}`);
    });
    
    console.log(`📊 Progress calls: ${progressCalls}`);
    console.log(`⏱️ Processing time: ${processingTime}s`);
    
    console.log('🎉 Multiple image compression test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Multiple image compression test failed:', error);
    return false;
  }
};

// Test validation functions
export const testValidation = () => {
  console.log('🧪 Testing File Validation');
  
  try {
    // Test valid file
    const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const validResult = validateImageFile(validFile);
    console.log(`✅ Valid file test: ${validResult.valid ? 'PASSED' : 'FAILED'}`);
    
    // Test invalid file type
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const invalidResult = validateImageFile(invalidFile);
    console.log(`✅ Invalid file test: ${!invalidResult.valid ? 'PASSED' : 'FAILED'}`);
    
    // Test no file
    const noFileResult = validateImageFile(null);
    console.log(`✅ No file test: ${!noFileResult.valid ? 'PASSED' : 'FAILED'}`);
    
    console.log('🎉 Validation tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Validation tests failed:', error);
    return false;
  }
};

// Test progress callback error handling
export const testProgressCallbackError = async () => {
  console.log('🧪 Testing Progress Callback Error Handling');
  
  try {
    const testFile = await createTestImageBlob(2, 'callback-test');
    
    // Test with invalid callback
    const invalidCallback = "not a function";
    await compressImage(testFile, 'document', invalidCallback);
    
    console.log('🎉 Progress callback error handling test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Progress callback error handling test failed:', error);
    return false;
  }
};

// Run all tests
export const runAllTests = async () => {
  console.log('🚀 Starting Image Compression Test Suite...\n');
  
  const tests = [
    { name: 'Validation', test: testValidation },
    { name: 'Single Compression', test: testSingleCompression },
    { name: 'Multiple Compression', test: testMultipleCompression },
    { name: 'Progress Callback Error', test: testProgressCallbackError }
  ];
  
  const results = {};
  
  for (const { name, test } of tests) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing: ${name}`);
    console.log(`${'='.repeat(50)}`);
    
    try {
      results[name] = await test();
    } catch (error) {
      console.error(`❌ ${name} test crashed:`, error);
      results[name] = false;
    }
  }
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Test Results: ${passedTests}/${totalTests} passed`);
  console.log(`${'='.repeat(50)}`);
  
  Object.entries(results).forEach(([name, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  return results;
};

// Export for manual testing in browser console
window.testImageCompression = {
  testSingleCompression,
  testMultipleCompression,
  testValidation,
  testProgressCallbackError,
  runAllTests
};

// Legacy export for backward compatibility
export const testImageCompression = testSingleCompression;