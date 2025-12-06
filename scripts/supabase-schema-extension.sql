-- Supabase Database Schema Extension for Complete Airtable Migration
-- Run this in Supabase SQL Editor after the base schema (supabase-schema.sql)
-- This adds tables for call notes, scheduled calls, outbound calls, phone mappings, business trials, and calendar events

-- Extend users table with OAuth tokens and phone number
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS spotify_access_token TEXT,
ADD COLUMN IF NOT EXISTS spotify_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS spotify_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS vapi_number TEXT,
ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS twilio_phone_sid TEXT;

CREATE INDEX IF NOT EXISTS idx_users_vapi_agent_id ON users(vapi_agent_id);
CREATE INDEX IF NOT EXISTS idx_users_vapi_number ON users(vapi_number);
CREATE INDEX IF NOT EXISTS idx_users_mobile_number ON users(mobile_number);

-- Call notes table (replaces Airtable call notes)
CREATE TABLE IF NOT EXISTS call_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  call_id TEXT,
  caller_phone TEXT NOT NULL,
  note TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  owner_phone TEXT,
  sms_sent BOOLEAN DEFAULT false,
  call_duration INTEGER, -- Duration in seconds
  read BOOLEAN DEFAULT false,
  call_type TEXT CHECK (call_type IN ('inbound', 'outbound')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_notes_agent_id ON call_notes(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_caller_phone ON call_notes(caller_phone);
CREATE INDEX IF NOT EXISTS idx_call_notes_timestamp ON call_notes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_call_notes_read ON call_notes(agent_id, read);
CREATE INDEX IF NOT EXISTS idx_call_notes_call_type ON call_notes(agent_id, call_type);

-- Scheduled calls table (replaces Airtable scheduled calls)
CREATE TABLE IF NOT EXISTS scheduled_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  recipient_name TEXT,
  recipient_phone TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
  call_type TEXT DEFAULT 'outbound',
  phone_number_id TEXT, -- VAPI phone number ID
  message TEXT,
  caller_name TEXT,
  record_id TEXT, -- Owner record ID for chat relay
  thread_id TEXT, -- Chat thread ID for chat relay
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_calls_agent_id ON scheduled_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_scheduled_time ON scheduled_calls(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status ON scheduled_calls(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_pending ON scheduled_calls(status, scheduled_time) WHERE status = 'pending';

-- Outbound call requests table (replaces Airtable outbound call requests)
CREATE TABLE IF NOT EXISTS outbound_call_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT,
  call_id TEXT UNIQUE NOT NULL, -- VAPI call ID (primary key for lookup)
  record_id TEXT NOT NULL, -- Owner record ID
  thread_id TEXT NOT NULL, -- Chat thread ID
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-call', 'completed', 'failed', 'voicemail')),
  phone_number TEXT, -- Optional: for reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_call_requests_agent_id ON outbound_call_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_outbound_call_requests_call_id ON outbound_call_requests(call_id);
CREATE INDEX IF NOT EXISTS idx_outbound_call_requests_status ON outbound_call_requests(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_outbound_call_requests_record_id ON outbound_call_requests(record_id);

-- Phone number mappings table (for Canadian numbers and phone number IDs)
CREATE TABLE IF NOT EXISTS phone_number_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT UNIQUE NOT NULL,
  canadian_phone TEXT,
  phone_number_id TEXT, -- VAPI phone number ID
  twilio_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_number_mappings_agent_id ON phone_number_mappings(agent_id);
CREATE INDEX IF NOT EXISTS idx_phone_number_mappings_canadian_phone ON phone_number_mappings(canadian_phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_number_mappings_agent_unique ON phone_number_mappings(agent_id);

-- Business trials table (replaces Airtable business trials)
CREATE TABLE IF NOT EXISTS business_trials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE, -- Airtable record ID for migration
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  business_website TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_trials_record_id ON business_trials(record_id);
CREATE INDEX IF NOT EXISTS idx_business_trials_email ON business_trials(email);
CREATE INDEX IF NOT EXISTS idx_business_trials_status ON business_trials(status);

-- Calendar events table (replaces Airtable calendar events)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT NOT NULL REFERENCES users(record_id) ON DELETE CASCADE,
  event_id TEXT NOT NULL, -- Google Calendar event ID
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  time_zone TEXT DEFAULT 'UTC',
  all_day BOOLEAN DEFAULT false,
  location TEXT,
  attendees TEXT[], -- Array of attendee emails
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Updated', 'Cancelled')),
  source TEXT, -- e.g., 'google', 'manual'
  event_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_id, event_id) -- One event per event_id per user
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_record_id ON calendar_events(record_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id ON calendar_events(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(record_id, start_time);

-- Triggers to auto-update updated_at for new tables
CREATE TRIGGER update_scheduled_calls_updated_at BEFORE UPDATE ON scheduled_calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbound_call_requests_updated_at BEFORE UPDATE ON outbound_call_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_number_mappings_updated_at BEFORE UPDATE ON phone_number_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_trials_updated_at BEFORE UPDATE ON business_trials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
