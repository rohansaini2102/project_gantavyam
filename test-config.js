// Test Configuration File
// Contains all test credentials and settings

//
// ./run-tests.sh --quick

// Full Test Suite:

// ./run-tests.sh

// Direct execution:

// node test-ride-flow.js


module.exports = {
  // Server Configuration
  API_URL: 'http://localhost:5000/api',
  SOCKET_URL: 'http://localhost:5000',
  
  // Test Credentials
  credentials: {
    user: {
      phone: '0000000000',
      password: 'Demo@123'
    },
    driver: {
      phone: '0000000000',
      email: 'driver@test.com', // Alternative login
      password: 'Demo@123'
    },
    admin: {
      email: 'admin@admin.com',
      password: 'admin@123'
    }
  },
  
  // Test Data
  testData: {
    pickupLocations: [
      'Hauz Khas Metro Gate No 1',
      'Rajiv Chowk Metro Station',
      'Connaught Place'
    ],
    dropLocations: [
      {
        address: 'Green Park Market',
        lat: 28.5494,
        lng: 77.2001
      },
      {
        address: 'Select City Walk Mall, Saket',
        lat: 28.5274,
        lng: 77.2201
      },
      {
        address: 'DLF Mall of India, Noida',
        lat: 28.5679,
        lng: 77.3211
      }
    ],
    vehicleTypes: ['bike', 'auto', 'car'],
    estimatedFares: {
      bike: 50,
      auto: 150,
      car: 250
    },
    testOTP: '1234' // For testing purposes
  },
  
  // Test Settings
  settings: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    delayBetweenTests: 1000, // 1 second
    verbose: true
  },
  
  // Expected Response Times (ms)
  performance: {
    login: 2000,
    booking: 3000,
    rideAccept: 2000,
    dashboardLoad: 5000
  }
};