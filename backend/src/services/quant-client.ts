/** Client for the Binance-backed market-data and Quant Lab service (:3002). */

import { env } from "../lib/env.js";
import type { MarketData, SimulationRequest, SimulationResponse } from "../types/index.js";

const ENGINE_URL = env.PYTHON_ENGINE_URL;

export async function getMarketData(symbol = "BNBUSDT"): Promise<MarketData> {
  const response = await fetch(`${ENGINE_URL}/market-data/${symbol.toUpperCase()}`);
  if (!response.ok) throw new Error(`Market-data service error (${response.status}): ${await response.text()}`);
  return response.json() as Promise<MarketData>;
}

export async function runSimulation(params: SimulationRequest): Promise<SimulationResponse> {
  const response = await fetch(`${ENGINE_URL}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: params.symbol?.toUpperCase() || "BNBUSDT", horizon: params.horizon || "30d", simulations: params.simulations || 3000 }),
  });
  if (!response.ok) throw new Error(`Quant Lab error (${response.status}): ${await response.text()}`);
  return response.json() as Promise<SimulationResponse>;
}

export async function checkEngineHealth(): Promise<boolean> {
  try { return (await fetch(`${ENGINE_URL}/health`)).ok; } catch { return false; }
}
