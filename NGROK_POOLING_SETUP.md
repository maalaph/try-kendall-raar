# Ngrok Pooling Setup Guide

> **Quick Start**: If you just want to get running fast, see [NGROK_QUICK_START.md](./NGROK_QUICK_START.md)

## Overview

This guide will help you set up Ngrok pooling so both computers can use the same Ngrok domain simultaneously. This is required for your paid Ngrok account to share the domain between multiple development machines.

## Prerequisites

- Paid Ngrok account (pooling doesn't work with free dev domains)
- Ngrok domain ID: `rd_36PUWsmItHti5ks0d5Gp1J7OG9v`
- Ngrok authtoken (same token for both computers)
- Next.js app running on port 3000

## Step 1: Identify Your Domain Name

1. Go to your Ngrok dashboard: https://dashboard.ngrok.com/domains
2. Find the domain with ID `rd_36PUWsmItHti5ks0d5Gp1J7OG9v`
3. Note the domain name (e.g., `your-domain.ngrok.app`)
4. **Write it down** - you'll need it for the next steps

## Step 2: Configure Endpoint for Pooling

1. Go to "Endpoints & Traffic Policy" in your Ngrok dashboard: https://dashboard.ngrok.com/endpoints
2. Find or create an endpoint for your domain:
   - If you see an endpoint with your domain, click on it
   - If not, click "+ New Endpoint" and select your domain
3. **Critical**: Ensure the endpoint is set to "Pooled" mode:
   - Look for a green "Pooled" tag with two person icons
   - If you see "Exclusive" instead, click the endpoint and change it to "Pooled"
4. The endpoint should show:
   - Domain: `your-domain.ngrok.app`
   - Status: "Pooled" (green tag)
   - HTTPS enabled

## Step 3: Set Up Ngrok on Each Computer

### On Computer 1:

1. **Install/Update Ngrok** (if not already installed):
   ```bash
   # macOS
   brew install ngrok/ngrok/ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Configure authtoken** (if not already done):
   ```bash
   ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
   ```
   Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Start Ngrok with your domain**:
   ```bash
   ngrok http 3000 --domain=your-domain.ngrok.app
   ```
   Replace `your-domain.ngrok.app` with your actual domain name from Step 1.

4. **Verify it's working**:
   - You should see: "Forwarding https://your-domain.ngrok.app -> http://localhost:3000"
   - Check the Ngrok dashboard - you should see the connection

### On Computer 2:

1. **Repeat the same steps** as Computer 1:
   ```bash
   ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
   ngrok http 3000 --domain=your-domain.ngrok.app
   ```

2. **Both can run simultaneously** - Ngrok will automatically pool the connections

## Step 4: Update Environment Variables

You need to set the webhook URL so VAPI can reach your application.

### Option A: Local Development (.env.local)

1. **Copy the template file** (if you don't have .env.local yet):
   ```bash
   cp env.template .env.local
   ```

2. **Edit `.env.local`** and add/update the webhook URL:
   ```bash
   # Add this line (replace with your actual domain)
   VAPI_WEBHOOK_URL=https://your-domain.ngrok.app/api/vapi-webhook
   
   # Or use NEXT_PUBLIC_WEBHOOK_URL if you prefer
   NEXT_PUBLIC_WEBHOOK_URL=https://your-domain.ngrok.app/api/vapi-webhook
   ```

3. **Verify your environment variables**:
   ```bash
   node verify-env.js
   ```
   This will check if all required variables are set, including the webhook URL.

4. **Restart your Next.js dev server** after adding the variable

### Option B: Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add:
   - **Name**: `VAPI_WEBHOOK_URL`
   - **Value**: `https://your-domain.ngrok.app/api/vapi-webhook`
   - **Environment**: Production, Preview, Development (select all)
4. Redeploy your application

### Option C: Both (Recommended)

Set it in both places:
- `.env.local` for local development
- Vercel environment variables for production

## Step 5: Verify the Setup

### Check Ngrok Dashboard

1. Go to https://dashboard.ngrok.com/endpoints
2. Find your endpoint
3. Verify:
   - ✅ Status shows "Pooled" (green tag)
   - ✅ Multiple agents connected (if both computers are running)
   - ✅ Traffic is being routed correctly

### Test Webhook Endpoint

1. Make sure your Next.js app is running: `npm run dev`
2. Make sure Ngrok is running on both computers
3. Test the webhook URL in your browser:
   ```
   https://your-domain.ngrok.app/api/vapi-webhook
   ```
   You should see a response (even if it's an error - that means the endpoint is reachable)

### Test with VAPI

1. Make a test call through VAPI
2. Check your application logs to see if webhooks are received
3. Verify that VAPI functions are working correctly

## Troubleshooting

### "Domain not found" error

- Double-check the domain name in Step 1
- Ensure you're using the paid domain, not the free dev domain
- Verify the domain ID matches: `rd_36PUWsmItHti5ks0d5Gp1J7OG9v`

### "Endpoint not pooled" error

- Go to Ngrok dashboard → Endpoints
- Click on your endpoint
- Change from "Exclusive" to "Pooled" mode
- Save the changes

### Webhooks not received

1. **Check Ngrok is running**:
   ```bash
   # Should show active tunnel
   curl http://localhost:4040/api/tunnels
   ```

2. **Check environment variable**:
   ```bash
   # In your Next.js app
   console.log(process.env.VAPI_WEBHOOK_URL)
   ```

3. **Verify the URL format**:
   - Should be: `https://your-domain.ngrok.app/api/vapi-webhook`
   - No trailing slash
   - Uses `https://` not `http://`

### Both computers can't connect

- Ensure both are using the **same** Ngrok authtoken
- Verify both are using the **same** domain name
- Check that the endpoint is set to "Pooled" mode
- Make sure both computers have Ngrok installed and updated

## Quick Reference

**Domain ID**: `rd_36PUWsmItHti5ks0d5Gp1J7OG9v`

**Webhook URL Format**: `https://your-domain.ngrok.app/api/vapi-webhook`

**Ngrok Command**: `ngrok http 3000 --domain=your-domain.ngrok.app`

**Environment Variable**: `VAPI_WEBHOOK_URL=https://your-domain.ngrok.app/api/vapi-webhook`

**Verify Setup**: Run `node verify-env.js` to check all environment variables

**Template File**: Copy `env.template` to `.env.local` and fill in your values

## Next Steps

After completing this setup:
1. ✅ Both computers can run Ngrok simultaneously
2. ✅ Webhooks are configured correctly
3. ✅ VAPI can reach your application
4. ✅ Traffic is pooled across both machines

If you encounter any issues, check the troubleshooting section above or refer to the Ngrok documentation: https://ngrok.com/docs

