-- Fix user_memories table schema
-- Adds missing 'importance' column if it doesn't exist
-- Run this in Supabase SQL Editor

-- Add importance column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'user_memories' 
    AND column_name = 'importance'
  ) THEN
    ALTER TABLE user_memories 
    ADD COLUMN importance TEXT DEFAULT 'medium' 
    CHECK (importance IN ('low', 'medium', 'high'));
    
    -- Update existing records to have default importance
    UPDATE user_memories SET importance = 'medium' WHERE importance IS NULL;
    
    RAISE NOTICE 'Added importance column to user_memories table';
  ELSE
    RAISE NOTICE 'importance column already exists in user_memories table';
  END IF;
END $$;




