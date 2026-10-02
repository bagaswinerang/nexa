-- Core Supabase schema for the on-chain trading journal.
-- Run schema.sql, then paper-trading.sql, then semantic-search.sql.

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

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pair TEXT DEFAULT 'BNB/USDT';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_hash TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for nexa" ON transactions;
CREATE POLICY "Allow all operations for nexa" ON transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Vector columns and semantic search RPC are defined in semantic-search.sql.