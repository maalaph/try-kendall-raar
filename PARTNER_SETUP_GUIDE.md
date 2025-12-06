# Complete Setup Guide for Partner

## Quick Start

Since you share the same Airtable base and Supabase database, you just need to:
1. Install dependencies
2. Copy the environment variables below
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

# Airtable Configuration
AIRTABLE_API_KEY=patTETTk0kE6nagqL.390f2cb15fa577b6e3d904325f756c891b72d379b5b857f8ca3e6422f6842373
AIRTABLE_BASE_ID=appRzrocK4whoKzZ7
AIRTABLE_TABLE_ID=tblEXG9wp3Dm3nPte

# Vapi Configuration
VAPI_PRIVATE_KEY=52c9d932-2ae8-47e7-8ace-f27966072ca5
VAPI_DEFAULT_MODEL=gpt-4o

# Vapi Voice Configuration
VAPI_VOICE_ID=Alexandra

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACa46bba8a4285d650e1ef19b3c8ca2fd2
TWILIO_AUTH_TOKEN=6aebca62039279629c5ba6afca7d4d5f

# Gmail SMTP Configuration
GMAIL_USER=admin@ordco.net
GMAIL_APP_PASSWORD=cwzwcbmytuysbtqu

# Business Trial Airtable Table
AIRTABLE_BUSINESS_TRIAL_TABLE_ID=tbli3uJLbubkIRk5S
OPENAI_API_KEY=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
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_YAQIFmtj2ekspubC_z6XyZyeMdGjYutFfeM9isVNHMKYGxh
ELEVENLABS_API_KEY=sk_0b87d06dfeb237a195d89d8afd08aba31e2f0399fbf8c3d2

AIRTABLE_CALL_NOTES_TABLE_ID=tblDn615swgYvoa3m

VAPI_WEBHOOK_URL=https://raar-dev.ngrok.app/api/vapi-webhook

# Scheduled Calls Airtable Table ID
AIRTABLE_SCHEDULED_CALLS_TABLE_ID=tblwnjWrCK7p86Tjz
AIRTABLE_CHAT_MESSAGES_TABLE_ID=tblcQk5eaci1SX6ZL
AIRTABLE_USER_PATTERNS_TABLE_ID=tblaVMSZIW4g4X91K
AIRTABLE_USER_MEMORY_TABLE_ID=tblcQk5eaci1SX6ZL
AIRTABLE_CONTACTS_TABLE_ID=tbldEql6xpdNAl9Do

# Google OAuth Credentials
GOOGLE_CLIENT_ID=625035731744-snfv8sd0r7qkfn8kk2r2id26ndio8nad.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# User Documents table
AIRTABLE_USER_DOCUMENTS_TABLE_ID=tblSG1Zfa1eAEUVTu

# Spotify OAuth Configuration
SPOTIFY_CLIENT_ID=25dc38efd45a44259319d9d92c61cdeb
SPOTIFY_CLIENT_SECRET=b1890965642c4ebcb6933cb93a84fdba
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback

# Supabase Configuration (PostgreSQL Database)
SUPABASE_URL=https://kwlkbuatidinolgfsxst.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bGtidWF0aWRpbm9sZ2ZzeHN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDk1MTk3MywiZXhwIjoyMDgwNTI3OTczfQ.Hjh5HcIBj70kmj0ZM8fqfmNMQ1lkAHQWdND8fYedhaw
SUPABASE_DB_URL=postgresql://postgres:Ry4nAli$70@db.kwlkbuatidinolgfsxst.supabase.co:5432/postgres

# Trigger.dev Configuration
TRIGGER_API_KEY=tr_dev_aYSqMuZZQJ5iPnigxifb
TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec

# LangGraph Configuration (for advanced agent orchestration)
USE_LANGGRAPH=true
TRIGGER_SECRET_KEY=tr_dev_aYSqMuZZQJ5iPnigxifb
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

Since you share the same Airtable and Supabase:
- ✅ All Airtable tables are already set up
- ✅ Database connections are configured
- ✅ All API keys are shared
- ✅ Chat, dashboard, and all features should work immediately

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

