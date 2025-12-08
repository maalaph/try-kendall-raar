-- Migration: Add documents table and profile_data column for Document Intelligence
-- Run this in Supabase SQL Editor

-- Create documents table for uploaded files
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  storage_path TEXT,
  content TEXT,
  summary TEXT,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_file_type CHECK (file_type IN ('pdf', 'docx', 'doc', 'txt', 'image', 'other')),
  CONSTRAINT valid_doc_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for documents table
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(user_id, file_type);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(user_id, created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE documents IS 'Stores uploaded documents and extracted content for AI analysis';
COMMENT ON COLUMN documents.content IS 'Raw text content extracted from document';
COMMENT ON COLUMN documents.summary IS 'AI-generated summary of document';
COMMENT ON COLUMN documents.extracted_data IS 'Structured data extracted (skills, experience, etc.)';

-- Add profile_data column to users table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'profile_data'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add extracted_skills column to users table (for quick access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'extracted_skills'
  ) THEN
    ALTER TABLE users ADD COLUMN extracted_skills TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Add industry column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'industry'
  ) THEN
    ALTER TABLE users ADD COLUMN industry TEXT;
  END IF;
END $$;

-- Create index on profile_data for JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_profile_data ON users USING GIN (profile_data);

-- Create index on extracted_skills for array queries
CREATE INDEX IF NOT EXISTS idx_users_skills ON users USING GIN (extracted_skills);

-- Add comments
COMMENT ON COLUMN users.profile_data IS 'Structured profile data extracted from uploaded documents';
COMMENT ON COLUMN users.extracted_skills IS 'Skills extracted from resume/profile documents';
COMMENT ON COLUMN users.industry IS 'User industry extracted from profile';

-- Function to update user profile when document is processed
CREATE OR REPLACE FUNCTION update_user_profile_from_document()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if document processing completed
  IF NEW.status = 'completed' AND NEW.extracted_data IS NOT NULL THEN
    -- Update user profile_data by merging with existing
    UPDATE users
    SET 
      profile_data = COALESCE(profile_data, '{}'::jsonb) || NEW.extracted_data,
      updated_at = NOW()
    WHERE record_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update user profile when document is processed
DROP TRIGGER IF EXISTS update_profile_on_document ON documents;
CREATE TRIGGER update_profile_on_document
AFTER UPDATE OF status ON documents
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_user_profile_from_document();

-- Grant permissions (adjust as needed)
-- GRANT ALL ON documents TO authenticated;
-- GRANT ALL ON documents TO service_role;



