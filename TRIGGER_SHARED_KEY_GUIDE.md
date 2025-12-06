# How to Use a Shared Trigger.dev API Key

## Current Status ✅

Your Trigger.dev setup is **configured and working**:
- ✅ `TRIGGER_SECRET_KEY` is set in your `.env.local`
- ✅ `TRIGGER_PROJECT_ID` is configured
- ✅ Ready to use

## Two Options for Sharing Keys

### Option 1: Share One Dev Key (Simple, but Limited) ⚠️

**What this means:**
- Both you and your teammate use the **same** `TRIGGER_SECRET_KEY`
- Tasks will only run on **one person's machine** at a time (whoever has `npm run trigger:dev` running)
- Simple setup - just copy the same key

**How to do it:**

1. **You (current setup):**
   - Your `.env.local` already has your dev key
   - Copy your `TRIGGER_SECRET_KEY` value (starts with `tr_dev_...`)

2. **Your teammate:**
   - Create/update their `.env.local` file
   - Add the **same** `TRIGGER_SECRET_KEY` you're using
   - Add the same `TRIGGER_PROJECT_ID`
   ```bash
   TRIGGER_SECRET_KEY=tr_dev_your_shared_key_here
   TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec
   ```

3. **Important limitation:**
   - Only one person should run `npm run trigger:dev` at a time
   - If both run it, tasks might execute on either machine (unpredictable)
   - Best for: Taking turns, or one person handling all background tasks

---

### Option 2: Use Production/Staging Environment Key (Recommended for Teams) ✅

**What this means:**
- Use a **Production** or **Staging** environment key (not Development)
- Tasks run in Trigger.dev's cloud, not on your local machines
- Both developers can trigger tasks simultaneously
- Better for collaboration

**How to do it:**

1. **Get the Production/Staging key:**
   - Go to https://cloud.trigger.dev
   - Select project: "kendall-backend"
   - Switch environment from "Development" to **"Production"** (or create "Staging")
   - Go to: Manage → API keys
   - Copy the **Production Secret key** (starts with `tr_prod_...` or similar)

2. **Both you and your teammate:**
   - Update `.env.local` to use the Production key:
   ```bash
   TRIGGER_SECRET_KEY=tr_prod_your_production_key_here
   TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec
   ```

3. **Benefits:**
   - ✅ Tasks run in cloud (no local worker needed)
   - ✅ Both can trigger tasks simultaneously
   - ✅ More predictable behavior
   - ✅ Better for team collaboration

4. **Note:**
   - You don't need to run `npm run trigger:dev` with this approach
   - Tasks execute in Trigger.dev's cloud infrastructure
   - You can still monitor them in the dashboard

---

## What Your Teammate Needs to Do

### If Using Option 1 (Shared Dev Key):

1. **Get the key from you:**
   - Ask you for your `TRIGGER_SECRET_KEY` value
   - Get the `TRIGGER_PROJECT_ID` (should be: `proj_hsneehqxymxjwpkwntec`)

2. **Set up their `.env.local`:**
   ```bash
   cd /path/to/landing_page
   # Create or edit .env.local
   TRIGGER_SECRET_KEY=tr_dev_your_shared_key_here
   TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec
   ```

3. **Coordinate:**
   - Only one person runs `npm run trigger:dev` at a time
   - Or decide who handles background tasks

### If Using Option 2 (Production Key):

1. **Get access to Trigger.dev:**
   - Go to https://cloud.trigger.dev
   - Sign in (or create account)
   - Get added to the "kendall-backend" project (if not already)

2. **Get the Production key:**
   - Select project: "kendall-backend"
   - Switch to "Production" environment
   - Go to: Manage → API keys
   - Copy the Production Secret key

3. **Set up their `.env.local`:**
   ```bash
   cd /path/to/landing_page
   # Create or edit .env.local
   TRIGGER_SECRET_KEY=tr_prod_production_key_here
   TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec
   ```

4. **No local worker needed:**
   - They don't need to run `npm run trigger:dev`
   - Tasks run in the cloud automatically

---

## Verification Steps

After setting up, verify it works:

### For Option 1 (Dev Key):
```bash
npm run trigger:dev
```
Look for:
```
[Trigger.dev] Connected to project proj_hsneehqxymxjwpkwntec
[Trigger.dev] Listening for tasks...
```

### For Option 2 (Production Key):
```bash
npx tsx scripts/test-api-keys.ts
```
Should show:
```
Testing TRIGGER_SECRET_KEY/TRIGGER_API_KEY... ✅ SET
```

Then test by triggering a task from your app and check the Trigger.dev dashboard to see it execute.

---

## Recommendation

**For team collaboration, I recommend Option 2 (Production/Staging key)** because:
- ✅ No coordination needed
- ✅ Both can work simultaneously
- ✅ Tasks run reliably in cloud
- ✅ Easier to debug (all tasks in one place)

**Option 1 is fine if:**
- You're taking turns working
- Only one person needs background tasks
- You want tasks to run locally for debugging

---

## Quick Checklist

- [ ] Decide which option (1 or 2)
- [ ] Get the appropriate key (dev or production)
- [ ] Share key and project ID with teammate
- [ ] Both set `.env.local` with same values
- [ ] Verify connection works
- [ ] Test by triggering a task

