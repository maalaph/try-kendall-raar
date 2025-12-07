# YOUR TASKS: What to Do While I Build

## QUICK REFERENCE - Do These Now (10-15 minutes)

### ✅ Task 1: Create Migration Directory
```bash
cd /Users/rm/Desktop/landing_page
mkdir -p scripts/migrations
```
**Time:** 10 seconds

---

### ✅ Task 2: Set Up Upstash (Redis + Rate Limiting)

**Steps:**
1. Go to https://upstash.com
2. Sign up (use GitHub/Google for quick signup)
3. Create Redis Database:
   - Click "Create Database"
   - Name: `kendall-cache`
   - Region: Choose closest (e.g., `us-east-1`)
   - Plan: **Free** (256MB, 500K commands/month)
   - Click "Create"
4. Copy credentials:
   - REST URL (looks like `https://xxx.upstash.io`)
   - REST Token (long string)
5. Create Rate Limit:
   - Go to "Rate Limit" in left sidebar
   - Click "Create"
   - Name: `chat-rate-limit`
   - Limit: 50
   - Window: 1 hour
   - Click "Create"
6. Copy Rate Limit credentials:
   - REST URL
   - REST Token

**Add to `.env.local`:**
```env
# Upstash Redis (for caching)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token-here

# Upstash Rate Limit (for chat protection)
UPSTASH_RATE_LIMIT_REST_URL=https://your-rate-limit-url.upstash.io
UPSTASH_RATE_LIMIT_REST_TOKEN=your-rate-limit-token-here
```

**Time:** 5-10 minutes

---

### ✅ Task 3: Verify Environment Variables

**Open your `.env.local` and verify you have:**

**Existing (Should Already Have):**
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `VAPI_PRIVATE_KEY`
- [ ] `VAPI_WEBHOOK_URL`
- [ ] `OPENAI_API_KEY`
- [ ] Google OAuth credentials
- [ ] Spotify OAuth credentials

**New (From Task 2):**
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] `UPSTASH_RATE_LIMIT_REST_URL`
- [ ] `UPSTASH_RATE_LIMIT_REST_TOKEN`

**Action:** Check each one. Note any missing.

**Time:** 2 minutes

---

### ✅ Task 4: Test Current System (Baseline)

**Run this to verify current state:**
```bash
npm run dev
```

**Test these quickly:**
1. Open http://localhost:3000
2. Try sending a chat message
3. Check if Google Calendar works (if you have it connected)
4. Check if Spotify works (if you have it connected)
5. Make a note: "What works now: _____"

**Action:** Create a baseline checklist. This helps verify nothing breaks after my changes.

**Time:** 5 minutes

---

### ✅ Task 5: Prepare Test Files

**Get ready for Day 2 testing:**
1. Find or create a sample PDF resume
2. Save it somewhere accessible (e.g., `~/Desktop/test-resume.pdf`)
3. Optional: Get a sample Docx file

**Action:** Have test files ready for document intelligence testing.

**Time:** 2 minutes

---

## OPTIONAL (While I Build - Can Do Later)

### Plan UI Components
- Sketch approval modal design
- Plan approval dashboard layout
- Design location settings page
- Plan document upload UI

### Draft Demo Script
- Write demo flow
- List key scenarios
- Prepare talking points

### Create Test Scenarios
- Approval test scenario
- Location test scenario
- Document test scenario
- VAPI test scenario

---

## CHECKLIST SUMMARY

### Must Do Now (Before I Start):
- [ ] Create `scripts/migrations/` directory
- [ ] Set up Upstash account
- [ ] Add Upstash credentials to `.env.local`
- [ ] Verify all environment variables
- [ ] Test current system (baseline)
- [ ] Prepare test files (resume PDF)

### Can Do Later (While I Build):
- [ ] Plan UI components
- [ ] Draft demo script
- [ ] Create test scenarios list

---

## TOTAL TIME: ~15-20 Minutes

**Do the "Must Do Now" tasks, then you're ready for me to start building!**

Once you've completed the checklist above, let me know and I'll begin building the complete foundation infrastructure.

