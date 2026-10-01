"use client";

import { useState, useCallback } from "react";
import { runSimulation, type SimulationResult } from "@/lib/api";

export function useMonteCarlo() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const simulate = useCallback(async (symbol: string, days = 30) => {
    setIsLoading(true); setError(null);
    try { setResult(await runSimulation({ symbol: symbol.toUpperCase(), days, simulations: 3000 })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Simulation failed"); }
    finally { setIsLoading(false); }
  }, []);
  const reset = useCallback(() => { setResult(null); setError(null); }, []);
  return { result, isLoading, error, simulate, reset };
}
