-- ============================================
-- NEXA — Supabase Database Migration
-- Table: transactions (Trading Journal & Capital Flow)
-- Categories: 'Deposit', 'Withdrawal', 'Trade Profit', 'Trade Loss', 'Trading Fee', 'Staking Yield'
-- ============================================

-- 1. Create table for trading journal & capital flow transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL, -- 'Deposit' | 'Withdrawal' | 'Trade Profit' | 'Trade Loss' | 'Trading Fee' | 'Staking Yield'
  note TEXT DEFAULT '',
  is_income BOOLEAN NOT NULL DEFAULT false, -- TRUE for Deposit, Trade Profit, Staking; FALSE for Withdrawal, Trade Loss, Fee
  pair TEXT DEFAULT 'BNB/USDT', -- Asset pair (e.g. 'BNB/USDT', 'BTC/USDT', 'USDT')
  tx_hash TEXT DEFAULT '', -- On-chain BSC transaction hash
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Upgrade existing table if columns don't exist yet
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pair TEXT DEFAULT 'BNB/USDT';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_hash TEXT DEFAULT '';

-- 2. Index for quick lookup by user wallet address
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Allow all operations for Nexa client & backend
DROP POLICY IF EXISTS "Allow all operations for nexa" ON transactions;
CREATE POLICY "Allow all operations for nexa" ON transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. SEMANTIC SEARCH (pgvector)
-- ============================================
-- Enable pgvector extension (Supabase Database Extensions)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (768 dimensions for Gemini Embeddings)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Drop previous function version if return type signature changed
DROP FUNCTION IF EXISTS match_transactions(vector, double precision, integer, text);
DROP FUNCTION IF EXISTS match_transactions;

-- Function for semantic similarity search
CREATE OR REPLACE FUNCTION match_transactions (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10,
  filter_user TEXT DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  user_address text,
  amount numeric,
  category text,
  note text,
  is_income boolean,
  pair text,
  tx_hash text,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    transactions.id,
    transactions.user_address,
    transactions.amount,
    transactions.category,
    transactions.note,
    transactions.is_income,
    COALESCE(transactions.pair, 'BNB/USDT') AS pair,
    COALESCE(transactions.tx_hash, '') AS tx_hash,
    transactions.created_at,
    1 - (transactions.embedding <=> query_embedding) AS similarity
  FROM transactions
  WHERE 
    (filter_user = '' OR LOWER(transactions.user_address) = LOWER(filter_user))
    AND transactions.embedding IS NOT NULL
    AND 1 - (transactions.embedding <=> query_embedding) > match_threshold
  ORDER BY transactions.embedding <=> query_embedding
  LIMIT match_count;
$$;
