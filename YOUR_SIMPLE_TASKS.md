# YOUR SIMPLE TASKS: Accounts & API Keys Only

## WHAT YOU DO (Super Simple)

### ✅ Task 1: Set Up Upstash Account (5-10 minutes)

**Go to:** https://upstash.com

**Steps:**
1. Sign up (use GitHub/Google - fastest)
2. Create Redis Database:
   - Click "Create Database"
   - Name: `kendall-cache` (or any name)
   - Region: Choose closest to you
   - Plan: **Free** (this is enough)
   - Click "Create"
3. Copy these 2 things:
   - **REST URL** (looks like `https://xxx.upstash.io`)
   - **REST Token** (long string)
4. Create Rate Limit:
   - Click "Rate Limit" in left sidebar
   - Click "Create"
   - Name: `chat-rate-limit`
   - Limit: `50`
   - Window: `1 hour`
   - Click "Create"
5. Copy these 2 things:
   - **REST URL** (for rate limit)
   - **REST Token** (for rate limit)

**Give me these 4 values:**
```
UPSTASH_REDIS_REST_URL=?
UPSTASH_REDIS_REST_TOKEN=?
UPSTASH_RATE_LIMIT_REST_URL=?
UPSTASH_RATE_LIMIT_REST_TOKEN=?
```

**OR** add them to your `.env.local` file and tell me when done.

---

### ✅ Task 2: Verify Existing API Keys

**Open your `.env.local` file and check you have:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPI_PRIVATE_KEY`
- `OPENAI_API_KEY`

**If you have those, you're good. If any are missing, let me know.**

---

### ✅ Task 3: After I Build - Run SQL Migrations (Day 2)

**What I Do:**
- Create 3 SQL files in `scripts/migrations/` directory
- I create the directory automatically
- I create all the SQL

**What You Do:**
1. I'll tell you: "Run this file: `scripts/migrations/add_approvals_table.sql`"
2. Open the file I created
3. Copy all the SQL
4. Go to Supabase Dashboard → SQL Editor
5. Paste the SQL
6. Click "Run"
7. Done!

**Repeat for the other 2 SQL files.**

---

## THAT'S IT

**You only need to:**
1. ✅ Set up Upstash account (5-10 min)
2. ✅ Give me 4 credentials (or add to `.env.local`)
3. ✅ Verify existing API keys are set
4. ✅ Run 3 SQL migrations after I create them (Day 2)

**I handle:**
- ✅ Creating all directories
- ✅ Creating all files
- ✅ Writing all code
- ✅ Writing all SQL
- ✅ Everything technical

---

## WHEN TO DO WHAT

### Now (Before I Start Building):
1. Set up Upstash account
2. Give me the 4 credentials
3. Verify existing API keys

### Day 2 (After I Build):
1. Run 3 SQL migrations (I tell you exactly how)
2. Test APIs (I give you test commands)

### Days 4-30 (Your Work):
1. Build UI components
2. Train the system
3. Polish & demo prep

---

**Ready? Set up Upstash and give me the credentials, then I'll start building!**

