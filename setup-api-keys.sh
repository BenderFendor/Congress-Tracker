#!/bin/bash

# Script to help set up API keys for the Congress Accountability Tracker
# This script creates a .env file from .env.example and prompts for API keys

set -e

echo "Congress Accountability Tracker - API Key Setup"
echo "=============================================="
echo ""

# Check if .env.example exists
if [ ! -f ".env.example" ]; then
    echo "Error: .env.example not found in current directory"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file"
else
    echo "✓ .env file already exists"
fi

echo ""
echo "API Key Setup Instructions:"
echo "---------------------------"
echo ""
echo "1. Congress.gov API Key:"
echo "   - Visit: https://api.data.gov/signup/"
echo "   - Sign up for a free API key"
echo "   - Set CONGRESS_GOV_API_KEY in your .env file"
echo ""
echo "2. OpenFEC API Key:"
echo "   - Visit: https://api.open.fec.gov/developers/"
echo "   - Sign up for a free API key"
echo "   - Set OPENFEC_API_KEY in your .env file"
echo ""
echo "3. Optional APIs:"
echo "   - USAspending API: https://api.usaspending.gov/"
echo "   - Census API: https://www.census.gov/data/developers.html"
echo ""
echo "Current .env file contents:"
echo "---------------------------"
cat .env
echo ""
echo "To edit the .env file:"
echo "  nano .env  # or use your preferred editor"
echo ""
echo "Next steps:"
echo "  1. Update the API keys in .env"
echo "  2. Run: cargo run --bin backend_server"
echo "  3. Run: cd frontend && npm run dev"
echo ""
