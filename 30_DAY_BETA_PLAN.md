# 30-Day Beta Foundation Plan: Build the Base, Move Fast

## The Goal

**30 days to beta demo.** Build the FOUNDATIONAL INFRASTRUCTURE so you can add integrations fast without errors, fallbacks, or constant debugging. Focus on what enables rapid iteration, not perfection.

---

## What You Already Have ✅

- LangGraph with Postgres checkpointer (already implemented!)
- VAPI basic calls working
- Google Calendar + Gmail integrations
- Contact management
- Pattern learning + memory
- Database schema foundation

**You're not starting from zero. You're building on solid ground.**

---

## THE 30-DAY PLAN

### WEEK 1: Integration Foundation (Days 1-7)

**Goal:** Build the base layer so adding new integrations is plug-and-play, not custom code every time.

#### Day 1-2: Integration Registry System
**Files to Create:**
- `lib/integrations/registry.ts` - Central registry for all integrations
- `lib/integrations/types.ts` - Standard integration interface
- `lib/integrations/base.ts` - Base class for all integrations

**What It Does:**
- Standardized way to register integrations
- Automatic error handling and retries
- Unified OAuth flow management
- Function schema generation for LangGraph

**Why First:** Every new integration uses this. Without it, you're writing custom code every time.

#### Day 3-4: Error Handling & Retry Infrastructure
**Files to Create:**
- `lib/integrations/errorHandler.ts` - Standard error handling
- `lib/integrations/retry.ts` - Exponential backoff retry logic
- `lib/integrations/rateLimiter.ts` - Rate limiting per integration

**What It Does:**
- Catches errors before they crash the system
- Retries failed API calls intelligently
- Prevents API rate limit issues
- Logs errors in a structured way

**Why Critical:** No more silent failures. Everything either works or tells you exactly why it failed.

#### Day 5-7: Refactor Existing Integrations
**Files to Modify:**
- `lib/integrations/google.ts` - Migrate to registry system
- `lib/integrations/spotify.ts` - Migrate to registry system
- `app/api/chat/send/route.ts` - Use registry for function loading

**What It Does:**
- Proves the registry system works
- Gives you a template for new integrations
- Eliminates custom error handling code

**Outcome:** Adding a new integration = implement interface, register it, done. No more debugging integration-specific issues.

---

### WEEK 2: Approval System Foundation (Days 8-14)

**Goal:** Safe execution of sensitive actions. Can't demo purchases or financial actions without this.

#### Day 8-9: Database + API Layer
**Files to Create:**
- Database migration: `pending_approvals` table
- `lib/database.ts` - Add approval CRUD functions
- `app/api/approvals/route.ts` - Approval API (GET list, POST approve/reject)

**Schema:**
```sql
CREATE TABLE pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'purchase', 'financial', 'call_transfer'
  action_params JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
```

#### Day 10-11: LangGraph Integration
**Files to Modify:**
- `lib/agent/orchestrator.ts` - Add interrupt_before for sensitive tools
- `lib/agent/functions.ts` - Mark sensitive functions

**What It Does:**
- Agent pauses before executing sensitive actions
- Creates approval record
- Waits for user approval before continuing

#### Day 12-14: Frontend UI
**Files to Create:**
- `components/ApprovalRequests.tsx` - Approval list + actions
- `app/dashboard/approvals/page.tsx` - Approval dashboard page
- Real-time updates (polling or websockets)

**UI Features:**
- List of pending approvals
- Approve/Reject buttons
- Action details display
- Notification badge

**Outcome:** You can safely demo purchases, financial actions, complex calls. Agent asks permission before doing anything risky.

---

### WEEK 3: Enhanced VAPI + Location (Days 15-21)

**Goal:** Better call handling for demo + location intelligence.

#### Day 15-16: VAPI Smart Endpointing
**Files to Modify:**
- `lib/vapi.ts` - Add endpointing configuration
- `app/api/vapi-webhook/route.ts` - Track call phase

**What It Does:**
- Adjusts silence detection based on call phase (IVR vs. human)
- Reduces interruptions during IVR menus
- Faster responses when talking to humans

**Configuration:**
```typescript
// First 30 seconds: IVR mode (longer silence tolerance)
// After 30 seconds: Human mode (faster responses)
```

#### Day 17-18: DTMF Tool for IVR Navigation
**Files to Create:**
- `lib/vapi/dtmf.ts` - DTMF tool implementation
- Add `send_dtmf` function to VAPI agent config

**What It Does:**
- Navigate phone menus by pressing keys
- Handle "Press 1 for X" scenarios
- Support wait characters (w = 0.5s, W = 1s)

**Research Alignment:** RFC 2833 out-of-band signaling from your research.

#### Day 19-21: Basic Location Services (FREE)
**Files to Create:**
- `lib/location/browserGeolocation.ts` - Frontend location service
- `app/api/location/route.ts` - Backend location storage
- Database migration: Add `user_locations` table

**What It Does:**
- Browser geolocation API (free, no API keys needed)
- Store last known location
- Manual "set home/work" addresses
- Simple location history

**Schema:**
```sql
CREATE TABLE user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  latitude DECIMAL NOT NULL,
  longitude DECIMAL NOT NULL,
  accuracy INTEGER,
  label TEXT, -- 'home', 'work', 'current'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Outcome:** Location-aware features work. No Google Maps API costs yet.

---

### WEEK 4: Polish + Demo Prep (Days 22-30)

**Goal:** Make it demo-ready. Fix bugs, add polish, prepare showcase.

#### Day 22-24: Integration Testing & Bug Fixes
- Test all integrations end-to-end
- Fix any error handling issues
- Add logging for demo visibility
- Performance optimization

#### Day 25-27: Demo Features
**What to Add:**
- Dashboard improvements (show integrations, approvals, location)
- Better error messages for users
- Loading states and feedback
- Demo script/test cases

#### Day 28-30: Documentation & Handoff
- Document how to add new integrations
- API documentation
- Demo preparation
- Final testing

---

## WHAT YOU GET IN 30 DAYS

### ✅ Foundation Infrastructure
1. **Integration Registry** - Add new integrations in hours, not days
2. **Error Handling** - No more silent failures or random crashes
3. **Approval System** - Safe execution of sensitive actions
4. **Enhanced VAPI** - Better call handling for demos
5. **Location Services** - Free location tracking

### ✅ What You Can Demo
- ✅ Complex phone calls with IVR navigation
- ✅ Safe purchase workflows (with approvals)
- ✅ Location-aware recommendations
- ✅ Multiple integrations working smoothly
- ✅ Reliable error handling

### ✅ What You Can Build Next (Fast)
- New integrations: Just implement interface, register, done
- Financial features: Approval system ready, just add Plaid
- Commerce features: Approval system ready, just add Stripe/Rye
- Advanced location: Base is there, add PostGIS later

---

## YOUR ACTION ITEMS

### Setup Tasks (Do These First)

1. **Review Integration Registry Design**
   - Check `lib/integrations/registry.ts` design
   - Confirm it matches your vision
   - Adjust if needed

2. **Set Up Database Migrations**
   - Create migration files in `scripts/`
   - Test on local Supabase
   - Plan deployment strategy

3. **VAPI Configuration Review**
   - Check current VAPI setup
   - Identify what needs endpointing config
   - Test DTMF capabilities

4. **Environment Variables**
   - List all API keys you'll need
   - Set up development keys
   - Document required env vars

### Daily Check-ins

**Each Day:**
- What did you build?
- Any blockers?
- What's next?

**End of Week:**
- Demo what you built
- Test with real scenarios
- Fix any critical bugs

---

## TECHNICAL DECISIONS TO MAKE NOW

### 1. Approval UI: Where Should It Live?

**Options:**
- A) Dashboard page (`/dashboard/approvals`)
- B) Modal overlay (appears when needed)
- C) Sidebar component (always visible)

**Recommendation:** Start with A (dedicated page), add B (modal) for urgent approvals.

### 2. Location Storage: How Much Data?

**Options:**
- A) Last location only (simple, minimal storage)
- B) Last 10 locations (basic history)
- C) Full history with timestamps (advanced)

**Recommendation:** Start with A, migrate to B if needed for demo.

### 3. Integration Error Handling: How Aggressive?

**Options:**
- A) Fail silently, log error (current)
- B) Retry 3 times, then notify user
- C) Retry with exponential backoff, notify on final failure

**Recommendation:** C - Users see what failed and why.

---

## FILES YOU'LL BE WORKING WITH

### New Files to Create (25 files)

**Week 1:**
- `lib/integrations/registry.ts`
- `lib/integrations/types.ts`
- `lib/integrations/base.ts`
- `lib/integrations/errorHandler.ts`
- `lib/integrations/retry.ts`
- `lib/integrations/rateLimiter.ts`

**Week 2:**
- `scripts/migrations/add_approvals_table.sql`
- `app/api/approvals/route.ts`
- `components/ApprovalRequests.tsx`
- `app/dashboard/approvals/page.tsx`

**Week 3:**
- `lib/vapi/smartEndpointing.ts`
- `lib/vapi/dtmf.ts`
- `lib/location/browserGeolocation.ts`
- `app/api/location/route.ts`
- `scripts/migrations/add_locations_table.sql`

**Week 4:**
- Documentation files
- Test files
- Demo scripts

### Files to Modify (15 files)

- `lib/integrations/google.ts` - Migrate to registry
- `lib/integrations/spotify.ts` - Migrate to registry
- `lib/vapi.ts` - Add endpointing config
- `app/api/vapi-webhook/route.ts` - Add DTMF handler
- `lib/agent/orchestrator.ts` - Add approval interrupts
- `lib/database.ts` - Add approval functions
- `app/api/chat/send/route.ts` - Use registry
- Plus others as needed

---

## SUCCESS METRICS

**By End of Week 1:**
- ✅ Can add a new integration in < 2 hours
- ✅ All integrations use standardized error handling
- ✅ No more custom integration code

**By End of Week 2:**
- ✅ Approval system works end-to-end
- ✅ Can demo "purchase with approval" flow
- ✅ UI shows pending approvals clearly

**By End of Week 3:**
- ✅ VAPI calls handle IVR menus without interruption
- ✅ Location services work and store data
- ✅ DTMF tool can navigate phone systems

**By End of Week 4:**
- ✅ Demo-ready product
- ✅ All features tested and working
- ✅ Documentation complete

---

## IF YOU GET STUCK

### Common Issues & Solutions

**Integration fails silently:**
→ Check error handler logs
→ Verify API keys
→ Test API manually first

**Approval not showing:**
→ Check database for approval record
→ Verify frontend polling/websocket
→ Check user_id matching

**VAPI endpointing not working:**
→ Verify configuration in VAPI dashboard
→ Check webhook logs
→ Test with different call scenarios

**Location not storing:**
→ Check browser permissions
→ Verify API endpoint
→ Check database migration ran

---

## NEXT STEPS

1. **Review this plan** - Does it match what you need?
2. **Confirm approval UI approach** - Dashboard page vs. modal?
3. **List your demo requirements** - What MUST work for the pitch?
4. **Start Week 1** - Build the integration registry first

**You've got 30 days. This plan gets you a solid foundation. You move fast. Let's build.**



