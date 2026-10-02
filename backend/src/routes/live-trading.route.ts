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
import {
  getAutonomousTradingStatus,
  startAutonomousTrading,
  stopAutonomousTrading,
} from "../services/autonomous-trading-service.js";
import { generateRecommendation } from "../services/ai-recommend.js";
import { getPaperPredictions } from "../services/paper-trading-service.js";

const liveTrading = new Hono();

// ─── GET /live-trading/balances ──────────────────────────────────
// Returns live on-chain BNB and USDT balance
liveTrading.get("/balances", async (c) => {
  try {
    const customWallet = c.req.query("wallet");
    const balances = await getLiveBalances(customWallet);
    return c.json(balances);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch balances";
    return c.json({ error: message }, 500);
  }
});

// Binance BNB/USDT signal. BNB is capital; BUY opens a USDT position.
liveTrading.post("/recommend", async (c) => {
  try {
    const body = await c.req.json<{ user_address: string; symbol?: string }>();
    if (!body.user_address)
      return c.json({ error: "user_address is required" }, 400);
    const recommendation = await generateRecommendation(
      body.user_address,
      body.symbol || "BNBUSDT",
    );
    return c.json({ recommendation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recommendation failed";
    return c.json({ error: message }, 400);
  }
});

liveTrading.get("/paper-trades", async (c) => {
  const userAddress = c.req.query("user_address");
  if (!userAddress) return c.json({ error: "user_address is required" }, 400);
  const parsedLimit = Number.parseInt(c.req.query("limit") || "50", 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 100))
    : 50;
  try {
    return c.json({
      predictions: await getPaperPredictions(userAddress, limit),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch paper trades";
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
        400,
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
    const message =
      error instanceof Error ? error.message : "Swap execution failed";
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
    }>();

    if (!body.user_address) {
      return c.json({ error: "user_address is required" }, 400);
    }

    const status = startAutonomousTrading({
      userAddress: body.user_address,
      symbol: body.symbol || "BNBUSDT",
    });
    return c.json({ status }, 202);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to start autonomous trading";
    console.error(`[LiveTrading] Auto start error: ${message}`);
    return c.json({ error: message }, 400);
  }
});

liveTrading.get("/auto/status", (c) => {
  const userAddress = c.req.query("user_address");
  if (!userAddress) return c.json({ error: "user_address is required" }, 400);
  return c.json({ status: getAutonomousTradingStatus(userAddress) });
});

liveTrading.post("/auto/stop", async (c) => {
  const body = await c.req.json<{ user_address: string }>();
  if (!body.user_address)
    return c.json({ error: "user_address is required" }, 400);
  const status =
    stopAutonomousTrading(body.user_address) ??
    getAutonomousTradingStatus(body.user_address);
  return c.json({ status });
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
        400,
      );
    }

    const result = await executeLiveWithdrawal({
      userAddress: body.user_address,
      amount: amt,
      token: token,
    });

    return c.json({ withdrawal: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Withdrawal failed";
    console.error(`[LiveTrading] ❌ Withdraw error: ${message}`);
    return c.json({ error: message }, 400);
  }
});

export default liveTrading;
