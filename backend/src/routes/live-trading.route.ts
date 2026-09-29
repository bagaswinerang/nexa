/**
 * Live PancakeSwap Autonomous Trading Route.
 *
 * Endpoints:
 *   GET  /live-trading/balances — Get real on-chain BNB and USDT balance of agent wallet
 *   POST /live-trading/execute  — Execute live swap on PancakeSwap Router
 *   POST /live-trading/auto     — Full autonomous AI: Analyze -> Recommend -> Swap on PancakeSwap
 */

import { Hono } from "hono";
import {
  getLiveBalances,
  executeLivePancakeSwap,
  executeLiveWithdrawal,
  type LiveTradeRequest,
} from "../services/pancakeswap-service.js";
import { generateRecommendation } from "../services/ai-recommend.js";
import {
  TOKEN_LIMITS,
  QUANT_DECISION_FACTORS,
} from "../config/trading-rules.js";

const liveTrading = new Hono();

// ─── GET /live-trading/balances ──────────────────────────────────
// Returns live on-chain BNB and USDT balance
liveTrading.get("/balances", async (c) => {
  try {
    const customWallet = c.req.query("wallet");
    const balances = await getLiveBalances(customWallet);
    return c.json(balances);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch balances";
    return c.json({ error: message }, 500);
  }
});

// ─── POST /live-trading/execute ──────────────────────────────────
// Execute a real swap on PancakeSwap
liveTrading.post("/execute", async (c) => {
  try {
    const body = await c.req.json<{
      user_address: string;
      action: "BUY" | "SELL";
      amount_usdt: number;
      symbol?: string;
      reasoning?: string;
      slippage_pct?: number;
    }>();

    if (!body.user_address || !body.action || !body.amount_usdt) {
      return c.json(
        { error: "user_address, action, and amount_usdt are required" },
        400
      );
    }

    if (body.amount_usdt < TOKEN_LIMITS.MIN_SWAP_USDT) {
      return c.json(
        { error: `Minimal swap adalah ${TOKEN_LIMITS.MIN_SWAP_USDT} tUSDT` },
        400
      );
    }

    const trade = await executeLivePancakeSwap({
      action: body.action,
      amountUsdt: body.amount_usdt,
      userAddress: body.user_address,
      symbol: body.symbol || "BNBUSDT",
      reasoning: body.reasoning,
      slippagePct: body.slippage_pct,
    });

    return c.json({ trade }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Swap execution failed";
    console.error(`[LiveTrading] ❌ Execute error: ${message}`);
    return c.json({ error: message }, 400);
  }
});

// ─── POST /live-trading/auto ─────────────────────────────────────
// Autonomous loop: AI recommendation -> if actionable -> swap on PancakeSwap
liveTrading.post("/auto", async (c) => {
  try {
    const body = await c.req.json<{
      user_address: string;
      symbol?: string;
      forecast_days?: number;
      min_confidence?: number;
    }>();

    if (!body.user_address) {
      return c.json({ error: "user_address is required" }, 400);
    }

    const symbol = body.symbol || "BNBUSDT";
    const minConfidence =
      body.min_confidence ||
      QUANT_DECISION_FACTORS.THRESHOLDS.DEFAULT_MIN_CONFIDENCE_AUTO_SWAP;
    const forecastDays =
      body.forecast_days ||
      QUANT_DECISION_FACTORS.THRESHOLDS.DEFAULT_FORECAST_DAYS;

    // 1. Generate AI recommendation (Monte Carlo + Market Data + Gemini)
    const recommendation = await generateRecommendation(
      body.user_address,
      symbol,
      forecastDays
    );

    // 2. If HOLD or low confidence, do not trade
    if (
      recommendation.action === "HOLD" ||
      recommendation.confidence < minConfidence
    ) {
      return c.json({
        executed: false,
        action: recommendation.action,
        confidence: recommendation.confidence,
        reason: `Action is ${recommendation.action} (Confidence: ${recommendation.confidence}%, Min Required: ${minConfidence}%). No swap executed.`,
        recommendation,
      });
    }

    // 3. Execute live swap on PancakeSwap!
    const trade = await executeLivePancakeSwap({
      action: recommendation.action,
      amountUsdt: recommendation.amount_usdt || TOKEN_LIMITS.MIN_SWAP_USDT,
      userAddress: body.user_address,
      symbol,
      reasoning: `[Auto AI Agent] ${recommendation.reasoning}`,
    });

    return c.json(
      {
        executed: true,
        action: recommendation.action,
        trade,
        recommendation,
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto trading failed";
    console.error(`[LiveTrading] ❌ Auto error: ${message}`);
    return c.json({ error: message }, 500);
  }
});

// ─── POST /live-trading/withdraw ─────────────────────────────────
// On-chain transfer from agent back to user wallet
liveTrading.post("/withdraw", async (c) => {
  try {
    const body = await c.req.json<{
      user_address: string;
      amount?: number;
      amount_usdt?: number; // legacy support
      token?: "BNB" | "USDT" | "tBNB" | "tUSDT";
    }>();

    const amt = body.amount || body.amount_usdt;
    const rawToken = body.token || "USDT";
    const token = rawToken === "tBNB" || rawToken === "BNB" ? "BNB" : "USDT";

    if (!body.user_address || !amt || amt <= 0) {
      return c.json(
        { error: "user_address and amount (> 0) are required" },
        400
      );
    }

    const result = await executeLiveWithdrawal({
      userAddress: body.user_address,
      amount: amt,
      token: token,
    });

    return c.json({ withdrawal: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Withdrawal failed";
    console.error(`[LiveTrading] ❌ Withdraw error: ${message}`);
    return c.json({ error: message }, 400);
  }
});

export default liveTrading;
