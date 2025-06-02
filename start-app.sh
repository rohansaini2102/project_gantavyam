#!/bin/bash

echo "Starting GANTAVYAM Application..."

# Check if MongoDB is running
if ! sudo systemctl is-active --quiet mongod; then
    echo "Starting MongoDB..."
    sudo systemctl start mongod
    sleep 3
fi

# Check MongoDB status
echo "MongoDB status:"
sudo systemctl status mongod --no-pager -l

# Load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Use Node 20 if nvm is available
if command -v nvm &> /dev/null; then
    nvm use 20
fi

# Set environment variable for development
export NODE_ENV=development

# Function to cleanup processes on exit
cleanup() {
    echo "Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit
}

# Trap Ctrl+C
trap cleanup SIGINT

# Start backend
echo "Starting backend server..."
cd /home/rohan/gantavyam/server
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 8

# Start frontend
echo "Starting frontend..."
cd /home/rohan/gantavyam/client
npm start &
FRONTEND_PID=$!

echo ""
echo "========================="
echo "GANTAVYAM Application Started"
echo "========================="
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:5000/api"
echo "MongoDB: mongodb://localhost:27017/gantavyam"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "========================="

# Wait for user interrupt
wait