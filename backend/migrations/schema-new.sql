-- ============================================================
-- NEXA — Web3 Quantitative DeFi Trading Terminal
-- File: schema-new.sql
-- Description: Run this in Supabase SQL Editor to update your DB
-- ============================================================

-- 1. Create table (if not exists)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  note TEXT DEFAULT '',
  is_income BOOLEAN NOT NULL DEFAULT false,
  pair TEXT DEFAULT 'BNB/USDT',
  tx_hash TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add new columns to existing table safely (if already exists)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pair TEXT DEFAULT 'BNB/USDT';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_hash TEXT DEFAULT '';

-- 3. (Optional) Cleanup old non-trading records (salary, food, etc.)
DELETE FROM transactions 
WHERE category NOT IN (
  'Trade Profit', 
  'Trade Loss', 
  'Deposit', 
  'Withdrawal', 
  'Trading Fee', 
  'Staking Yield'
);

-- 4. Create indexes for fast querying by wallet and trading category
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- 5. Enable Row Level Security (RLS) & Allow access
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for nexa" ON transactions;
CREATE POLICY "Allow all operations for nexa" ON transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Enable pgvector extension for Gemini AI Semantic Search
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Drop previous function version if return type signature changed
DROP FUNCTION IF EXISTS match_transactions(vector, double precision, integer, text);
DROP FUNCTION IF EXISTS match_transactions;

-- 7. Stored procedure for Gemini AI Semantic Search
CREATE OR REPLACE FUNCTION match_transactions (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.25,
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

-- 8. Seed initial trading journal records for your wallet
-- Wallet: 0xB461205ea2392497d2D59EFEf6ff3928E3630a0b
INSERT INTO transactions (user_address, amount, category, note, is_income, pair, tx_hash) VALUES
('0xb461205ea2392497d2d59efef6ff3928e3630a0b', 2500.00, 'Deposit', 'Initial Margin Deposit from Binance Pay', true, 'USDT', '0x44c9...719a'),
('0xb461205ea2392497d2d59efef6ff3928e3630a0b', 380.50, 'Trade Profit', 'Take Profit TP2 Swing Long 4h breakout', true, 'BNB/USDT', '0x7a8f...94b2'),
('0xb461205ea2392497d2d59efef6ff3928e3630a0b', 145.20, 'Trade Profit', 'Scalping 15m Monte Carlo volatility band', true, 'BNB/USDT', '0x91da...ec50'),
('0xb461205ea2392497d2d59efef6ff3928e3630a0b', 85.00, 'Trade Loss', 'Stop Loss Hit -2.5% resistance rejection', false, 'BTC/USDT', '0x3e12...b841'),
('0xb461205ea2392497d2d59efef6ff3928e3630a0b', 4.80, 'Trading Fee', 'PancakeSwap Gas & DEX routing fee', false, 'BNB/USDT', '0x28f1...63e2'),
('0xb461205ea2392497d2d59efef6ff3928e3630a0b', 400.00, 'Withdrawal', 'Partial profit withdrawal to Hardware Wallet', false, 'USDT', '0xfa11...32d9');
