-- Migration: Add user_locations table for location tracking
-- Run this in Supabase SQL Editor

-- Create user_locations table
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER,
  altitude DECIMAL(10, 2),
  altitude_accuracy INTEGER,
  heading DECIMAL(5, 2),
  speed DECIMAL(10, 2),
  label TEXT,
  source TEXT DEFAULT 'browser',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT valid_longitude CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT valid_source CHECK (source IN ('browser', 'manual', 'gps', 'ip', 'other'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_created ON user_locations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_label ON user_locations(user_id, label) WHERE label IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE user_locations IS 'Stores user location history (last 10 locations per user)';
COMMENT ON COLUMN user_locations.label IS 'Custom label for location (home, work, etc.)';
COMMENT ON COLUMN user_locations.source IS 'How location was obtained: browser, manual, gps, ip, other';

-- Function to maintain only last 10 locations per user
CREATE OR REPLACE FUNCTION maintain_location_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete old locations beyond the 10 most recent
  DELETE FROM user_locations
  WHERE user_id = NEW.user_id
  AND id NOT IN (
    SELECT id FROM user_locations
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    LIMIT 10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-maintain 10 location limit
DROP TRIGGER IF EXISTS limit_user_locations ON user_locations;
CREATE TRIGGER limit_user_locations
AFTER INSERT ON user_locations
FOR EACH ROW EXECUTE FUNCTION maintain_location_limit();

-- Create saved_locations table for manual home/work locations
CREATE TABLE IF NOT EXISTS saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one location per label per user
  CONSTRAINT unique_user_label UNIQUE (user_id, label),
  CONSTRAINT valid_saved_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT valid_saved_longitude CHECK (longitude >= -180 AND longitude <= 180)
);

-- Index for saved locations
CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON saved_locations(user_id);

COMMENT ON TABLE saved_locations IS 'Stores user-defined locations (home, work, etc.)';

-- Grant permissions (adjust as needed)
-- GRANT ALL ON user_locations TO authenticated;
-- GRANT ALL ON user_locations TO service_role;
-- GRANT ALL ON saved_locations TO authenticated;
-- GRANT ALL ON saved_locations TO service_role;

