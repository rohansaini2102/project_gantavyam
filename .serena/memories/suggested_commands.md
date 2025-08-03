# Development Commands

## Starting the Application

### Option 1: Using the start script (Recommended)
```bash
./start-app.sh
```
This script:
- Starts MongoDB if not running
- Uses Node.js v20 (via nvm)
- Starts both backend and frontend
- Provides clean shutdown with Ctrl+C

### Option 2: Manual Start
```bash
# Backend (from server directory)
cd server
npm run dev  # Uses nodemon for hot reload

# Frontend (from client directory) 
cd client
npm start    # Starts React development server
```

### Option 3: Using PM2
```bash
pm2 start ecosystem.config.js
pm2 logs     # View logs
pm2 stop all # Stop all services
```

## Testing
```bash
# Frontend tests
cd client
npm test

# Backend (no tests configured)
cd server
npm test  # Currently returns "no test specified"
```

## Building
```bash
# Frontend production build
cd client
npm run build
```

## Environment Setup
1. Copy `.env.example` to `.env` in both client and server directories
2. Update with your API keys and configuration

## Database
- MongoDB URL: `mongodb://localhost:27017/gantavyam`
- Ensure MongoDB is running: `sudo systemctl start mongod`

## Ports
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## Git Commands
```bash
git status
git add .
git commit -m "message"
git push origin main
```