/**
 * Nexa Backend — Hono server entry point.
 *
 * Usage:
 *   npm run dev    → starts with hot reload on :3001
 *   npm run start  → production start
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { env } from "./lib/env.js";
import { testSupabaseConnection } from "./lib/supabase.js";
import quantLabRoute from "./routes/monte-carlo.route.js";
import chatRoute from "./routes/chat.route.js";
import transactionRoute from "./routes/transaction.route.js";
import liveTradingRoute from "./routes/live-trading.route.js";
import { startPaperPredictionSettlementWorker } from "./services/paper-trading-service.js";

const app = new Hono();
const allowedOrigins = new Set(
  env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

// ─── Middleware ──────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    // Same-origin proxy traffic has no Origin header. Direct browser access is
    // permitted only from explicitly configured production origins; local
    // development remains convenient when no allowlist is configured.
    origin: (origin) => {
      if (!origin) return "";
      if (allowedOrigins.size === 0 && process.env.NODE_ENV !== "production") {
        return origin;
      }
      return allowedOrigins.has(origin) ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Routes ─────────────────────────────────────────────────────
app.route("/monte-carlo", quantLabRoute);
app.route("/chat", chatRoute);
app.route("/transactions", transactionRoute);
app.route("/live-trading", liveTradingRoute);
startPaperPredictionSettlementWorker();

// ─── Health Check with Live DB Check ────────────────────────────
app.get("/health", async (c) => {
  const dbStatus = await testSupabaseConnection();
  return c.json({
    status: dbStatus.connected ? "ok" : "degraded",
    service: "nexa-backend",
    database: {
      provider: "supabase",
      connected: dbStatus.connected,
      total_transactions: dbStatus.count ?? 0,
    },
    timestamp: new Date().toISOString(),
  });
});

// Readiness intentionally returns 503 when the database is unavailable so a
// platform can remove an unhealthy instance from traffic without exposing DB
// internals in the response.
app.get("/ready", async (c) => {
  const dbStatus = await testSupabaseConnection();
  return c.json(
    {
      status: dbStatus.connected ? "ready" : "degraded",
      database: dbStatus.connected ? "connected" : "unavailable",
      timestamp: new Date().toISOString(),
    },
    dbStatus.connected ? 200 : 503,
  );
});

// ─── Root ───────────────────────────────────────────────────────
app.get("/", (c) => {
  return c.json({
    name: "Nexa Backend API",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      readiness: "GET /ready",
      chat: "POST /chat",
      quant_lab: "POST /monte-carlo/simulate",
      transactions: "GET|POST /transactions",
      transaction_summary: "GET /transactions/summary",
      live_balances: "GET /live-trading/balances",
      live_recommend: "POST /live-trading/recommend",
      live_execute: "POST /live-trading/execute",
      live_auto: "POST /live-trading/auto",
      paper_trades: "GET /live-trading/paper-trades",
    },
  });
});

// ─── Start Server & Verify DB Connection ─────────────────────────
serve({
  fetch: app.fetch,
  port: env.PORT,
});

console.log(`
╔══════════════════════════════════════════════════════╗
║         🚀 Nexa Quant Backend is running!            ║
║         URL: http://localhost:${env.PORT}                   ║
╚══════════════════════════════════════════════════════╝
`);

// Async DB ping log
(async () => {
  console.log(`[Database] 🔌 Pinging Supabase (${env.SUPABASE_URL})...`);
  const dbStatus = await testSupabaseConnection();
  if (dbStatus.connected) {
    console.log(`[Database] ✅ Supabase Connected successfully!`);
    console.log(
      `[Database] 📊 Table 'transactions' is online (Total entries: ${dbStatus.count})`,
    );
  } else {
    console.error(`[Database] ❌ Supabase Connection Error: ${dbStatus.error}`);
    console.error(
      `[Database] 💡 Check SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env`,
    );
  }
})();
