// scripts/addTestDrivers.js
const mongoose = require('mongoose');
const Driver = require('../models/Driver');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/gt3-transport';
    await mongoose.connect(mongoUrl);
    console.log('MongoDB connected to:', mongoUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test data for validation
const testDrivers = [
  {
    fullName: 'Test Driver One',
    mobileNo: '9876543210',
    email: 'test1@example.com',
    aadhaarNo: '123456789012',
    vehicleNo: 'MH01AB1234',
    drivingLicenseNo: 'MH0120110012345',
    aadhaarPhotoFront: 'test-front.jpg',
    aadhaarPhotoBack: 'test-back.jpg',
    driverSelfie: 'test-selfie.jpg',
    registrationCertificatePhoto: 'test-rc.jpg',
    drivingLicensePhoto: 'test-dl.jpg',
    permitPhoto: 'test-permit.jpg',
    fitnessCertificatePhoto: 'test-fitness.jpg',
    insurancePolicyPhoto: 'test-insurance.jpg',
    bankDetails: {
      bankName: 'Test Bank',
      accountNumber: '1234567890',
      accountHolderName: 'Test Driver One',
      ifscCode: 'SBIN0001234'
    },
    permitNo: 'TEST001',
    fitnessCertificateNo: 'FIT001',
    insurancePolicyNo: 'INS001',
    password: 'Test@123'
  },
  {
    fullName: 'Test Driver Two',
    mobileNo: '8765432109',
    email: 'test2@example.com',
    aadhaarNo: '987654321098',
    vehicleNo: 'DL02CD5678',
    drivingLicenseNo: 'DL0320150098765',
    aadhaarPhotoFront: 'test-front2.jpg',
    aadhaarPhotoBack: 'test-back2.jpg',
    driverSelfie: 'test-selfie2.jpg',
    registrationCertificatePhoto: 'test-rc2.jpg',
    drivingLicensePhoto: 'test-dl2.jpg',
    permitPhoto: 'test-permit2.jpg',
    fitnessCertificatePhoto: 'test-fitness2.jpg',
    insurancePolicyPhoto: 'test-insurance2.jpg',
    bankDetails: {
      bankName: 'Test Bank 2',
      accountNumber: '0987654321',
      accountHolderName: 'Test Driver Two',
      ifscCode: 'HDFC0001234'
    },
    permitNo: 'TEST002',
    fitnessCertificateNo: 'FIT002',
    insurancePolicyNo: 'INS002',
    password: 'Test@456'
  }
];

const testUsers = [
  {
    name: 'Test User One',
    email: 'user1@example.com',
    phone: '7654321098',
    password: 'User@123'
  },
  {
    name: 'Test User Two',
    email: 'user2@example.com',
    phone: '6543210987',
    password: 'User@456'
  }
];

const addTestData = async () => {
  try {
    await connectDB();

    // Clear existing test data
    await Driver.deleteMany({ fullName: { $regex: /^Test Driver/ } });
    await User.deleteMany({ name: { $regex: /^Test User/ } });

    console.log('Cleared existing test data');

    // Add test drivers
    for (const driverData of testDrivers) {
      const driver = new Driver(driverData);
      await driver.save();
      console.log(`Added test driver: ${driver.fullName}`);
    }

    // Add test users
    for (const userData of testUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`Added test user: ${user.name}`);
    }

    console.log('\nTest data added successfully!');
    console.log('\nNow you can test validation with these values:');
    console.log('Mobile numbers already in use: 9876543210, 8765432109, 7654321098, 6543210987');
    console.log('Emails already in use: test1@example.com, test2@example.com, user1@example.com, user2@example.com');
    console.log('Aadhaar numbers already in use: 123456789012, 987654321098');
    console.log('Vehicle numbers already in use: MH01AB1234, DL02CD5678');
    console.log('License numbers already in use: MH0120110012345, DL0320150098765');

    process.exit(0);
  } catch (error) {
    console.error('Error adding test data:', error);
    process.exit(1);
  }
};

addTestData();