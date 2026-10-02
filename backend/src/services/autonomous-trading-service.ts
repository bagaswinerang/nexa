import {
  generateRecommendation,
  type TradeRecommendation,
} from "./ai-recommend.js";
import {
  executeLivePancakeSwap,
  type LiveTradeResponse,
} from "./pancakeswap-service.js";

import { MARKET_DECISION_FACTORS } from "../config/trading-rules.js";
import { TradingForecastUnavailableError } from "./trading-forecast.js";

const AUTO_TRADE_INTERVAL_MS = MARKET_DECISION_FACTORS.ALPHA.COOLDOWN_MS;
const AUTO_TRADE_COOLDOWN_MS = MARKET_DECISION_FACTORS.ALPHA.COOLDOWN_MS;

type AutoTradeOptions = { userAddress: string; symbol: string };

export type AutonomousDecision = {
  timestamp: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  summary: string;
  reasoning: string;
  executed: boolean;
  trade?: LiveTradeResponse;
};

export type AutoTradeStatus = {
  active: boolean;
  paused: boolean;
  is_analyzing: boolean;
  user_address: string;
  symbol: string;
  interval_ms: number;
  started_at?: string;
  last_cycle_at?: string;
  last_action?: "BUY" | "SELL" | "HOLD";
  last_error?: string;
  pause_reason?: string;
  last_recommendation?: TradeRecommendation;
  last_trade?: LiveTradeResponse;
  /** USDT position opened by BUY (BNB -> USDT). */
  current_position?: {
    action: "BUY";
    entered_at: string;
    amount_usdt: number;
  };
  recent_decisions: AutonomousDecision[];
};

type AutoTradeSession = {
  options: AutoTradeOptions;
  status: AutoTradeStatus;
  timer?: ReturnType<typeof setTimeout>;
};
const sessions = new Map<string, AutoTradeSession>();

function sessionKey(userAddress: string) {
  return userAddress.toLowerCase();
}
function scheduleNextCycle(session: AutoTradeSession) {
  if (session.status.active)
    session.timer = setTimeout(
      () => void runCycle(session),
      AUTO_TRADE_INTERVAL_MS,
    );
}

async function runCycle(session: AutoTradeSession) {
  if (!session.status.active) return;
  session.status.last_cycle_at = new Date().toISOString();
  session.status.is_analyzing = true;
  session.status.last_error = undefined;
  session.status.pause_reason = undefined;
  try {
    const recommendation = await generateRecommendation(
      session.options.userAddress,
      session.options.symbol,
    );

    // ─── 24-Hour Intraday Guard ─────────────────────────────────
    // If a USDT position has been held >= 24h, force close back to BNB.
    if (session.status.current_position) {
      const holdDurationMs =
        Date.now() - Date.parse(session.status.current_position.entered_at);
      const maxHoldMs =
        MARKET_DECISION_FACTORS.ALPHA.MAX_HOLD_HOURS * 60 * 60 * 1000;
      if (holdDurationMs >= maxHoldMs) {
        const holdHours = Math.floor(holdDurationMs / 3600000);
        recommendation.action = "SELL";
        // Use the live USDT balance so the guard closes the whole position.
        recommendation.amount_usdt = recommendation.agent_balances.tUSDT;
        recommendation.summary = `Batas Intraday 24 Jam Tercapai (${holdHours}h). Menutup posisi kembali ke BNB.`;
        recommendation.reasoning = `[Intraday 24h Guard] Posisi USDT telah terbuka selama ${holdHours} jam (melewati batas harian). Agent otomatis menukar seluruh USDT kembali ke BNB.`;
      }
    }

    session.status.last_recommendation = recommendation;
    session.status.last_action = recommendation.action;
    let trade: LiveTradeResponse | undefined;

    const lastTradeAt = session.status.last_trade?.timestamp;
    const inCooldown =
      lastTradeAt !== undefined &&
      Date.now() - Date.parse(lastTradeAt) < AUTO_TRADE_COOLDOWN_MS;

    // Simple alpha-based gate: action ≠ HOLD, has size, not in cooldown.
    const isForcedClose =
      session.status.current_position !== undefined &&
      recommendation.reasoning.startsWith("[Intraday 24h Guard]");
    const canExecute =
      recommendation.action !== "HOLD" &&
      recommendation.amount_usdt > 0 &&
      (!inCooldown || isForcedClose);

    if (
      canExecute &&
      (recommendation.action === "BUY" || recommendation.action === "SELL")
    ) {
      trade = await executeLivePancakeSwap({
        action: recommendation.action,
        amountUsdt: recommendation.amount_usdt,
        userAddress: session.options.userAddress,
        symbol: session.options.symbol,
        reasoning: `[Autonomous AI Agent] ${recommendation.reasoning}`,
      });
      session.status.last_trade = trade;

      // Update position tracking
      if (trade.success) {
        if (recommendation.action === "BUY") {
          session.status.current_position = {
            action: "BUY",
            // An additional BUY must not reset the 24-hour deadline of an
            // already open USDT position.
            entered_at:
              session.status.current_position?.entered_at ??
              new Date().toISOString(),
            amount_usdt:
              (session.status.current_position?.amount_usdt ?? 0) +
              recommendation.amount_usdt,
          };
        } else if (recommendation.action === "SELL") {
          session.status.current_position = undefined;
        }
      }
    }
    session.status.recent_decisions = [
      {
        timestamp: new Date().toISOString(),
        action: recommendation.action,
        confidence: recommendation.confidence,
        summary: recommendation.summary,
        reasoning: recommendation.reasoning,
        executed: Boolean(trade?.success),
        trade,
      },
      ...session.status.recent_decisions,
    ].slice(0, 20);
  } catch (error) {
    session.status.last_error =
      error instanceof Error
        ? error.message
        : "Autonomous trading cycle failed";
    if (error instanceof TradingForecastUnavailableError) {
      session.status.active = false;
      session.status.paused = true;
      session.status.pause_reason = error.message;
      if (session.timer) clearTimeout(session.timer);
    }
    console.error(`[AutonomousTrading] ${session.status.last_error}`);
  } finally {
    session.status.is_analyzing = false;
    scheduleNextCycle(session);
  }
}

export function startAutonomousTrading(
  options: AutoTradeOptions,
): AutoTradeStatus {
  const key = sessionKey(options.userAddress);
  const existing = sessions.get(key);
  if (existing) {
    existing.options = options;
    existing.status.symbol = options.symbol;
    if (!existing.status.active) {
      existing.status.active = true;
      existing.status.paused = false;
      existing.status.pause_reason = undefined;
      existing.status.last_error = undefined;
      void runCycle(existing);
    }
    return existing.status;
  }
  const session: AutoTradeSession = {
    options,
    status: {
      active: true,
      paused: false,
      is_analyzing: false,
      user_address: options.userAddress,
      symbol: options.symbol,
      interval_ms: AUTO_TRADE_INTERVAL_MS,
      started_at: new Date().toISOString(),
      recent_decisions: [],
    },
  };
  sessions.set(key, session);
  void runCycle(session);
  return session.status;
}

export function stopAutonomousTrading(
  userAddress: string,
): AutoTradeStatus | null {
  const key = sessionKey(userAddress);
  const session = sessions.get(key);
  if (!session) return null;
  session.status.active = false;
  session.status.paused = false;
  session.status.is_analyzing = false;
  if (session.timer) clearTimeout(session.timer);
  sessions.delete(key);
  return session.status;
}

export function getAutonomousTradingStatus(
  userAddress: string,
): AutoTradeStatus {
  return (
    sessions.get(sessionKey(userAddress))?.status ?? {
      active: false,
      paused: false,
      is_analyzing: false,
      user_address: userAddress,
      symbol: "BNBUSDT",
      interval_ms: AUTO_TRADE_INTERVAL_MS,
      recent_decisions: [],
    }
  );
}
