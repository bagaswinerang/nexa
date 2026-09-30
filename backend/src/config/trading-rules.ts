/**
 * ============================================================================
 * NEXA QUANT & ON-CHAIN TRADING CONFIGURATION
 * ============================================================================
 * File ini adalah pusat pengaturan (Single Source of Truth) untuk:
 * 1. Batas Minimum Koin & Guardrail Keamanan (Safety Limits).
 * 2. Cadangan Gas Fee Jaringan (Gas Reserve).
 * 3. Bobot Faktor Penentu Analisis AI Quant Engine (Monte Carlo, Sentiment, dll).
 * 4. Threshold & Parameter Eksekusi Otomatis.
 *
 * Silakan ubah angka di sini tanpa perlu membongkar logika di routes atau services.
 */

// ─── 1. BATAS MINIMAL ORDER & TRANSAKSI (TOKEN LIMITS) ─────────────
export const TOKEN_LIMITS = {
  /**
   * Minimal nominal pertukaran (Swap) tUSDT.
   * Di testnet bisa sangat kecil (misal: 0.001 tUSDT).
   */
  MIN_SWAP_USDT: 0.001,

  /**
   * Minimal nominal tBNB yang dapat ditradingkan (di luar cadangan gas).
   */
  MIN_SWAP_BNB: 0.0001,

  /**
   * Minimal penarikan dana (Withdrawal) ke dompet user.
   */
  MIN_WITHDRAW_USDT: 0.001,
  MIN_WITHDRAW_BNB: 0.001,
} as const;

// ─── 2. PROTEKSI GAS FEE BLOCKCHAIN (GAS RESERVES) ─────────────────
export const GAS_SAFETY_CONFIG = {
  /**
   * Jumlah tBNB yang WAJIB disisakan di dompet Agent saat melakukan trading SELL BNB.
   * Sistem otomatis memotong saldo trading agar dompet tidak pernah kehabisan gas.
   */
  TRADE_GAS_RESERVE_BNB: "0.001",

  /**
   * Jumlah tBNB yang disisakan saat melakukan penarikan tBNB.
   */
  WITHDRAW_GAS_RESERVE_BNB: "0.002",
} as const;

// ─── 3. GUARDRAIL & EKSEKUSI ON-CHAIN ──────────────────────────────
export const EXECUTION_GUARDRAILS = {
  /**
   * Toleransi slippage default dalam persen (1.0 = 1%).
   */
  DEFAULT_SLIPPAGE_PCT: 1.0,

  /**
   * Batas waktu konfirmasi transaksi (dalam menit) sebelum transaksi kadaluarsa.
   */
  TX_DEADLINE_MINUTES: 20,

  /**
   * Batas pengeluaran harian default (dalam USDT) jika belum di-set di .env.
   */
  FALLBACK_MAX_DAILY_SPEND_USDT: 99999999999999999999999999999999999999999999999999999999,
} as const;

// ─── 4. FAKTOR PENENTU KEPUTUSAN AI (QUANT DECISION ENGINE) ────────
export const QUANT_DECISION_FACTORS = {
  /**
   * Bobot masing-masing faktor analisis (Total harus = 1.0 / 100%):
   * - monte_carlo_prob: Bobot probabilitas simulasi masa depan (3000 jalur).
   * - sentiment: Bobot indikator Fear & Greed Index + Market Sentiment.
   * - momentum_24h: Bobot perubahan harga & volume 24 jam terakhir.
   * - portfolio_risk: Bobot diversifikasi & risiko rasio modal dompet.
   */
  WEIGHTS: {
    monte_carlo_prob: 0.35,
    sentiment: 0.25,
    momentum_24h: 0.2,
    portfolio_risk: 0.2,
  },

  /**
   * Ambang batas sinyal gabungan (Composite Signal Score: -1.0 s/d +1.0)
   * untuk menentukan aksi BUY, SELL, atau HOLD.
   */
  THRESHOLDS: {
    /** Skor di atas nilai ini memicu rekomendasi BUY */
    BUY_THRESHOLD: 0.15,

    /** Skor di bawah nilai ini memicu rekomendasi SELL */
    SELL_THRESHOLD: -0.15,

    /**
     * Tingkat keyakinan minimum (Confidence %) agar Auto-Execution dijalankan.
     * Jika confidence < nilai ini, eksekusi otomatis ditunda (HOLD demi keamanan).
     */
    DEFAULT_MIN_CONFIDENCE_AUTO_SWAP: 35,

    /**
     * Jumlah hari proyeksi default untuk Monte Carlo.
     */
    DEFAULT_FORECAST_DAYS: 14,
  },

  /**
   * Pengaturan ukuran porsi modal saat open order (Position Sizing).
   */
  SIZING: {
    /** Porsi minimum modal (5% dari saldo) */
    MIN_SIZE_PCT: 0.05,

    /** Porsi maksimum modal (25% dari saldo) */
    MAX_SIZE_PCT: 0.25,
  },
} as const;
