# COMPLETE FOUNDATION BUILD PLAN

## THE GOAL

**Build comprehensive foundation infrastructure NOW** so you can spend the next 27 days training, enhancing UI/UX, and preparing your demo. This is a complete, production-ready personal assistant.

---

## CLEAR DIVISION OF WORK

### I DO (Everything Technical):
- ✅ Create ALL directories (including `scripts/migrations/`)
- ✅ Create ALL 24 new files
- ✅ Modify ALL 12 existing files
- ✅ Write ALL SQL migrations
- ✅ Write ALL code
- ✅ Handle ALL technical setup

### YOU DO (Only Accounts & Running SQL):
- ✅ Set up Upstash account (5-10 minutes)
- ✅ Give me 4 Upstash credentials
- ✅ Verify existing API keys
- ✅ Run 3 SQL migrations in Supabase (after I create them)

**That's it. Everything else is on me.**

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

**Outcome:** Adding new integrations = implement interface + register. No custom error handling code.

---

### 2. Approval System Backend (COMPREHENSIVE)
**Purpose:** Safe execution of ALL sensitive actions (purchases, financial, bookings, etc.)

**Database Migration I Create:**
- `scripts/migrations/add_approvals_table.sql`

**SQL Schema:**
```sql
CREATE TABLE IF NOT EXISTS pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_params JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  thread_id TEXT,
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_user_id ON pending_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON pending_approvals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON pending_approvals(status, created_at) WHERE status = 'pending';
```

**Files I Create:**
- `lib/agent/approvalHandler.ts` - Approval interrupt logic
- `app/api/approvals/route.ts` - API endpoints (GET, POST, PATCH)

**Files I Modify:**
- `lib/database.ts` - Add approval functions:
  - `createPendingApproval(userId, actionType, params, threadId, message)`
  - `getPendingApprovals(userId, status?)`
  - `getApprovalById(approvalId)`
  - `updateApprovalStatus(approvalId, status, resolvedBy)`
  - `getPendingApprovalsForUser(userId)`
- `lib/agent/orchestrator.ts` - Add interrupt_before for sensitive functions
- `lib/agent/functions.ts` - Mark sensitive functions with approval metadata

**Approval Types Supported:**
- `purchase` - Any purchase transaction
- `payment` - Paying bills, invoices
- `transfer` - Money transfers
- `booking` - Expensive bookings/services
- `subscription` - Subscription changes
- `financial` - Any financial action
- `irreversible` - Actions that can't be undone

**Outcome:** Agent pauses before sensitive actions, creates approval record, waits for your decision, resumes execution.

---

### 3. Enhanced VAPI Configuration
**Purpose:** Better call handling, IVR navigation, adaptive silence detection

**Files I Create:**
- `lib/vapi/smartEndpointing.ts` - Dynamic endpointing logic
- `lib/vapi/dtmf.ts` - DTMF tool implementation (RFC 2833)

**Files I Modify:**
- `lib/vapi.ts` - Add endpointing configuration
- `app/api/vapi-webhook/route.ts` - Add DTMF handler and call phase tracking

**Configuration:**
```typescript
// First 30 seconds: IVR mode (2 second silence tolerance)
// After 30 seconds: Human mode (600ms silence tolerance)
endpointing: {
  waitTime: (callDuration) => {
    if (callDuration < 30) return 2000; // IVR phase
    return 600; // Human phase
  }
}
```

**Outcome:** Agent can navigate IVR menus without interrupting. Faster responses when talking to humans.

---

### 4. Location Services Backend
**Purpose:** Store/retrieve location data using FREE browser geolocation API

**Database Migration I Create:**
- `scripts/migrations/add_locations_table.sql`

**SQL Schema:**
```sql
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_created ON user_locations(user_id, created_at DESC);

-- Keep only last 10 locations per user (auto-deletes older ones)
CREATE OR REPLACE FUNCTION maintain_location_limit()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM user_locations
  WHERE user_id = NEW.user_id
  AND id NOT IN (
    SELECT id FROM user_locations
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    LIMIT 10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER limit_user_locations
AFTER INSERT ON user_locations
FOR EACH ROW EXECUTE FUNCTION maintain_location_limit();
```

**Files I Create:**
- `lib/location/browserGeolocation.ts` - Frontend helper for browser API
- `app/api/location/route.ts` - API endpoints

**Files I Modify:**
- `lib/database.ts` - Add location functions:
  - `saveUserLocation(userId, lat, lng, accuracy, label)`
  - `getUserLastLocation(userId)`
  - `getUserLocationHistory(userId, limit)`
  - `setUserLocationLabel(userId, label, lat, lng)`

**Outcome:** Backend ready to store/retrieve location. Free browser geolocation (no API costs). Last 10 locations stored automatically.

---

### 5. Document Intelligence & Profile Learning (NEW) 📄
**Purpose:** Parse resumes/documents, extract structured profile data, enable proactive recommendations

**Database Migration I Create:**
- `scripts/migrations/add_document_intelligence.sql`

**SQL Schema:**
```sql
-- Store raw text and embeddings for document RAG
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add profile_context to users table for "always-on" knowledge
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;
```

**Files I Create:**
- `lib/documents/loader.ts` - Parse PDF/Docx files
- `lib/documents/extractor.ts` - AI chain to extract structured profile data
- `app/api/documents/ingest/route.ts` - Upload endpoint

**Files I Modify:**
- `lib/agent/orchestrator.ts` - Load profile_data and inject into system prompt
- `lib/database.ts` - Add document functions

**Outcome:** Upload resume → Agent knows who you are → Proactive recommendations based on profile.

---

### 6. Production Readiness Enhancements (NEW) 🚀
**Purpose:** Robust, efficient, production-ready system

**Small Tweaks:**
- `lib/logger.ts` - Structured logging (replaces console.log)
- `components/ErrorBoundary.tsx` - Custom branded error handling

**Performance:**
- `lib/cache/redis.ts` - Redis caching wrapper (Upstash)
- `lib/rateLimit.ts` - Rate limiting wrapper (Upstash)
- `app/api/chat/send/route.ts` - Add rate limiting (50 messages/hour)

**Architecture:**
- `app/api/webhooks/incoming/route.ts` - Single webhook entry point

**Files I Modify:**
- Multiple files - Replace console.log with logger
- Frontend layout - Add error boundary
- Chat route - Add rate limiting
- Various files - Add Redis caching

**Outcome:** Production-ready system with proper logging, error handling, performance optimization.

---

## WHAT YOU DO (Super Simple)

### NOW (Before I Start Building):

#### 1. Set Up Upstash Account (5-10 minutes)

**Go to:** https://upstash.com

**Steps:**
1. Sign up (GitHub/Google login is fastest)
2. Create Redis Database:
   - Click "Create Database"
   - Name: `kendall-cache`
   - Region: Choose closest
   - Plan: **Free** (256MB, 500K commands/month)
   - Click "Create"
3. Copy 2 credentials:
   - REST URL
   - REST Token
4. Create Rate Limit:
   - Click "Rate Limit" in sidebar
   - Click "Create"
   - Name: `chat-rate-limit`
   - Limit: 50
   - Window: 1 hour
   - Click "Create"
5. Copy 2 credentials:
   - REST URL
   - REST Token

**Give me these 4 values (or add to `.env.local`):**
```
UPSTASH_REDIS_REST_URL=?
UPSTASH_REDIS_REST_TOKEN=?
UPSTASH_RATE_LIMIT_REST_URL=?
UPSTASH_RATE_LIMIT_REST_TOKEN=?
```

#### 2. Verify Existing API Keys

**Check your `.env.local` has:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPI_PRIVATE_KEY`
- `OPENAI_API_KEY`

**If you have those, you're good.**

---

### DAY 2 (After I Build):

#### Run 3 SQL Migrations

**What I Create:**
- `scripts/migrations/add_approvals_table.sql`
- `scripts/migrations/add_locations_table.sql`
- `scripts/migrations/add_document_intelligence.sql`

**What You Do:**
1. I'll tell you: "Run this SQL file"
2. Open the file I created
3. Copy all the SQL
4. Go to Supabase Dashboard → SQL Editor
5. Paste SQL
6. Click "Run"
7. Verify table created

**Repeat for all 3 files.**

---

## COMPLETE FILE BREAKDOWN

### Files I Create (24 new files)

**Integration Registry (6):**
1. `lib/integrations/registry.ts`
2. `lib/integrations/types.ts`
3. `lib/integrations/base.ts`
4. `lib/integrations/errorHandler.ts`
5. `lib/integrations/retry.ts`
6. `lib/integrations/rateLimiter.ts`

**Approval System (3):**
7. `scripts/migrations/add_approvals_table.sql`
8. `lib/agent/approvalHandler.ts`
9. `app/api/approvals/route.ts`

**VAPI Enhancements (2):**
10. `lib/vapi/smartEndpointing.ts`
11. `lib/vapi/dtmf.ts`

**Location Services (3):**
12. `scripts/migrations/add_locations_table.sql`
13. `lib/location/browserGeolocation.ts`
14. `app/api/location/route.ts`

**Document Intelligence (4):**
15. `scripts/migrations/add_document_intelligence.sql`
16. `lib/documents/loader.ts`
17. `lib/documents/extractor.ts`
18. `app/api/documents/ingest/route.ts`

**Production Readiness (6):**
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
**I Build:** All 24 files + 12 modifications  
**You Do:** Set up Upstash, give me credentials

### Day 2: Testing
**I Fix:** Any issues  
**You Do:** Run 3 SQL migrations, test APIs

### Day 3: Polish
**I Do:** Final polish  
**You Do:** Final testing

### Days 4-30: Your Work
**You Build:** UI components, train system, polish, demo prep

---

## YOUR CHECKLIST

### Before I Start:
- [ ] Set up Upstash account (5-10 min)
- [ ] Give me 4 Upstash credentials
- [ ] Verify existing API keys

### Day 2 (After I Build):
- [ ] Run 3 SQL migrations (I'll tell you exactly how)

---

## READY?

**Do the 3 tasks above, then I'll start building everything immediately!**

**I handle all directories, all files, all code. You just set up accounts and give me keys.**

