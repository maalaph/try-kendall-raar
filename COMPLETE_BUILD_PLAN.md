# COMPLETE FOUNDATION BUILD PLAN

## THE GOAL

**Build comprehensive foundation infrastructure NOW** so you can spend the next 27 days training, enhancing UI/UX, and preparing your demo. This includes everything needed for a production-ready personal assistant.

---

## CURRENT STATE ✅

**What's Already Done:**
- ✅ Supabase fully migrated (all tables)
- ✅ LangGraph with Postgres checkpointer
- ✅ VAPI basic calls working
- ✅ Google Calendar + Gmail integrations
- ✅ Spotify integration
- ✅ Contact management
- ✅ Pattern learning + memory system

**What We're Building:**
- 🔨 Integration Registry System
- 🔨 Approval System (comprehensive)
- 🔨 Enhanced VAPI (IVR navigation, smart endpointing)
- 🔨 Location Services (free browser API)
- 🔨 Document Intelligence & Profile Learning (NEW)
- 🔨 Production Readiness (logging, caching, rate limiting, webhooks)

---

## WHAT I BUILD (Complete Foundation Infrastructure)

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

**Database Migration:**
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

**Database Migration:**
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

-- Keep only last 10 locations per user
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

**Database Migration:**
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
- `lib/documents/loader.ts` - Parse PDF/Docx files (using existing pdf-parse)
- `lib/documents/extractor.ts` - AI chain to extract structured profile data
- `app/api/documents/ingest/route.ts` - Upload endpoint

**Files I Modify:**
- `lib/agent/orchestrator.ts` - Load profile_data and inject into system prompt
- `lib/database.ts` - Add document functions

**Outcome:** Upload resume → Agent knows who you are → Proactive recommendations based on profile.

---

### 6. Production Readiness Enhancements (NEW) 🚀

**Purpose:** Robust, efficient, production-ready system

**Small Tweaks (Quality of Life):**

1. **Structured Logging**
   - `lib/logger.ts` - Structured logger wrapper
   - Replace console.log with logger.info/error/warn
   - Includes context (userId, action, etc.)

2. **Global Error Boundary**
   - Frontend error boundary component
   - Shows "System offline, try again" toast
   - Prevents UI crashes from database failures

**Medium Additions (Performance):**

3. **Redis Caching (Optional but Recommended)**
   - Cache user_profile and patterns
   - Reduces Supabase queries by ~200ms per message
   - Uses Upstash Redis (serverless)

4. **Rate Limiting**
   - Add Upstash Rate Limit to `/api/chat/send`
   - Limit: 50 messages/hour per user
   - Prevents OpenAI credit drain from loops

**Big Additions (Architecture):**

5. **Event Bus / Webhooks**
   - `app/api/webhooks/incoming/route.ts` - Single entry point
   - Handles Gmail push notifications
   - Handles Calendar updates
   - Checks profile_data for urgency before waking agent

**Files I Create:**
- `lib/logger.ts` - Structured logging
- `components/ErrorBoundary.tsx` - Frontend error handling
- `lib/cache/redis.ts` - Redis caching wrapper (optional)
- `lib/rateLimit.ts` - Rate limiting wrapper
- `app/api/webhooks/incoming/route.ts` - Webhook handler

**Files I Modify:**
- Update existing files to use logger instead of console.log
- Add rate limiting to chat endpoint
- Add caching to database queries (optional)

**Outcome:** Production-ready system with proper logging, error handling, performance optimization, and event-driven architecture.

---

## WHAT YOU DO WHILE I BUILD

### Setup Tasks (Do These First)

#### 1. Environment Variables Setup

**Check/Create `.env.local`:**

**Required (Already Have):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPI_PRIVATE_KEY`
- `VAPI_WEBHOOK_URL`
- `OPENAI_API_KEY`
- Google OAuth credentials
- Spotify OAuth credentials

**New (Optional but Recommended):**
- `UPSTASH_REDIS_REST_URL` - For Redis caching (get from Upstash.io)
- `UPSTASH_REDIS_REST_TOKEN` - Redis token
- `UPSTASH_RATE_LIMIT_REST_URL` - For rate limiting
- `UPSTASH_RATE_LIMIT_REST_TOKEN` - Rate limit token

**Action:** Check if you have these. If not, sign up for Upstash (free tier is fine).

---

#### 2. Database Migrations Preparation

**Create Migration Directory:**
```bash
mkdir -p scripts/migrations
```

**Action:** Just create the directory. I'll create the SQL files.

---

#### 3. Review Current Codebase

**Check These Files Still Work:**
- `lib/integrations/google.ts`
- `lib/integrations/spotify.ts`
- `app/api/chat/send/route.ts`
- `lib/agent/orchestrator.ts`

**Action:** Familiarize yourself with the current structure. Note any issues or questions.

---

#### 4. Test Current System

**Before I Start Building:**
1. Start dev server: `npm run dev`
2. Test a chat message
3. Test Google Calendar integration
4. Test VAPI call (if possible)
5. Note any current errors or issues

**Action:** Create a baseline - know what works now so we can verify nothing breaks.

---

#### 5. Prepare Test Scenarios

**Think About:**
- What scenarios will you test after I build?
- What documents/resumes will you upload?
- What approval scenarios to test?
- What location features to test?

**Action:** Write down 3-5 test scenarios you'll run after Day 2.

---

### While I'm Building (You Can Do Parallel Work)

#### 1. UI Component Planning

**Sketch/Plan:**
- Approval modal design
- Approval dashboard layout
- Location settings page
- Document upload UI
- Error boundary design

**Action:** Create wireframes or notes on what the UI should look like.

---

#### 2. Demo Script Preparation

**Create:**
- Demo flow document
- Key scenarios to showcase
- Talking points for each feature
- Backup scenarios if something breaks

**Action:** Start drafting your demo script while I build backend.

---

#### 3. Documentation Notes

**Keep Notes On:**
- Questions you have about the implementation
- Features you want to prioritize
- UI/UX ideas
- Testing observations

**Action:** Keep a running doc of thoughts/ideas while I work.

---

## COMPLETE FILE BREAKDOWN

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
21. `lib/cache/redis.ts` (optional)
22. `lib/rateLimit.ts`
23. `app/api/webhooks/incoming/route.ts`
24. Plus database function additions

### Files I Modify (12 files)

1. `lib/integrations/google.ts` - Migrate to registry
2. `lib/integrations/spotify.ts` - Migrate to registry
3. `app/api/chat/send/route.ts` - Use registry + rate limiting
4. `lib/vapi.ts` - Add endpointing config
5. `app/api/vapi-webhook/route.ts` - Add DTMF handler
6. `lib/agent/orchestrator.ts` - Add approval interrupts + profile injection
7. `lib/agent/functions.ts` - Mark sensitive functions
8. `lib/database.ts` - Add approval, location, document functions
9. Multiple files - Replace console.log with logger
10. Frontend layout - Add error boundary
11. Chat route - Add rate limiting
12. Various files - Add caching (optional)

---

## TIMELINE

### Day 1: Foundation Build

**What I Do:**
- Build integration registry system
- Build approval system backend
- Build VAPI enhancements
- Build location services backend
- Build document intelligence system
- Build production readiness features

**What You Do:**
- Set up environment variables
- Create migration directory
- Test current system (baseline)
- Prepare test scenarios
- Plan UI components
- Start demo script

---

### Day 2: Testing & Fixes

**What I Do:**
- Fix any issues from Day 1
- Add missing features
- Update documentation
- Test integration points

**What You Do:**
- Run database migrations
- Test all API endpoints
- Test document upload
- Test approval flow
- Test location API
- Test VAPI enhancements
- Report any issues

---

### Day 3: Polish & Handoff

**What I Do:**
- Final polish
- Complete documentation
- Performance optimization
- Final testing

**What You Do:**
- Final testing
- Verify everything works
- Prepare for UI development
- Start building UI components

---

### Days 4-30: Your Work

**What You Build:**
- Approval UI (modal + dashboard)
- Location UI (settings + display)
- Document upload UI
- Dashboard enhancements
- Error handling UI

**What You Do:**
- Train the agent
- Upload your resume/documents
- Test all features
- Polish UI/UX
- Prepare demo

---

## DATABASE MIGRATIONS YOU RUN

### Migration 1: Approvals Table

**File:** `scripts/migrations/add_approvals_table.sql`

**Steps:**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy entire SQL content from the file
4. Paste into SQL Editor
5. Click "Run"
6. Verify table `pending_approvals` appears in Table Editor

---

### Migration 2: Locations Table

**File:** `scripts/migrations/add_locations_table.sql`

**Steps:**
1. Open Supabase SQL Editor
2. Copy SQL content from file
3. Paste and run
4. Verify table `user_locations` created
5. Verify trigger `limit_user_locations` exists

---

### Migration 3: Document Intelligence

**File:** `scripts/migrations/add_document_intelligence.sql`

**Steps:**
1. Open Supabase SQL Editor
2. Copy SQL content from file
3. Paste and run
4. Verify table `documents` created
5. Verify `users.profile_data` column added

---

## TESTING CHECKLIST (Day 2)

### Integration Registry Test

- [ ] Start dev server
- [ ] Check console for registry initialization
- [ ] Test Google Calendar integration still works
- [ ] Test Spotify integration still works
- [ ] Verify no errors in logs

---

### Approval System Test

```bash
# Create approval
curl -X POST http://localhost:3000/api/approvals \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "actionType": "purchase",
    "actionParams": {"item": "Laptop", "amount": 999.99},
    "threadId": "test-thread",
    "message": "Purchase laptop for $999.99"
  }'

# Get approvals
curl http://localhost:3000/api/approvals?userId=test-user

# Approve
curl -X PATCH http://localhost:3000/api/approvals/{approvalId} \
  -H "Content-Type: application/json" \
  -d '{"status": "approved", "resolvedBy": "test-user"}'
```

- [ ] Approval created successfully
- [ ] Approval appears in database
- [ ] Can approve/reject via API
- [ ] Status updates correctly

---

### Location Services Test

```bash
# Save location
curl -X POST http://localhost:3000/api/location \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10,
    "label": "current"
  }'

# Get last location
curl http://localhost:3000/api/location?userId=test-user

# Get history
curl http://localhost:3000/api/location/history?userId=test-user
```

- [ ] Location saves successfully
- [ ] Only last 10 locations kept (test by saving 11)
- [ ] History endpoint works
- [ ] Manual location setting works

---

### Document Intelligence Test

```bash
# Upload document (use a real PDF file)
curl -X POST http://localhost:3000/api/documents/ingest \
  -F "file=@/path/to/resume.pdf" \
  -F "userId=test-user" \
  -F "fileType=resume"
```

- [ ] Document uploads successfully
- [ ] Check `documents` table for entry
- [ ] Check `users.profile_data` column populated
- [ ] Ask chat: "What skills do I have?" (should reference resume)

---

### VAPI Enhancements Test

- [ ] Make test call through VAPI
- [ ] Check webhook logs for endpointing configuration
- [ ] Test DTMF tool (if you have IVR to test with)
- [ ] Verify call phase tracking works

---

## SUCCESS CRITERIA

### By End of Day 3, You Will Have:

✅ **Integration Registry**
- Standardized integration development
- Error handling built-in
- Easy to add new integrations

✅ **Approval System**
- All sensitive actions require approval
- Backend fully functional
- Ready for UI development

✅ **Enhanced VAPI**
- Smart endpointing configured
- DTMF tool available
- Better call handling

✅ **Location Services**
- Backend ready
- Free browser geolocation
- Last 10 locations stored

✅ **Document Intelligence**
- Resume/document parsing
- Profile extraction
- Proactive recommendations enabled

✅ **Production Ready**
- Structured logging
- Error boundaries
- Rate limiting
- Optional caching
- Webhook infrastructure

---

## QUESTIONS TO ANSWER BEFORE I START

1. **Redis Caching:** Do you want Redis caching? (Recommended - reduces latency, but requires Upstash account)
   - Option A: Yes, I'll set up Upstash
   - Option B: No, skip caching for now

2. **Rate Limiting:** Do you want rate limiting on chat? (Recommended - prevents credit drain)
   - Option A: Yes, add it
   - Option B: No, skip for now

3. **Document Types:** Which document types should we support initially?
   - Option A: Just PDFs (resumes)
   - Option B: PDFs + Docx
   - Option C: PDFs + Docx + Images (OCR)

4. **Error Boundary:** Should error boundary show a custom message or generic?
   - Option A: Custom branded message
   - Option B: Generic "Something went wrong"

---

## READY TO START?

**Once you answer the questions above, I'll start building immediately.**

**While I build, you:**
1. Set up environment variables
2. Create migration directory
3. Test current system (baseline)
4. Prepare test scenarios
5. Plan UI components

**Let me know your answers and I'll begin!**



