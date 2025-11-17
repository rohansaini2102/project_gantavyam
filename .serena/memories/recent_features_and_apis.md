# Recent Features and API Endpoints

## Latest Features (2024)

### 1. OTP Verification System
- **File**: `server/routes/otpVerification.js`, `server/utils/otpUtils.js`
- **Service**: Twilio SMS integration (`server/services/twilioSmsService.js`)
- **Model**: SMS logging (`server/models/SmsLog.js`)
- **Test Script**: `server/send-test-otp.js`

### 2. Fare Management System
- **Route**: `server/routes/admin/fareManagement.js`
- **Model**: `server/models/FareConfig.js`
- **Calculator**: `server/utils/fareCalculator.js`
- **Scripts**: 
  - `server/update-fare-config.js`
  - `server/check-ride-fares.js`
  - `server/migrate-driver-fares.js`

### 3. Manual Booking with Drag-and-Drop
- **Route**: `server/routes/admin/manualBookingRoutes.js`
- **Feature**: Admin can manually book rides with map drag-and-drop
- **Old Version**: `server/routes/admin/manualBookingRoutes_old.js` (deprecated)

### 4. Queue Management System
- **Route**: `server/routes/admin/queueRoutes.js`
- **Model**: `server/models/BoothQueue.js`
- **Manager**: `server/utils/queueManager.js`
- **Debug**: `server/debug-queue.js`
- **Fixer**: `server/fix-queue-positions.js`

### 5. Driver Information Recovery
- **Route**: `server/routes/admin/driverInfoRecovery.js`
- **Utility**: `server/utils/driverInfoRecovery.js`

### 6. Enhanced Ride Management
- **Routes**:
  - `server/routes/admin/rideRoutes.js`
  - `server/routes/admin/rideManagementTools.js`
  - `server/routes/rideRequests.js`
  - `server/routes/rideHistory.js`
- **Service**: `server/services/rideLifecycle.js`
- **Utils**:
  - `server/utils/rideCompletionService.js`
  - `server/utils/rideLogger.js`
  - `server/utils/rideDataCleaner.js`

### 7. Analytics & Financial Reporting
- **Routes**:
  - `server/routes/analytics.js`
  - `server/routes/admin/financialRoutes.js`

### 8. Metro Station Integration
- **Model**: `server/models/MetroStation.js`
- **Seeder**: `server/utils/seedMetroStations.js`

### 9. Enhanced Notifications
- **Utility**: `server/utils/enhancedNotification.js`

### 10. Pickup Locations Management
- **Model**: `server/models/PickupLocation.js`
- **Seeder**: `server/seeders/pickupLocationSeeder.js`
- **Importer**: `server/utils/importPickupLocations.js`

## Core API Structure
- **Authentication**: JWT-based with middleware (`server/middleware/auth.js`, `server/middleware/userAuth.js`)
- **File Upload**: Multer + Cloudinary (`server/middleware/upload.js`, `server/config/cloudinary.js`)
- **Storage**: Dual storage system (`server/config/dualStorage.js`, `server/config/localStorage.js`)
- **Logging**: Winston logger (`server/config/logger.js`)
- **Request Logging**: `server/middleware/requestLogger.js`

## Database Models
- User, Driver, Admin
- RideRequest, RideHistory
- BoothQueue, PickupLocation, MetroStation
- FareConfig, SmsLog

## Socket.IO Events
- Real-time ride tracking
- Driver location updates
- Queue position updates
- Ride status changes
- Admin notifications