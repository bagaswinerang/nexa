/**
 * Shared TypeScript types for the Nexa backend.
 */

// ─── Transaction ────────────────────────────────────────────────
export interface Transaction {
  id: string;
  user_address: string;
  amount: number;
  category: string;
  note: string;
  is_income: boolean;
  pair?: string;
  tx_hash?: string;
  created_at: string;
}

export interface CreateTransactionBody {
  user_address: string;
  amount: number;
  category: string;
  note?: string;
  is_income: boolean;
  pair?: string;
  tx_hash?: string;
}

// ─── Monte Carlo ────────────────────────────────────────────────
export interface SimulationRequest {
  symbol?: string;
  days?: number;
  simulations?: number;
  interval?: string;
  lookback_days?: number;
}

export interface PercentileResult {
  percentile: number;
  price: number;
}

export interface SimulationResponse {
  symbol: string;
  current_price: number;
  days_simulated: number;
  num_simulations: number;
  mean_price: number;
  median_price: number;
  std_dev: number;
  min_price: number;
  max_price: number;
  percentiles: PercentileResult[];
  prob_above_current: number;
  prob_above_10pct: number;
  prob_below_10pct: number;
  annual_drift: number;
  annual_volatility: number;
  sample_paths: number[][];
  final_prices: number[];
}

// ─── Market Data ────────────────────────────────────────────────
export interface MarketData {
  symbol: string;
  price: number;
  price_change_24h: number;
  price_change_pct_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  fear_greed_index: number | null;
  fear_greed_label: string | null;
}

// ─── Chat ───────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "model";
  content: string;
  thought?: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  user_address?: string;
  is_thinking?: boolean;
  model?: string;
}

export interface ChatResponse {
  reply: string;
  thought?: string;
  model_used?: string;
  tool_calls?: string[];
}
