-- Enable pgvector Extension for Semantic Memory
-- Run this in Supabase SQL Editor

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify embeddings table exists and has correct structure
-- (This should already exist from supabase-schema.sql, but we'll verify)
DO $$
BEGIN
  -- Check if embeddings table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'embeddings'
  ) THEN
    -- Create embeddings table if it doesn't exist
    CREATE TABLE embeddings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      record_id TEXT NOT NULL,
      thread_id TEXT,
      message_id UUID,
      content TEXT NOT NULL,
      embedding vector(1536), -- OpenAI text-embedding-3-small dimension
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_embeddings_record_id ON embeddings(record_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_thread_id ON embeddings(thread_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_message_id ON embeddings(message_id);
  END IF;
END $$;

-- Create or update vector similarity search index
-- Using HNSW index for efficient approximate nearest neighbor search
-- HNSW is faster than ivfflat for production vector search at scale
-- Note: This index requires at least some data to be effective
-- If you get an error about empty table, add some embeddings first, then create the index

-- Drop existing index if it exists (to recreate with optimal parameters)
DROP INDEX IF EXISTS idx_embeddings_vector;

-- Create HNSW index for cosine similarity search
-- HNSW provides better query performance for similarity search at scale
-- m: number of connections per layer (default 16, higher = more accurate but slower)
-- ef_construction: size of candidate list during construction (default 64, higher = more accurate but slower)
-- This will be created after we have some data
-- For now, we'll create it with a check to avoid errors on empty table

DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM embeddings;
  
  IF row_count > 0 THEN
    -- Create index with HNSW for approximate nearest neighbor search
    -- Using cosine distance (vector_cosine_ops)
    -- HNSW is faster than ivfflat for production use
    CREATE INDEX idx_embeddings_vector ON embeddings 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  ELSE
    -- Create a placeholder index that will be recreated when data exists
    -- We'll use default HNSW parameters for now
    CREATE INDEX idx_embeddings_vector ON embeddings 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    RAISE NOTICE 'HNSW vector index created with default parameters. Consider recreating after adding data for optimal performance.';
  END IF;
END $$;

-- Create function for similarity search
-- This function will be used by the application to find similar embeddings
CREATE OR REPLACE FUNCTION search_similar_embeddings(
  query_embedding vector(1536),
  record_id_filter TEXT DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.7,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  record_id TEXT,
  thread_id TEXT,
  message_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.record_id,
    e.thread_id,
    e.message_id,
    e.content,
    e.metadata,
    -- Cosine similarity: 1 - cosine_distance
    -- Higher values = more similar
    1 - (e.embedding <=> query_embedding) AS similarity,
    e.created_at
  FROM embeddings e
  WHERE 
    (record_id_filter IS NULL OR e.record_id = record_id_filter)
    AND e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT USAGE ON SCHEMA public TO your_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON embeddings TO your_role;

-- Verify extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Display embeddings table structure
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'embeddings'
ORDER BY ordinal_position;

