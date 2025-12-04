# How Personalization Works in MyKendall Backend

## Business Context: Customer Experience Flow

### What Happens When a Customer Sets Up Their Kendall:

1. **Customer visits `/personal-setup` page** and fills out the form:
   - Their name, email, phone number
   - Personality description (e.g., "Direct, sharp, confident, smooth")
   - Custom instructions (e.g., "Act like a concierge assistant. Keep calls short, human, and helpful.")
   - Optional: Upload files (resumes, business documents, etc.)

2. **Backend creates a personalized AI agent** that:
   - Knows the customer's name
   - Speaks with their specified personality
   - Follows their custom instructions
   - Gets assigned a unique phone number

3. **Customer receives their dedicated phone number** - they can give this out to clients/customers

4. **Kendall answers calls** with the personalized personality and follows the customer's instructions

## Technical Implementation: Where Personalization Happens

### Current State: What Works ✅

**Text-Based Personalization (FULLY FUNCTIONAL):**

Location: `lib/vapi.ts` → `createAgent()` function (lines 12-57)

Process:
1. Customer submits `personality` and `userPrompt` via form (`app/personal-setup/page.tsx`)
2. Form sends data to `/api/createMyKendall` (`app/api/createMyKendall/route.ts` line 50-54)
3. Backend calls `createAgent()` with `fullName`, `personality`, and `userPrompt`
4. These get combined into an instruction string:
   ```
   You are Kendall, the personal AI assistant for [fullName].
   
   Personality: [personality text]
   
   Custom Instructions: [userPrompt text]
   
   Respond naturally and personally while staying helpful.
   ```
5. This instruction is sent to Vapi API with GPT-4o model
6. Vapi creates an agent that follows these instructions

**File Upload (PARTIALLY FUNCTIONAL):**

Location: `app/api/uploadFile/route.ts` and `app/api/createMyKendall/route.ts`

Process:
1. Customer uploads files via form
2. Files are converted to base64 data URLs (`app/api/uploadFile/route.ts` lines 15-19)
3. Files are stored in Airtable `attachedFiles` field (`app/api/createMyKendall/route.ts` lines 42-43)
4. **FILES ARE NOT USED IN AGENT CREATION** - they sit unused in Airtable

### Current Gap: What's Missing ⚠️

**Files Are Uploaded But Not Used for Personalization:**

- Files (resumes, business docs) are successfully uploaded and stored
- Files are saved to Airtable database
- **BUT:** Files are never passed to Vapi API when creating the agent
- **RESULT:** Files don't enhance Kendall's knowledge about the customer's business

**Code Evidence:**
- `app/api/createMyKendall/route.ts` line 50-54: `createAgent()` is called with only `fullName`, `personality`, `userPrompt`
- `attachedFiles` is handled separately (lines 42-43) and stored in Airtable only
- `lib/vapi.ts` `createAgent()` function (lines 12-20) doesn't accept file parameters

### How Personalization Fits in the Backend Flow

**Step-by-Step Backend Process:**

1. **Form Submission** → `app/personal-setup/page.tsx` (line 199)
   - Collects: fullName, email, mobileNumber, personality, userPrompt, attachedFiles

2. **API Route Handler** → `app/api/createMyKendall/route.ts`
   - Step 1: Creates Airtable record with status "processing" (line 46)
   - Step 2: Calls `createAgent()` with personality + userPrompt (line 50-54)
   - Step 3: Purchases phone number (line 58-60)
   - Step 4: Assigns number to agent (line 63)
   - Step 5: Updates Airtable with agent ID, phone number, status "active" (line 66-70)

3. **Agent Creation** → `lib/vapi.ts` → `createAgent()` (lines 12-57)
   - Builds personalized instruction string
   - Calls Vapi API to create agent with GPT-4o model
   - Returns agent ID

**Key Files:**
- `app/personal-setup/page.tsx` - Frontend form (collects user input)
- `app/api/createMyKendall/route.ts` - Backend orchestration (coordinates all steps)
- `lib/vapi.ts` - Vapi API integration (agent creation, phone number management)
- `lib/airtable.ts` - Airtable API integration (database storage)

## Business Impact: What This Means for Customers

### What Customers Can Currently Personalize:

✅ **Personality** - How Kendall talks (tone, style, demeanor)
   - Example: "Direct, sharp, confident, smooth"
   - Impact: Kendall will use this tone in all conversations

✅ **Custom Instructions** - What Kendall does (behavior, rules, guidelines)
   - Example: "Act like a concierge assistant. Keep calls short, human, and helpful."
   - Impact: Kendall follows these specific instructions for every call

✅ **Name Context** - Kendall knows who the customer is
   - Example: "You are Kendall, the personal AI assistant for John Smith"
   - Impact: Kendall can personalize responses with customer's name

### What Customers Cannot Currently Use (Gap):

❌ **Uploaded Files** - Resumes, business documents, company info
   - Files are uploaded and stored
   - But files don't enhance Kendall's knowledge
   - Kendall can't reference information from uploaded documents

**Example Scenario:**
- Customer uploads their resume and business brochure
- Currently: Files stored in Airtable, but Kendall knows nothing about them
- Should Be: Kendall can reference resume skills, business details, company info during calls

## What Would Need to Change for Full File-Based Personalization

### Option 1: Extract Text and Add to Instructions
- Parse files (PDF, DOCX, etc.) to extract text content
- Add extracted text to the instruction string when creating agent
- Pros: Simple, works immediately
- Cons: Large files might exceed instruction length limits

### Option 2: Use Vapi Knowledge Base Feature
- Check if Vapi API supports knowledge base/file upload
- Upload files to Vapi as knowledge base documents
- Agent can reference these during conversations
- Pros: Scalable, handles large files better
- Cons: Requires Vapi API support (need to verify if available)

### Option 3: Create Vector Database with RAG
- Extract text from files
- Create embeddings and store in vector database
- Agent queries vector DB during conversations for relevant context
- Pros: Most powerful, handles large knowledge bases
- Cons: More complex implementation, requires additional infrastructure

## Summary: Where Files Fit in the Backend

**Current Flow:**
```
Customer uploads files
    ↓
Files converted to base64
    ↓
Files stored in Airtable ✅
    ↓
Files NOT sent to Vapi ❌
    ↓
Agent created without file knowledge
```

**Ideal Flow (To Implement):**
```
Customer uploads files
    ↓
Files converted to base64
    ↓
Files stored in Airtable ✅
    ↓
Extract text from files
    ↓
Pass file content to Vapi (via instructions or knowledge base)
    ↓
Agent created WITH file knowledge ✅
    ↓
Kendall can reference file content in conversations
```

**Files to Modify for Full Personalization:**
1. `lib/vapi.ts` - Update `createAgent()` to accept file content
2. `app/api/createMyKendall/route.ts` - Parse files and pass to agent creation
3. Possibly add: File parsing library (PDF.js, mammoth, etc.)
4. Possibly add: Text extraction service

## Testing Personalization

When you test the backend:

1. **Test text personalization:**
   - Submit form with personality: "Friendly and warm"
   - Submit form with personality: "Professional and formal"
   - Call the numbers - you should hear different tones

2. **Test custom instructions:**
   - Submit form with instructions: "Always ask about their day first"
   - Call the number - Kendall should follow this instruction

3. **Test file upload (current gap):**
   - Upload a resume with your business info
   - Call the number - Kendall won't know about the resume content (this is the gap)
















