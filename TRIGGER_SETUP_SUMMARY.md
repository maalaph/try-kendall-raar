# Recommended Setup: Use Production Key Everywhere ✅

## The Simple Answer

**Use the Production key for BOTH development and production.** This is the simplest approach and works perfectly for testing and deployment.

## Current Status

✅ **Your setup:**
- `TRIGGER_SECRET_KEY`: Currently set to dev key (`tr_dev_...`)
- `TRIGGER_PROJECT_ID`: `proj_hsneehqxymxjwpkwntec`
- **Recommendation:** Switch to Production key (see below)

---

## What to Do: Switch to Production Key

### Step 1: Get Production Key

1. Go to https://cloud.trigger.dev
2. Select project: **"kendall-backend"**
3. Switch environment to **"Production"** (top left dropdown)
4. Go to: **Manage → API keys**
5. Copy the **Secret key** (starts with `tr_prod_...`)

### Step 2: Update Your `.env.local`

Replace your current key:
```bash
TRIGGER_SECRET_KEY=tr_prod_your_production_key_here
TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec
```

### Step 3: What Your Teammate Does

**Same exact thing:**
- Get the Production key from dashboard
- Add to their `.env.local` with same values
- Done!

### Step 4: For Deployment

When you deploy to Vercel, add the **same** environment variables:
- `TRIGGER_SECRET_KEY` = same production key
- `TRIGGER_PROJECT_ID` = `proj_hsneehqxymxjwpkwntec`

**That's it! Same key everywhere works perfectly.**

---

## Important Notes

- ❌ **Don't run** `npm run trigger:dev` anymore (only needed for dev keys)
- ✅ Tasks run automatically in Trigger.dev's cloud
- ✅ Both you and teammate can work simultaneously
- ✅ Works for testing AND production deployment

---

## Full Guide

See `TRIGGER_SIMPLE_SETUP.md` for complete step-by-step instructions.

