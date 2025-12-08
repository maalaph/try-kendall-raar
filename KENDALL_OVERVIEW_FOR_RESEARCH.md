# Kendall Personal Assistant: System Overview for Research

## Executive Summary

**Kendall** is a personal AI assistant designed to handle tasks a human assistant would manage. The system is built to learn user preferences, remember context, and execute actions across multiple integrated services. The vision is to create a comprehensive personal assistant that can manage phone calls, emails, calendar, purchases, finances, location-based tasks, and more.

**Current Goal**: Enable two new capabilities:
1. **Financial tracking and analysis** - Access finances, track spending, identify subscriptions, detect trends, and provide financial overviews in the dashboard
2. **Purchase execution** - Make purchases on behalf of the user

---

## What Kendall Is

Kendall is a **personal AI assistant** that operates through multiple interfaces:
- **Voice calls** (inbound/outbound) via VAPI
- **Text chat** via web dashboard
- **Function calling** to execute actions across integrated services

Kendall learns from interactions, remembers user preferences, contacts, and patterns, and can execute complex multi-step tasks autonomously or with user approval.

---

## Current Capabilities (What Works Now)

### ✅ Communication & Scheduling
- **Phone Calls**: Inbound and outbound voice calls via VAPI
  - Personalized voice and personality per user
  - Can make calls on user's behalf with specific messages
  - Can schedule calls for future times
- **Email Management**: Gmail integration
  - Read emails (with intelligent filtering and insights)
  - Send emails on user's behalf
  - Analyze email patterns and importance
- **Calendar Management**: Google Calendar integration
  - Read calendar events
  - Create calendar events
  - Check availability

### ✅ Context & Memory
- **Contact Management**: Auto-extracts and stores contacts from conversations
  - Lookup contacts by name, email, or phone
  - Stores relationship context
- **Pattern Learning**: Extracts recurring behaviors and preferences
  - Identifies user patterns (e.g., "usually orders groceries on Fridays")
  - Stores patterns for context-aware suggestions
- **Long-term Memory**: Stores facts, preferences, relationships
  - Semantic search across conversation history
  - Vector embeddings for intelligent context retrieval
- **Location Intelligence**: Location-based suggestions
  - Tracks user locations (with permission)
  - Suggests nearby services, restaurants, businesses
  - Location clustering and labeling

### ✅ Integration Framework
- **Google Services**: Calendar, Gmail (OAuth-based)
- **Spotify**: Music preferences and mood analysis
- **VAPI**: Voice AI for phone calls
- **Twilio**: Phone number management

### ✅ User Interface
- **Chat Interface**: Real-time text chat with AI
- **Dashboard**: Overview of integrations, locations, and insights
- **Location Map**: Interactive map for location management
- **Personal Setup**: Wizard for creating personalized assistant

---

## Vision & Future Goals

### The Ultimate Goal
Kendall should be able to **do anything a human personal assistant can do, but better**:
- Never forgets anything
- Available 24/7
- Learns continuously
- Handles multiple tasks simultaneously
- Proactive rather than reactive
- Gets smarter over time

### Planned Capabilities (From Architecture Documents)
1. **Complex Phone Interactions**: IVR navigation, hold time handling, multi-step call flows
2. **Purchasing & Commerce**: Buy products, compare prices, track receipts, manage subscriptions
3. **Financial Management**: Track spending, analyze patterns, budget management, alerts
4. **Location-Based Intelligence**: Recommendations based on location, nearby services, geofencing
5. **Universal Integration**: Connect to every service the user uses (banking, shopping, healthcare, etc.)
6. **Approval Workflows**: Human-in-the-loop for sensitive actions

---

## Architecture Overview

### Technology Stack

#### Frontend
- **Next.js 16** (App Router) - React-based web application
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Styling
- **React 19** - UI framework

#### Backend
- **Next.js API Routes** - Serverless API endpoints (`/app/api/*`)
- **Supabase (PostgreSQL)** - Primary database with pgvector for semantic search
- **OpenAI GPT-4o** - AI reasoning and function calling
- **LangGraph** - Advanced agent orchestration with state management
- **Trigger.dev** - Background job processing for async tasks

#### Integrations
- **VAPI** - Voice AI platform for phone calls
- **Google APIs** - Calendar, Gmail (OAuth)
- **Spotify API** - Music preferences
- **Twilio** - Phone number management

### System Architecture Flow

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                        │
│  (Chat, Voice Calls, Dashboard, Personal Setup)         │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTES                         │
│  /api/chat/send  │  /api/vapi-webhook  │  /api/*       │
└────────────────────┬─────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                          │
        ▼                          ▼
┌───────────────┐        ┌──────────────────┐
│  AI PROCESSING│        │  FUNCTION EXEC   │
│  (GPT-4o)     │        │  (Integrations)  │
│  + LangGraph  │        │                  │
└───────┬───────┘        └────────┬─────────┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │                          │
        ▼                          ▼
┌───────────────┐        ┌──────────────────┐
│   DATABASE    │        │  BACKGROUND JOBS  │
│  (Supabase)   │        │  (Trigger.dev)    │
│               │        │  - Learning       │
│  - Users      │        │  - Embeddings    │
│  - Messages   │        │  - Scheduled      │
│  - Contacts   │        │    Tasks          │
│  - Patterns   │        └──────────────────┘
│  - Memories   │
│  - Embeddings │
└───────────────┘
```

### Key Components

#### 1. Chat System (`app/api/chat/send/route.ts`)
- **Purpose**: Handles text-based chat with function calling
- **Capabilities**:
  - Multi-modal input (text, voice, files, images)
  - Function calling for integrations
  - Context retrieval (patterns, memories, contacts)
  - Smart model selection (cost optimization)
  - LangGraph orchestration (optional, enabled via `USE_LANGGRAPH=true`)

#### 2. Function System (`CHAT_FUNCTIONS` array)
Currently available functions:
- `make_outbound_call` - Make immediate phone call
- `schedule_outbound_call` - Schedule future call
- `get_calendar_events` - Read Google Calendar
- `create_calendar_event` - Create calendar event
- `get_gmail_messages` - Read Gmail with analysis
- `send_gmail` - Send email
- `get_contact_by_name` - Lookup contact
- `get_contact_by_email` - Lookup by email
- `save_contact` - Save new contact
- `get_user_location` - Get user's current location
- `get_spotify_insights` - Get music preferences

#### 3. Database Schema (Supabase PostgreSQL)
**Key Tables**:
- `users` - User profiles, OAuth tokens, preferences
- `threads` - Conversation threads
- `messages` - Chat messages with metadata
- `contacts` - Extracted contacts from conversations
- `patterns` - Learned behavioral patterns
- `memories` - Long-term facts and preferences
- `embeddings` - Vector embeddings for semantic search
- `call_notes` - Call transcripts and summaries
- `scheduled_calls` - Scheduled outbound calls
- `calendar_events` - Calendar event records
- `location_suggestions` - Location-based suggestions

**Note**: No financial tables exist yet (transactions, subscriptions, budgets, etc.)

#### 4. Agent Orchestration (`lib/agent/orchestrator.ts`)
- **LangGraph-based state machine**
- **Capabilities**:
  - Multi-step reasoning
  - State persistence (Postgres checkpointer)
  - Function selection and execution
  - Context-aware responses
  - Loop detection and prevention

#### 5. Background Processing (`trigger/`)
- **Trigger.dev workers** for async tasks
- **Current Tasks**:
  - Pattern extraction from conversations
  - Embedding creation for semantic search
  - Scheduled task execution

#### 6. Integration Framework (`lib/integrations/`)
- **Structure**: Each integration is a module with standardized interface
- **Current Integrations**:
  - `google.ts` - Google Calendar and Gmail
  - `spotify.ts` - Spotify music preferences
- **Design**: Extensible for new integrations (banking, e-commerce, etc.)

#### 7. Approval System (Planned/Partial)
- **Status**: Foundation exists (`lib/agent/approvalHandler.ts`, `app/api/approvals/route.ts`)
- **Purpose**: Human-in-the-loop for sensitive actions
- **Current**: Detects actions requiring approval but not fully implemented
- **Approval Types**: `purchase`, `payment`, `transfer`, `booking`, `subscription`, `financial`, `irreversible`

---

## Current State Assessment for Financial Features

### ✅ What Exists (Foundations)
1. **Approval System Foundation**: Code exists to detect and request approval for financial actions
2. **Database Infrastructure**: PostgreSQL can support new financial tables
3. **Function Calling Framework**: Can add new functions for financial operations
4. **Integration Architecture**: Pattern exists for adding new service integrations
5. **LangGraph Orchestration**: Can handle complex multi-step financial workflows
6. **Background Jobs**: Trigger.dev can process async financial tasks

### ❌ What's Missing (Required for Financial Features)
1. **Banking Integration**: No Plaid, Yodlee, or direct bank API connections
2. **Financial Data Schema**: No tables for transactions, accounts, budgets, subscriptions
3. **Payment Processing**: No Stripe, PayPal, or payment method storage
4. **Financial Functions**: No functions for viewing balances, tracking spending, managing subscriptions
5. **E-commerce Integration**: No Amazon, Shopify, or shopping APIs
6. **Receipt Processing**: No OCR or receipt storage system
7. **Financial Analysis**: No spending categorization, trend analysis, or budgeting tools
8. **Subscription Detection**: No automated subscription identification from transactions

---

## Key Files Reference

### Core Chat & AI
- `app/api/chat/send/route.ts` - Main chat endpoint with function calling
- `lib/agent/orchestrator.ts` - LangGraph agent orchestration
- `lib/agent/functions.ts` - Function registry and execution
- `lib/promptBlocks.ts` - System prompt construction

### Database
- `lib/database.ts` - All database operations (Supabase)
- `lib/supabase.ts` - Supabase client initialization

### Integrations
- `lib/integrations/google.ts` - Google Calendar & Gmail
- `lib/integrations/spotify.ts` - Spotify integration
- `lib/integrations/registry.ts` - Integration registry pattern

### Voice & Calls
- `lib/vapi.ts` - VAPI integration for phone calls
- `app/api/vapi-webhook/route.ts` - VAPI webhook handler

### Approval System
- `lib/agent/approvalHandler.ts` - Approval detection and request handling
- `app/api/approvals/route.ts` - Approval API endpoint

### Background Jobs
- `trigger/` - Trigger.dev task definitions

### Frontend
- `app/chat/page.tsx` - Chat interface
- `app/dashboard/page.tsx` - Dashboard overview
- `components/ChatInterface.tsx` - Chat UI component
- `components/IntegrationDashboard.tsx` - Integration management UI

---

## Current User Flow Example

### Example: User Asks to Schedule a Meeting

1. **User sends message**: "Schedule a meeting with John tomorrow at 2pm"
2. **Chat API receives request** (`app/api/chat/send/route.ts`)
3. **Context loaded**: User patterns, memories, contacts, recent messages
4. **AI analyzes request**: Determines it needs to:
   - Lookup contact "John" (`get_contact_by_name`)
   - Create calendar event (`create_calendar_event`)
5. **Functions executed**:
   - `get_contact_by_name` → Returns John's contact info
   - `create_calendar_event` → Creates event in Google Calendar
6. **Response generated**: "I've scheduled a meeting with John tomorrow at 2pm. Added to your calendar."
7. **Background processing**: Pattern extractor identifies "user frequently schedules meetings with John"

---

## Design Patterns & Conventions

### Function Calling Pattern
Functions are defined in `CHAT_FUNCTIONS` array with:
- `name`: Function identifier
- `description`: Natural language description for AI
- `parameters`: JSON schema for parameters

Functions are executed via handler functions that:
1. Validate parameters
2. Execute integration logic
3. Return structured results
4. Handle errors gracefully

### Integration Pattern
New integrations should:
1. Add OAuth handling (if needed) in `lib/integrations/[service].ts`
2. Add function definition to `CHAT_FUNCTIONS`
3. Add function handler in chat route
4. Store credentials securely in database
5. Handle token refresh automatically

### Database Pattern
- Use Supabase client (`lib/supabase.ts`)
- Follow existing naming conventions (snake_case for DB, camelCase for TypeScript)
- Add migrations in `scripts/migrations/`
- Use vector embeddings for semantic search where applicable

### Error Handling
- Use typed error classes (`GoogleIntegrationError`, etc.)
- Return user-friendly error messages
- Log detailed errors server-side
- Gracefully degrade when services unavailable

---

## Security & Privacy Considerations

### Current Security Measures
- OAuth tokens stored in database (encrypted at rest by Supabase)
- Function calling requires explicit user intent
- Contact extraction requires user confirmation
- Rate limiting on API endpoints

### For Financial Features (To Consider)
- **PCI Compliance**: Payment data must be handled according to PCI-DSS
- **Encryption**: Financial data must be encrypted at rest and in transit
- **Audit Logging**: All financial actions should be logged
- **Approval Workflows**: High-value transactions require explicit approval
- **Tokenization**: Payment methods should be tokenized, not stored raw
- **Banking APIs**: Use secure, regulated providers (Plaid, Yodlee)

---

## Research Questions for Financial Features

### Financial Tracking
1. **Banking API Options**: Which APIs are best for connecting to user bank accounts?
   - Plaid (most popular, comprehensive)
   - Yodlee (enterprise-focused)
   - Teller (developer-friendly)
   - Direct bank APIs (limited availability)
2. **Transaction Categorization**: How to automatically categorize transactions?
   - ML-based categorization
   - Rule-based categorization
   - User-defined categories
   - Merchant name matching
3. **Subscription Detection**: How to identify recurring subscriptions?
   - Pattern analysis (same amount, same merchant, recurring dates)
   - Merchant name matching
   - Integration with subscription tracking services
4. **Data Storage**: What financial data should be stored?
   - Transaction history
   - Account balances
   - Budgets and limits
   - Subscription tracking
   - Receipt storage

### Purchase Execution
1. **Payment Processing**: How to securely process payments?
   - Stripe (most common, supports many payment methods)
   - PayPal (alternative)
   - Apple Pay / Google Pay integration
2. **E-commerce APIs**: How to make purchases on user's behalf?
   - Amazon API (limited, requires business account)
   - Shopify (if merchant-specific)
   - Generic checkout automation (browser automation?)
3. **Approval Workflows**: How to implement purchase approval?
   - Real-time notifications
   - In-app approval UI
   - Email/SMS approval
   - Approval thresholds (auto-approve small amounts?)
4. **Receipt Management**: How to store and organize receipts?
   - OCR for receipt extraction
   - Automatic receipt matching to transactions
   - Receipt storage (file upload, PDF parsing)

---

## Next Steps After Research

Once research is complete, we'll need to:
1. **Select APIs and Services**: Choose banking API (Plaid vs Yodlee), payment processor (Stripe), etc.
2. **Design Database Schema**: Create tables for transactions, accounts, budgets, subscriptions
3. **Design Function API**: Define functions for financial operations
4. **Implement Approval System**: Complete the approval workflow for purchases
5. **Build UI Components**: Add financial overview to dashboard
6. **Security Review**: Ensure compliance with financial regulations
7. **Testing Plan**: Define how to safely test financial features

---

## Additional Context

### Codebase Location
- **Root**: `/Users/rm/Desktop/landing_page`
- **API Routes**: `app/api/*`
- **Library Code**: `lib/*`
- **Components**: `components/*`
- **Database Migrations**: `scripts/migrations/*`

### Environment Variables
Key environment variables (see `env.template`):
- `OPENAI_API_KEY` - For GPT-4o
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` - Database
- `VAPI_PRIVATE_KEY` - Voice AI
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- (Future: `PLAID_CLIENT_ID`, `STRIPE_SECRET_KEY`, etc.)

### Testing
- **Local Development**: `npm run dev` (Next.js) + `npm run trigger:dev` (background jobs)
- **Database**: Supabase local or hosted instance
- **Integrations**: Use test/sandbox credentials where available

---

## Summary for Researcher

**Kendall is a personal AI assistant** built on Next.js, Supabase, and OpenAI GPT-4o. It currently handles:
- Phone calls, emails, calendar
- Contact management and memory
- Location-based suggestions

**Goal**: Add financial tracking and purchase capabilities.

**Architecture is ready**: The function calling system, database, and integration patterns exist and can be extended. What's needed is:
- Research on banking/payment APIs
- Database schema design for financial data
- Function definitions for financial operations
- UI components for financial overview
- Security and compliance considerations

The system is designed to be extensible, so new features follow existing patterns. Financial features will integrate with the same function calling system used for calendar, email, and other integrations.

