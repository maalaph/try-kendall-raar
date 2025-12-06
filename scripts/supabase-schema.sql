-- Supabase Database Schema for Kendall Migration
-- Run this in Supabase SQL Editor after enabling pgvector extension

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (replaces Airtable user records)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL, -- Original Airtable record ID for migration
  full_name TEXT,
  nickname TEXT,
  email TEXT,
  mobile_number TEXT,
  kendall_name TEXT DEFAULT 'Kendall',
  selected_traits TEXT[],
  use_case_choice TEXT,
  boundary_choices TEXT[],
  user_context_and_rules TEXT,
  analyzed_file_content TEXT,
  file_usage_instructions TEXT,
  vapi_agent_id TEXT,
  time_zone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Threads table (conversation threads)
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT NOT NULL REFERENCES users(record_id) ON DELETE CASCADE,
  thread_id TEXT UNIQUE NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_record_id ON threads(record_id);
CREATE INDEX IF NOT EXISTS idx_threads_thread_id ON threads(thread_id);

-- Chat messages table (replaces Airtable chat messages)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT NOT NULL REFERENCES users(record_id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
  agent_id TEXT,
  message TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system', 'call_request')),
  read BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_record_id ON chat_messages(record_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);

-- Embeddings table for vector search (semantic memory)
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT NOT NULL REFERENCES users(record_id) ON DELETE CASCADE,
  thread_id TEXT REFERENCES threads(thread_id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_record_id ON embeddings(record_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_thread_id ON embeddings(thread_id);
-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);

-- Contacts table (replaces Airtable contacts)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT NOT NULL REFERENCES users(record_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  relationship TEXT,
  last_contacted TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_id, name) -- One contact per name per user
);

CREATE INDEX IF NOT EXISTS idx_contacts_record_id ON contacts(record_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(record_id, name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(record_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(record_id, email);

-- User patterns table (behavioral patterns)
CREATE TABLE IF NOT EXISTS user_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT NOT NULL REFERENCES users(record_id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('recurring_call', 'time_based_action', 'preferred_contact', 'behavior', 'preference')),
  pattern_data JSONB NOT NULL,
  confidence NUMERIC(3, 2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  last_observed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_patterns_record_id ON user_patterns(record_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_type ON user_patterns(record_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_user_patterns_confidence ON user_patterns(record_id, confidence DESC, last_observed DESC);

-- User memories table (long-term memory)
CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT NOT NULL REFERENCES users(record_id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'relationship', 'reminder', 'important_date', 'instruction')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  context TEXT,
  importance TEXT DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_id, key) -- One memory per key per user
);

CREATE INDEX IF NOT EXISTS idx_user_memories_record_id ON user_memories(record_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(record_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(record_id, importance DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_key ON user_memories(record_id, key);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_patterns_updated_at BEFORE UPDATE ON user_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_memories_updated_at BEFORE UPDATE ON user_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

