"use client";

/**
 * Hook for Monte Carlo simulation.
 */

import { useState, useCallback } from "react";
import { runSimulation, type SimulationResult } from "@/lib/api";

interface UseMonteCarloReturn {
  result: SimulationResult | null;
  isLoading: boolean;
  error: string | null;
  simulate: (symbol: string, days?: number) => Promise<void>;
  reset: () => void;
}

export function useMonteCarlo(): UseMonteCarloReturn {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulate = useCallback(
    async (symbol: string, days = 30) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await runSimulation({
          symbol: symbol.toUpperCase(),
          days,
          simulations: 3000,
        });
        setResult(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Simulation failed"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isLoading, error, simulate, reset };
}
