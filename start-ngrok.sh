#!/bin/bash

# Start Ngrok with the pooled domain
# This script starts Ngrok pointing to your local Next.js server on port 3000

DOMAIN="raar-dev.ngrok.app"
PORT=3000

echo "🚀 Starting Ngrok..."
echo "   Domain: $DOMAIN"
echo "   Port: $PORT"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok is not installed!"
    echo ""
    echo "Install it with one of these methods:"
    echo "  1. Homebrew: brew install ngrok/ngrok/ngrok"
    echo "  2. Download: https://ngrok.com/download"
    echo ""
    exit 1
fi

# Check if port 3000 is in use
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Warning: Nothing is listening on port $PORT"
    echo "   Make sure your Next.js dev server is running: npm run dev"
    echo ""
fi

# Start ngrok with pooling enabled (allows multiple agents)
echo "Starting Ngrok tunnel with pooling enabled..."
ngrok http $PORT --domain=$DOMAIN --pooling-enabled

