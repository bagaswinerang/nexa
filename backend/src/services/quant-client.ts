/**
 * HTTP client for calling the Python Quant Engine (:3002).
 */

import { env } from "../lib/env.js";
import type { SimulationRequest, SimulationResponse, MarketData } from "../types/index.js";

const ENGINE_URL = env.PYTHON_ENGINE_URL;

export async function runSimulation(params: SimulationRequest): Promise<SimulationResponse> {
  const response = await fetch(`${ENGINE_URL}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol: params.symbol || "BNBUSDT",
      days: params.days || 30,
      simulations: params.simulations || 3000,
      interval: params.interval || "1d",
      lookback_days: params.lookback_days || 90,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Engine error (${response.status}): ${error}`);
  }

  return response.json() as Promise<SimulationResponse>;
}

export async function getMarketData(symbol: string): Promise<MarketData> {
  const response = await fetch(`${ENGINE_URL}/market-data/${symbol}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Engine error (${response.status}): ${error}`);
  }

  return response.json() as Promise<MarketData>;
}

export async function checkEngineHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ENGINE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
