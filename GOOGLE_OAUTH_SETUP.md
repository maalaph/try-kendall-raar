# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth 2.0 for Kendall to access user Google Calendar and Gmail.

## Prerequisites

- Google Cloud Console account
- Access to your Google Cloud project
- OAuth 2.0 Client ID and Client Secret (already created)

## Step 1: Google Cloud Console Configuration

### OAuth Client Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Your OAuth 2.0 Client ID should already be created:
   - **Name**: MyKendall Calendar & Gmail Integration
   - **Type**: Web application
   - **Client ID**: `625035731744-snfv8sd0r7qkfn8kk2r2id26ndio8nad.apps.googleusercontent.com`

### Authorized Redirect URIs

Make sure these redirect URIs are configured:

**Development:**
- `http://localhost:3000/api/auth/google/callback`

**Production (add when deploying):**
- `https://yourdomain.com/api/auth/google/callback`

### OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Configure the following scopes:

**Calendar Scopes:**
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.events.owned`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.freebusy`

**Gmail Scopes (light, non-restricted):**
- `https://www.googleapis.com/auth/gmail.labels`
- `https://www.googleapis.com/auth/gmail.metadata`

**User-facing permission descriptions:**
- "See my calendar so Kendall can understand and summarize my schedule"
- "See when I'm free or busy so Kendall can help with scheduling"
- "Create, edit, and cancel events on my calendars when I ask"
- "Organize my email labels"
- "See email metadata to help with organization"

## Step 2: Environment Variables

Add these to your `.env.local` file:

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=625035731744-snfv8sd0r7qkfn8kk2r2id26ndio8nad.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

**Important:** 
- Never commit `.env.local` to version control
- For production, update `GOOGLE_REDIRECT_URI` to your production domain
- Keep your Client Secret secure

## Step 3: Install Dependencies

The `googleapis` package should already be installed. If not, run:

```bash
npm install googleapis
```

## Step 4: Airtable Schema Setup

See `GOOGLE_OAUTH_AIRTABLE_SETUP.md` for detailed instructions on adding the required fields to your Airtable table.

Required fields:
- `Google OAuth Access Token` (single line text, encrypted/private)
- `Google OAuth Refresh Token` (single line text, encrypted/private)
- `Google OAuth Token Expiry` (date/time)
- `Google Calendar Connected` (checkbox)
- `Google Gmail Connected` (checkbox)
- `Google Email` (email)

## Step 5: Testing

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to your dashboard with a `recordId`:
   ```
   http://localhost:3000/dashboard?recordId=YOUR_RECORD_ID
   ```

3. Click "Connect Google Account" button

4. You should be redirected to Google's consent screen

5. After granting permissions, you'll be redirected back to the dashboard

6. Verify the connection status shows:
   - ✓ Calendar Connected
   - ✓ Gmail Connected
   - Your Google email address

## API Endpoints

### OAuth Flow

- **GET** `/api/auth/google/authorize?recordId=XXX` - Initiates OAuth flow
- **GET** `/api/auth/google/callback` - Handles OAuth callback (called by Google)
- **GET** `/api/auth/google/status?recordId=XXX` - Check connection status
- **POST** `/api/auth/google/disconnect?recordId=XXX` - Disconnect Google account

## Troubleshooting

### "Invalid redirect URI" error
- Verify the redirect URI in Google Cloud Console matches exactly: `http://localhost:3000/api/auth/google/callback`
- Check that `GOOGLE_REDIRECT_URI` in `.env.local` matches

### "Access denied" error
- Check that all required scopes are added to OAuth consent screen
- Verify the OAuth consent screen is published (if in production)

### Token refresh failures
- Tokens are automatically refreshed when expired
- If refresh fails, user will need to reconnect their Google account

### Airtable field errors
- Ensure all required fields exist in your Airtable table
- Check field names match exactly (case-sensitive)

## Security Notes

- OAuth tokens are stored in Airtable (mark fields as private/encrypted)
- Client Secret is never exposed to client-side code
- CSRF protection via state parameter
- Use HTTPS in production for OAuth redirects

## Next Steps

After setup, you can use the Calendar and Gmail API functions:

```typescript
import { getUserEvents, createEvent } from '@/lib/google/calendar';
import { getLabels, searchMessages } from '@/lib/google/gmail';
```

See the API library files for available functions:
- `lib/google/calendar.ts` - Calendar API functions
- `lib/google/gmail.ts` - Gmail API functions




