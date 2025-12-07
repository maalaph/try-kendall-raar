-- Migration: Enhanced Location System with PostGIS
-- Run this in Supabase SQL Editor

-- Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Add columns to user_locations table
ALTER TABLE user_locations 
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326),
ADD COLUMN IF NOT EXISTS cluster_id INTEGER,
ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'unknown' CHECK (location_type IN ('unknown', 'home', 'work', 'frequent')),
ADD COLUMN IF NOT EXISTS geocoding_type TEXT DEFAULT 'temporary' CHECK (geocoding_type IN ('temporary', 'permanent')),
ADD COLUMN IF NOT EXISTS retention_days INTEGER DEFAULT 30;

-- Create spatial index on geom column
CREATE INDEX IF NOT EXISTS idx_user_locations_geom ON user_locations USING GIST(geom);

-- Create index on cluster_id
CREATE INDEX IF NOT EXISTS idx_user_locations_cluster ON user_locations(user_id, cluster_id) WHERE cluster_id IS NOT NULL;

-- Create trigger to auto-populate geom from lat/lng
CREATE OR REPLACE FUNCTION update_location_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_location_geom ON user_locations;
CREATE TRIGGER trigger_update_location_geom
BEFORE INSERT OR UPDATE ON user_locations
FOR EACH ROW
EXECUTE FUNCTION update_location_geom();

-- Create clusters table for storing identified location patterns
CREATE TABLE IF NOT EXISTS location_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  cluster_id INTEGER NOT NULL,
  cluster_type TEXT DEFAULT 'unknown' CHECK (cluster_type IN ('unknown', 'home', 'work', 'frequent')),
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lng DOUBLE PRECISION NOT NULL,
  centroid_geom GEOMETRY(Point, 4326),
  formatted_address TEXT,
  point_count INTEGER DEFAULT 0,
  avg_duration_hours DOUBLE PRECISION,
  primary_time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'night'
  primary_day_of_week TEXT, -- 'weekday', 'weekend', 'both'
  confidence_score DOUBLE PRECISION DEFAULT 0,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cluster_id)
);

-- Create spatial index on cluster centroids
CREATE INDEX IF NOT EXISTS idx_location_clusters_geom ON location_clusters USING GIST(centroid_geom);
CREATE INDEX IF NOT EXISTS idx_location_clusters_user ON location_clusters(user_id);

-- Create trigger to auto-populate centroid_geom
CREATE OR REPLACE FUNCTION update_cluster_centroid_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.centroid_lat IS NOT NULL AND NEW.centroid_lng IS NOT NULL THEN
    NEW.centroid_geom := ST_SetSRID(ST_MakePoint(NEW.centroid_lng, NEW.centroid_lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cluster_centroid_geom ON location_clusters;
CREATE TRIGGER trigger_update_cluster_centroid_geom
BEFORE INSERT OR UPDATE ON location_clusters
FOR EACH ROW
EXECUTE FUNCTION update_cluster_centroid_geom();

-- Create search cache table for frequently searched locations
CREATE TABLE IF NOT EXISTS location_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  result_json JSONB,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geom GEOMETRY(Point, 4326),
  hit_count INTEGER DEFAULT 1,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_search_cache_user ON location_search_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_search_cache_query ON location_search_cache(user_id, query);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON location_search_cache(expires_at);

-- Create trigger to auto-populate search cache geom
CREATE OR REPLACE FUNCTION update_search_cache_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_search_cache_geom ON location_search_cache;
CREATE TRIGGER trigger_update_search_cache_geom
BEFORE INSERT OR UPDATE ON location_search_cache
FOR EACH ROW
EXECUTE FUNCTION update_search_cache_geom();

-- Add location_enabled to user preferences (Ghost Mode)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS location_retention_days INTEGER DEFAULT 30;

-- Function to run DBSCAN clustering on user locations
CREATE OR REPLACE FUNCTION cluster_user_locations(p_user_id TEXT, p_eps DOUBLE PRECISION DEFAULT 0.001, p_min_points INTEGER DEFAULT 5)
RETURNS TABLE(cluster_id INTEGER, point_count BIGINT, centroid_lat DOUBLE PRECISION, centroid_lng DOUBLE PRECISION) AS $$
BEGIN
  RETURN QUERY
  WITH clustered AS (
    SELECT 
      ST_ClusterDBSCAN(geom, eps := p_eps, minpoints := p_min_points) OVER () AS cid,
      latitude,
      longitude
    FROM user_locations
    WHERE user_id = p_user_id
      AND geom IS NOT NULL
      AND created_at > NOW() - INTERVAL '30 days'
  )
  SELECT 
    cid::INTEGER AS cluster_id,
    COUNT(*)::BIGINT AS point_count,
    AVG(latitude) AS centroid_lat,
    AVG(longitude) AS centroid_lng
  FROM clustered
  WHERE cid IS NOT NULL
  GROUP BY cid
  ORDER BY point_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired search cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_search_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM location_search_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old location data based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_locations ul
  USING users u
  WHERE ul.user_id = u.record_id
    AND ul.created_at < NOW() - (COALESCE(u.location_retention_days, 30) || ' days')::INTERVAL
    AND ul.cluster_id IS NULL; -- Don't delete clustered points
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (uncomment if needed)
-- GRANT ALL ON user_locations TO authenticated;
-- GRANT ALL ON user_locations TO service_role;
-- GRANT ALL ON location_clusters TO authenticated;
-- GRANT ALL ON location_clusters TO service_role;
-- GRANT ALL ON location_search_cache TO authenticated;
-- GRANT ALL ON location_search_cache TO service_role;

-- Update existing locations to populate geom column
UPDATE user_locations 
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON TABLE location_clusters IS 'Stores identified location patterns (home, work, frequent places) from PostGIS clustering';
COMMENT ON TABLE location_search_cache IS 'Caches frequently searched locations to reduce Mapbox API calls';
COMMENT ON COLUMN user_locations.geom IS 'PostGIS geometry point for spatial queries and clustering';
COMMENT ON COLUMN user_locations.geocoding_type IS 'temporary = exploration ($0.75/1k), permanent = saved ($5/1k)';
COMMENT ON COLUMN users.location_enabled IS 'Ghost Mode: when false, AI cannot access location';

