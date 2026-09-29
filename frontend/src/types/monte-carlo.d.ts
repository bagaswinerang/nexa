/**
 * Monte Carlo simulation type definitions.
 */

export interface PercentileResult {
  percentile: number;
  price: number;
}

export interface SimulationResult {
  symbol: string;
  current_price: number;
  days_simulated: number;
  num_simulations: number;
  mean_price: number;
  median_price: number;
  std_dev: number;
  min_price: number;
  max_price: number;
  percentiles: PercentileResult[];
  prob_above_current: number;
  prob_above_10pct: number;
  prob_below_10pct: number;
  annual_drift: number;
  annual_volatility: number;
  sample_paths: number[][];
  final_prices: number[];
}

export interface SimulationParams {
  symbol: string;
  days: number;
  simulations: number;
}
