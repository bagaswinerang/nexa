/** Binance-backed Quant Lab API. */

import { Hono } from "hono";
import { env } from "../lib/env.js";
import { checkEngineHealth, runSimulation } from "../services/quant-client.js";
import type { SimulationRequest } from "../types/index.js";

const quantLab = new Hono();
quantLab.post("/simulate", async (c) => {
  try { return c.json(await runSimulation(await c.req.json<SimulationRequest>())); }
  catch (error) { return c.json({ error: error instanceof Error ? error.message : "Quant Lab failed" }, 502); }
});
quantLab.get("/health", async (c) => c.json({ engine: await checkEngineHealth() ? "connected" : "disconnected", engine_url: env.PYTHON_ENGINE_URL }));
export default quantLab;
