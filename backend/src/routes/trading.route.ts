/**
 * AI Trading Agent Route.
 *
 * Endpoints:
 *   POST /trading/recommend  — Get AI recommendation (BUY/SELL/HOLD)
 *   POST /trading/execute    — Execute a paper trade (manual or AI-approved)
 *   GET  /trading/portfolio   — Get current paper portfolio status
 *   POST /trading/reset       — Reset portfolio to $10,000 USDT
 */

import { Hono } from "hono";
import { generateRecommendation } from "../services/ai-recommend.js";
import {
  executePaperTrade,
  getPortfolioStatus,
  resetPortfolio,
} from "../services/paper-trading.js";

const trading = new Hono();

// ─── POST /trading/recommend ────────────────────────────────────
// Generate AI recommendation based on Monte Carlo + Sentiment + Portfolio
trading.post("/recommend", async (c) => {
  try {
    const body = await c.req.json<{
      user_address: string;
      symbol?: string;
      forecast_days?: number;
    }>();

    if (!body.user_address) {
      return c.json({ error: "user_address is required" }, 400);
    }

    const recommendation = await generateRecommendation(
      body.user_address,
      body.symbol || "BNBUSDT",
      body.forecast_days || 14
    );

    return c.json({ recommendation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recommendation failed";
    console.error(`[Trading] ❌ Recommend error: ${message}`);
    return c.json({ error: message }, 500);
  }
});

// ─── POST /trading/execute ──────────────────────────────────────
// Execute a paper trade (BUY or SELL)
trading.post("/execute", async (c) => {
  try {
    const body = await c.req.json<{
      user_address: string;
      action: "BUY" | "SELL";
      symbol?: string;
      amount_usdt: number;
      reasoning?: string;
      source?: "manual" | "ai_agent";
    }>();

    if (!body.user_address || !body.action || !body.amount_usdt) {
      return c.json(
        { error: "user_address, action, and amount_usdt are required" },
        400
      );
    }

    if (body.amount_usdt < 1) {
      return c.json({ error: "Minimum trade amount is $1 USDT" }, 400);
    }

    const result = await executePaperTrade(body.user_address, {
      action: body.action,
      symbol: body.symbol || "BNBUSDT",
      amount_usdt: body.amount_usdt,
      reasoning: body.reasoning,
      source: body.source || "manual",
    });

    return c.json({ trade: result }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trade execution failed";
    console.error(`[Trading] ❌ Execute error: ${message}`);
    return c.json({ error: message }, 400);
  }
});

// ─── POST /trading/auto ─────────────────────────────────────────
// Full auto: get recommendation → if BUY/SELL → execute immediately
trading.post("/auto", async (c) => {
  try {
    const body = await c.req.json<{
      user_address: string;
      symbol?: string;
      forecast_days?: number;
    }>();

    if (!body.user_address) {
      return c.json({ error: "user_address is required" }, 400);
    }

    // 1. Get AI recommendation
    const recommendation = await generateRecommendation(
      body.user_address,
      body.symbol || "BNBUSDT",
      body.forecast_days || 14
    );

    // 2. If actionable, execute automatically
    let trade = null;
    if (recommendation.action !== "HOLD" && recommendation.amount_usdt > 0) {
      trade = await executePaperTrade(body.user_address, {
        action: recommendation.action,
        symbol: recommendation.symbol,
        amount_usdt: recommendation.amount_usdt,
        reasoning: recommendation.reasoning,
        source: "ai_agent",
      });
    }

    return c.json({
      recommendation,
      trade,
      auto_executed: trade !== null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-trade failed";
    console.error(`[Trading] ❌ Auto error: ${message}`);
    return c.json({ error: message }, 500);
  }
});

// ─── GET /trading/portfolio ─────────────────────────────────────
// Get current paper trading portfolio status
trading.get("/portfolio", async (c) => {
  const userAddress = c.req.query("user_address");

  if (!userAddress) {
    return c.json({ error: "user_address query parameter is required" }, 400);
  }

  try {
    const status = await getPortfolioStatus(userAddress);
    return c.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get portfolio";
    return c.json({ error: message }, 500);
  }
});

// ─── POST /trading/reset ────────────────────────────────────────
// Reset portfolio back to $10,000 USDT
trading.post("/reset", async (c) => {
  try {
    const body = await c.req.json<{ user_address: string }>();

    if (!body.user_address) {
      return c.json({ error: "user_address is required" }, 400);
    }

    const portfolio = resetPortfolio(body.user_address);
    return c.json({ portfolio, message: "Portfolio reset to $10,000 USDT" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return c.json({ error: message }, 500);
  }
});

export default trading;
