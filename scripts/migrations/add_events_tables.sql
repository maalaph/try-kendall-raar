-- Migration: Events Recommendation System Tables
-- Run this in Supabase SQL Editor
-- Creates tables for event data, user interests, and feedback tracking

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('google', 'eventbrite', 'meetup', 'manual')),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  venue TEXT,
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  url TEXT,
  image_url TEXT,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_external_event UNIQUE (external_id, source),
  CONSTRAINT valid_latitude CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT valid_longitude CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_source_external ON events(source, external_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_location ON events(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_updated_at ON events(updated_at DESC);

-- Vector index for semantic search (HNSW for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_events_embedding ON events 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embedding IS NOT NULL;

-- Spatial index for location-based queries (if PostGIS extension exists)
CREATE INDEX IF NOT EXISTS idx_events_spatial ON events 
USING GIST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- EVENT SOURCES TABLE (for tracking sync status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE CHECK (source IN ('google', 'eventbrite', 'meetup')),
  enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'partial')),
  last_sync_error TEXT,
  sync_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER INTERESTS TABLE (for interest embeddings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id TEXT NOT NULL,
  interest_embedding vector(1536), -- Combined interest profile embedding
  interest_tags JSONB DEFAULT '[]', -- Array of interest tags/categories
  confidence_scores JSONB DEFAULT '{}', -- Map of tag -> confidence score
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_interests UNIQUE (record_id)
);

-- Indexes for user interests
CREATE INDEX IF NOT EXISTS idx_user_interests_record_id ON user_interests(record_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_embedding ON user_interests 
USING hnsw (interest_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE interest_embedding IS NOT NULL;

-- ============================================================================
-- EVENT IMPRESSIONS TABLE (when event shown to user)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  context JSONB DEFAULT '{}', -- Context when shown (location, time, query, etc.)
  
  CONSTRAINT unique_impression UNIQUE (record_id, event_id, shown_at)
);

-- Indexes for impressions
CREATE INDEX IF NOT EXISTS idx_impressions_record_id ON event_impressions(record_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_impressions_event_id ON event_impressions(event_id);
CREATE INDEX IF NOT EXISTS idx_impressions_shown_at ON event_impressions(shown_at DESC);

-- ============================================================================
-- EVENT INTERACTIONS TABLE (user actions on events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impression_id UUID NOT NULL REFERENCES event_impressions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('click', 'save', 'dismiss', 'rsvp', 'view_details')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for interactions
CREATE INDEX IF NOT EXISTS idx_interactions_impression ON event_interactions(impression_id);
CREATE INDEX IF NOT EXISTS idx_interactions_action ON event_interactions(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON event_interactions(timestamp DESC);

-- ============================================================================
-- EVENT OUTCOMES TABLE (did user actually attend?)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  attended BOOLEAN,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  verified_from_calendar BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_outcome UNIQUE (event_id, record_id)
);

-- Indexes for outcomes
CREATE INDEX IF NOT EXISTS idx_outcomes_record_id ON event_outcomes(record_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_event_id ON event_outcomes(event_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_attended ON event_outcomes(record_id, attended) WHERE attended = true;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for events table
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for event_sources table
DROP TRIGGER IF EXISTS update_event_sources_updated_at ON event_sources;
CREATE TRIGGER update_event_sources_updated_at
BEFORE UPDATE ON event_sources
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to search similar events by embedding
CREATE OR REPLACE FUNCTION search_similar_events(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  result_limit INTEGER DEFAULT 10,
  start_date_filter TIMESTAMPTZ DEFAULT NULL,
  category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  start_date TIMESTAMPTZ,
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.category,
    e.start_date,
    e.location,
    e.latitude,
    e.longitude,
    -- Cosine similarity: 1 - cosine_distance (higher = more similar)
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM events e
  WHERE 
    e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) >= similarity_threshold
    AND (start_date_filter IS NULL OR e.start_date >= start_date_filter)
    AND (category_filter IS NULL OR e.category = category_filter)
  ORDER BY e.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE events IS 'Normalized event data from multiple sources (Google Events, Eventbrite, etc.)';
COMMENT ON TABLE event_sources IS 'Configuration and sync status for event data sources';
COMMENT ON TABLE user_interests IS 'User interest embeddings derived from memories, patterns, Spotify, and behavior';
COMMENT ON TABLE event_impressions IS 'Tracks when events are shown to users for recommendation tracking';
COMMENT ON TABLE event_interactions IS 'User actions on events (click, save, dismiss, RSVP)';
COMMENT ON TABLE event_outcomes IS 'Whether users actually attended events (verified from calendar when possible)';

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON events TO authenticated;
-- GRANT ALL ON event_sources TO authenticated;
-- GRANT ALL ON user_interests TO authenticated;
-- GRANT ALL ON event_impressions TO authenticated;
-- GRANT ALL ON event_interactions TO authenticated;
-- GRANT ALL ON event_outcomes TO authenticated;

