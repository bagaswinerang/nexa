/** API wrapper for Nexa's live market and tBNB/tUSDT execution APIs. */

import { env } from "./env";

const API_URL = env.BACKEND_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "Permintaan membutuhkan waktu terlalu lama. Silakan coba lagi.",
        504,
        "REQUEST_TIMEOUT",
      );
    }
    throw new ApiError(
      "Layanan Nexa sedang tidak dapat dijangkau. Silakan coba lagi.",
      503,
      "NETWORK_ERROR",
    );
  } finally {
    window.clearTimeout(timeout);
  }
  if (!response.ok) {
    const error: { error?: string; message?: string; code?: string; request_id?: string } = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new ApiError(
      error.message || error.error || `API Error: ${response.status}`,
      response.status,
      error.code,
      error.request_id,
    );
  }
  return response.json() as Promise<T>;
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  thought?: string;
  model_used?: string;
}
export interface ChatResponse {
  reply: string;
  thought?: string;
  model_used?: string;
  tool_calls?: string[];
}
export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = [],
  userAddress?: string,
  isThinking = false,
  model?: string,
): Promise<ChatResponse> {
  return fetchAPI<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      history,
      user_address: userAddress,
      is_thinking: isThinking,
      model,
    }),
  });
}
export type QuantHorizon =
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "24h"
  | "7d"
  | "14d"
  | "30d"
  | "60d"
  | "90d";

export interface SimulationResult {
  symbol: string;
  horizon: QuantHorizon;
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
export async function runSimulation(params: {
  symbol?: string;
  horizon?: QuantHorizon;
  days?: number;
  hours?: number;
  simulations?: number;
}): Promise<SimulationResult> {
  const horizon =
    params.horizon ||
    (params.hours
      ? (`${params.hours}h` as QuantHorizon)
      : params.days === 1
        ? "24h"
        : params.days
          ? (`${params.days}d` as QuantHorizon)
          : "24h");
  return fetchAPI("/monte-carlo/simulate", {
    method: "POST",
    body: JSON.stringify({
      symbol: params.symbol || "BNBUSDT",
      horizon,
      simulations: params.simulations || 3000,
    }),
  });
}
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
export interface TransactionSummary {
  total_deposit?: number;
  total_withdrawal?: number;
  total_profit?: number;
  total_loss?: number;
  net_pnl?: number;
  active_balance?: number;
  win_rate?: number;
  total_income: number;
  total_expense: number;
  total_entries: number;
  balance: number;
}
export async function getTransactions(
  userAddress: string,
  limit = 50,
): Promise<{ transactions: Transaction[] }> {
  return fetchAPI(`/transactions?user_address=${userAddress}&limit=${limit}`);
}
export async function createTransaction(data: {
  user_address: string;
  amount: number;
  category: string;
  note?: string;
  is_income: boolean;
  pair?: string;
  tx_hash?: string;
}): Promise<{ transaction: Transaction }> {
  return fetchAPI("/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export async function deleteTransaction(
  id: string,
): Promise<{ success: boolean }> {
  return fetchAPI(`/transactions/${id}`, { method: "DELETE" });
}
export async function getTransactionSummary(
  userAddress: string,
): Promise<TransactionSummary> {
  return fetchAPI(`/transactions/summary?user_address=${userAddress}`);
}

export interface TradeRecommendation {
  action: "BUY" | "SELL" | "HOLD";
  symbol: "BNBUSDT";
  pair: "BNB/USDT";
  confidence: number;
  paper_prediction_id: string;
  amount_usdt: number;
  current_price: number;
  summary: string;
  reasoning: string;
  risk_warning: string;
  market: {
    source: "Binance";
    price_change_5m_pct: number;
    price_change_1h_pct: number;
    price_change_4h_pct: number;
    price_change_24h_pct: number;
    volatility_24h_pct: number;
    high_24h: number;
    low_24h: number;
    volume_24h: number;
  };
  sentiment: {
    fear_greed_index: number | null;
    fear_greed_label: string | null;
  };
  agent_balances: { tBNB: number; tUSDT: number; network: string };
  signal: {
    alpha: number;
    components: Record<string, number>;
    weights: Record<string, number>;
  };
  timestamp: string;
}

export interface PaperPrediction {
  id: string;
  user_address: string;
  pair: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  gemini_up_probability: number;
  entry_price: number;
  price_5m_ago: number;
  change_5m_pct: number;
  change_24h_pct: number;
  fear_greed_index: number | null;
  fear_greed_label: string | null;
  monte_carlo_probability_up: number;
  monte_carlo_median_price: number;
  gemini_factor_scores: Record<string, number>;
  simulated_notional_usdt: number;
  summary: string;
  reasoning: string;
  settles_at: string;
  settlement_price: number | null;
  actual_return_pct: number | null;
  simulated_pnl_usdt: number | null;
  direction_correct: boolean | null;
  settled_at: string | null;
  predicted_at: string;
  decision_bucket?: string;
  model_version?: string;
}

export async function getPaperPredictions(
  userAddress: string,
  limit = 50,
): Promise<{ predictions: PaperPrediction[] }> {
  return fetchAPI(
    `/live-trading/paper-trades?user_address=${encodeURIComponent(userAddress)}&limit=${limit}`,
  );
}

export async function getTradingRecommendation(
  userAddress: string,
): Promise<{ recommendation: TradeRecommendation }> {
  return fetchAPI("/live-trading/recommend", {
    method: "POST",
    body: JSON.stringify({ user_address: userAddress, symbol: "BNBUSDT" }),
  });
}

export interface LiveBalancesResponse {
  configured: boolean;
  wallet_address: string | null;
  bnb_balance: number;
  usdt_balance: number;
  network: string;
  explorer_url: string;
  error?: string;
}
export interface LiveTradeResult {
  success: boolean;
  action: "BUY" | "SELL";
  txHash: string;
  explorerUrl: string;
  amountIn: number;
  amountOut: number;
  tokenIn?: string;
  tokenOut?: string;
  symbol: string;
  reasoning?: string;
  gasUsed?: string;
  timestamp: string;
}
export async function getLiveBalances(
  wallet?: string,
): Promise<LiveBalancesResponse> {
  return fetchAPI(`/live-trading/balances${wallet ? `?wallet=${wallet}` : ""}`);
}
export async function executeLiveSwap(params: {
  user_address: string;
  action: "BUY" | "SELL";
  amount_usdt: number;
  is_source_amount?: boolean;
  symbol?: "BNBUSDT";
  reasoning?: string;
  slippage_pct?: number;
}): Promise<{ trade: LiveTradeResult }> {
  return fetchAPI("/live-trading/execute", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface LiveAutonomousDecision {
  timestamp: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  summary: string;
  reasoning: string;
  executed: boolean;
  trade?: LiveTradeResult;
}
export interface LiveAutonomousStatus {
  active: boolean;
  paused?: boolean;
  pause_reason?: string;
  is_analyzing?: boolean;
  user_address: string;
  symbol: string;
  interval_ms: number;
  started_at?: string;
  last_cycle_at?: string;
  last_action?: "BUY" | "SELL" | "HOLD";
  last_error?: string;
  last_recommendation?: Pick<
    TradeRecommendation,
    "action" | "confidence" | "summary" | "reasoning"
  >;
  last_trade?: LiveTradeResult;
  recent_decisions: LiveAutonomousDecision[];
}
export async function executeLiveAutoTrade(params: {
  user_address: string;
  symbol?: "BNBUSDT";
}): Promise<{ status: LiveAutonomousStatus }> {
  const response = await fetchAPI<{ status?: LiveAutonomousStatus }>(
    "/live-trading/auto",
    { method: "POST", body: JSON.stringify(params) },
  );
  if (!response.status || typeof response.status.active !== "boolean")
    throw new Error("Invalid AI Agent status response from backend.");
  return { status: response.status };
}
export async function stopLiveAutoTrade(
  userAddress: string,
): Promise<{ status: LiveAutonomousStatus }> {
  return fetchAPI("/live-trading/auto/stop", {
    method: "POST",
    body: JSON.stringify({ user_address: userAddress }),
  });
}
export async function getLiveAutoTradeStatus(
  userAddress: string,
): Promise<{ status: LiveAutonomousStatus }> {
  const response = await fetchAPI<{ status?: LiveAutonomousStatus }>(
    `/live-trading/auto/status?user_address=${encodeURIComponent(userAddress)}`,
  );
  if (!response.status || typeof response.status.active !== "boolean")
    throw new Error("Invalid AI Agent status response from backend.");
  return { status: response.status };
}
export async function executeLiveWithdrawal(params: {
  user_address: string;
  amount: number;
  token: "USDT" | "BNB" | "tUSDT" | "tBNB";
}): Promise<{
  withdrawal: {
    txHash: string;
    explorerUrl: string;
    amount: number;
    token: string;
  };
}> {
  return fetchAPI("/live-trading/withdraw", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
// End of API client.
