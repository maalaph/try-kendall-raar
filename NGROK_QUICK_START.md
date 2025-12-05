# Ngrok Pooling Quick Start

## TL;DR - Get Running in 5 Minutes

### 1. Find Your Domain
- Go to https://dashboard.ngrok.com/domains
- Find domain ID: `rd_36PUWsmItHti5ks0d5Gp1J7OG9v`
- Copy the domain name (e.g., `raar-dev.ngrok.app`)

### 2. Set Endpoint to Pooled
- Go to https://dashboard.ngrok.com/endpoints
- Find your endpoint or create one
- Make sure it shows "Pooled" (green tag with two people)

### 3. Start Ngrok on Each Computer
```bash
ngrok http 3000 --domain=YOUR_DOMAIN.ngrok.app
```

### 4. Add Webhook URL to .env.local
```bash
# Copy template
cp env.template .env.local

# Edit .env.local and add:
VAPI_WEBHOOK_URL=https://YOUR_DOMAIN.ngrok.app/api/vapi-webhook
```

### 5. Verify Everything
```bash
# Check environment variables
node verify-env.js

# Check Ngrok setup (optional)
./scripts/check-ngrok-setup.sh
```

### 6. Restart Your Dev Server
```bash
npm run dev
```

## That's It! 🎉

Both computers can now use the same Ngrok domain simultaneously.

## Need More Help?

- **Full Guide**: See [NGROK_POOLING_SETUP.md](./NGROK_POOLING_SETUP.md)
- **Troubleshooting**: Check the troubleshooting section in the full guide
- **Verify Setup**: Run `node verify-env.js` to check all variables

## Common Issues

**"Domain not found"**
→ Double-check the domain name in your Ngrok dashboard

**"Webhooks not working"**
→ Make sure `VAPI_WEBHOOK_URL` is set in `.env.local` and you restarted the server

**"Can't connect both computers"**
→ Ensure both use the same Ngrok authtoken and the endpoint is set to "Pooled"

