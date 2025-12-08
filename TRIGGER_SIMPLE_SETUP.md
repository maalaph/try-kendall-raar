# Simple Trigger.dev Setup - Use Production Key Everywhere ✅

## The Simple Answer

**Yes, use the Production key for both development AND production.** This is totally fine and actually simpler!

## Why This Works

- ✅ **Same key everywhere** = less confusion
- ✅ **Works for testing** = tasks run in cloud, you can test them
- ✅ **Works for deployment** = when you deploy to Vercel, same key works
- ✅ **No coordination needed** = both you and your teammate can work simultaneously
- ✅ **No local worker needed** = tasks run in Trigger.dev's cloud automatically

## Step-by-Step Setup

### 1. Get Your Production Key

1. Go to https://cloud.trigger.dev
2. Select project: **"kendall-backend"**
3. Switch environment from "Development" to **"Production"** (top left)
4. Go to: **Manage → API keys**
5. Copy the **Secret key** (it will start with `tr_prod_...` or similar)

### 2. Update Your `.env.local`

Replace your current dev key with the production key:

```bash
TRIGGER_SECRET_KEY=tr_prod_your_production_key_here
TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec
```

### 3. What Your Teammate Needs to Do

**Exact same thing:**
1. Get the Production key from Trigger.dev dashboard (same steps as above)
2. Add to their `.env.local`:
   ```bash
   TRIGGER_SECRET_KEY=tr_prod_same_production_key
   TRIGGER_PROJECT_ID=proj_hsneehqxymxjwpkwntec
   ```

That's it! Both of you use the same production key.

### 4. For Deployment (Vercel/Production)

When you deploy to Vercel (or any hosting):

1. Add the **same** environment variables in Vercel:
   - `TRIGGER_SECRET_KEY` = same production key
   - `TRIGGER_PROJECT_ID` = `proj_hsneehqxymxjwpkwntec`

2. That's it! It will work automatically.

## Important: You DON'T Need `npm run trigger:dev` Anymore

With production keys:
- ❌ **Don't run** `npm run trigger:dev` (that's only for dev keys)
- ✅ Tasks run automatically in Trigger.dev's cloud
- ✅ You can monitor them in the dashboard at https://cloud.trigger.dev

## Testing It Works

1. Make sure your `.env.local` has the production key
2. Restart your Next.js server: `npm run dev`
3. Trigger a task from your app (e.g., send a chat message that triggers background indexing)
4. Check the Trigger.dev dashboard to see the task execute

## Summary

**Development (local testing):**
- Use Production key in `.env.local`
- Tasks run in cloud automatically
- No `npm run trigger:dev` needed

**Production (Vercel deployment):**
- Use same Production key in Vercel environment variables
- Tasks run in cloud automatically
- Works immediately

**Same key, same setup, everywhere!** 🎉



