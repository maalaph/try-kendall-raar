# Contact Management System - Issue Analysis & Solutions

## Problem Summary

The AI assistant is having issues with contact management:
1. **Bad contacts being created**: "It" appears as a contact name, "Ali it" instead of "Ali"
2. **Assistant not asking for required info**: When a new contact name is mentioned, assistant doesn't ask for phone number/email
3. **Contact updates not working**: When additional info (email/phone) is provided for an existing contact, it's not updating properly

## Current Architecture

### System Overview
- **Stack**: Next.js API routes, OpenAI GPT-4 for chat, Airtable for contact storage
- **Flow**: User sends message → API processes → AI generates response with function calls → Actions executed → Response returned
- **Contact Storage**: Airtable table "User Contacts" with fields: Name, phone, email, relationship, notes, lastContacted, contactCount, recordId (links to user)

### Key Components

#### 1. Automatic Contact Extraction (`lib/contactExtractor.ts`)
```typescript
// Runs automatically on EVERY user message
export async function extractContactFromMessage(
  recordId: string,
  message: string,
  timestamp: string
): Promise<Contact | null>
```

**Current Behavior:**
- Uses regex patterns to extract names from messages
- Extracts phone numbers, emails, relationships
- Creates contacts in Airtable immediately if name is found
- Called automatically in background (line 519 of `app/api/chat/send/route.ts`)

**Problem Patterns:**
- Pattern: `/(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+(?:ask|if|can|come|for|dinner...))/i`
- This pattern matches capitalized words but doesn't exclude common words like "It"
- Example: "can you call kusb" → extracts "kusb" but also captures "It" from other messages
- Example: "call ali ask him if he can come" → might extract "Ali it" if "it" appears nearby

**Excluded Words List (incomplete):**
```typescript
const EXCLUDED_WORDS = new Set([
  'for', 'my', 'call', 'text', 'message', 'tell', 'contact', 'reach', 'out', 'to',
  'the', 'a', 'an', 'his', 'her', 'their', 'number', 'phone', 'at', 'on', 'is',
  'me', 'you', 'him', 'she', 'they', 'this', 'that', 'with', 'from', 'and', 'or',
  'need', 'want', 'can', 'will', 'should', 'would', 'could', 'please', 'ask', 'give'
]);
// Missing: 'it' (this is why "It" becomes a contact)
```

#### 2. AI Chat Handler (`app/api/chat/send/route.ts`)

**Function Definition for Contact Lookup:**
```typescript
{
  name: 'get_contact_by_name',
  description: 'Look up a contact by name in the user\'s contact list. Use this when the user mentions a name (e.g., "call Ali", "email Ryan") but doesn\'t provide a phone number or email address. This function searches the user\'s Airtable contacts to find matching contact information. ALWAYS call this function BEFORE asking the user for contact information - the contact may already exist in their database. IMPORTANT: After finding a contact with a phone number, IMMEDIATELY use that phone number to call make_outbound_call. After finding a contact with an email, use that email to send the email.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The name of the contact to look up. Extract ONLY the first name (or first and last name) from the user\'s message. Examples: "Ali", "Ryan", "John Smith". Do NOT include action words or the rest of the sentence (e.g., use "Ali" not "Ali ask him if he can come").',
      },
    },
    required: ['name'],
  },
}
```

**When Contact Not Found:**
```typescript
// Line 1171-1180
if (!contact) {
  functionResults.push({
    name: 'get_contact_by_name',
    result: {
      success: false,
      error: 'Contact not found',
      message: `I couldn't find a contact named "${cleanName}" in your contacts.`,
    },
  });
}
```

**Problem:** The AI receives this "not found" result but sometimes gives generic response like "Sounds good, I'll take care of that" instead of asking for phone number.

**Post-processing Logic (lines 1395-1449):**
- Tries to override generic responses when contact missing
- Only works for email requests, not consistently for phone requests
- Has complex logic to detect "generic responses" but misses some cases

#### 3. Contact Creation Flow (`lib/contacts.ts`)

**Upsert Function:**
```typescript
export async function upsertContact(contact: Contact): Promise<Contact> {
  // Creates or updates contact in Airtable
  // Merges information intelligently
  // Handles deduplication by phone/email
}
```

**Current Behavior:**
- Creates contact if name exists (even without phone/email)
- Updates existing contact if found by phone/email
- Merges duplicate contacts by name

**Problem:** Creates incomplete contacts (just name, no phone/email) because automatic extraction runs before AI can ask for required info.

#### 4. System Prompt (`lib/chatPromptTemplate.ts`)

**Instructions to AI:**
```
When the owner mentions a name (e.g., "call Ali", "email Ryan"):
1. FIRST: Call `get_contact_by_name` function to look up the contact
2. IF CONTACT FOUND WITH PHONE NUMBER: IMMEDIATELY use that phone number to call
3. IF CONTACT FOUND WITH EMAIL: IMMEDIATELY use that email to send email
4. IF CONTACT NOT FOUND: Then ask the user for the phone number or email address
5. NEVER ask for contact information BEFORE looking it up
```

**Problem:** AI sometimes skips step 4 or gives generic response instead of asking.

## Issue Flow Example

### Current Broken Flow:
1. User: "can you call kusb"
2. **Automatic extraction runs** (background): Extracts "kusb" as name, creates contact with just name
3. AI receives message, calls `get_contact_by_name("kusb")`
4. Contact exists but has no phone number
5. AI should ask "I don't have Kusb's phone number. What's their phone number?"
6. **Problem:** AI gives generic "Sounds good, I'll take care of that" instead

### Another Broken Flow:
1. User: "call ali ask him if he can come"
2. **Automatic extraction runs**: Regex matches "Ali" but also captures "it" → creates "Ali it"
3. AI looks up "Ali" → finds "Ali it" contact (wrong)
4. Contact has no phone number
5. AI doesn't ask properly

## Proposed Solutions

### Solution 1: Remove Automatic Extraction (Pure AI Approach)

**What Changes:**
- Disable automatic `extractContactFromMessage` call on line 519
- Let AI handle everything through `get_contact_by_name` function
- Only create contacts when:
  - AI explicitly identifies a contact AND gets required info, OR
  - User provides complete info in one message (AI extracts it naturally)

**Pros:**
- ✅ No bad contacts created (AI is smarter at name recognition)
- ✅ Natural conversation flow
- ✅ Simpler codebase
- ✅ AI better at context understanding

**Cons:**
- ❌ Loses automatic extraction benefit (no passive contact learning)
- ❌ Requires AI to always call function (sometimes misses edge cases)
- ❌ Might feel slower (more back-and-forth)

**Implementation:**
```typescript
// In app/api/chat/send/route.ts, line 519
// REMOVE or COMMENT OUT:
// extractContactFromMessage(recordId, message.trim(), timestamp)

// Keep extraction ONLY for explicit cases:
// - When user provides complete info: "call Ali at 814-996-9612"
// - When AI requests info and user provides it
```

---

### Solution 2: Smart Automatic Extraction (Hybrid)

**What Changes:**
- Keep automatic extraction BUT only if HIGH CONFIDENCE:
  - Name AND phone number both present, OR
  - Name AND email both present
- Fix name extraction patterns:
  - Add "it", "he", "she", "they" to excluded words
  - Improve regex to stop at action words properly
  - Better validation of names

**Pros:**
- ✅ Catches cases where user provides complete info immediately
- ✅ Still prevents bad contacts (only extracts when confident)
- ✅ Best of both worlds

**Cons:**
- ❌ Still uses regex (can miss edge cases)
- ❌ More complex validation logic
- ❌ Might miss some legitimate extractions

**Implementation:**
```typescript
// In lib/contactExtractor.ts
const EXCLUDED_WORDS = new Set([
  // ... existing words ...
  'it', 'he', 'she', 'they', // Add pronouns
]);

// Only create contact if both name AND phone/email exist
if (contact && contact.name && (contact.phone || contact.email)) {
  await upsertContact(contact);
}
```

---

### Solution 3: Fix Both Extraction AND AI Response (Recommended)

**What Changes:**
1. Make automatic extraction smarter (Solution 2 improvements)
2. Fix AI response override logic to force asking for info
3. Better post-processing when contact not found
4. Improve system prompt instructions

**Pros:**
- ✅ Handles both cases (complete info + asking for missing info)
- ✅ Prevents bad contacts
- ✅ Ensures AI always asks when needed
- ✅ Most robust solution

**Cons:**
- ❌ Most work to implement
- ❌ Two systems to maintain
- ❌ More edge cases to handle

**Implementation:**
```typescript
// 1. Fix extraction (lib/contactExtractor.ts)
// Add to EXCLUDED_WORDS: 'it', 'he', 'she', 'they'
// Only extract if name + phone/email both present

// 2. Fix AI response (app/api/chat/send/route.ts)
// In post-processing (line 1395), add:
if (fr.name === 'get_contact_by_name' && !fr.result.success) {
  const userMessage = message.trim().toLowerCase();
  const isCallRequest = userMessage.includes('call') || userMessage.includes('phone');
  const isEmailRequest = userMessage.includes('email') || userMessage.includes('send');
  
  if (isCallRequest || isEmailRequest) {
    const contactName = extractNameFromMessage(message); // Extract name from user message
    if (isCallRequest) {
      agentResponse = `I don't have ${contactName} in your contacts. What's their phone number?`;
    } else {
      agentResponse = `I don't have ${contactName} in your contacts. What's their email address?`;
    }
  }
}
```

---

### Solution 4: Only Extract After AI Confirms (Most Conservative)

**What Changes:**
- Remove automatic extraction completely
- AI checks contacts, asks for info if needed
- Only create contact AFTER AI has confirmed it's real contact and has required info
- Use extraction only when explicitly creating contact

**Pros:**
- ✅ Zero bad contacts
- ✅ AI fully controls flow
- ✅ Cleanest data

**Cons:**
- ❌ Loses automatic extraction benefit entirely
- ❌ More manual process
- ❌ Might feel slower

---

## Recommendation

**I recommend Solution 3 (Fix Both)** because:

1. **Automatic extraction IS useful** - When user says "call Ali at 814-996-9612", we should extract both name and phone automatically
2. **AI needs to ask properly** - When contact missing, AI must ask (currently broken)
3. **Best user experience** - Handles both complete info and missing info gracefully

### Specific Fixes Needed:

1. **Fix Name Extraction:**
   - Add "it", "he", "she", "they" to `EXCLUDED_WORDS` in `lib/contactExtractor.ts`
   - Improve regex patterns to stop immediately after name
   - Only create contacts when name + phone/email both present

2. **Fix AI Response:**
   - Improve post-processing logic to override generic responses
   - Force asking for phone/email when contact not found
   - Better handling of function result messages

3. **Fix Contact Updates:**
   - When user provides phone/email after AI asks, update contact properly
   - Handle deduplication when same contact has multiple entries

## Code Locations

- **Automatic extraction call**: `app/api/chat/send/route.ts` line 519-525
- **Extraction logic**: `lib/contactExtractor.ts` (entire file)
- **Contact lookup function**: `app/api/chat/send/route.ts` line 137-153 (function definition), line 925-1194 (handler)
- **Post-processing**: `app/api/chat/send/route.ts` line 1395-1449
- **Contact upsert**: `lib/contacts.ts` line 38-293
- **System prompt**: `lib/chatPromptTemplate.ts` line 219-265

## Questions for Decision

1. **Do you want automatic extraction at all?** (or let AI handle everything)
2. **How important is catching complete info automatically?** (e.g., "call Ali at 814-996-9612")
3. **Prefer safer (no bad contacts) or more automated (extract when possible)?**

## Testing Scenarios

After fixes, test these cases:

1. ✅ "call kusb" → Should ask for phone number
2. ✅ "call ali at 814-996-9612" → Should extract both and create contact
3. ✅ "call it" → Should NOT create "It" as contact
4. ✅ "I don't have Ali's email. Here it is: ali@email.com" → Should update Ali's contact
5. ✅ Existing contact "Ali" with phone → Should use phone, not ask again


