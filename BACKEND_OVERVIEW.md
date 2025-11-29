# MyKendall Backend Overview

## Quick Start Guide

This document provides a complete overview of your MyKendall backend, how personalization works, and how to test it.

## Complete Backend Flow

### Customer Journey
1. Customer visits `/personal-setup` page
2. Fills out form with personalization details
3. Backend creates personalized AI agent with their phone number
4. Customer receives their dedicated phone number
5. Kendall answers calls with personalized personality and instructions

### Technical Flow

```
User Form Submission
    ↓
/app/api/createMyKendall (route.ts)
    ↓
Step 1: Create Airtable record (status: "processing")
    ↓
Step 2: Create Vapi agent with personalized instructions
    ↓
Step 3: Purchase phone number via Vapi
    ↓
Step 4: Assign phone number to agent
    ↓
Step 5: Update Airtable (status: "active" + agent ID + phone number)
    ↓
Customer receives phone number
```

## Business Trial Flow (B2B)

### Customer Journey
1. Business owner visits landing page
2. Clicks "Start Free Trial" button
3. Fills out trial form (name, business name, contact info)
4. Backend stores signup in Airtable
5. Customer receives welcome email with next steps

### Technical Flow

```
User Form Submission
    ↓
/app/api/createBusinessTrial (route.ts)
    ↓
Step 1: Create Airtable record in "Kendall Business" table
    ↓
Step 2: Send welcome email with next steps
    ↓
Customer receives confirmation
```

**Key Differences from Personal Kendall:**
- No Vapi agent creation (trial signup only)
- No phone number purchase
- Simpler flow focused on lead capture
- Email sent automatically after signup

### Backend API Routes
- **`app/api/createBusinessTrial/route.ts`**
  - Handles business trial signups
  - Creates Airtable record
  - Sends welcome email
  - Returns success/error response

### Integration Libraries
- **`lib/airtable.ts`**
  - `createBusinessTrialRecord()` - Creates trial signup record
  - `getBusinessTrialRecord()` - Fetches trial record by ID
  - `updateBusinessTrialRecord()` - Updates trial record

- **`lib/email.ts`**
  - `sendBusinessTrialWelcomeEmail()` - Sends welcome email to trial signups

## How Personalization Works

### ✅ Currently Working: Text-Based Personalization

**Where it happens:** `lib/vapi.ts` → `createAgent()` function

**What gets personalized:**
1. **Personality** - How Kendall talks (tone, style, demeanor)
2. **Custom Instructions** - What Kendall does (behavior, rules)
3. **Name Context** - Kendall knows the customer's name

**How it works:**
- Customer's `personality` and `userPrompt` are combined into an instruction string
- This instruction is sent to Vapi API with GPT-4o model
- Vapi creates an agent that follows these personalized instructions

**Example instruction created:**
```
You are Kendall, the personal AI assistant for John Smith.

Personality: Direct, sharp, confident, smooth.

Custom Instructions: Act like a concierge assistant. Keep calls short, human, and helpful.

Respond naturally and personally while staying helpful.
```

### ⚠️ Current Gap: File-Based Personalization

**What's happening:**
- Files (resumes, documents) CAN be uploaded
- Files ARE stored in Airtable
- Files are NOT used in agent creation

**Impact:**
- Customers can upload business documents, resumes, etc.
- But Kendall doesn't know about this content
- Files sit unused in the database

**To fix this (future enhancement):**
- Need to extract text from uploaded files
- Add file content to agent instructions OR use Vapi knowledge base feature
- This would allow Kendall to reference customer's business info, resume details, etc.

## Key Files & Their Roles

### Frontend
- **`app/personal-setup/page.tsx`**
  - Form UI that collects customer input
  - Submits to `/api/createMyKendall` endpoint
  - Handles file uploads via `/api/uploadFile`

### Backend API Routes
- **`app/api/createMyKendall/route.ts`**
  - Main orchestration endpoint
  - Coordinates all backend steps
  - Creates Airtable record → Creates Vapi agent → Purchases number → Updates Airtable

- **`app/api/uploadFile/route.ts`**
  - Handles file uploads
  - Converts files to base64 data URLs
  - Returns file data to frontend (currently stored in Airtable but not used in agent creation)

### Integration Libraries
- **`lib/vapi.ts`**
  - Vapi API wrapper
  - `createAgent()` - Creates personalized agent with instructions
  - `purchaseNumber()` - Purchases phone number
  - `assignNumberToAgent()` - Links phone number to agent

- **`lib/airtable.ts`**
  - Airtable API wrapper
  - **Personal Kendall:**
    - `createUserRecord()` - Creates initial record with "processing" status
    - `updateUserRecord()` - Updates record with agent ID, phone number, "active" status
  - **Business Trials:**
    - `createBusinessTrialRecord()` - Creates trial signup record
    - `getBusinessTrialRecord()` - Fetches trial record by ID
    - `updateBusinessTrialRecord()` - Updates trial record

## Testing Your Backend

See the main testing plan: `backend-testing-guide.plan.md`

**Quick Test Checklist:**
1. ✅ Environment variables set up (Step 1)
2. ✅ Server restarted (Step 2)
3. ✅ Airtable table structure verified (Step 3)
4. ⏭️ Submit test form (Step 4)
5. ⏭️ Monitor backend logs (Step 5)
6. ⏭️ Verify Airtable record (Step 6)
7. ⏭️ Check Vapi dashboard (Step 7)
8. ⏭️ Test phone call (Step 8)

## Understanding Personalization (Business Context)

### What Customers Can Control

**Personality Personalization:**
- Customer describes how they want Kendall to sound
- Example: "Friendly and warm" vs "Professional and formal"
- Impact: Kendall uses this tone in ALL conversations

**Instruction Personalization:**
- Customer specifies what Kendall should do
- Example: "Always ask about their day first" or "Keep calls under 2 minutes"
- Impact: Kendall follows these specific rules for every call

**Name-Based Context:**
- Kendall knows the customer's name
- Impact: Can personalize responses with customer identity

### What's Missing (Files)

**Current State:**
- Customers CAN upload files (resumes, business docs)
- Files ARE stored in your database
- Files DON'T enhance Kendall's knowledge

**Business Impact:**
- If a customer uploads their business brochure, Kendall doesn't know about it
- If a customer uploads their resume, Kendall can't reference their skills/experience
- This is a limitation in the current implementation

**Why It Matters:**
- Your customers expect full personalization
- Files represent valuable context that should inform Kendall's responses
- This gap means customers aren't getting maximum value from file uploads

## Environment Variables Reference

Required variables in `.env.local`:

```
AIRTABLE_API_KEY=your_personal_access_token_here
AIRTABLE_BASE_ID=appRzrock4whokZZ7
AIRTABLE_TABLE_ID=tblEXG9wp3Dm3nPte
AIRTABLE_BUSINESS_TRIAL_TABLE_ID=tbli3uJLbubkIRk5S

VAPI_PRIVATE_KEY=your_vapi_private_key
VAPI_DEFAULT_MODEL=gpt-4o
VAPI_COUNTRY=US

TWILIO_ACCOUNT_SID=your_twilio_account_sid

GMAIL_USER=your_gmail_address
GMAIL_APP_PASSWORD=your_gmail_app_password
```

Optional variables:

```
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

**Note:** `TWILIO_ACCOUNT_SID` is required when using Twilio as the phone number provider. Twilio credentials must also be configured in your Vapi dashboard settings. The `TWILIO_AUTH_TOKEN` environment variable is optional and only for reference.

**Verification:**
- Run `node verify-env.js` (after starting dev server) to check if all variables are loaded

## Related Documentation

- **`backend-testing-guide.plan.md`** - Complete step-by-step testing plan
- **`PERSONALIZATION_EXPLAINED.md`** - Detailed technical explanation of personalization
- **`STEP1_VERIFICATION.md`** - Environment setup verification results
- **`BUSINESS_TRIAL_AIRTABLE_SETUP.md`** - Business trial Airtable table setup guide

## Next Steps

1. Complete Steps 4-8 from the testing plan
2. Review personalization gaps identified in `PERSONALIZATION_EXPLAINED.md`
3. Consider implementing file-based personalization (extract text from files and add to agent instructions)

