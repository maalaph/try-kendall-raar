-- Migration: Add Plaid integration tables for bank accounts and transactions
-- Run this in Supabase SQL Editor

-- Plaid items table (tracks connected institutions)
CREATE TABLE IF NOT EXISTS plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  plaid_item_id TEXT UNIQUE NOT NULL, -- Plaid's item ID
  institution_id TEXT, -- Institution identifier
  institution_name TEXT, -- Human-readable institution name
  access_token TEXT NOT NULL, -- Encrypted access token (should be encrypted in application layer)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'error', 'removed')),
  
  -- Metadata
  error JSONB, -- Store any Plaid errors
  webhook_url TEXT, -- Webhook URL for this item
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, plaid_item_id)
);

-- Bank accounts table (user's accounts from connected institutions)
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  plaid_item_id UUID REFERENCES plaid_items(id) ON DELETE CASCADE,
  plaid_account_id TEXT NOT NULL, -- Plaid's account ID
  
  -- Account details
  name TEXT NOT NULL, -- Account name (e.g., "Chase Total Checking")
  official_name TEXT, -- Official account name from bank
  type TEXT NOT NULL, -- 'depository', 'credit', 'loan', 'investment'
  subtype TEXT, -- 'checking', 'savings', 'credit card', etc.
  mask TEXT, -- Last 4 digits (e.g., "0000")
  
  -- Balances
  balance_available NUMERIC(19, 4), -- Available balance in cents
  balance_current NUMERIC(19, 4), -- Current balance in cents
  balance_limit NUMERIC(19, 4), -- Credit limit (for credit cards)
  balance_iso_currency_code TEXT DEFAULT 'USD',
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, plaid_item_id, plaid_account_id)
);

-- Transactions table (transaction history)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT NOT NULL, -- Plaid's transaction ID (unique per account)
  
  -- Transaction details
  amount NUMERIC(19, 4) NOT NULL, -- Amount in cents (negative for debits, positive for credits)
  date DATE NOT NULL, -- Transaction date
  authorized_date DATE, -- Authorized date (if different from transaction date)
  merchant_name TEXT, -- Merchant name
  name TEXT NOT NULL, -- Transaction name/description
  category TEXT, -- Primary category (e.g., "Food and Drink", "Transportation")
  category_id TEXT, -- Plaid category ID
  primary_category TEXT, -- Simplified category
  detailed_category TEXT, -- Detailed category
  personal_finance_category JSONB, -- Plaid's personal finance category object
  
  -- Status
  pending BOOLEAN DEFAULT false, -- Whether transaction is pending
  iso_currency_code TEXT DEFAULT 'USD',
  
  -- Additional metadata
  location JSONB, -- Location data (if available)
  payment_meta JSONB, -- Payment metadata
  payment_channel TEXT, -- How transaction was made
  
  -- Transaction metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Custom metadata
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(account_id, plaid_transaction_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_status ON plaid_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_plaid_items_plaid_item_id ON plaid_items(plaid_item_id);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_plaid_item_id ON bank_accounts(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_status ON bank_accounts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(user_id, type);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_pending ON transactions(user_id, pending);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(user_id, primary_category);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(user_id, merchant_name);
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_id ON transactions(account_id, plaid_transaction_id);

-- RLS Policies
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own Plaid items
CREATE POLICY "Users access own plaid items" ON plaid_items
  FOR ALL
  USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can only access their own bank accounts
CREATE POLICY "Users access own bank accounts" ON bank_accounts
  FOR ALL
  USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can only access their own transactions
CREATE POLICY "Users access own transactions" ON transactions
  FOR ALL
  USING (user_id = auth.uid()::text OR user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Comments for documentation
COMMENT ON TABLE plaid_items IS 'Tracks Plaid connections (institutions) for each user';
COMMENT ON TABLE bank_accounts IS 'User bank accounts from connected Plaid institutions';
COMMENT ON TABLE transactions IS 'Transaction history from connected bank accounts';

