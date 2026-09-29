/**
 * Monte Carlo simulation route.
 * Proxies requests to the Python Quant Engine.
 */

import { Hono } from "hono";
import { runSimulation, getMarketData, checkEngineHealth } from "../services/quant-client.js";
import { env } from "../lib/env.js";
import type { SimulationRequest } from "../types/index.js";

const monteCarlo = new Hono();

// POST /monte-carlo/simulate
monteCarlo.post("/simulate", async (c) => {
  try {
    const body = await c.req.json<SimulationRequest>();
    const result = await runSimulation(body);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed";
    return c.json({ error: message }, 500);
  }
});

// GET /monte-carlo/market-data/:symbol
monteCarlo.get("/market-data/:symbol", async (c) => {
  try {
    const symbol = c.req.param("symbol");
    const data = await getMarketData(symbol);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch market data";
    return c.json({ error: message }, 500);
  }
});

// GET /monte-carlo/health
monteCarlo.get("/health", async (c) => {
  const engineHealthy = await checkEngineHealth();
  return c.json({
    engine: engineHealthy ? "connected" : "disconnected",
    engine_url: env.PYTHON_ENGINE_URL,
  });
});

export default monteCarlo;
