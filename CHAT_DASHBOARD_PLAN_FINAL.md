# Chat Interface and Dashboard Implementation Plan (Final)

## Overview

Build a chat interface where users can communicate with their agent, view messages left from calls, upload documents, and request outbound calls. Include a stats dashboard and navbar for navigation.

## Architecture Decisions

**Chat Technology**: Start with **polling-based** chat (simpler, proof of concept). Can upgrade to WebSocket/real-time later without major refactoring.

**Message Storage**: Use existing Airtable Call Notes table + new Chat Messages table for user-to-agent conversations.

**Call Stats**: Store call duration and metadata from VAPI webhooks in Airtable.

**Thread Model**: **1 thread per user's Kendall**. The `threadId` is created once during onboarding (when agent is created) and stored in the user record. All chat messages for that user's agent use the same `threadId`. This provides structure for future multi-thread support while keeping current implementation simple.

**Pagination**: Implement pagination limits (50-100 messages per request) to prevent mobile crashes and improve performance.

---

## Phase 1: Data Storage & API Foundation

### 1.1 Airtable Schema Updates

**Call Notes Table** (existing - `AIRTABLE_CALL_NOTES_TABLE_ID`):
- Already has: `agentId`, `callerPhone`, `Notes`, `timestamp`, `callId`, `ownerPhone`, `smsSent`
- **Add fields:**
  - `callDuration` (Number) - duration in seconds
  - `callStatus` (Single select: "completed", "missed", "forwarded")
  - `read` (Checkbox) - whether owner has read this message

**Main Users Table** (existing):
- **Add field:**
  - `threadId` (Single line text) - Created during onboarding, reused for all chat messages for this user's agent

**New Chat Messages Table**:
Create new Airtable table for user-to-agent chat messages with this schema:

- `recordId` (Linked record to main users table)
- `agentId` (Single line text) - VAPI agent ID
- `threadId` (Single line text) - **Stable session identifier. Fetched from user record, same for all messages from this user's agent**
- `message` (Long text)
- `role` (Single select: "user", "assistant")
- `timestamp` (Date/Time, auto) - when message was created
- `read` (Checkbox)
- `attachments` (Attachment field) - for document uploads
- `callRequestId` (Single line text, optional) - if message triggered an outbound call

**Call Stats** (calculated from Call Notes, not stored separately):
- Calculate on-the-fly: `totalCalls`, `totalCallMinutes`, `averageCallDuration` from Call Notes table

### 1.2 Backend API Endpoints

**`/app/api/chat/messages/route.ts`**:
- `GET /api/chat/messages?recordId=xxx&lastMessageId=xxx&limit=xxx` - Get chat messages (polling endpoint)
  - `recordId` (required) - Airtable record ID for the user
  - `lastMessageId` (optional) - Airtable record ID of last message received (for pagination)
  - `limit` (optional, default: 50) - Max messages to return (pagination limit: 50-100)
  - Returns: `{ messages: [...], hasMore: boolean, lastMessageId: string }`
  - **Thread consistency**: Fetches user's `threadId` from user record, queries all messages with that `threadId`
- `POST /api/chat/messages` - Send message to agent
  - Body: `{ recordId, message, attachments? }`
  - Fetches user's `threadId`, creates message with that `threadId`

**`/app/api/chat/send/route.ts`**:
- `POST /api/chat/send` - Send message and get immediate response
- Uses existing SMS response generation logic (`generateSMSResponse`)
- Handles outbound call requests via existing `/api/make-call`
- Stores both user message and agent response in Chat Messages table with same `threadId`

**`/app/api/chat/messages-left/route.ts`**:
- `GET /api/chat/messages-left?recordId=xxx` - Get unread call notes/messages left for agent
- Filters Call Notes by `agentId` and `read = false`

**`/app/api/chat/upload-document/route.ts`**:
- `POST /api/chat/upload-document` - Upload document for agent context
- Similar to existing file upload in onboarding wizard
- Stores in Chat Messages attachments and updates agent's analyzedFileContent

**`/app/api/stats/route.ts`**:
- `GET /api/stats?recordId=xxx` - Get call statistics
- Returns: `{ totalCalls, totalCallMinutes, averageCallDuration, unreadMessages, recentActivity }`
- Queries Call Notes table and calculates stats on-the-fly

**`/app/api/call-notes/route.ts`**:
- `GET /api/call-notes?recordId=xxx` - Get call notes for this agent
- Marks notes as read when fetched
- Returns with call duration, timestamp, caller info

### 1.3 Update VAPI Webhook to Store Call Duration

**`/app/api/vapi-webhook/route.ts`**:
- Extract `duration` from VAPI payload if available
- If `duration` is missing, extract `startedAt`/`endedAt` timestamps and calculate duration in seconds
- Store `callDuration` in Call Notes table when creating call notes

### 1.4 ThreadId Creation During Onboarding

**`/app/api/createMyKendall/route.ts`**:
- After agent is created successfully, generate a unique `threadId` (UUID)
- Store `threadId` in user record
- This `threadId` will be used for all chat messages for this user's agent

---

## Phase 2: Chat Interface UI

### 2.1 Chat Page Component

**`/app/chat/page.tsx`**:
- Main chat interface page
- Requires `recordId` in URL or localStorage (from edit link)
- Uses ChatNavbar component (fixed at top, with "Chat" highlighted/underlined)
- Layout: **Fixed Navbar** | Chat Area | Sidebar (messages left for you)
- Navbar stays visible while scrolling

**`/components/ChatInterface.tsx`**:
- Chat message list (user messages + agent responses)
- Input area with text input + document upload button
- **Pagination support**: 
  - Initial load: Last 50 messages
  - User scrolls up → Loads next batch of older messages
  - Shows "Load more" button when `hasMore = true`
- Polling mechanism (check for new messages every 3-5 seconds)
- **Polling backoff**: Reduce polling frequency when tab is backgrounded or user idle
- Auto-scroll to bottom on new messages
- Loading states and error handling

**`/components/ChatMessage.tsx`**:
- Individual message bubble component
- Shows timestamp, role (user/agent)
- Supports attachments/documents
- Different styling for user vs agent messages

**`/components/ChatInput.tsx`**:
- Text input with send button
- File upload button (opens file picker)
- Shows upload progress
- Disabled during message sending

**`/components/MessagesLeftPanel.tsx`**:
- Sidebar showing unread messages left from calls
- Click to view full message and mark as read
- Shows caller phone, timestamp, message preview
- **Mobile**: Collapse into tab/drawer to save horizontal space

---

## Phase 3: Stats Dashboard

### 3.1 Dashboard Page

**`/app/dashboard/page.tsx`**:
- Stats dashboard page (accessible via navbar from chat page)
- Requires `recordId` in URL or localStorage
- Shows: Total Calls, Total Minutes, Average Duration, Recent Activity
- Uses same ChatNavbar component (with "Stats" highlighted/underlined)
- Same-page navigation from /chat - clicking "Stats" in navbar routes here

**`/components/StatsDashboard.tsx`**:
- Main dashboard component
- Stats cards: Total Calls, Total Minutes, Avg Duration
- Recent Activity timeline (last 10 call notes)
- Chart/graph for call volume over time (optional, future)

**`/components/StatCard.tsx`**:
- Reusable stat card component
- Shows label, value, optional icon
- Consistent styling with brand colors

---

## Phase 4: Navigation & Integration

### 4.1 Chat Navbar Component

**`/components/ChatNavbar.tsx`**:
- **Fixed navigation bar** at top of chat/dashboard pages
- **Always visible** - fixed position, doesn't scroll away
- Links: "Chat" | "Stats" | "Edit Agent" | Logo (home)
- **Active link highlighting**: 
  - Underline/highlight current page using accent color
  - If on `/chat`, "Chat" link is underlined/highlighted
  - If on `/dashboard`, "Stats" link is underlined/highlighted
  - Clear visual indication of current location
- Uses Next.js `usePathname()` hook to detect current route
- Same-page navigation (no new tabs) - uses Next.js Link component
- "Edit Agent" links to `/personal-setup?edit=${recordId}`
- Shows agent name/Kendall name (optional)
- Mobile-responsive hamburger menu if needed
- Styled consistently with existing Navbar component (dark theme, purple accents)
- Z-index high enough to stay above page content

### 4.2 Update Welcome Email

**`/lib/email.ts`**:
- Update `sendKendallWelcomeEmail` to include chat link
- Format: `/chat?recordId=${recordId}`
- Show: Phone Number | Edit Link | Chat Link

### 4.3 Integration with Existing Systems

- Use existing `generateSMSResponse` function for chat responses
- Use existing `/api/make-call` for outbound call requests
- Use existing file upload logic from onboarding wizard
- Leverage existing agent prompt system

---

## Phase 5: Document Upload & Processing

### 5.1 Document Upload Flow

- User uploads file in chat
- Store in Chat Messages attachments
- Process via existing file analysis (if supported)
- Update agent context with document content
- Agent can reference documents in responses

### 5.2 Document Types Support

- PDF files
- Images (JPG, PNG)
- Text files (.txt, .docx)
- Limit file size (e.g., 10MB max)

---

## Implementation Files

### New Files to Create:
1. `app/chat/page.tsx` - Chat page with fixed navbar
2. `app/dashboard/page.tsx` - Stats dashboard page with fixed navbar (same-page nav from chat)
3. `components/ChatInterface.tsx` - Main chat UI with pagination
4. `components/ChatMessage.tsx` - Message bubble
5. `components/ChatInput.tsx` - Input area
6. `components/MessagesLeftPanel.tsx` - Sidebar for call notes (collapsible on mobile)
7. `components/ChatNavbar.tsx` - Fixed navigation with active link highlighting
8. `components/StatsDashboard.tsx` - Dashboard component
9. `components/StatCard.tsx` - Reusable stat card
10. `app/api/chat/messages/route.ts` - Get/send messages with pagination
11. `app/api/chat/send/route.ts` - Send message endpoint
12. `app/api/chat/messages-left/route.ts` - Get unread call notes
13. `app/api/chat/upload-document/route.ts` - Document upload
14. `app/api/stats/route.ts` - Stats endpoint
15. `app/api/call-notes/route.ts` - Get call notes
16. `lib/airtable.ts` - Add helper functions for chat messages and stats

### Files to Modify:
1. `lib/airtable.ts` - Add chat message functions, update call note creation with duration, add threadId helper
2. `app/api/vapi-webhook/route.ts` - Store call duration in call notes
3. `lib/email.ts` - Add chat link to welcome email
4. `app/api/createMyKendall/route.ts` - Generate and store threadId during onboarding

---

## Airtable Setup Required

### Environment Variables:
- `AIRTABLE_CHAT_MESSAGES_TABLE_ID` - New table for chat messages

### New Airtable Table: Chat Messages

**Fields (consistent schema):**
- `recordId` (Linked record to main users table)
- `agentId` (Single line text)
- `threadId` (Single line text) - Fetched from user record
- `message` (Long text)
- `role` (Single select: "user", "assistant")
- `timestamp` (Date/Time, auto)
- `read` (Checkbox)
- `attachments` (Attachment)
- `callRequestId` (Single line text, optional)

### Update Call Notes Table:
- Add: `callDuration` (Number)
- Add: `read` (Checkbox)

### Update Main Users Table:
- Add: `threadId` (Single line text) - Created during onboarding

---

## Key Implementation Details

### ThreadId Usage:
1. **Created during onboarding**: When agent is created, generate UUID for `threadId` and store in user record
2. **All chat messages**: Fetch `threadId` from user record, use for all chat messages
3. **Queries**: Always filter chat messages by `threadId` (not just `agentId`)

### Pagination:
- Default limit: 50 messages per request
- Max limit: 100 messages per request
- Response includes `hasMore` flag for "Load more" functionality
- Frontend handles loading older messages when user scrolls up

### Polling:
- Check for new messages every 3-5 seconds when active
- Back off to 10-15 seconds when tab is backgrounded
- Back off to 30 seconds when user is idle

---

## Future Enhancements (Post-MVP)

1. **Real-time Chat**: Upgrade from polling to WebSocket/SSE
2. **Phase 5 Integrations**: Connect chat to Notion, Google Calendar, etc.
3. **Voice Messages**: Allow voice message recording in chat
4. **Chat History Search**: Search through past conversations
5. **Agent Status Indicators**: Show when agent is "thinking" or "responding"
6. **Rich Media**: Support images, links, formatted text in chat

---

## Design Considerations

- Match existing brand aesthetic (dark theme, purple accents)
- Mobile-responsive design
- Loading states and error handling throughout
- Optimistic UI updates (show sent message immediately)
- Smooth animations for new messages
- Fixed navbar for clear navigation
- Active link highlighting for user orientation




