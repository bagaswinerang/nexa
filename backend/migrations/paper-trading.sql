-- Paper prediction history. Run after schema.sql and before semantic-search.sql.
CREATE TABLE IF NOT EXISTS paper_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  pair TEXT NOT NULL DEFAULT 'BNB/USDT',
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD')),
  confidence NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  gemini_up_probability NUMERIC NOT NULL CHECK (gemini_up_probability BETWEEN 0 AND 100),
  entry_price NUMERIC NOT NULL,
  price_5m_ago NUMERIC NOT NULL,
  change_5m_pct NUMERIC NOT NULL,
  change_24h_pct NUMERIC NOT NULL,
  fear_greed_index INTEGER,
  fear_greed_label TEXT,
  monte_carlo_probability_up NUMERIC NOT NULL CHECK (monte_carlo_probability_up BETWEEN 0 AND 1),
  monte_carlo_median_price NUMERIC NOT NULL,
  gemini_factor_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  simulated_notional_usdt NUMERIC NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  reasoning TEXT NOT NULL DEFAULT '',
  settles_at TIMESTAMPTZ NOT NULL,
  settlement_price NUMERIC,
  actual_return_pct NUMERIC,
  simulated_pnl_usdt NUMERIC,
  direction_correct BOOLEAN,
  settled_at TIMESTAMPTZ,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision_bucket DATE NOT NULL DEFAULT CURRENT_DATE,
  model_version TEXT NOT NULL DEFAULT 'llm-v1'
);

ALTER TABLE paper_predictions
  ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';
ALTER TABLE paper_predictions
  ADD COLUMN IF NOT EXISTS gemini_factor_scores JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE paper_predictions
  ADD COLUMN IF NOT EXISTS decision_bucket DATE;
ALTER TABLE paper_predictions
  ADD COLUMN IF NOT EXISTS model_version TEXT NOT NULL DEFAULT 'llm-v1';

UPDATE paper_predictions
SET decision_bucket = (predicted_at AT TIME ZONE 'UTC')::DATE
WHERE decision_bucket IS NULL;

UPDATE paper_predictions
SET summary = action || ' — Gemini peluang naik ' ||
  ROUND(gemini_up_probability, 1)::TEXT || '%, Monte Carlo ' ||
  ROUND(monte_carlo_probability_up * 100, 1)::TEXT || '%.'
WHERE summary = '';

UPDATE paper_predictions
SET summary =
  'Harga Binance $' || ROUND(entry_price, 2)::TEXT ||
  ' | 5m ' || CASE WHEN change_5m_pct >= 0 THEN '+' ELSE '' END ||
  ROUND(change_5m_pct, 3)::TEXT || '% | 24h ' ||
  CASE WHEN change_24h_pct >= 0 THEN '+' ELSE '' END ||
  ROUND(change_24h_pct, 2)::TEXT || '% | ' ||
  CASE
    WHEN fear_greed_index IS NULL THEN 'Fear & Greed tidak tersedia'
    ELSE 'Fear & Greed ' || fear_greed_index::TEXT || ' (' || COALESCE(fear_greed_label, 'unknown') || ')'
  END ||
  ' | MC naik ' || ROUND(monte_carlo_probability_up * 100, 1)::TEXT ||
  '% | Gemini naik ' || ROUND(gemini_up_probability, 1)::TEXT ||
  '% | Ambang: BUY >=65%, SELL <=35% + konfirmasi MC | Keputusan: ' || action || '.'
WHERE summary ILIKE 'HOLD:%'
   OR summary ILIKE 'Guardrail belum terpenuhi%'
   OR summary ILIKE 'Probabilitas faktor gabungan%'
   OR summary ILIKE 'Probabilitas naik %'
   OR summary ILIKE 'Binance BNB/USDT berada%';

CREATE INDEX IF NOT EXISTS idx_paper_predictions_user_date
  ON paper_predictions (user_address, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_predictions_due
  ON paper_predictions (settles_at)
  WHERE settled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_paper_predictions_model_outcome
  ON paper_predictions (model_version, pair, gemini_up_probability)
  WHERE settled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paper_predictions_bucket
  ON paper_predictions (user_address, pair, decision_bucket, model_version);

ALTER TABLE paper_predictions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE paper_predictions TO anon, authenticated;
DROP POLICY IF EXISTS "Allow all operations for nexa paper predictions" ON paper_predictions;
CREATE POLICY "Allow all operations for nexa paper predictions"
  ON paper_predictions FOR ALL USING (true) WITH CHECK (true);
