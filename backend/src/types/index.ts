/** Shared backend types. */

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

export interface SimulationRequest {
  symbol?: string;
  horizon?: "24h" | "7d" | "14d" | "30d" | "60d" | "90d";
  simulations?: number;
}

export interface SimulationResponse {
  symbol: string;
  horizon: string;
  current_price: number;
  periods_simulated: number;
  days_simulated: number;
  period_label: string;
  num_simulations: number;
  mean_price: number;
  median_price: number;
  std_dev: number;
  min_price: number;
  max_price: number;
  percentiles: { percentile: number; price: number }[];
  prob_above_current: number;
  prob_above_10pct: number;
  prob_below_10pct: number;
  annual_drift: number;
  annual_volatility: number;
  sample_paths: number[][];
  final_prices: number[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "model";
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  user_address?: string;
  is_thinking?: boolean;
  model?: string;
}
