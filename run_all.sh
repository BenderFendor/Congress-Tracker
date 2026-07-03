#!/bin/bash

# Function to kill all child processes on exit
cleanup() {
    echo "Stopping all services..."
    # Kill all child processes in the current process group
    kill 0
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT EXIT

echo "Loading environment from .env..."
set -a
source .env
set +a

echo "Killing any process on ports 4020 and 3000..."
# Kill any process using port 4020 or 3000
for port in 4020 3000; do
    # Use fuser to kill process on port, fallback to lsof if available
    if command -v fuser &> /dev/null; then
        fuser -k "$port/tcp" >/dev/null 2>&1
    elif command -v lsof &> /dev/null; then
        pid=$(lsof -ti:$port 2>/dev/null)
        if [ -n "$pid" ]; then
            echo "Killing process $pid on port $port"
            kill -9 "$pid"
        fi
    else
        # Try using ss as last resort
        pid=$(ss -tlnp | grep ":$port" | awk '{print $7}' | cut -d, -f2 | cut -d= -f2)
        if [ -n "$pid" ]; then
            echo "Killing process $pid on port $port"
            kill -9 "$pid"
        fi
    fi
done

echo "Starting Backend..."
cd backend
# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "Error: cargo is not installed."
    exit 1
fi

# Build and run the canonical Postgres-backed backend.
cargo run -p intel_backend --bin intel_backend &
BACKEND_PID=$!
cd ..

echo "Starting Frontend..."
cd frontend
# Check if pnpm is installed, fallback to npm
if command -v pnpm &> /dev/null; then
    PNPM_CMD="pnpm"
else
    echo "pnpm not found, using npm"
    PNPM_CMD="npm"
fi

$PNPM_CMD install
PORT=3000 NEXT_PUBLIC_BACKEND_URL="${NEXT_PUBLIC_BACKEND_URL:-http://localhost:4020}" $PNPM_CMD run dev &
FRONTEND_PID=$!
cd ..

echo "Services started. Press Ctrl+C to stop."

# Wait for any process to exit
wait -n

# If one exits, kill the other and exit
cleanup
