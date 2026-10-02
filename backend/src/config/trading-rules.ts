/** Shared limits for live tBNB/tUSDT execution. */
export const GAS_SAFETY_CONFIG = {
  TRADE_GAS_RESERVE_BNB: "0.001",
  WITHDRAW_GAS_RESERVE_BNB: "0.002",
} as const;

export const EXECUTION_GUARDRAILS = {
  DEFAULT_SLIPPAGE_PCT: 1.0,
  TX_DEADLINE_MINUTES: 20,
} as const;

/** Binance BNB/USDT quant-v3 signal settings. */
export const MARKET_DECISION_FACTORS = {
  TRADE_GAS_RESERVE_BNB: GAS_SAFETY_CONFIG.TRADE_GAS_RESERVE_BNB,
  MODEL_VERSION: "quant-v3",
  PAPER_HORIZON_HOURS: 1,

  /** Weights for the composite alpha signal. Sum = 1.0. */
  FORECAST_WEIGHTS: {
    momentum_5m: 0.10,
    momentum_1h: 0.20,
    momentum_4h: 0.20,
    rsi: 0.15,
    volume: 0.10,
    sentiment: 0.10,
    monte_carlo_24h: 0.15,
  },

  /** Alpha-based execution parameters — replaces the old checklist gates. */
  ALPHA: {
    /** Minimum |alpha| to trigger BUY or SELL. Below this → HOLD. */
    ENTRY_THRESHOLD: 0.15,
    /** Maximum portfolio fraction per trade. */
    MAX_POSITION_PCT: 0.25,
    /** Target annualized portfolio volatility (%). Sizing scales inversely. */
    TARGET_ANNUAL_VOL_PCT: 30,
    /** Cooldown between live executions (ms). */
    COOLDOWN_MS: 5 * 60_000,
    /** Maximum hold duration for intraday trading (hours). Closes to USDT after 24h. */
    MAX_HOLD_HOURS: 24,
  },

  /** Kept for paper-trading-service compatibility (calibration, settlement). */
  THRESHOLDS: {
    MIN_SETTLED_PAPER_SAMPLES_FOR_AUTO_SWAP: 10,
    MIN_CALIBRATION_SAMPLES: 5,
    CALIBRATION_BIN_HALF_WIDTH_PCT: 5,
  },

  SIZING: {
    PAPER_INITIAL_BNB: 1,
    PAPER_FEE_PER_SIDE_PCT: 0.15,
    PAPER_HOLD_NEUTRAL_MOVE_PCT: 0.25,
    ESTIMATED_ROUND_TRIP_COST_PCT: 0.3,
  },
} as const;
