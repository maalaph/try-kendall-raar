-- Migration: Add Soft Delete Columns to Threads Table
-- Run this in Supabase SQL Editor
-- This enables UI-only thread deletion while preserving data for AI learning

-- Add soft delete columns to threads table
ALTER TABLE threads 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for efficient filtering of non-deleted threads
CREATE INDEX IF NOT EXISTS idx_threads_deleted ON threads(record_id, deleted) WHERE deleted = false;

-- Ensure all existing threads are marked as not deleted
UPDATE threads SET deleted = false WHERE deleted IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN threads.deleted IS 'Soft delete flag - marks thread as deleted for UI organization only. Data remains in database for AI learning.';
COMMENT ON COLUMN threads.deleted_at IS 'Timestamp when thread was soft-deleted for UI purposes';

