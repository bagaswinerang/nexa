/** Shared limits for live tBNB/tUSDT execution. */
export const GAS_SAFETY_CONFIG = {
  TRADE_GAS_RESERVE_BNB: "0.001",
  WITHDRAW_GAS_RESERVE_BNB: "0.002",
} as const;

export const EXECUTION_GUARDRAILS = {
  DEFAULT_SLIPPAGE_PCT: 1.0,
  TX_DEADLINE_MINUTES: 20,
} as const;

/** Binance BNB/USDT signal settings. No virtual portfolio or price projection is used. */
export const MARKET_DECISION_FACTORS = {
  TRADE_GAS_RESERVE_BNB: GAS_SAFETY_CONFIG.TRADE_GAS_RESERVE_BNB,
  WEIGHTS: {
    sentiment: 0.45,
    momentum_24h: 0.55,
  },
  THRESHOLDS: {
    BUY_THRESHOLD: 0.15,
    SELL_THRESHOLD: -0.15,
    DEFAULT_MIN_CONFIDENCE_AUTO_SWAP: 35,
  },
  SIZING: {
    MAX_SIZE_PCT: 0.25,
  },
} as const;
