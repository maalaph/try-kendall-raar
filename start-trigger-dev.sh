#!/bin/bash
# Quick script to start Trigger.dev dev worker

echo "🚀 Starting Trigger.dev Dev Worker..."
echo ""
echo "This will connect to Trigger.dev and process background tasks."
echo "Keep this terminal open while developing."
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd "$(dirname "$0")"
npm run trigger:dev
