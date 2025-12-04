# Airtable Setup for Call Summaries

## Overview

Call summaries are posted back to chat after outbound calls end. This document explains what Airtable tables are needed.

## Required Tables

### 1. Chat Messages Table (REQUIRED)
**Environment Variable:** `AIRTABLE_CHAT_MESSAGES_TABLE_ID`

This table stores all chat messages, including call summaries.

**Required Fields:**

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `recordId` | Linked record | Link to main Users table |
| `agentId` | Single line text | VAPI agent ID |
| `threadId` | Single line text | Chat thread identifier |
| `message` | Long text | The message content (includes call summaries) |
| `role` | Single select | Options: `user`, `assistant` |
| `messageType` | Single select | Options: `text`, `file`, `system`, `call_request` |
| `createdAt` | Date | ISO timestamp format |
| `read` | Checkbox | Default: false |

**Optional Fields:**
- `attachments` (Multiple attachments)
- `callRequestId` (Single line text)
- `callStatus` (Single select)

## Optional Tables

### 2. Outbound Call Requests Table (OPTIONAL but Recommended)
**Environment Variable:** `AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID`

This table helps track outbound calls and link them back to chat threads for better summary delivery.

**Required Fields:**

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `callId` | Single line text | VAPI call ID (primary key for lookup) |
| `recordId` | Linked record | Link to main Users table |
| `threadId` | Single line text | Chat thread identifier |
| `status` | Single select | Options: `pending`, `in-call`, `completed`, `failed` |
| `createdAt` | Date | ISO timestamp format |

**Optional Fields:**
- `phoneNumber` (Phone number)
- `completedAt` (Date)

## How It Works

1. **When outbound call is requested:**
   - If Outbound Call Requests table is configured, a record is created linking the callId to recordId/threadId
   - This helps the system know which chat thread to post the summary to

2. **When call ends:**
   - Webhook receives call completion event with `assistantSummary`
   - System looks up the call in Outbound Call Requests table (if configured)
   - Gets recordId and threadId from the lookup (or falls back to getting from agentId)
   - Posts summary to Chat Messages table with: `"I called [number]. Here's what happened: [summary]"`
   - Summary appears in the chat thread automatically

## Setup Instructions

### If Chat Messages Table Already Exists:
✅ You're good! Summaries will work.

### If You Want Better Tracking:
1. Create "Outbound Call Requests" table in Airtable
2. Add the fields listed above
3. Get table ID from https://airtable.com/api
4. Add to `.env`: `AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID=tblXXXXXXXXXXXXXX`
5. Restart server

## Verification

After setup, when you make an outbound call:
1. Call completes
2. Summary should appear in chat automatically
3. Check Chat Messages table - you should see a new message with role="assistant" containing the call summary

