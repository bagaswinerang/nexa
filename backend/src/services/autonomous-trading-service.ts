import { generateRecommendation, type TradeRecommendation } from "./ai-recommend.js";
import { executeLivePancakeSwap, type LiveTradeResponse } from "./pancakeswap-service.js";

import { QUANT_DECISION_FACTORS } from "../config/trading-rules.js";
const AUTO_TRADE_INTERVAL_MS = 60_000;

type AutoTradeOptions = { userAddress: string; symbol: string; forecastDays: number };

export type AutonomousDecision = {
  timestamp: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning: string;
  executed: boolean;
  trade?: LiveTradeResponse;
};

export type AutoTradeStatus = {
  active: boolean;
  user_address: string;
  symbol: string;
  interval_ms: number;
  started_at?: string;
  last_cycle_at?: string;
  last_action?: "BUY" | "SELL" | "HOLD";
  last_error?: string;
  last_recommendation?: TradeRecommendation;
  last_trade?: LiveTradeResponse;
  recent_decisions: AutonomousDecision[];
};

type AutoTradeSession = { options: AutoTradeOptions; status: AutoTradeStatus; timer?: ReturnType<typeof setTimeout> };
const sessions = new Map<string, AutoTradeSession>();

function sessionKey(userAddress: string) { return userAddress.toLowerCase(); }
function scheduleNextCycle(session: AutoTradeSession) {
  if (session.status.active) session.timer = setTimeout(() => void runCycle(session), AUTO_TRADE_INTERVAL_MS);
}

async function runCycle(session: AutoTradeSession) {
  if (!session.status.active) return;
  session.status.last_cycle_at = new Date().toISOString();
  session.status.last_error = undefined;
  try {
    const recommendation = await generateRecommendation(session.options.userAddress, session.options.symbol, session.options.forecastDays);
    session.status.last_recommendation = recommendation;
    session.status.last_action = recommendation.action;
    let trade: LiveTradeResponse | undefined;
    const minimumConfidence = QUANT_DECISION_FACTORS.THRESHOLDS.DEFAULT_MIN_CONFIDENCE_AUTO_SWAP;
    const canExecute = recommendation.action !== "HOLD" && recommendation.amount_usdt > 0 && recommendation.confidence >= minimumConfidence;

    if (canExecute && (recommendation.action === "BUY" || recommendation.action === "SELL")) {
      trade = await executeLivePancakeSwap({
        action: recommendation.action,
        amountUsdt: recommendation.amount_usdt,
        userAddress: session.options.userAddress,
        symbol: session.options.symbol,
        reasoning: `[Autonomous AI Agent] ${recommendation.reasoning}`,
      });
      session.status.last_trade = trade;
    }
    session.status.recent_decisions = [{
      timestamp: new Date().toISOString(),
      action: recommendation.action,
      confidence: recommendation.confidence,
      reasoning: recommendation.reasoning,
      executed: Boolean(trade?.success),
      trade,
    }, ...session.status.recent_decisions].slice(0, 20);
  } catch (error) {
    session.status.last_error = error instanceof Error ? error.message : "Autonomous trading cycle failed";
    console.error(`[AutonomousTrading] ${session.status.last_error}`);
  } finally {
    scheduleNextCycle(session);
  }
}

export function startAutonomousTrading(options: AutoTradeOptions): AutoTradeStatus {
  const key = sessionKey(options.userAddress);
  const existing = sessions.get(key);
  if (existing) {
    existing.options = options;
    existing.status.symbol = options.symbol;
    return existing.status;
  }
  const session: AutoTradeSession = {
    options,
    status: { active: true, user_address: options.userAddress, symbol: options.symbol, interval_ms: AUTO_TRADE_INTERVAL_MS, started_at: new Date().toISOString(), recent_decisions: [] },
  };
  sessions.set(key, session);
  void runCycle(session);
  return session.status;
}

export function stopAutonomousTrading(userAddress: string): AutoTradeStatus | null {
  const key = sessionKey(userAddress);
  const session = sessions.get(key);
  if (!session) return null;
  session.status.active = false;
  if (session.timer) clearTimeout(session.timer);
  sessions.delete(key);
  return session.status;
}

export function getAutonomousTradingStatus(userAddress: string): AutoTradeStatus {
  return sessions.get(sessionKey(userAddress))?.status ?? {
    active: false, user_address: userAddress, symbol: "BNBUSDT", interval_ms: AUTO_TRADE_INTERVAL_MS, recent_decisions: [],
  };
}