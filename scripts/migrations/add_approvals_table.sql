-- Migration: Add pending_approvals table for Human-in-the-Loop (HITL) system
-- Run this in Supabase SQL Editor

-- Create pending_approvals table
CREATE TABLE IF NOT EXISTS pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  thread_id TEXT,
  message TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_approvals_user_id ON pending_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON pending_approvals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON pending_approvals(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approvals_thread ON pending_approvals(thread_id) WHERE thread_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE pending_approvals IS 'Stores pending approval requests for sensitive agent actions (purchases, payments, bookings)';
COMMENT ON COLUMN pending_approvals.action_type IS 'Type of action: purchase, payment, transfer, booking, subscription, financial, irreversible';
COMMENT ON COLUMN pending_approvals.action_params IS 'Parameters for the action (amount, recipient, etc.)';
COMMENT ON COLUMN pending_approvals.context IS 'Additional context about when/why approval was requested';

-- Function to auto-expire old approvals
CREATE OR REPLACE FUNCTION expire_old_approvals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pending_approvals
  SET status = 'expired', resolved_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run expiration check on new inserts (optional - can be run via cron instead)
-- DROP TRIGGER IF EXISTS check_expired_approvals ON pending_approvals;
-- CREATE TRIGGER check_expired_approvals
-- AFTER INSERT ON pending_approvals
-- EXECUTE FUNCTION expire_old_approvals();

-- Grant permissions (adjust as needed for your Supabase setup)
-- GRANT ALL ON pending_approvals TO authenticated;
-- GRANT ALL ON pending_approvals TO service_role;

