# Complete Setup Guide for Partner

## ⚠️ IMPORTANT: Replace All API Keys
**All keys in this file are placeholders. You MUST replace them with your own keys before using this application.**

## Quick Start

Since you share the same Supabase database, you just need to:
1. Install dependencies
2. Copy the environment variables below and **replace all placeholder values with your actual keys**
3. Start the development server

---

## Step 1: Install Dependencies

```bash
cd /path/to/landing_page
npm install
```

---

## Step 2: Create `.env.local` File

Create a file named `.env.local` in the project root and paste the following:

```bash
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/admin-ordco/15

# Airtable Configuration (REMOVED - All data migrated to Supabase)
# No longer needed - all functionality uses Supabase PostgreSQL

# Vapi Configuration
VAPI_PRIVATE_KEY=your_vapi_private_key
VAPI_DEFAULT_MODEL=gpt-4o

# Vapi Voice Configuration
VAPI_VOICE_ID=Alexandra

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Gmail SMTP Configuration
GMAIL_USER=your_gmail_user
GMAIL_APP_PASSWORD=your_gmail_app_password

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_read_write_token

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key

VAPI_WEBHOOK_URL=https://your-domain.ngrok.app/api/vapi-webhook

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Spotify OAuth Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback

# Supabase Configuration (PostgreSQL Database)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DB_URL=postgresql://postgres:your_password@db.your-project.supabase.co:5432/postgres

# Trigger.dev Configuration
TRIGGER_SECRET_KEY=your_trigger_secret_key
TRIGGER_PROJECT_ID=your_trigger_project_id
# Legacy support (optional - will use TRIGGER_SECRET_KEY if both are set)
# TRIGGER_API_KEY=your_trigger_api_key

# LangGraph Configuration (for advanced agent orchestration)
USE_LANGGRAPH=true
```

**Important Notes:**
- The `$` in `SUPABASE_DB_URL` password needs to be escaped or quoted if your shell interprets it. If you have issues, wrap the password in quotes: `postgresql://postgres:"Ry4nAli$70"@db.kwlkbuatidinolgfsxst.supabase.co:5432/postgres`
- The `VAPI_WEBHOOK_URL` uses ngrok. If you're running locally, you may need to set up your own ngrok tunnel (see Step 4).

---

## Step 3: Start the Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

**Important:** Restart the server after creating/updating `.env.local` - environment variables only load on server start.

---

## Step 4: (Optional) Set Up Ngrok for Webhooks

If you need VAPI webhooks to work locally:

1. **Install Ngrok** (if not already installed):
   ```bash
   npm install -g ngrok
   # or
   brew install ngrok
   ```

2. **Start Ngrok**:
   ```bash
   ngrok http 3000 --domain=raar-dev.ngrok.app
   ```
   
   Note: This uses the shared ngrok domain. If you need your own, get a domain from https://dashboard.ngrok.com/domains and update `VAPI_WEBHOOK_URL` in `.env.local`.

3. **Keep Ngrok running** in a separate terminal while developing.

---

## Step 5: (Optional) Start Trigger.dev for Background Tasks

If you want background tasks (message indexing, pattern extraction) to work:

**Option A: Run in separate terminals**

Terminal 1 (Next.js):
```bash
npm run dev
```

Terminal 2 (Trigger.dev):
```bash
npm run trigger:dev
```

**Option B: Run both together**

```bash
npm run dev:all
```

You should see:
```
[Trigger.dev] Connected to project proj_hsneehqxymxjwpkwntec
[Trigger.dev] Listening for tasks...
```

---

## Step 6: Verify Setup

Run the verification script:

```bash
node verify-env.js
```

This checks that all required environment variables are loaded correctly.

---

## What Works Out of the Box

Since you share the same Supabase database:
- ✅ All database tables are already set up
- ✅ Database connections are configured
- ✅ Chat, dashboard, and all features should work immediately
- ⚠️ **You must replace all API keys** (see KEY_REPLACEMENT_CHECKLIST.md)

---

## Troubleshooting

### "Table not configured" warnings
- These are for optional features. The app will work without them, but some advanced features won't be available.
- If you see these, it means the optional tables (User Patterns, User Memory, Contacts) might not exist yet, but core functionality will still work.

### Features not working
1. Check browser console (F12) for errors
2. Check server terminal for warnings
3. Verify `.env.local` file exists and has all variables
4. Make sure server was restarted after creating `.env.local`

### Ngrok connection issues
- Make sure ngrok is running: `ngrok http 3000 --domain=raar-dev.ngrok.app`
- Verify the domain matches what's in `VAPI_WEBHOOK_URL`
- Check ngrok dashboard: https://dashboard.ngrok.com

### Trigger.dev not connecting
- Verify `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_ID` are set correctly
- Check Trigger.dev dashboard: https://cloud.trigger.dev
- Make sure `npm run trigger:dev` is running in a separate terminal

---

## Quick Test Checklist

After setup, test these:

1. **Landing Page**: http://localhost:3000 - Should load
2. **Chat Interface**: http://localhost:3000/chat - Should work
3. **Dashboard**: http://localhost:3000/dashboard - Should load
4. **Command Palette**: Press `Cmd+K` (Mac) or `Ctrl+K` (Windows) in chat - Should open

---

## Summary

**Minimum required steps:**
1. ✅ `npm install`
2. ✅ Create `.env.local` with the values above
3. ✅ `npm run dev`

**Optional but recommended:**
- Set up ngrok for webhooks (if using VAPI features)
- Run Trigger.dev for background tasks

Everything else is already configured since you share the same infrastructure!

---

**You're all set!** 🚀


