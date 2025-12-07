# MASTER BUILD PLAN: Foundation Infrastructure

## THE GOAL

**Build comprehensive foundation infrastructure NOW** so you can spend the next 27 days training, enhancing UI/UX, and preparing your demo. This creates the base for a complete, production-ready personal assistant.

---

## CLEAR DIVISION: WHAT I DO vs. WHAT YOU DO

### ✅ WHAT I DO (All Technical Work)

**I handle 100% of:**
- Creating all directories (including `scripts/migrations/`)
- Creating all 24 new files
- Modifying all 12 existing files
- Writing all SQL migrations
- Writing all code
- All technical setup

**You don't create any files or directories. I do everything technical.**

---

### ✅ WHAT YOU DO (Accounts & API Keys Only)

**Your 3 simple tasks:**

1. **Set up Upstash account** (5-10 minutes)
   - Create Redis database
   - Create Rate Limit
   - Give me 4 credentials

2. **Verify existing API keys**
   - Check your `.env.local` has all required keys

3. **Run 3 SQL migrations** (Day 2 - after I create them)
   - Copy SQL from files I create
   - Paste into Supabase SQL Editor
   - Click "Run"

**That's literally it. Everything else is on me.**

---

## WHAT I BUILD (Complete Foundation)

### 1. Integration Registry System

**Purpose:** Standardized integration development - plug-and-play system

**Files I Create:**
- `lib/integrations/registry.ts` - Central registry
- `lib/integrations/types.ts` - Type definitions
- `lib/integrations/base.ts` - Base class
- `lib/integrations/errorHandler.ts` - Unified error handling
- `lib/integrations/retry.ts` - Exponential backoff retry
- `lib/integrations/rateLimiter.ts` - Rate limiting per integration

**Files I Modify:**
- `lib/integrations/google.ts` - Migrate to registry
- `lib/integrations/spotify.ts` - Migrate to registry
- `app/api/chat/send/route.ts` - Use registry for function loading

**What This Enables:**
- Adding new integrations = implement interface + register
- Automatic error handling and retries
- Rate limiting built-in
- No more custom error handling code

---

### 2. Approval System Backend (COMPREHENSIVE)

**Purpose:** Safe execution of ALL sensitive actions (purchases, financial, bookings, etc.)

**Database Migration I Create:**
- `scripts/migrations/add_approvals_table.sql`

**Files I Create:**
- `lib/agent/approvalHandler.ts` - Approval interrupt logic
- `app/api/approvals/route.ts` - API endpoints

**Files I Modify:**
- `lib/database.ts` - Add approval functions
- `lib/agent/orchestrator.ts` - Add interrupt_before for sensitive functions
- `lib/agent/functions.ts` - Mark sensitive functions

**Approval Types:**
- `purchase` - Any purchase transaction
- `payment` - Paying bills, invoices
- `transfer` - Money transfers
- `booking` - Expensive bookings/services
- `subscription` - Subscription changes
- `financial` - Any financial action
- `irreversible` - Actions that can't be undone

**What This Enables:**
- Agent pauses before sensitive actions
- Creates approval record in database
- Waits for your approval/rejection
- Resumes execution with decision

---

### 3. Enhanced VAPI Configuration

**Purpose:** Better call handling, IVR navigation, adaptive silence detection

**Files I Create:**
- `lib/vapi/smartEndpointing.ts` - Dynamic endpointing logic
- `lib/vapi/dtmf.ts` - DTMF tool implementation (RFC 2833)

**Files I Modify:**
- `lib/vapi.ts` - Add endpointing configuration
- `app/api/vapi-webhook/route.ts` - Add DTMF handler

**Features:**
- Smart endpointing (IVR phase vs. human phase)
- DTMF tool (navigate phone menus by pressing keys)
- Call phase tracking

---

### 4. Location Services Backend

**Purpose:** Store/retrieve location data using FREE browser geolocation API

**Database Migration I Create:**
- `scripts/migrations/add_locations_table.sql`

**Files I Create:**
- `lib/location/browserGeolocation.ts` - Frontend helper
- `app/api/location/route.ts` - API endpoints

**Files I Modify:**
- `lib/database.ts` - Add location functions

**Features:**
- Stores last 10 locations automatically
- Manual home/work location setting
- FREE (uses browser geolocation API)

---

### 5. Document Intelligence & Profile Learning (NEW)

**Purpose:** Parse resumes/documents, extract structured profile data, enable proactive recommendations

**Database Migration I Create:**
- `scripts/migrations/add_document_intelligence.sql`

**Files I Create:**
- `lib/documents/loader.ts` - Parse PDF/Docx files
- `lib/documents/extractor.ts` - AI chain to extract profile data
- `app/api/documents/ingest/route.ts` - Upload endpoint

**Files I Modify:**
- `lib/agent/orchestrator.ts` - Load profile_data and inject into system prompt
- `lib/database.ts` - Add document functions

**Features:**
- PDF + Docx parsing
- Resume/profile extraction
- Proactive recommendations enabled

---

### 6. Production Readiness Enhancements

**Purpose:** Robust, efficient, production-ready system

**Files I Create:**
- `lib/logger.ts` - Structured logging
- `components/ErrorBoundary.tsx` - Custom branded error handling
- `lib/cache/redis.ts` - Redis caching wrapper (Upstash)
- `lib/rateLimit.ts` - Rate limiting wrapper (Upstash)
- `app/api/webhooks/incoming/route.ts` - Webhook handler

**Files I Modify:**
- Multiple files - Replace console.log with logger
- Frontend layout - Add error boundary
- Chat route - Add rate limiting (50 messages/hour)
- Various files - Add Redis caching

**Features:**
- Structured logging
- Error boundaries
- Redis caching (reduces latency)
- Rate limiting (prevents credit drain)
- Webhook infrastructure

---

## WHAT YOU DO (Super Simple)

### NOW (Before I Start Building):

#### Task 1: Set Up Upstash Account (5-10 minutes)

**Steps:**
1. Go to https://upstash.com
2. Sign up (GitHub/Google login is fastest)
3. Create Redis Database:
   - Click "Create Database"
   - Name: `kendall-cache`
   - Region: Choose closest
   - Plan: **Free** (256MB, 500K commands/month)
   - Click "Create"
4. Copy 2 credentials:
   - REST URL
   - REST Token
5. Create Rate Limit:
   - Click "Rate Limit" in sidebar
   - Click "Create"
   - Name: `chat-rate-limit`
   - Limit: 50
   - Window: 1 hour
   - Click "Create"
6. Copy 2 credentials:
   - REST URL
   - REST Token

**Give me these 4 values (or add to `.env.local`):**
```
UPSTASH_REDIS_REST_URL=?
UPSTASH_REDIS_REST_TOKEN=?
UPSTASH_RATE_LIMIT_REST_URL=?
UPSTASH_RATE_LIMIT_REST_TOKEN=?
```

#### Task 2: Verify Existing API Keys

**Check your `.env.local` has:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPI_PRIVATE_KEY`
- `OPENAI_API_KEY`

**If you have those, you're good.**

---

### DAY 2 (After I Build):

#### Task 3: Run 3 SQL Migrations

**What I Create:**
- `scripts/migrations/add_approvals_table.sql`
- `scripts/migrations/add_locations_table.sql`
- `scripts/migrations/add_document_intelligence.sql`

**What You Do (for each file):**
1. I'll tell you: "Run this SQL file"
2. Open the file I created
3. Copy all the SQL
4. Go to Supabase Dashboard → SQL Editor
5. Paste SQL
6. Click "Run"
7. Verify table created

**Repeat for all 3 files.**

---

## COMPLETE FILE LIST

### Files I Create (24 new files)

**Integration Registry (6 files):**
1. `lib/integrations/registry.ts`
2. `lib/integrations/types.ts`
3. `lib/integrations/base.ts`
4. `lib/integrations/errorHandler.ts`
5. `lib/integrations/retry.ts`
6. `lib/integrations/rateLimiter.ts`

**Approval System (3 files):**
7. `scripts/migrations/add_approvals_table.sql`
8. `lib/agent/approvalHandler.ts`
9. `app/api/approvals/route.ts`

**VAPI Enhancements (2 files):**
10. `lib/vapi/smartEndpointing.ts`
11. `lib/vapi/dtmf.ts`

**Location Services (3 files):**
12. `scripts/migrations/add_locations_table.sql`
13. `lib/location/browserGeolocation.ts`
14. `app/api/location/route.ts`

**Document Intelligence (4 files):**
15. `scripts/migrations/add_document_intelligence.sql`
16. `lib/documents/loader.ts`
17. `lib/documents/extractor.ts`
18. `app/api/documents/ingest/route.ts`

**Production Readiness (6 files):**
19. `lib/logger.ts`
20. `components/ErrorBoundary.tsx`
21. `lib/cache/redis.ts`
22. `lib/rateLimit.ts`
23. `app/api/webhooks/incoming/route.ts`
24. Plus database function additions

### Files I Modify (12 files)

1. `lib/integrations/google.ts`
2. `lib/integrations/spotify.ts`
3. `app/api/chat/send/route.ts`
4. `lib/vapi.ts`
5. `app/api/vapi-webhook/route.ts`
6. `lib/agent/orchestrator.ts`
7. `lib/agent/functions.ts`
8. `lib/database.ts`
9. Multiple files (logger migration)
10. Frontend layout (error boundary)
11. Chat route (rate limiting)
12. Various files (caching)

---

## TIMELINE

### Day 1: Foundation Build

**I Build:**
- All 24 new files
- All 12 file modifications
- All directory structures
- All SQL migrations
- Complete foundation infrastructure

**You Do:**
- Set up Upstash account
- Give me 4 credentials
- Verify existing API keys

---

### Day 2: Testing & Migrations

**I Do:**
- Fix any issues
- Update code if needed

**You Do:**
- Run 3 SQL migrations
- Test all APIs
- Report any issues

---

### Day 3: Polish & Handoff

**I Do:**
- Final polish
- Documentation

**You Do:**
- Final testing
- Prepare for UI development

---

### Days 4-30: Your Work

**You Build:**
- Approval UI (modal + dashboard)
- Location UI (settings + display)
- Document upload UI
- Dashboard enhancements

**You Do:**
- Train the agent
- Upload your resume/documents
- Test all features
- Polish UI/UX
- Prepare demo

---

## DELIVERABLES

### By End of Day 3:

✅ **Integration Registry System**
- Standardized integration development
- Easy to add new integrations

✅ **Approval System Backend**
- All sensitive actions require approval
- Backend fully functional

✅ **Enhanced VAPI**
- Smart endpointing configured
- DTMF tool available
- Better call handling

✅ **Location Services Backend**
- Free browser geolocation
- Last 10 locations stored

✅ **Document Intelligence**
- Resume/document parsing
- Profile extraction
- Proactive recommendations enabled

✅ **Production Ready**
- Structured logging
- Error boundaries
- Redis caching
- Rate limiting
- Webhook infrastructure

---

## YOUR CHECKLIST

### Before I Start Building:
- [ ] Set up Upstash account (5-10 min)
- [ ] Give me 4 Upstash credentials
- [ ] Verify existing API keys are set

### Day 2 (After I Build):
- [ ] Run 3 SQL migrations (I'll tell you exactly how)

### Days 4-30:
- [ ] Build UI components
- [ ] Train the system
- [ ] Polish & demo prep

---

## COST

**Total Additional Cost: $0**

- Upstash Redis: Free tier (256MB, 500K commands/month)
- Upstash Rate Limit: Free tier
- Browser Geolocation: Free
- Everything else: Using existing services

---

## READY TO START?

**I'm ready to build everything now. You:**

1. ✅ Set up Upstash account (5-10 minutes)
2. ✅ Give me the 4 credentials
3. ✅ Verify existing API keys

**Then I start building the complete foundation infrastructure immediately!**

**I handle all directories, all files, all code. You just set up accounts and give me keys.**

