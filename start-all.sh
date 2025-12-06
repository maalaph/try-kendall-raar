#!/bin/bash
# Quick script to start both Next.js and Trigger.dev together

echo "🚀 Starting Next.js + Trigger.dev..."
echo ""
echo "This will run both servers in the same terminal."
echo "Press Ctrl+C to stop both"
echo ""

cd "$(dirname "$0")"
npm run dev:all
