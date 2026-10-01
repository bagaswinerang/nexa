/**
 * Live BNB/USDT recommendation service.
 *
 * Price signals come from Binance through the market-data service. Position
 * sizing is based exclusively on the agent's on-chain tUSDT/tBNB balances.
 */

import { getMarketData } from "./quant-client.js";
import { getLiveBalances } from "./pancakeswap-service.js";
import type { MarketData } from "../types/index.js";
import { MARKET_DECISION_FACTORS } from "../config/trading-rules.js";

export interface TradeRecommendation {
  action: "BUY" | "SELL" | "HOLD";
  symbol: "BNBUSDT";
  pair: "BNB/USDT";
  confidence: number;
  /** USDT notional. BUY spends tUSDT; SELL is converted to tBNB by the router. */
  amount_usdt: number;
  current_price: number;
  reasoning: string;
  risk_warning: string;
  market: {
    source: "Binance";
    price_change_24h_pct: number;
    high_24h: number;
    low_24h: number;
    volume_24h: number;
  };
  sentiment: {
    fear_greed_index: number | null;
    fear_greed_label: string | null;
  };
  agent_balances: {
    tBNB: number;
    tUSDT: number;
    network: string;
  };
  signal: {
    composite: number;
    components: { sentiment: number; momentum_24h: number };
    weights: { sentiment: number; momentum_24h: number };
  };
  timestamp: string;
}

type CompositeSignal = {
  sentiment_score: number;
  momentum_score: number;
  composite: number;
};

const WEIGHTS = MARKET_DECISION_FACTORS.WEIGHTS;

/** Generate a live BNB/USDT recommendation; other pairs are intentionally unsupported. */
export async function generateRecommendation(
  _walletAddress: string,
  symbol = "BNBUSDT",
): Promise<TradeRecommendation> {
  if (symbol.toUpperCase() !== "BNBUSDT") {
    throw new Error("Only BNB/USDT is supported for the tBNB/tUSDT agent.");
  }

  const [market, balances] = await Promise.all([
    getMarketData("BNBUSDT"),
    getLiveBalances(),
  ]);
  const signal = computeSignal(market);
  const { action, confidence, amount } = determineAction(signal, market.price, balances);

  return {
    action,
    symbol: "BNBUSDT",
    pair: "BNB/USDT",
    confidence,
    amount_usdt: amount,
    current_price: market.price,
    reasoning: buildReasoning(action, confidence, market, signal),
    risk_warning: buildRiskWarning(market, balances.bnb_balance, balances.usdt_balance),
    market: {
      source: "Binance",
      price_change_24h_pct: market.price_change_pct_24h,
      high_24h: market.high_24h,
      low_24h: market.low_24h,
      volume_24h: market.volume_24h,
    },
    sentiment: {
      fear_greed_index: market.fear_greed_index,
      fear_greed_label: market.fear_greed_label,
    },
    agent_balances: {
      tBNB: balances.bnb_balance,
      tUSDT: balances.usdt_balance,
      network: balances.network,
    },
    signal: {
      composite: signal.composite,
      components: {
        sentiment: signal.sentiment_score,
        momentum_24h: signal.momentum_score,
      },
      weights: { ...WEIGHTS },
    },
    timestamp: new Date().toISOString(),
  };
}

function computeSignal(market: MarketData): CompositeSignal {
  let sentiment_score = 0;
  const fg = market.fear_greed_index;
  if (fg !== null) {
    if (fg <= 25) sentiment_score = 0.8;
    else if (fg <= 45) sentiment_score = 0.3;
    else if (fg <= 55) sentiment_score = 0;
    else if (fg <= 75) sentiment_score = -0.3;
    else sentiment_score = -0.8;
  }

  const momentum_score = Math.max(-1, Math.min(1, market.price_change_pct_24h / 5));
  return {
    sentiment_score,
    momentum_score,
    composite: sentiment_score * WEIGHTS.sentiment + momentum_score * WEIGHTS.momentum_24h,
  };
}

function determineAction(
  signal: CompositeSignal,
  price: number,
  balances: { bnb_balance: number; usdt_balance: number },
): { action: "BUY" | "SELL" | "HOLD"; confidence: number; amount: number } {
  const { BUY_THRESHOLD, SELL_THRESHOLD } = MARKET_DECISION_FACTORS.THRESHOLDS;
  const { MAX_SIZE_PCT } = MARKET_DECISION_FACTORS.SIZING;
  const confidence = Math.min(95, Math.max(10, Math.abs(signal.composite) * 100 + 20));
  const sizePct = (confidence / 100) * MAX_SIZE_PCT;

  if (signal.composite > BUY_THRESHOLD) {
    return { action: "BUY", confidence, amount: balances.usdt_balance * sizePct };
  }
  if (signal.composite < SELL_THRESHOLD) {
    const tradableBnb = Math.max(0, balances.bnb_balance - Number(MARKET_DECISION_FACTORS.TRADE_GAS_RESERVE_BNB));
    return { action: "SELL", confidence, amount: tradableBnb * price * sizePct };
  }
  return { action: "HOLD", confidence, amount: 0 };
}

function buildReasoning(action: string, confidence: number, market: MarketData, signal: CompositeSignal): string {
  const move = `${market.price_change_pct_24h >= 0 ? "+" : ""}${market.price_change_pct_24h.toFixed(2)}%`;
  const sentiment = market.fear_greed_index === null
    ? "Fear & Greed belum tersedia"
    : `Fear & Greed ${market.fear_greed_index} (${market.fear_greed_label})`;
  const verdict = action === "HOLD" ? "menunggu sinyal yang lebih jelas" : `memberi sinyal ${action}`;
  return `Binance BNB/USDT berada di $${market.price.toFixed(2)} (${move} dalam 24 jam). ${sentiment}. Kombinasi momentum dan sentimen ${verdict} dengan keyakinan ${confidence.toFixed(0)}%.`;
}

function buildRiskWarning(market: MarketData, bnbBalance: number, usdtBalance: number): string {
  const warnings: string[] = [];
  if (Math.abs(market.price_change_pct_24h) >= 5) warnings.push("Volatilitas BNB/USDT 24 jam sedang tinggi.");
  if (bnbBalance <= Number(MARKET_DECISION_FACTORS.TRADE_GAS_RESERVE_BNB)) warnings.push("Saldo tBNB hanya cukup untuk cadangan gas; SELL tidak dapat dieksekusi.");
  if (usdtBalance <= 0) warnings.push("Saldo tUSDT agent kosong; BUY tidak dapat dieksekusi.");
  warnings.push("Harga berasal dari Binance, sementara swap memakai saldo tBNB/tUSDT on-chain. Bukan nasihat keuangan (DYOR).");
  return warnings.join(" ");
}
