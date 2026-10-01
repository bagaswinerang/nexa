/**
 * API wrapper for the Hono backend.
 */

import { env } from "./env";

const API_URL = env.BACKEND_URL;

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Chat ───────────────────────────────────────────────────────

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
  isThinking: boolean = false,
  model?: string
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

// ─── Monte Carlo ────────────────────────────────────────────────

export interface SimulationParams {
  symbol?: string;
  days?: number;
  simulations?: number;
}

export interface SimulationResult {
  symbol: string;
  current_price: number;
  days_simulated: number;
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

export async function runSimulation(
  params: SimulationParams
): Promise<SimulationResult> {
  return fetchAPI<SimulationResult>("/monte-carlo/simulate", {
    method: "POST",
    body: JSON.stringify(params),
  });
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

export async function getMarketData(symbol: string): Promise<MarketData> {
  return fetchAPI<MarketData>(`/monte-carlo/market-data/${symbol}`);
}

// ─── Transactions ───────────────────────────────────────────────

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
  limit = 50
): Promise<{ transactions: Transaction[] }> {
  return fetchAPI<{ transactions: Transaction[] }>(
    `/transactions?user_address=${userAddress}&limit=${limit}`
  );
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
  return fetchAPI<{ transaction: Transaction }>("/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteTransaction(
  id: string
): Promise<{ success: boolean }> {
  return fetchAPI<{ success: boolean }>(`/transactions/${id}`, {
    method: "DELETE",
  });
}

export async function getTransactionSummary(
  userAddress: string
): Promise<TransactionSummary> {
  return fetchAPI<TransactionSummary>(
    `/transactions/summary?user_address=${userAddress}`
  );
}

// ─── AI Trading Agent & Paper Trading ─────────────────────────

export interface TradeRecommendation {
  action: "BUY" | "SELL" | "HOLD";
  symbol: string;
  pair: string;
  confidence: number;
  amount_usdt: number;
  current_price: number;
  reasoning: string;
  risk_warning: string;
  monte_carlo: {
    prob_above_current: number;
    prob_above_10pct: number;
    prob_below_10pct: number;
    expected_return_pct: number;
    median_price: number;
  };
  sentiment: {
    fear_greed_index: number | null;
    fear_greed_label: string | null;
    price_change_24h_pct: number;
  };
  signal: {
    composite: number;
    components: {
      monte_carlo: number;
      sentiment: number;
      momentum_24h: number;
    };
    weights: {
      monte_carlo_prob: number;
      sentiment: number;
      momentum_24h: number;
    };
  };
  timestamp: string;
}

export interface PaperPosition {
  symbol: string;
  quantity: number;
  avg_entry_price: number;
  current_value: number;
}

export interface PaperPortfolio {
  user_address: string;
  usdt_balance: number;
  positions: Record<string, PaperPosition>;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  created_at: string;
}

export interface PaperPortfolioResponse {
  portfolio: PaperPortfolio;
  total_equity: number;
  unrealized_pnl: number;
}

export interface TradeResult {
  success: boolean;
  order_id: string;
  action: "BUY" | "SELL";
  symbol: string;
  price: number;
  quantity: number;
  amount_usdt: number;
  pnl?: number;
  new_balance: number;
  reasoning?: string;
  timestamp: string;
}

export async function getTradingRecommendation(
  userAddress: string,
  symbol = "BNBUSDT",
  forecastDays = 14
): Promise<{ recommendation: TradeRecommendation }> {
  return fetchAPI<{ recommendation: TradeRecommendation }>("/trading/recommend", {
    method: "POST",
    body: JSON.stringify({
      user_address: userAddress,
      symbol,
      forecast_days: forecastDays,
    }),
  });
}

export async function executePaperTrade(params: {
  user_address: string;
  action: "BUY" | "SELL";
  symbol?: string;
  amount_usdt: number;
  reasoning?: string;
  source?: "manual" | "ai_agent";
}): Promise<{ trade: TradeResult }> {
  return fetchAPI<{ trade: TradeResult }>("/trading/execute", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function executeAutoTrade(params: {
  user_address: string;
  symbol?: string;
  forecast_days?: number;
}): Promise<{
  recommendation: TradeRecommendation;
  trade: TradeResult | null;
  auto_executed: boolean;
}> {
  return fetchAPI<{
    recommendation: TradeRecommendation;
    trade: TradeResult | null;
    auto_executed: boolean;
  }>("/trading/auto", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getPaperPortfolio(
  userAddress: string
): Promise<PaperPortfolioResponse> {
  return fetchAPI<PaperPortfolioResponse>(
    `/trading/portfolio?user_address=${userAddress}`
  );
}

export async function resetPaperPortfolio(
  userAddress: string
): Promise<{ portfolio: PaperPortfolio; message: string }> {
  return fetchAPI<{ portfolio: PaperPortfolio; message: string }>(
    "/trading/reset",
    {
      method: "POST",
      body: JSON.stringify({ user_address: userAddress }),
    }
  );
}

// ─── Live PancakeSwap Autonomous DEX Trading ───────────────────

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
  wallet?: string
): Promise<LiveBalancesResponse> {
  const query = wallet ? `?wallet=${wallet}` : "";
  return fetchAPI<LiveBalancesResponse>(`/live-trading/balances${query}`);
}

export async function executeLiveSwap(params: {
  user_address: string;
  action: "BUY" | "SELL";
  amount_usdt: number;
  symbol?: string;
  reasoning?: string;
  slippage_pct?: number;
}): Promise<{ trade: LiveTradeResult }> {
  return fetchAPI<{ trade: LiveTradeResult }>("/live-trading/execute", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface LiveAutonomousDecision {
  timestamp: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning: string;
  executed: boolean;
  trade?: LiveTradeResult;
}

export interface LiveAutonomousStatus {
  active: boolean;
  user_address: string;
  symbol: string;
  interval_ms: number;
  started_at?: string;
  last_cycle_at?: string;
  last_action?: "BUY" | "SELL" | "HOLD";
  last_error?: string;
  last_recommendation?: Pick<TradeRecommendation, "action" | "confidence" | "reasoning">;
  last_trade?: LiveTradeResult;
  recent_decisions: LiveAutonomousDecision[];
}

export async function executeLiveAutoTrade(params: {
  user_address: string;
  symbol?: string;
  forecast_days?: number;
}): Promise<{ status: LiveAutonomousStatus }> {
  return fetchAPI<{ status: LiveAutonomousStatus }>("/live-trading/auto", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function stopLiveAutoTrade(userAddress: string): Promise<{ status: LiveAutonomousStatus }> {
  return fetchAPI<{ status: LiveAutonomousStatus }>("/live-trading/auto/stop", {
    method: "POST",
    body: JSON.stringify({ user_address: userAddress }),
  });
}

export async function getLiveAutoTradeStatus(userAddress: string): Promise<{ status: LiveAutonomousStatus }> {
  return fetchAPI<{ status: LiveAutonomousStatus }>(
    `/live-trading/auto/status?user_address=${encodeURIComponent(userAddress)}`,
  );
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
  return fetchAPI<{
    withdrawal: {
      txHash: string;
      explorerUrl: string;
      amount: number;
      token: string;
    };
  }>("/live-trading/withdraw", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
