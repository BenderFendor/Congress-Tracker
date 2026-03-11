#!/bin/bash
set -e

echo "Starting backend server..."
cargo run --manifest-path backend/crates/backend_server/Cargo.toml &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo "Fetching /api/trades from backend..."
RESPONSE=$(curl -s http://127.0.0.1:4020/api/trades)

# Verify the response contains 'data'
if echo "$RESPONSE" | grep -q '"data"'; then
    echo "SUCCESS: Backend returned trades data!"
else
    echo "ERROR: Backend did not return valid trades data."
    kill $SERVER_PID
    exit 1
fi

kill $SERVER_PID
echo "End-to-End Test Passed!"
