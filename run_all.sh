#!/bin/bash

# Function to kill all child processes on exit
cleanup() {
    echo "Stopping all services..."
    # Kill all child processes in the current process group
    kill 0
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT EXIT

echo "Starting Backend..."
cd backend
# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "Error: cargo is not installed."
    exit 1
fi

# Build and run the backend
# We use --bin if there are multiple, but default run should work for single binary package
cargo run -p backend_server &
BACKEND_PID=$!
cd ..

echo "Starting Frontend..."
cd frontend
# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is not installed."
    kill $BACKEND_PID
    exit 1
fi

pnpm install
pnpm dev &
FRONTEND_PID=$!
cd ..

echo "Services started. Press Ctrl+C to stop."

# Wait for any process to exit
wait -n

# If one exits, kill the other and exit
cleanup
