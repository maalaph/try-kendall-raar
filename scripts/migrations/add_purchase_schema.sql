-- Migration: Add purchase execution tables for Privacy.com virtual cards and purchase workflow
-- Run this in Supabase SQL Editor

-- Virtual cards table (Privacy.com cards)
CREATE TABLE IF NOT EXISTS virtual_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  privacy_card_id TEXT UNIQUE, -- Privacy.com card ID
  card_number TEXT, -- Last 4 digits only (for display)
  card_type TEXT, -- 'merchant_locked', 'single_use', 'open'
  spend_limit NUMERIC(19, 4), -- Spending limit in cents
  spent_amount NUMERIC(19, 4) DEFAULT 0, -- Amount already spent
  state TEXT NOT NULL CHECK (state IN ('OPEN', 'PAUSED', 'CLOSED', 'PENDING_FULFILLMENT', 'PENDING_ACTIVATION')),
  merchant TEXT, -- Merchant name if merchant-locked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Purchase requests table (links to existing pending_approvals)
CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  approval_id UUID REFERENCES pending_approvals(id), -- Link to approval workflow
  item_name TEXT NOT NULL,
  item_url TEXT, -- Product URL
  merchant TEXT NOT NULL,
  amount NUMERIC(19, 4) NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'approved', 'card_created', 'purchased', 'failed', 'cancelled')),
  
  -- Card details (after card creation)
  virtual_card_id UUID REFERENCES virtual_cards(id),
  
  -- Purchase details
  purchase_details JSONB DEFAULT '{}'::jsonb, -- Store any additional purchase info
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Purchase history table (completed purchases)
CREATE TABLE IF NOT EXISTS purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  purchase_request_id UUID REFERENCES purchase_requests(id),
  virtual_card_id UUID REFERENCES virtual_cards(id),
  item_name TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount NUMERIC(19, 4) NOT NULL,
  currency TEXT DEFAULT 'USD',
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Purchase metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_virtual_cards_user_id ON virtual_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_cards_state ON virtual_cards(user_id, state);
CREATE INDEX IF NOT EXISTS idx_virtual_cards_privacy_id ON virtual_cards(privacy_card_id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_user_id ON purchase_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_approval_id ON purchase_requests(approval_id);

CREATE INDEX IF NOT EXISTS idx_purchase_history_user_id ON purchase_history(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_date ON purchase_history(user_id, transaction_date DESC);

-- RLS Policies
ALTER TABLE virtual_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;

-- Users can only access their own cards
CREATE POLICY "Users access own virtual cards" ON virtual_cards
  FOR ALL
  USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can only access their own purchase requests
CREATE POLICY "Users access own purchase requests" ON purchase_requests
  FOR ALL
  USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can only access their own purchase history
CREATE POLICY "Users access own purchase history" ON purchase_history
  FOR ALL
  USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Comments for documentation
COMMENT ON TABLE virtual_cards IS 'Privacy.com virtual cards created for user purchases';
COMMENT ON TABLE purchase_requests IS 'Pending and completed purchase requests with approval workflow';
COMMENT ON TABLE purchase_history IS 'Completed purchase transactions';

