# Trigger.dev Setup Guide

## What is Trigger.dev?

Trigger.dev runs **background tasks** for your app. When you send a chat message, it:
- Indexes messages for semantic search (runs in background)
- Extracts patterns from conversations (runs in background)
- Doesn't slow down your chat responses

## Quick Start (2 Terminals Required)

### Terminal 1: Next.js Server
```bash
cd /Users/rm/Desktop/landing_page
npm run dev
```
**Keep this running** - this is your main app server.

### Terminal 2: Trigger.dev Worker
```bash
cd /Users/rm/Desktop/landing_page
npm run trigger:dev
```
**Keep this running** - this processes background tasks.

## Or Run Both Together (1 Terminal)

```bash
cd /Users/rm/Desktop/landing_page
npm run dev:all
```

This runs both Next.js and Trigger.dev in the same terminal.

## How to Know It's Working

### When Trigger.dev Worker Starts Successfully:
You'll see:
```
[Trigger.dev] Connected to project proj_hsneehqxymxjwpkwntec
[Trigger.dev] Listening for tasks...
```

### When You Send a Chat Message:
1. **Terminal 1 (Next.js)**: Shows `[TRIGGER] Message indexing task queued`
2. **Terminal 2 (Trigger.dev)**: Shows `[TRIGGER] Starting message indexing...`
3. **Trigger.dev Dashboard**: Tasks show as "queued" → "running" → "completed"

## Troubleshooting

### "Dev worker not running!" Error
- Make sure Terminal 2 is running `npm run trigger:dev`
- Check that both terminals are in the same directory

### Tasks Not Executing
1. Check Terminal 2 for connection errors
2. Verify `.env.local` has `TRIGGER_API_KEY` and `TRIGGER_PROJECT_ID`
3. Check Trigger.dev dashboard: https://cloud.trigger.dev

### Connection Errors
- Verify your internet connection
- Check that `TRIGGER_API_KEY` is valid
- Make sure `TRIGGER_PROJECT_ID` matches your Trigger.dev project

## What About MCP?

**MCP (Model Context Protocol) is NOT needed for Trigger.dev.**

MCP is for connecting AI assistants to external tools. Trigger.dev uses:
- **CLI** (`npx trigger.dev@latest dev`) - runs the worker
- **SDK** (`@trigger.dev/sdk`) - already installed
- **Cloud Dashboard** - monitors tasks

You don't need MCP for this setup.

## Next Steps

1. ✅ Start both terminals (or use `npm run dev:all`)
2. ✅ Send a test chat message
3. ✅ Check Trigger.dev dashboard for task activity
4. ✅ Verify tasks complete successfully

That's it! Your background tasks are now running.

