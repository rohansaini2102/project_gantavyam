#!/bin/bash

# This script runs the frontend in WSL with proper Node version

echo "Starting GANTAVYAM Frontend..."

# Navigate to client directory
cd /mnt/c/Users/rohan/OneDrive/Desktop/GANTAVYAM-main/client

# Load nvm and use Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20

# Try to run with npx which should find react-scripts
echo "Starting React app..."
npx react-scripts start