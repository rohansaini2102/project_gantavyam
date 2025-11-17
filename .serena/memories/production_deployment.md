# Production Deployment Information

## Deployment Configuration
- **Process Manager**: PM2 with `ecosystem.config.js`
- **Startup Script**: `start-app.sh`
- **Environment**: Supports development and production modes

## Server Ports
- **Frontend (React)**: Port 3000
- **Backend (Node.js/Express)**: Port 5000
- **Alternative Test Port**: 3002 (for testing)

## Recent Production Issues Fixed
1. **Data Vanishing Error**: Fixed in production (commit 7c215f9)
2. **Dependency Conflicts**: Resolved security vulnerabilities (commit 43fe086)
3. **Render Error**: Fixed rendering issues (commit 22c3abc)
4. **Ride Fare Issues**: Multiple fixes for fare calculation in production

## Database
- **Type**: MongoDB with Mongoose ODM
- **Version**: Mongoose 8.13.2
- **Connection**: Configured in `server/config/db.js`

## External Services
- **SMS/OTP**: Twilio API for SMS verification
- **Maps**: Google Maps API for location services
- **File Storage**: Cloudinary for image uploads
- **Local Storage**: Dual storage system for redundancy

## Security Features
- JWT authentication (jsonwebtoken 9.0.2)
- Password hashing (bcryptjs 3.0.2)
- CORS configuration (cors 2.8.5)
- Request logging and monitoring

## Maintenance Scripts
- `server/clearCurrentRides.js` - Clear stuck rides
- `server/fix-ride-history-driver-fare.js` - Fix fare data
- `server/fix-queue-positions.js` - Fix queue positions
- `server/fix-dropoff-migration.js` - Migrate dropoff data
- `server/check-all-rides.js` - Audit ride data
- `server/scripts/addTestDrivers.js` - Add test data

## Monitoring & Debugging
- Winston logger for application logs
- Request logger middleware
- Debug scripts for queue and ride management
- Ride logger for tracking ride lifecycle events