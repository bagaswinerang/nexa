-- Run schema.sql and paper-trading.sql first.
-- Both record types keep their embedding on their own source row.

CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE paper_predictions ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS idx_transactions_embedding
  ON transactions USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paper_predictions_embedding
  ON paper_predictions USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION match_user_history (
  query_embedding vector(768),
  filter_user TEXT,
  match_threshold float DEFAULT 0.25,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  record_type text,
  user_address text,
  created_at timestamptz,
  content text,
  tx_hash text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  WITH history AS (
    SELECT
      t.id,
      'transaction'::text AS record_type,
      t.user_address,
      t.created_at,
      concat_ws(' | ', t.category, t.pair, t.note, 'amount=' || t.amount::text) AS content,
      NULLIF(t.tx_hash, '') AS tx_hash,
      t.embedding
    FROM transactions AS t
    WHERE LOWER(t.user_address) = LOWER(filter_user)
      AND t.embedding IS NOT NULL

    UNION ALL

    SELECT
      p.id,
      'paper_prediction'::text AS record_type,
      p.user_address,
      p.predicted_at AS created_at,
      jsonb_build_object(
        'action', p.action,
        'pair', p.pair,
        'confidence', p.confidence,
        'gemini_up_probability', p.gemini_up_probability,
        'entry_price', p.entry_price,
        'price_5m_ago', p.price_5m_ago,
        'change_5m_pct', p.change_5m_pct,
        'change_24h_pct', p.change_24h_pct,
        'fear_greed_index', p.fear_greed_index,
        'fear_greed_label', p.fear_greed_label,
        'monte_carlo_probability_up', p.monte_carlo_probability_up,
        'monte_carlo_median_price', p.monte_carlo_median_price,
        'gemini_factor_scores', p.gemini_factor_scores,
        'summary', p.summary,
        'settlement_price', p.settlement_price,
        'actual_return_pct', p.actual_return_pct,
        'simulated_pnl_usdt', p.simulated_pnl_usdt,
        'direction_correct', p.direction_correct,
        'reasoning', p.reasoning
      )::text AS content,
      NULL::text AS tx_hash,
      p.embedding
    FROM paper_predictions AS p
    WHERE LOWER(p.user_address) = LOWER(filter_user)
      AND p.embedding IS NOT NULL
  )
  SELECT
    history.id,
    history.record_type,
    history.user_address,
    history.created_at,
    history.content,
    history.tx_hash,
    1 - (history.embedding <=> query_embedding) AS similarity
  FROM history
  WHERE filter_user IS NOT NULL
    AND filter_user <> ''
    AND 1 - (history.embedding <=> query_embedding) > match_threshold
  ORDER BY history.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_user_history(vector, text, double precision, integer)
  TO anon, authenticated;