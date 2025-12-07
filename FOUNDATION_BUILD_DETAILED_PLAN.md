# FOUNDATION BUILD: Detailed Implementation Plan

## THE GOAL

**Build foundation infrastructure NOW** so you can spend the next 27 days training, enhancing UI/UX, and preparing your demo. This is a complete product - all features must work.

---

## CURRENT STATE ✅

**What's Already Done:**
- ✅ Supabase fully migrated (users, threads, messages, contacts, patterns, memories, embeddings, calendar_events, call_notes, scheduled_calls, etc.)
- ✅ LangGraph with Postgres checkpointer (already working!)
- ✅ VAPI basic calls working
- ✅ Google Calendar + Gmail integrations
- ✅ Spotify integration
- ✅ Contact management
- ✅ Pattern learning + memory system

**What's Missing:**
- ❌ Integration registry system (adding new integrations requires custom code)
- ❌ Approval system (can't safely do sensitive actions)
- ❌ Enhanced VAPI (IVR navigation, smart endpointing)
- ❌ Location services (no location tracking)

---

## WHAT I BUILD (Foundation Infrastructure)

### 1. Integration Registry System

**Purpose:** Standardize integration development. Adding new integrations becomes plug-and-play.

**Files I Create:**

1. **`lib/integrations/registry.ts`**
   - Central registry that stores all integrations
   - Methods: `register()`, `get()`, `list()`, `getFunctionSchemas()`
   - Handles registration and discovery

2. **`lib/integrations/types.ts`**
   - TypeScript interfaces for integrations
   - `Integration` interface, `IntegrationConfig`, `IntegrationFunction`
   - Standard contracts all integrations must follow

3. **`lib/integrations/base.ts`**
   - Base class `BaseIntegration` that all integrations extend
   - Common methods: error handling, retry logic, rate limiting
   - OAuth flow helpers

4. **`lib/integrations/errorHandler.ts`**
   - Unified error handling across all integrations
   - Categorizes errors (network, auth, rate limit, etc.)
   - Structured error logging

5. **`lib/integrations/retry.ts`**
   - Exponential backoff retry logic
   - Configurable retry attempts
   - Handles transient failures

6. **`lib/integrations/rateLimiter.ts`**
   - Rate limiting per integration
   - Prevents API quota exhaustion
   - Tracks request counts

**Files I Modify:**

1. **`lib/integrations/google.ts`**
   - Migrate to extend `BaseIntegration`
   - Register in registry
   - Use standardized error handling

2. **`lib/integrations/spotify.ts`**
   - Migrate to extend `BaseIntegration`
   - Register in registry
   - Use standardized error handling

3. **`app/api/chat/send/route.ts`**
   - Load functions from registry instead of hardcoded array
   - Dynamic function discovery

**What This Enables:**
- Adding a new integration = implement interface + register it
- Automatic error handling and retries
- Rate limiting built-in
- No more custom error handling code

---

### 2. Approval System Backend

**Purpose:** Safe execution of sensitive actions. Agent pauses and requests approval before purchases, financial actions, etc.

**Database Migration I Create:**

**File: `scripts/migrations/add_approvals_table.sql`**
```sql
-- Pending approvals table
CREATE TABLE IF NOT EXISTS pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'purchase', 'financial', 'call_transfer', etc.
  action_params JSONB NOT NULL, -- All parameters for the action
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  thread_id TEXT, -- Link to conversation thread
  message TEXT -- Human-readable description of action
);

CREATE INDEX IF NOT EXISTS idx_approvals_user_id ON pending_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON pending_approvals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON pending_approvals(status, created_at) WHERE status = 'pending';
```

**Files I Create:**

1. **`lib/database.ts`** - Add these functions:
   - `createPendingApproval(userId, actionType, params, threadId, message)`
   - `getPendingApprovals(userId, status?)`
   - `getApprovalById(approvalId)`
   - `updateApprovalStatus(approvalId, status, resolvedBy)`
   - `getPendingApprovalsForUser(userId)`

2. **`app/api/approvals/route.ts`**
   - `GET /api/approvals` - List all approvals for user (with optional status filter)
   - `POST /api/approvals` - Create new approval
   - `PATCH /api/approvals/:id` - Update approval status (approve/reject)

3. **`lib/agent/approvalHandler.ts`**
   - Logic for interrupting agent execution
   - Creating approval records
   - Resuming execution after approval

**Files I Modify:**

1. **`lib/agent/orchestrator.ts`**
   - Add `interrupt_before` configuration for sensitive functions
   - Integration with approval handler
   - State management for paused workflows

2. **`lib/agent/functions.ts`**
   - Mark sensitive functions (purchase, financial, etc.)
   - Add approval metadata to function definitions

**What This Enables:**
- Agent pauses before sensitive actions
- Creates approval record in database
- Waits for user approval/rejection
- Resumes execution with decision
- Backend is ready - you build the UI

---

### 3. Enhanced VAPI Configuration

**Purpose:** Better call handling, IVR navigation, adaptive silence detection.

**Files I Create:**

1. **`lib/vapi/smartEndpointing.ts`**
   - Logic for dynamic endpointing thresholds
   - IVR phase detection (first 30 seconds = longer silence tolerance)
   - Human phase detection (after 30 seconds = faster responses)
   - Configuration builder

2. **`lib/vapi/dtmf.ts`**
   - DTMF tool implementation (RFC 2833)
   - Handles digit sequences with wait characters
   - Integration with VAPI webhook

**Files I Modify:**

1. **`lib/vapi.ts`**
   - Add endpointing configuration to agent creation
   - Export smart endpointing builder
   - Add DTMF tool to function list

2. **`app/api/vapi-webhook/route.ts`**
   - Add `send_dtmf` function handler
   - Track call phase (time-based)
   - Dynamic endpointing adjustment

**Configuration Example:**
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

**What This Enables:**
- Agent can navigate IVR menus without interrupting
- Faster responses when talking to humans
- DTMF tool for pressing keys in phone menus
- Ready to use immediately

---

### 4. Location Services Backend

**Purpose:** Store and retrieve location data. Free browser geolocation API.

**Database Migration I Create:**

**File: `scripts/migrations/add_locations_table.sql`**
```sql
-- User locations table (stores last 10 locations)
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER, -- Accuracy in meters
  label TEXT, -- 'home', 'work', 'current', or custom label
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_created ON user_locations(user_id, created_at DESC);

-- Keep only last 10 locations per user (delete older ones)
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

1. **`lib/location/browserGeolocation.ts`**
   - Frontend helper for browser geolocation API
   - Request permission
   - Get current position
   - Error handling

2. **`app/api/location/route.ts`**
   - `GET /api/location` - Get user's last location
   - `GET /api/location/history` - Get last 10 locations
   - `POST /api/location` - Save new location
   - `POST /api/location/manual` - Save manual location (home/work)

**Files I Modify:**

1. **`lib/database.ts`**
   - Add location CRUD functions:
     - `saveUserLocation(userId, lat, lng, accuracy, label)`
     - `getUserLastLocation(userId)`
     - `getUserLocationHistory(userId, limit)`
     - `setUserLocationLabel(userId, label, lat, lng)`

**What This Enables:**
- Backend ready to store/retrieve location
- Free browser geolocation (no API costs)
- Last 10 locations stored automatically
- Manual home/work location setting
- You build the UI to request and display location

---

## WHAT YOU NEED TO DO

### Day 1: Database Setup

**Task 1: Run Database Migrations**

1. Open Supabase SQL Editor
2. Run `scripts/migrations/add_approvals_table.sql`
   - Copy SQL content
   - Paste into SQL Editor
   - Execute
   - Verify `pending_approvals` table created

3. Run `scripts/migrations/add_locations_table.sql`
   - Copy SQL content
   - Paste into SQL Editor
   - Execute
   - Verify `user_locations` table created

**Task 2: Verify Environment Variables**

Check your `.env.local` or environment config:

Required variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPI_PRIVATE_KEY`
- `VAPI_WEBHOOK_URL`
- `OPENAI_API_KEY`
- Google OAuth credentials (if using)
- Spotify OAuth credentials (if using)

**Task 3: Test Database Connection**

Run a quick test to verify:
- Can connect to Supabase
- Tables are accessible
- Permissions are correct

---

### Day 2-3: Testing & Verification

**Task 1: Test Integration Registry**

1. Start your dev server: `npm run dev`
2. Test existing integrations still work:
   - Try Google Calendar integration
   - Try Spotify integration
   - Verify no errors in console
3. Check logs for registry initialization

**Task 2: Test Approval API**

Use curl or Postman to test:

```bash
# Create an approval (manual test)
curl -X POST http://localhost:3000/api/approvals \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "actionType": "purchase",
    "actionParams": {"item": "test item", "amount": 10},
    "threadId": "test-thread",
    "message": "Test purchase approval"
  }'

# Get approvals
curl http://localhost:3000/api/approvals?userId=test-user

# Approve/reject
curl -X PATCH http://localhost:3000/api/approvals/{approvalId} \
  -H "Content-Type: application/json" \
  -d '{"status": "approved", "resolvedBy": "test-user"}'
```

**Task 3: Test Location API**

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

**Task 4: Test VAPI Enhancements**

1. Make a test call through VAPI
2. Verify endpointing configuration is applied
3. Test DTMF tool (if you have an IVR system to test with)
4. Check webhook logs for call phase tracking

---

### Days 4-30: Your Work (UI/UX, Training, Enhancement)

**What You Build:**

1. **Approval UI Components**
   - Modal overlay component (`components/ApprovalModal.tsx`)
     - Appears when approval needed
     - Shows action details
     - Approve/Reject buttons
     - Real-time updates
   
   - Dashboard page (`app/dashboard/approvals/page.tsx`)
     - List all approvals (pending, approved, rejected)
     - Filter by status
     - Show action details
     - History view

2. **Location UI Components**
   - Location settings page (`app/dashboard/location/page.tsx`)
     - Request location permission
     - Show current location
     - Set home/work locations
     - View location history
   
   - Location display component
     - Show on dashboard
     - Nearby recommendations (if implementing)

3. **Dashboard Enhancements**
   - Integration status indicators
   - Pending approvals badge/count
   - Location widget
   - Quick actions

4. **Training & Testing**
   - Train agent with real scenarios
   - Test all integrations
   - Polish user experience
   - Fix any UI/UX issues

5. **Demo Preparation**
   - Create demo script
   - Test all features work
   - Prepare showcase scenarios
   - Record demo videos if needed

---

## FILES BREAKDOWN

### Files I Create (15 new files)

**Integration Registry (6 files):**
- `lib/integrations/registry.ts`
- `lib/integrations/types.ts`
- `lib/integrations/base.ts`
- `lib/integrations/errorHandler.ts`
- `lib/integrations/retry.ts`
- `lib/integrations/rateLimiter.ts`

**Approval System (4 files):**
- `scripts/migrations/add_approvals_table.sql`
- `lib/agent/approvalHandler.ts`
- `app/api/approvals/route.ts`
- (Database functions added to `lib/database.ts`)

**VAPI Enhancements (2 files):**
- `lib/vapi/smartEndpointing.ts`
- `lib/vapi/dtmf.ts`

**Location Services (3 files):**
- `scripts/migrations/add_locations_table.sql`
- `lib/location/browserGeolocation.ts`
- `app/api/location/route.ts`

### Files I Modify (8 files)

1. `lib/integrations/google.ts` - Migrate to registry
2. `lib/integrations/spotify.ts` - Migrate to registry
3. `app/api/chat/send/route.ts` - Use registry
4. `lib/vapi.ts` - Add endpointing config
5. `app/api/vapi-webhook/route.ts` - Add DTMF handler
6. `lib/agent/orchestrator.ts` - Add approval interrupts
7. `lib/agent/functions.ts` - Mark sensitive functions
8. `lib/database.ts` - Add location functions

### Files You Create (UI Components)

**Approval UI:**
- `components/ApprovalModal.tsx` - Modal overlay
- `app/dashboard/approvals/page.tsx` - Dashboard page

**Location UI:**
- `app/dashboard/location/page.tsx` - Location settings
- `components/LocationWidget.tsx` - Location display (optional)

**Dashboard:**
- Update `app/dashboard/page.tsx` - Add widgets

---

## DELIVERABLES

### By End of Day 3, You Will Have:

✅ **Integration Registry System**
- Standardized integration development
- Error handling and retries built-in
- Easy to add new integrations

✅ **Approval System Backend**
- Database table created
- API endpoints working
- Agent can request approvals
- Ready for UI development

✅ **Enhanced VAPI**
- Smart endpointing configured
- DTMF tool available
- Better call handling
- Ready to use

✅ **Location Services Backend**
- Database table created
- API endpoints working
- Free browser geolocation ready
- Ready for UI development

### What's Next (Days 4-30):

🔨 Build approval UI (modal + dashboard)
🔨 Build location UI (settings + display)
🔨 Enhance dashboard
🔨 Train the agent
🔨 Polish UI/UX
🔨 Prepare demo

---

## CHECKLIST

### My Tasks (Backend Infrastructure)

- [ ] Create integration registry system
- [ ] Create approval system backend
- [ ] Create VAPI enhancements
- [ ] Create location services backend
- [ ] Migrate existing integrations
- [ ] Update agent orchestrator
- [ ] Create database migrations
- [ ] Test all backend components

### Your Tasks

**Day 1:**
- [ ] Run approval table migration in Supabase
- [ ] Run location table migration in Supabase
- [ ] Verify environment variables
- [ ] Test database connection

**Day 2-3:**
- [ ] Test integration registry works
- [ ] Test approval API endpoints
- [ ] Test location API endpoints
- [ ] Test VAPI enhancements
- [ ] Report any issues

**Days 4-30:**
- [ ] Build approval modal component
- [ ] Build approval dashboard page
- [ ] Build location settings page
- [ ] Enhance main dashboard
- [ ] Train agent with scenarios
- [ ] Polish UI/UX
- [ ] Prepare demo

---

## SUPPORT & QUESTIONS

**If you encounter issues:**

1. **Database migration fails:**
   - Check SQL syntax
   - Verify Supabase permissions
   - Check if tables already exist

2. **API endpoints don't work:**
   - Check server logs
   - Verify environment variables
   - Test with curl/Postman first

3. **Integration registry issues:**
   - Check console logs
   - Verify integrations register correctly
   - Test existing integrations still work

4. **VAPI enhancements not working:**
   - Check VAPI dashboard configuration
   - Verify webhook URLs
   - Test with real call

**Questions to ask:**
- "Does the backend work but UI is missing?" → You build UI
- "Is there an error in the logs?" → Share logs, I'll fix
- "Does the database table exist?" → Check Supabase dashboard

---

## TIMELINE

**Today (Day 1):**
- I build all backend infrastructure
- You run database migrations
- You verify environment

**Tomorrow (Day 2):**
- I fix any issues from Day 1
- You test all APIs
- We verify everything works

**Day 3:**
- Final polish
- Documentation
- Handoff complete

**Days 4-30:**
- You build UI/UX
- You train the system
- You prepare demo

---

## READY TO START?

**I'll start building the foundation infrastructure now. You:**

1. ✅ Prepare to run database migrations (Day 1)
2. ✅ Prepare to test APIs (Day 2-3)
3. ✅ Get ready to build UI (Days 4-30)

**Let me know when you're ready and I'll begin building!**

