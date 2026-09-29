/**
 * AI Trading Recommendation Service.
 *
 * Combines Monte Carlo simulation results, market sentiment,
 * and user portfolio data to generate actionable trade recommendations.
 */

import { runSimulation, getMarketData } from "./quant-client.js";
import { getPortfolioStatus, type PaperPortfolio } from "./paper-trading.js";
import { supabase } from "../lib/supabase.js";
import type { SimulationResponse, MarketData } from "../types/index.js";
import {
  QUANT_DECISION_FACTORS,
  TOKEN_LIMITS,
} from "../config/trading-rules.js";

// ─── Types ──────────────────────────────────────────────────────

export interface TradeRecommendation {
  action: "BUY" | "SELL" | "HOLD";
  symbol: string;
  pair: string;
  confidence: number; // 0-100
  amount_usdt: number;
  current_price: number;
  reasoning: string;
  risk_warning: string;

  // Underlying data
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
  portfolio_context: {
    usdt_balance: number;
    has_position: boolean;
    position_size?: number;
    unrealized_pnl?: number;
    win_rate: number;
  };

  timestamp: string;
}

// ─── Signal Weights (Configured in ../config/trading-rules.ts) ──

const WEIGHTS = QUANT_DECISION_FACTORS.WEIGHTS;

// ─── Core Recommendation Logic ──────────────────────────────────

/**
 * Generate an AI trading recommendation by analyzing all available signals.
 */
export async function generateRecommendation(
  walletAddress: string,
  symbol: string = "BNBUSDT",
  forecastDays: number = 14
): Promise<TradeRecommendation> {
  console.log(
    `[AIRecommend] 🧠 Generating recommendation for ${symbol} (${forecastDays}d forecast)...`
  );

  // 1. Run Monte Carlo simulation
  let mcResult: SimulationResponse;
  try {
    mcResult = await runSimulation({
      symbol,
      days: forecastDays,
      simulations: 3000,
    });
  } catch (err) {
    throw new Error(`Monte Carlo simulation failed: ${err}`);
  }

  // 2. Get live market data + sentiment
  let marketData: MarketData;
  try {
    marketData = await getMarketData(symbol);
  } catch (err) {
    throw new Error(`Market data fetch failed: ${err}`);
  }

  // 3. Get user's portfolio status
  const { portfolio, unrealized_pnl } = await getPortfolioStatus(walletAddress);

  // 4. Get user's historical win rate from Supabase
  const winRate = await getUserWinRate(walletAddress);

  // 5. Compute composite signal
  const signal = computeSignal(mcResult, marketData, portfolio, unrealized_pnl);

  // 6. Determine action, confidence, and sizing
  const { action, confidence, amount } = determineAction(
    signal,
    portfolio,
    symbol,
    marketData.price
  );

  // 7. Generate human-readable reasoning
  const pair = symbol.replace("USDT", "/USDT");
  const reasoning = buildReasoning(action, confidence, mcResult, marketData, signal);
  const riskWarning = buildRiskWarning(mcResult, marketData, portfolio);

  const recommendation: TradeRecommendation = {
    action,
    symbol,
    pair,
    confidence,
    amount_usdt: amount,
    current_price: marketData.price,
    reasoning,
    risk_warning: riskWarning,
    monte_carlo: {
      prob_above_current: mcResult.prob_above_current,
      prob_above_10pct: mcResult.prob_above_10pct,
      prob_below_10pct: mcResult.prob_below_10pct,
      expected_return_pct:
        ((mcResult.mean_price - mcResult.current_price) / mcResult.current_price) * 100,
      median_price: mcResult.median_price,
    },
    sentiment: {
      fear_greed_index: marketData.fear_greed_index,
      fear_greed_label: marketData.fear_greed_label,
      price_change_24h_pct: marketData.price_change_pct_24h,
    },
    portfolio_context: {
      usdt_balance: portfolio.usdt_balance,
      has_position: !!portfolio.positions[symbol],
      position_size: portfolio.positions[symbol]?.quantity,
      unrealized_pnl: unrealized_pnl,
      win_rate: winRate,
    },
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[AIRecommend] ✅ ${action} ${symbol} | Confidence: ${confidence.toFixed(1)}% | Amount: $${amount.toFixed(2)}`
  );

  return recommendation;
}

// ─── Signal Computation ─────────────────────────────────────────

interface CompositeSignal {
  mc_score: number; // -1 to +1
  sentiment_score: number; // -1 to +1
  momentum_score: number; // -1 to +1
  risk_score: number; // -1 to +1
  composite: number; // Weighted sum
}

function computeSignal(
  mc: SimulationResponse,
  market: MarketData,
  portfolio: PaperPortfolio,
  unrealizedPnl: number
): CompositeSignal {
  // MC Score: based on probability of going up vs down
  // prob_above_current = 0.7 → score = +0.4 (bullish)
  // prob_above_current = 0.3 → score = -0.4 (bearish)
  const mc_score = (mc.prob_above_current - 0.5) * 2;

  // Sentiment Score: based on Fear & Greed Index
  // 0-25 = Extreme Fear → contrarian BUY signal (+1)
  // 25-45 = Fear → mild BUY (+0.3)
  // 45-55 = Neutral → 0
  // 55-75 = Greed → mild SELL (-0.3)
  // 75-100 = Extreme Greed → contrarian SELL (-1)
  let sentiment_score = 0;
  if (market.fear_greed_index !== null) {
    const fg = market.fear_greed_index;
    if (fg <= 25) sentiment_score = 0.8; // Extreme fear → buy
    else if (fg <= 45) sentiment_score = 0.3;
    else if (fg <= 55) sentiment_score = 0;
    else if (fg <= 75) sentiment_score = -0.3;
    else sentiment_score = -0.8; // Extreme greed → sell
  }

  // Momentum Score: based on 24h price change
  const pctChange = market.price_change_pct_24h;
  const momentum_score = Math.max(-1, Math.min(1, pctChange / 5)); // Normalize to [-1, 1]

  // Risk Score: portfolio concentration and PnL management
  let risk_score = 0;
  const positionsValue = Object.values(portfolio.positions).reduce(
    (sum, p) => sum + p.current_value,
    0
  );
  const totalEquity = portfolio.usdt_balance + positionsValue;
  const investedRatio = positionsValue / totalEquity;

  if (investedRatio > 0.7) {
    risk_score = -0.5; // Over-concentrated, bias toward SELL
  } else if (investedRatio < 0.3) {
    risk_score = 0.3; // Underinvested, bias toward BUY
  }

  // If unrealized PnL is very negative, bias toward HOLD/SELL
  if (unrealizedPnl < -totalEquity * 0.1) {
    risk_score -= 0.3;
  }

  const composite =
    mc_score * WEIGHTS.monte_carlo_prob +
    sentiment_score * WEIGHTS.sentiment +
    momentum_score * WEIGHTS.momentum_24h +
    risk_score * WEIGHTS.portfolio_risk;

  return { mc_score, sentiment_score, momentum_score, risk_score, composite };
}

// ─── Action Determination ───────────────────────────────────────

function determineAction(
  signal: CompositeSignal,
  portfolio: PaperPortfolio,
  symbol: string,
  currentPrice: number
): { action: "BUY" | "SELL" | "HOLD"; confidence: number; amount: number } {
  const absSignal = Math.abs(signal.composite);
  const confidence = Math.min(95, Math.max(10, absSignal * 100 + 20));

  // Thresholds from ../config/trading-rules.ts
  const { BUY_THRESHOLD, SELL_THRESHOLD } = QUANT_DECISION_FACTORS.THRESHOLDS;
  const { MIN_SIZE_PCT, MAX_SIZE_PCT } = QUANT_DECISION_FACTORS.SIZING;

  let action: "BUY" | "SELL" | "HOLD";
  let amount = 0;

  if (signal.composite > BUY_THRESHOLD) {
    action = "BUY";
    // Size dynamically between MIN_SIZE_PCT and MAX_SIZE_PCT based on confidence
    const sizePct = MIN_SIZE_PCT + (confidence / 100) * (MAX_SIZE_PCT - MIN_SIZE_PCT);
    amount = Math.min(portfolio.usdt_balance * sizePct, portfolio.usdt_balance * MAX_SIZE_PCT);
    amount = Math.max(TOKEN_LIMITS.MIN_SWAP_USDT, amount);
    if (amount > portfolio.usdt_balance) {
      action = "HOLD";
      amount = 0;
    }
  } else if (signal.composite < SELL_THRESHOLD) {
    const position = portfolio.positions[symbol];
    if (position && position.quantity > 0) {
      action = "SELL";
      // Sell 30-50% of position based on signal strength
      const sellPct = 0.3 + absSignal * 0.2;
      amount = position.quantity * currentPrice * sellPct;
      amount = Math.max(TOKEN_LIMITS.MIN_SWAP_USDT, amount);
    } else {
      action = "HOLD";
    }
  } else {
    action = "HOLD";
  }

  return { action, confidence, amount };
}

// ─── Reasoning & Risk Warning Builders ──────────────────────────

function buildReasoning(
  action: string,
  confidence: number,
  mc: SimulationResponse,
  market: MarketData,
  signal: CompositeSignal
): string {
  const parts: string[] = [];

  // Monte Carlo insight
  const expectedReturn =
    ((mc.mean_price - mc.current_price) / mc.current_price) * 100;
  parts.push(
    `Monte Carlo (3000 sims, ${mc.days_simulated}d): ${(mc.prob_above_current * 100).toFixed(1)}% probability price stays above current $${mc.current_price.toFixed(2)}. Expected return: ${expectedReturn > 0 ? "+" : ""}${expectedReturn.toFixed(1)}%.`
  );

  // Sentiment insight
  if (market.fear_greed_index !== null) {
    parts.push(
      `Market sentiment: Fear & Greed Index at ${market.fear_greed_index} (${market.fear_greed_label}). 24h change: ${market.price_change_pct_24h > 0 ? "+" : ""}${market.price_change_pct_24h.toFixed(2)}%.`
    );
  }

  // Action summary
  if (action === "BUY") {
    parts.push(
      `Composite signal is BULLISH (${(signal.composite * 100).toFixed(0)}). Recommending BUY with ${confidence.toFixed(0)}% confidence.`
    );
  } else if (action === "SELL") {
    parts.push(
      `Composite signal is BEARISH (${(signal.composite * 100).toFixed(0)}). Recommending SELL with ${confidence.toFixed(0)}% confidence.`
    );
  } else {
    parts.push(
      `Composite signal is NEUTRAL (${(signal.composite * 100).toFixed(0)}). Recommending HOLD — wait for a clearer setup.`
    );
  }

  return parts.join(" ");
}

function buildRiskWarning(
  mc: SimulationResponse,
  market: MarketData,
  portfolio: PaperPortfolio
): string {
  const warnings: string[] = [];

  if (mc.prob_below_10pct > 0.3) {
    warnings.push(
      `⚠️ High drawdown risk: ${(mc.prob_below_10pct * 100).toFixed(1)}% chance of >10% drop.`
    );
  }

  if (market.fear_greed_index !== null && market.fear_greed_index > 80) {
    warnings.push(`⚠️ Extreme Greed detected — potential reversal zone.`);
  }

  if (market.fear_greed_index !== null && market.fear_greed_index < 20) {
    warnings.push(`⚠️ Extreme Fear detected — high volatility expected.`);
  }

  const positionsValue = Object.values(portfolio.positions).reduce(
    (sum, p) => sum + p.current_value,
    0
  );
  const totalEquity = portfolio.usdt_balance + positionsValue;
  if (positionsValue > totalEquity * 0.7) {
    warnings.push(`⚠️ Portfolio is >70% invested. Consider reducing exposure.`);
  }

  warnings.push(
    "This is a paper trading simulation. Not financial advice (DYOR)."
  );

  return warnings.join(" ");
}

// ─── Helper ─────────────────────────────────────────────────────

async function getUserWinRate(walletAddress: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("transactions")
      .select("category")
      .eq("user_address", walletAddress.toLowerCase())
      .in("category", ["Trade Profit", "Trade Loss"]);

    if (!data || data.length === 0) return 0;

    const wins = data.filter((t) => t.category === "Trade Profit").length;
    return (wins / data.length) * 100;
  } catch {
    return 0;
  }
}
