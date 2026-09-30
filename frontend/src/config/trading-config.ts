/**
 * ============================================================================
 * NEXA FRONTEND TRADING CONFIGURATION
 * ============================================================================
 * Pusat konfigurasi tampilan, batas input, dan default nominal untuk:
 * - DEX Trading Card (Swap tBNB <-> tUSDT)
 * - Modal Deposit & Penarikan On-Chain
 * - AI Quant Auto-Execution Threshold
 */

export const TRADING_UI_CONFIG = {
  /**
   * Batas input Swap tUSDT
   */
  SWAP: {
    MIN_USDT: 0.001,
    STEP_USDT: 0.001,
    DEFAULT_INPUT_USDT: 0.01,
  },

  /**
   * Modal Deposit On-Chain
   */
  DEPOSIT: {
    MIN_AMOUNT: 0.001,
    DEFAULT_BNB: 0.01,
    DEFAULT_USDT: 1.0,
  },

  /**
   * Modal Penarikan (Withdrawal) On-Chain
   */
  WITHDRAW: {
    MIN_AMOUNT: 0.001,
    DEFAULT_BNB: 0.01,
    DEFAULT_USDT: 0.01,
  },

  /**
   * Pengaturan AI Auto Swap Modal & Guardrails
   */
  AI_GUARDRAIL: {
    /** Nilai cadangan gas fee yang disisihkan di backend */
    GAS_RESERVE_BNB: "0.001",

    /** Ambang batas keyakinan minimum untuk eksekusi otomatis */
    MIN_CONFIDENCE_PCT: 35,

    /** Default forecast days untuk Monte Carlo */
    FORECAST_DAYS: 14,
  },
} as const;
