#!/bin/bash

# Quick script to verify Ngrok setup
# Usage: ./scripts/check-ngrok-setup.sh

echo "🔍 Checking Ngrok Setup..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok is not installed"
    echo "   Install it with: brew install ngrok/ngrok/ngrok"
    exit 1
else
    echo "✅ Ngrok is installed"
    ngrok version
fi

echo ""

# Check if ngrok is running
if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    echo "✅ Ngrok is running"
    echo ""
    echo "Active tunnels:"
    curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | sed 's/"public_url":"/   - /' | sed 's/"$//'
else
    echo "⚠️  Ngrok is not running"
    echo "   Start it with: ngrok http 3000 --domain=your-domain.ngrok.app"
fi

echo ""

# Check environment variables
if [ -f .env.local ]; then
    echo "✅ .env.local file exists"
    
    if grep -q "VAPI_WEBHOOK_URL" .env.local || grep -q "NEXT_PUBLIC_WEBHOOK_URL" .env.local; then
        echo "✅ Webhook URL is configured in .env.local"
        grep -E "VAPI_WEBHOOK_URL|NEXT_PUBLIC_WEBHOOK_URL" .env.local | sed 's/=.*/=***/' | sed 's/^/   /'
    else
        echo "❌ Webhook URL is NOT configured in .env.local"
        echo "   Add: VAPI_WEBHOOK_URL=https://your-domain.ngrok.app/api/vapi-webhook"
    fi
else
    echo "⚠️  .env.local file does not exist"
    echo "   Create it from: cp env.template .env.local"
fi

echo ""
echo "📋 Next steps:"
echo "   1. Make sure Ngrok is running with your domain"
echo "   2. Verify the endpoint is set to 'Pooled' in Ngrok dashboard"
echo "   3. Check that VAPI_WEBHOOK_URL is set correctly"
echo "   4. Run: node verify-env.js"

