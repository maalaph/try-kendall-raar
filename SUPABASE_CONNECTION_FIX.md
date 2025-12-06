# Supabase Connection Fix Guide

## Current Status

✅ **Supabase REST API**: Working (via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
❌ **Direct Database Connection**: Failing (DNS resolution issue for LangGraph checkpointing)

## Impact

- **Working**: All database operations via Supabase REST API (chat messages, threads, etc.)
- **Not Working**: LangGraph state persistence (checkpointing) - falls back to stateless mode
- **Trigger.dev**: ✅ Running and configured

## Root Cause

The direct PostgreSQL connection (`SUPABASE_DB_URL`) is failing with DNS resolution error:
```
getaddrinfo ENOTFOUND db.kwlkbuatidinolgfsxst.supabase.co
```

However, DNS resolution tests show the hostname resolves correctly, suggesting:
1. PostgresSaver may be using a different DNS resolver
2. Network timing/connection issue
3. Supabase project might need to be unpaused or re-activated

## Solutions

### Option 1: Check Supabase Project Status (Recommended First Step)

1. Go to https://supabase.com/dashboard
2. Select your project (`kwlkbuatidinolgfsxst`)
3. Check if project status shows "Active" (not "Paused")
4. If paused, click "Resume" or "Unpause"

### Option 2: Verify Connection String Format

Your `SUPABASE_DB_URL` should be in this format:
```
postgresql://postgres:[YOUR-PASSWORD]@db.kwlkbuatidinolgfsxst.supabase.co:5432/postgres
```

To get the correct connection string:
1. Go to Supabase Dashboard → Settings → Database
2. Find "Connection string" section
3. Select "URI" format
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your actual database password

### Option 3: Use Connection Pooler (Port 6543)

If direct connection (port 5432) fails, try the connection pooler (port 6543):

Update `.env.local`:
```bash
# Change from:
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.kwlkbuatidinolgfsxst.supabase.co:5432/postgres

# To:
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.kwlkbuatidinolgfsxst.supabase.co:6543/postgres?pgbouncer=true
```

### Option 4: Test Connection Manually

Run the test script:
```bash
npx tsx scripts/test-supabase-connection.ts
```

This will test:
- REST API connection
- Direct database connection (port 5432)
- Connection pooler (port 6543)
- DNS resolution

## Current Workaround

The code has been updated to:
1. ✅ Gracefully degrade when checkpointing fails (LangGraph runs stateless)
2. ✅ Try connection pooler automatically if direct connection fails
3. ✅ Provide helpful error messages for debugging

**LangGraph will work without checkpointing**, but:
- ❌ State won't persist between requests
- ❌ Multi-turn conversations may lose context
- ❌ Complex workflows may not resume properly

## Next Steps

1. **Check Supabase project status** (most likely fix)
2. **Verify connection string** in `.env.local`
3. **Test with connection pooler** (port 6543)
4. **Run test script** to diagnose further

## Verification

After fixing, verify by:
1. Restart Next.js: `npm run dev`
2. Send a chat message
3. Check logs for: `[CHECKPOINTER] Postgres checkpointer initialized successfully`
4. No DNS errors in logs

## Trigger.dev Status

✅ **Trigger.dev is running** (process ID: see `ps aux | grep trigger`)
✅ **Configuration**: `TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec`
✅ **Setup**: Complete

No action needed for Trigger.dev - it's working correctly.


