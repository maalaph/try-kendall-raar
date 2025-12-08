-- Migration: Location Suggestions Table
-- Run this in Supabase SQL Editor
-- Creates table for proactive location suggestions based on clustering patterns

CREATE TABLE IF NOT EXISTS location_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  cluster_id INTEGER NOT NULL,
  suggested_label TEXT, -- e.g., "Frequent Place", "Work", "Home", or null for user to customize
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(Point, 4326),
  confidence_score DOUBLE PRECISION DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(user_id, cluster_id)
);

-- Create spatial index on geom column
CREATE INDEX IF NOT EXISTS idx_location_suggestions_geom ON location_suggestions USING GIST(geom);

-- Create index on user_id and status for quick lookups
CREATE INDEX IF NOT EXISTS idx_location_suggestions_user_status ON location_suggestions(user_id, status);

-- Create index on cluster_id
CREATE INDEX IF NOT EXISTS idx_location_suggestions_cluster ON location_suggestions(user_id, cluster_id);

-- Create trigger to auto-populate geom from lat/lng
CREATE OR REPLACE FUNCTION update_suggestion_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_suggestion_geom ON location_suggestions;
CREATE TRIGGER trigger_update_suggestion_geom
BEFORE INSERT OR UPDATE ON location_suggestions
FOR EACH ROW
EXECUTE FUNCTION update_suggestion_geom();

-- Function to check if similar location was previously rejected
CREATE OR REPLACE FUNCTION was_similar_location_rejected(
  p_user_id TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_threshold_meters DOUBLE PRECISION DEFAULT 200
)
RETURNS BOOLEAN AS $$
DECLARE
  rejected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rejected_count
  FROM location_suggestions
  WHERE user_id = p_user_id
    AND status = 'rejected'
    AND ST_DWithin(
      geom,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326),
      p_threshold_meters / 111320.0 -- Convert meters to degrees (approximate)
    );
  
  RETURN rejected_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to check if location is already saved
CREATE OR REPLACE FUNCTION is_location_already_saved(
  p_user_id TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_threshold_meters DOUBLE PRECISION DEFAULT 200
)
RETURNS BOOLEAN AS $$
DECLARE
  saved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO saved_count
  FROM saved_locations
  WHERE user_id = p_user_id
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326),
      p_threshold_meters / 111320.0 -- Convert meters to degrees (approximate)
    );
  
  RETURN saved_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE location_suggestions IS 'Stores proactive location suggestions generated from clustering patterns';
COMMENT ON COLUMN location_suggestions.suggested_label IS 'AI-suggested label (can be customized by user when accepting)';
COMMENT ON COLUMN location_suggestions.status IS 'pending = waiting for user response, accepted = saved to saved_locations, rejected = user rejected, dismissed = user dismissed without action';
COMMENT ON COLUMN location_suggestions.confidence_score IS 'Confidence score from clustering (0-1)';
COMMENT ON COLUMN location_suggestions.visit_count IS 'Number of times user visited this location';



