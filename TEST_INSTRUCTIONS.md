# GANTAVYAM Test Suite Instructions

## Overview
This test suite provides comprehensive testing for the entire ride flow including user booking, driver acceptance, and admin monitoring.

## Test Credentials
- **User**: Phone: `0000000000`, Password: `Demo@123`
- **Driver**: Phone: `0000000000`, Password: `Demo@123`
- **Admin**: Email: `admin@admin.com`, Password: `admin@123`

## Files Created
1. **`test-config.js`** - Configuration file with test credentials and settings
2. **`test-ride-flow.js`** - Main test file that runs all tests
3. **`run-tests.sh`** - Shell script to run tests with pre-flight checks
4. **`TEST_INSTRUCTIONS.md`** - This file

## How to Run Tests

### 1. Quick Smoke Test
Run basic login tests to check if authentication is working:
```bash
./run-tests.sh --quick
```

### 2. Full Test Suite
Run complete ride flow tests:
```bash
./run-tests.sh
```

### 3. Direct Node Execution
If you prefer to run tests directly:
```bash
node test-ride-flow.js
```

## What Gets Tested

### Authentication Tests
- ✅ User login with phone/password
- ✅ Driver login with phone/password
- ✅ Admin login with email/password

### User Flow
- ✅ Fare estimation for rides
- ✅ Creating a ride booking
- ✅ Receiving booking confirmation

### Driver Flow
- ✅ Viewing available rides
- ✅ Accepting a ride
- ✅ Driver assignment to user

### Admin Features
- ✅ Dashboard statistics
- ✅ Viewing all rides
- ✅ Monitoring active rides

### Real-time Features
- ✅ Socket connections for user
- ✅ Socket connections for driver
- ✅ Real-time updates

## Prerequisites

### 1. Server Running
Make sure your server is running:
```bash
cd server
npm start
```

### 2. MongoDB Connected
Ensure MongoDB is connected and running.

### 3. Test Dependencies
The script will auto-install required packages:
- `node-fetch` - For API requests
- `socket.io-client` - For socket testing

## Understanding Test Output

### Success Output
```
✅ User Login
   User: Test User (0000000000)
```

### Failure Output
```
❌ Create Booking
   Error: Invalid drop location
```

### Test Summary
```
=== TEST SUMMARY ===
Passed: 10
Failed: 2
Pass Rate: 83.3%
```

## Test Logs
- Test results are saved to `test-results-YYYYMMDD-HHMMSS.log`
- Each run creates a new log file with timestamp

## Customizing Tests

### Add New Test Location
Edit `test-config.js`:
```javascript
dropLocations: [
  {
    address: 'Your New Location',
    lat: 28.1234,
    lng: 77.5678
  }
]
```

### Change Test Timeouts
Edit `test-config.js`:
```javascript
settings: {
  timeout: 60000, // 60 seconds
  delayBetweenTests: 2000 // 2 seconds
}
```

### Add New Test
Edit `test-ride-flow.js` and add your test function:
```javascript
async function testNewFeature() {
  log('\\n🧪 Testing New Feature...', 'test');
  // Your test logic here
  logTest('New Feature', true);
}
```

## Troubleshooting

### Server Not Running
```
✗ Server is not running!
Please start the server with: npm start
```

### MongoDB Not Connected
```
✗ MongoDB connection failed
```
Check your `.env` file for correct `MONGODB_URI`.

### Authentication Failures
- Ensure test users exist in database
- Check if passwords are correct
- Verify JWT secret is set

### Socket Connection Issues
- Check if socket.io is properly initialized
- Verify CORS settings allow localhost

## Running Before Each Commit

Add to your workflow:
```bash
# Before committing
./run-tests.sh

# If all tests pass
git add .
git commit -m "Your commit message"

# If tests fail
# Fix the issues first!
```

## Quick Health Check

For a quick system health check:
```bash
# Check if everything is working
curl http://localhost:5000/api/status

# Quick login test
./run-tests.sh --quick
```

## Notes
- Tests use demo credentials that should exist in your database
- Tests create real data (rides) in your database
- Socket tests require server to have socket.io properly configured
- All tests run sequentially to avoid conflicts

## Support
If tests are failing:
1. Check server logs for errors
2. Verify all services are running
3. Ensure test users exist in database
4. Check network connectivity