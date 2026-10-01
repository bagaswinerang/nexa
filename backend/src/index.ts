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

const app = new Hono();

// ─── Middleware ──────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Routes ─────────────────────────────────────────────────────
app.route("/monte-carlo", quantLabRoute);
app.route("/chat", chatRoute);
app.route("/transactions", transactionRoute);
app.route("/live-trading", liveTradingRoute);

// ─── Health Check with Live DB Check ────────────────────────────
app.get("/health", async (c) => {
  const dbStatus = await testSupabaseConnection();
  return c.json({
    status: dbStatus.connected ? "ok" : "degraded",
    service: "nexa-backend",
    database: {
      provider: "supabase",
      connected: dbStatus.connected,
      url: env.SUPABASE_URL,
      error: dbStatus.error || null,
      total_transactions: dbStatus.count ?? 0,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Root ───────────────────────────────────────────────────────
app.get("/", (c) => {
  return c.json({
    name: "Nexa Backend API",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      chat: "POST /chat",
      quant_lab: "POST /monte-carlo/simulate",
      transactions: "GET|POST /transactions",
      transaction_summary: "GET /transactions/summary",
      live_balances: "GET /live-trading/balances",
      live_recommend: "POST /live-trading/recommend",
      live_execute: "POST /live-trading/execute",
      live_auto: "POST /live-trading/auto",
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
    console.log(`[Database] 📊 Table 'transactions' is online (Total entries: ${dbStatus.count})`);
  } else {
    console.error(`[Database] ❌ Supabase Connection Error: ${dbStatus.error}`);
    console.error(`[Database] 💡 Check SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env`);
  }
})();
