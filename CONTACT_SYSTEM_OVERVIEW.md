# Contact System Overview

## What We're Trying to Achieve

**Goal**: The AI assistant should be able to make calls/emails without repeatedly asking for the same information. Once a contact is saved, it should be remembered forever.

## Required Information Before Making Call

1. **Name** - What the AI extracts from user message (e.g., "mo", "mo money", "John Smith")
2. **Contact Info** - Phone number OR email address
3. **Message** - What to say during the call/email

**Optional**:
- **Relationship** - If mentioned (e.g., "my friend", "my mom"), store it but don't require it

## Current System Architecture

### 1. Contact Storage (Airtable)

**Table**: Contacts table in Airtable
**Fields**:
- `Name` (text) - Contact's name (e.g., "Mo", "Mo Money", "John Smith")
- `phone` (phone) - Phone number in E.164 format (+12017904760)
- `email` (email) - Email address
- `relationship` (text) - Optional (e.g., "friend", "mom", "dad")
- `recordId` (linked record) - Links to user/owner
- `lastContacted` (date) - Last time contact was used
- `notes` (long text) - Additional notes
- `contactCount` (number) - How many times contacted

### 2. Contact Lookup Flow

**Function**: `get_contact_by_name(name: string)`
- **Called by**: AI assistant when user mentions a name
- **What it does**: 
  1. Searches Airtable for contacts matching the name (case-insensitive, partial match)
  2. Returns contact if found (with phone/email if available)
  3. Returns "not found" if no match

**Search Logic** (in `lib/contacts.ts`):
1. Exact match (case-insensitive): "mo" matches "Mo"
2. Partial match: "mo" matches "Mo Money" or vice versa
3. First word match: "Ali" matches "Ali Smith"

### 3. Contact Creation Flow

**Function**: `upsertContact(contact: Contact)`
- **When called**: 
  1. When user provides phone number after name is mentioned
  2. When call is made (backup)
- **What it does**:
  1. Normalizes phone to E.164 format (+12017904760)
  2. Searches for existing contact by phone/email
  3. If found: Updates existing contact
  4. If not found: Creates new contact
  5. Handles deduplication (merges multiple contacts with same name)

### 4. The Problem: AI Not Following Logic

**Expected Flow**:
1. User: "call my friend"
2. AI: Calls `get_contact_by_name("friend")` → Not found
3. AI: "I don't have friend in your contacts. What's their name?"
4. User: "mo money"
5. AI: Calls `get_contact_by_name("mo money")` → Not found
6. AI: "I don't have mo money in your contacts. What's their phone number?"
7. User: "2017904760"
8. System: Creates contact (name="mo money", phone="+12017904760", relationship="friend")
9. AI: "Got it! What message should I deliver to mo money?"
10. User: "tell him to come over"
11. AI: Makes call with all info

**Current Problem**:
- AI is NOT calling `get_contact_by_name` consistently
- AI gives generic responses ("Sounds good, I'll take care of that") instead of asking for missing info
- Post-processing tries to catch this but uses hardcoded regex instead of trusting AI

### 5. What Should Happen (AI-Driven)

**The AI should**:
1. **Always call `get_contact_by_name`** when user mentions a name
2. **Extract the name itself** from user message (don't hardcode extraction)
3. **If contact not found**: Ask for phone number
4. **If phone provided**: System creates contact automatically
5. **If message missing**: Ask for message before making call
6. **Only make call** when ALL 3 required pieces are present

**The system should**:
1. **Store contact** when phone is provided (name + phone + relationship if available)
2. **Store contact** when call is made (backup, in case phone-only handler failed)
3. **NOT hardcode name extraction** - trust the AI to extract names correctly
4. **Post-process generic responses** - but only to catch cases where AI didn't follow instructions

## Current Issues

1. **Hardcoded name extraction** - Using regex to extract "Mo" from "mo money" instead of letting AI handle it
2. **AI not calling function** - Sometimes AI doesn't call `get_contact_by_name` when it should
3. **Generic responses** - AI says "Sounds good" instead of asking for missing info
4. **Contact not saved** - When phone provided, contact creation might fail silently

## Solution Approach

1. **Remove all hardcoded name extraction** - Let AI extract names via `get_contact_by_name` function
2. **Improve AI instructions** - Make function description clearer about when to call it
3. **Post-process only for safety** - Catch generic responses, but trust AI to extract names correctly
4. **Ensure contact creation** - Add better error handling and verification
5. **Block calls without all info** - Enforce that name + phone + message are all present before making call


