# Airtable Fields Setup Guide

## Required Airtable Fields

You need to add/update these fields in your Airtable table (`tblEXG9wp3Dm3nPte`) to match the new hybrid personalization system.

### Existing Fields (Keep These)
- `fullName` (Single line text) - ✅ Already exists
- `email` (Email) - ✅ Already exists  
- `mobileNumber` (Phone number) - ✅ Already exists
- `forwardCalls` (Single select: "Y", "N" OR Text) - ✅ Already exists
- `personality` (Long text) - ✅ Already exists (now stores custom personality text)
- `userPrompt` (Long text) - ⚠️ **RENAME THIS** to `userContext` (see below)
- `attachedFiles` (Attachment field) - ✅ Already exists (optional)
- `status` (Single select: "processing", "active", "error") - ✅ Already exists
- `vapi_agent_id` (Single line text) - ✅ Already exists
- `vapi_number` (Phone number) - ✅ Already exists
- `created_at` (Date/Time) - ✅ Already exists

### New Fields to Add

1. **`personalityChoices`** (Long text) - **REQUIRED**
   - Stores the selected personality options (comma-separated)
   - Example: "Rude & Blunt, Sarcastic & Mean, Direct & Brief"
   - This is what's causing your error right now!

2. **`customizationOptions`** (Long text) - **NEW**
   - Stores the selected behavior customization options (comma-separated)
   - Example: "Keep conversations brief (under 2 minutes), Be more direct and to-the-point"

3. **`userContext`** (Long text) - **REQUIRED**
   - This is the required "About You" field
   - You can either:
     - **RENAME** `userPrompt` field to `userContext` (recommended), OR
     - **ADD** a new `userContext` field and keep `userPrompt` (we'll update code to use userContext)

4. **`additionalInstructions`** (Long text) - **NEW**
   - Stores optional additional instructions/rules
   - Can be empty if user doesn't provide any

## Step-by-Step: How to Fix Your Airtable

### Option 1: Add All New Fields (Recommended)

1. Go to your Airtable base: `appRzrock4whokZZ7`
2. Open the table: `tblEXG9wp3Dm3nPte`
3. Click the "+" button to add new fields:

   **Field 1: personalityChoices**
   - Type: **Long text**
   - Name: `personalityChoices`
   
   **Field 2: customizationOptions**
   - Type: **Long text**
   - Name: `customizationOptions`
   
   **Field 3: userContext**
   - Type: **Long text**
   - Name: `userContext`
   - (Or rename `userPrompt` to `userContext`)
   
   **Field 4: additionalInstructions**
   - Type: **Long text**
   - Name: `additionalInstructions`

### Option 2: Rename userPrompt → userContext

If you want to reuse the existing `userPrompt` field:

1. Click on the `userPrompt` field header
2. Click "Rename field"
3. Change it to `userContext`
4. Then add the 3 new fields above (personalityChoices, customizationOptions, additionalInstructions)

## All Personality Options (for your reference)

When users select personality choices, they'll appear in `personalityChoices` field as comma-separated values:

1. Friendly & Casual
2. Professional & Polished
3. Warm & Personal
4. Direct & Brief
5. Rude & Blunt ⭐ NEW
6. Sarcastic & Mean ⭐ NEW

## Quick Checklist

- [ ] Add `personalityChoices` field (Long text) - **THIS FIXES YOUR ERROR**
- [ ] Add `customizationOptions` field (Long text)
- [ ] Add/rename `userContext` field (Long text)
- [ ] Add `additionalInstructions` field (Long text)

Once you add these fields, the form will work perfectly!













