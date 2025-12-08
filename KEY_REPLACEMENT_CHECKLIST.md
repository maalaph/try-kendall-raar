# API Key Replacement Checklist

## ⚠️ CRITICAL: All keys in PARTNER_SETUP_GUIDE.md were exposed and need to be replaced

## Keys That Need Replacement

### ✅ Confirmed Disabled (Must Replace Immediately):
1. **OPENAI_API_KEY** - Disabled (you received email from OpenAI)
   - Get new key: https://platform.openai.com/api-keys
   - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

2. **TWILIO_ACCOUNT_SID** - Disabled
   - Get new credentials: https://console.twilio.com/
   - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

3. **TWILIO_AUTH_TOKEN** - Disabled
   - Get new credentials: https://console.twilio.com/
   - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

### ⚠️ Potentially Compromised (Should Replace):
4. **AIRTABLE_API_KEY** - No longer needed (migration complete)
   - Status: Can be removed entirely
   - Action: Remove from `.env.local` (no longer used)

5. **VAPI_PRIVATE_KEY**
   - Get new key: https://dashboard.vapi.ai/settings
   - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

6. **GMAIL_APP_PASSWORD**
   - Generate new app password: https://myaccount.google.com/apppasswords
   - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

7. **BLOB_READ_WRITE_TOKEN** (Vercel Blob Storage)
   - Get new token: https://vercel.com/dashboard/stores
   - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

8. **ELEVENLABS_API_KEY**
   - Get new key: https://elevenlabs.io/app/settings/api-keys
   - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

9. **GOOGLE_CLIENT_SECRET**
   - Regenerate: https://console.cloud.google.com/apis/credentials
   - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

10. **SPOTIFY_CLIENT_SECRET**
    - Regenerate: https://developer.spotify.com/dashboard
    - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

11. **SUPABASE_SERVICE_ROLE_KEY**
    - Get new key: https://supabase.com/dashboard/project/_/settings/api
    - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

12. **SUPABASE_DB_URL** (contains database password)
    - Get new connection string: https://supabase.com/dashboard/project/_/settings/database
    - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

13. **TRIGGER_SECRET_KEY** / **TRIGGER_API_KEY**
    - Get new key: https://cloud.trigger.dev/settings
    - Replace in: `.env.local` and `PARTNER_SETUP_GUIDE.md`

## Steps to Replace Keys

### Step 1: Get New Keys
1. Go to each service's dashboard (links above)
2. Generate new API keys/tokens
3. **Revoke the old keys** if possible

### Step 2: Update `.env.local`
1. Open `.env.local` file
2. Replace each exposed key with the new value
3. Save the file

### Step 3: Update PARTNER_SETUP_GUIDE.md
1. The file has already been updated with placeholders
2. If you share this file, make sure it only contains placeholders

### Step 4: Restart Services
1. Restart your development server: `npm run dev`
2. Restart Trigger.dev if running: `npm run trigger:dev`
3. Test that everything still works

## Verification

After replacing keys, verify:
- ✅ Chat messages work
- ✅ VAPI calls work
- ✅ Dashboard loads
- ✅ OAuth integrations work (Google, Spotify)
- ✅ Scheduled calls execute
- ✅ No errors in console

## Notes

- **Airtable keys are no longer needed** - migration to Supabase is complete
- Keep old keys temporarily if you need to access old data
- Revoke old keys once you confirm everything works with new keys
- Never commit `.env.local` to git (it's in `.gitignore`)



