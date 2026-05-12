#!/bin/bash

# Get the directory where this script is located
PROJECT_DIR="/Users/rahulgoswami/Documents/order-notification"
cd "$PROJECT_DIR"

# Check if the server is already running on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Server is already running."
else
    echo "Starting server..."
    # Run npm run dev in the background
    # We use nohup and redirect output so it stays running
    nohup npm run dev > /tmp/order-notification.log 2>&1 &
    
    # Wait for the server to start
    echo "Waiting for server to be ready..."
    until $(curl --output /dev/null --silent --head --fail http://localhost:3000); do
        printf '.'
        sleep 1
    done
    echo "Server is ready!"
fi

# Open the application in the browser (or PWA if installed)
open "http://localhost:3000"
