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

} as const;

// ─── 4. FAKTOR PENENTU KEPUTUSAN AI (QUANT DECISION ENGINE) ────────
export const QUANT_DECISION_FACTORS = {
  /**
   * Bobot masing-masing faktor analisis (Total harus = 1.0 / 100%):
   * - monte_carlo_prob: Bobot probabilitas simulasi masa depan (3000 jalur).
   * - sentiment: Bobot indikator Fear & Greed Index + Market Sentiment.
   * - momentum_24h: Bobot perubahan harga & volume 24 jam terakhir.
   * Bobot hanya memakai data pasar; portofolio paper tidak memengaruhi sinyal.
   */
  WEIGHTS: {
    monte_carlo_prob: 0.45,
    sentiment: 0.3,
    momentum_24h: 0.25,
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
     * Tingkat keyakinan minimum agar rekomendasi boleh dieksekusi otomatis.
     * Rumus confidence: Math.abs(composite signal) * 100 + 20.
     * Dengan threshold BUY/SELL +/-0.15, nilai ini selaras dengan mesin quant.
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
    /** Porsi maksimum modal (25% dari saldo) */
    MAX_SIZE_PCT: 0.25,
  },
} as const;
