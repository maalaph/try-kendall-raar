/**
 * Supabase client for PostgreSQL database
 * Replaces Airtable for all data operations
 */

import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is not set');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
}

// Create Supabase client with service role key (full access)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Database connection string for direct PostgreSQL queries (if needed)
export const getDatabaseUrl = (): string => {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL environment variable is not set');
  }
  return process.env.SUPABASE_DB_URL;
};

