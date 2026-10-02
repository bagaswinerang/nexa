/**
 * Live BNB/USDT recommendation service — quant-v3.
 *
 * Trading decisions are made by a composite alpha score. Gemini may add
 * an explanation, but cannot alter scores, alpha, size, or action.
 */

import {
  getMarketData,
  getRecentCandles,
  runSimulation,
} from "./quant-client.js";
import { getLiveBalances } from "./pancakeswap-service.js";
import type { MarketCandle, MarketData } from "../types/index.js";
import { MARKET_DECISION_FACTORS } from "../config/trading-rules.js";
import {
  generateTradingForecast,
  type TradingForecastInput,
} from "./trading-forecast.js";
import {
  calibrateUpProbability,
  recordPaperPrediction,
} from "./paper-trading-service.js";

export interface TradeRecommendation {
  action: "BUY" | "SELL" | "HOLD";
  symbol: "BNBUSDT";
  pair: "BNB/USDT";
  confidence: number;
  paper_prediction_id: string;
  amount_usdt: number;
  current_price: number;
  summary: string;
  reasoning: string;
  risk_warning: string;
  market: {
    source: "Binance";
    price_change_5m_pct: number;
    price_change_1h_pct: number;
    price_change_4h_pct: number;
    price_change_24h_pct: number;
    volatility_24h_pct: number;
    high_24h: number;
    low_24h: number;
    volume_24h: number;
  };
  sentiment: {
    fear_greed_index: number | null;
    fear_greed_label: string | null;
  };
  agent_balances: { tBNB: number; tUSDT: number; network: string };
  signal: {
    /** Composite alpha: positive = bullish, negative = bearish. */
    alpha: number;
    probability_calibrated: boolean;
    calibration_sample_size: number;
    monte_carlo_expected_return_pct: number;
    components: Record<string, number>;
    weights: typeof MARKET_DECISION_FACTORS.FORECAST_WEIGHTS;
  };
  timestamp: string;
}

const percentChange = (current: number, previous: number) =>
  ((current - previous) / previous) * 100;

function hourlyChange(
  currentPrice: number,
  candles: MarketCandle[],
  hoursAgo: number,
): number {
  const reference = candles.at(-(hoursAgo + 1))?.close;
  if (!Number.isFinite(reference) || !reference || reference <= 0) {
    throw new Error(`Binance did not return a valid price from ${hoursAgo}h ago.`);
  }
  return percentChange(currentPrice, reference);
}

function hourlyVolatility24h(candles: MarketCandle[]): number {
  const closes = candles.slice(-25).map((candle) => candle.close);
  if (closes.length < 25) throw new Error("Binance did not return 24 hours of candles.");
  const returns = closes.slice(1).map((close, index) =>
    Math.log(close / closes[index]),
  );
  const mean = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance =
    returns.reduce((total, value) => total + (value - mean) ** 2, 0) /
    (returns.length - 1);
  return Math.sqrt(variance * 24) * 100;
}

/**
 * Compute realised hourly volatility (annualised %) from candle closes.
 * Used for vol-adjusted position sizing.
 */
function realisedAnnualVol(candles: MarketCandle[]): number {
  const closes = candles.slice(-25).map((c) => c.close);
  if (closes.length < 10) return 30; // default fallback
  const logReturns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = logReturns.reduce((s, v) => s + v, 0) / logReturns.length;
  const variance =
    logReturns.reduce((s, v) => s + (v - mean) ** 2, 0) /
    (logReturns.length - 1);
  // hourly → annual: 24h × 365d = 8760 periods
  return Math.sqrt(variance * 8760) * 100;
}

/** Generate a current recommendation and at most one non-overlapping paper label per UTC hour. */
export async function generateRecommendation(
  userAddress: string,
  symbol = "BNBUSDT",
): Promise<TradeRecommendation> {
  if (symbol.toUpperCase() !== "BNBUSDT") {
    throw new Error("Only BNB/USDT is supported for the tBNB/tUSDT agent.");
  }

  const [market, balances, simulation, minuteCandles, hourlyCandles] =
    await Promise.all([
      getMarketData("BNBUSDT"),
      getLiveBalances(),
      runSimulation({ symbol: "BNBUSDT", horizon: "24h", simulations: 3000 }),
      getRecentCandles("BNBUSDT", 6, "1m"),
      getRecentCandles("BNBUSDT", 30, "1h"),
    ]);
  const price5mAgo = minuteCandles[0]?.close;
  if (!Number.isFinite(price5mAgo) || !price5mAgo || price5mAgo <= 0) {
    throw new Error("Binance did not return a valid BNB/USDT price from five minutes ago.");
  }

  const forecastInput: TradingForecastInput = {
    symbol: "BNB/USDT",
    current_price: market.price,
    price_5m_ago: price5mAgo,
    change_5m_pct: percentChange(market.price, price5mAgo),
    change_1h_pct: hourlyChange(market.price, hourlyCandles, 1),
    change_4h_pct: hourlyChange(market.price, hourlyCandles, 4),
    change_24h_pct: market.price_change_pct_24h,
    volatility_24h_pct: hourlyVolatility24h(hourlyCandles),
    fear_greed_index: market.fear_greed_index,
    fear_greed_label: market.fear_greed_label,
    monte_carlo_horizon: "24h",
    monte_carlo_probability_up: simulation.prob_above_current,
    monte_carlo_median_price: simulation.median_price,
    hourly_candles: hourlyCandles,
  };
  const forecast = await generateTradingForecast(forecastInput);
  const calibration = await calibrateUpProbability(forecast.up_probability);
  const monteCarloExpectedReturnPct = percentChange(
    simulation.median_price,
    market.price,
  );

  const realVol = realisedAnnualVol(hourlyCandles);
  const { action, confidence, amount } = determineAction({
    alpha: forecast.alpha,
    forecastInput,
    monteCarloExpectedReturnPct,
    price: market.price,
    balances,
    realisedVolPct: realVol,
  });

  const recommendation: Omit<TradeRecommendation, "paper_prediction_id"> = {
    action,
    symbol: "BNBUSDT",
    pair: "BNB/USDT",
    confidence,
    amount_usdt: amount,
    current_price: market.price,
    summary: buildSummary(action, forecast, calibration, forecastInput),
    reasoning: buildReasoning(action, confidence, forecast, calibration, forecastInput),
    risk_warning: buildRiskWarning(market, balances.bnb_balance, balances.usdt_balance),
    market: {
      source: "Binance",
      price_change_5m_pct: forecastInput.change_5m_pct,
      price_change_1h_pct: forecastInput.change_1h_pct,
      price_change_4h_pct: forecastInput.change_4h_pct,
      price_change_24h_pct: market.price_change_pct_24h,
      volatility_24h_pct: forecastInput.volatility_24h_pct,
      high_24h: market.high_24h,
      low_24h: market.low_24h,
      volume_24h: market.volume_24h,
    },
    sentiment: {
      fear_greed_index: market.fear_greed_index,
      fear_greed_label: market.fear_greed_label,
    },
    agent_balances: {
      tBNB: balances.bnb_balance,
      tUSDT: balances.usdt_balance,
      network: balances.network,
    },
    signal: {
      alpha: forecast.alpha,
      probability_calibrated: calibration.calibrated,
      calibration_sample_size: calibration.sample_size,
      monte_carlo_expected_return_pct: monteCarloExpectedReturnPct,
      components: forecast.factor_scores,
      weights: { ...MARKET_DECISION_FACTORS.FORECAST_WEIGHTS },
    },
    timestamp: new Date().toISOString(),
  };
  const paperPredictionId = await recordPaperPrediction({
    userAddress,
    action,
    confidence,
    geminiUpProbability: forecast.up_probability,
    geminiFactorScores: forecast.factor_scores,
    snapshot: forecastInput,
    summary: recommendation.summary,
    reasoning: recommendation.reasoning,
  });

  return { ...recommendation, paper_prediction_id: paperPredictionId };
}

// ── Alpha-based decision engine ────────────────────────────────────────

function determineAction(input: {
  alpha: number;
  forecastInput: TradingForecastInput;
  monteCarloExpectedReturnPct: number;
  price: number;
  balances: { bnb_balance: number; usdt_balance: number };
  realisedVolPct: number;
}): { action: "BUY" | "SELL" | "HOLD"; confidence: number; amount: number } {
  const { ALPHA, SIZING, TRADE_GAS_RESERVE_BNB } = MARKET_DECISION_FACTORS;

  // Confidence = how far alpha is from zero, mapped to 0–100.
  const confidence = Math.min(100, Math.abs(input.alpha) * 100);

  // ── Vol-adjusted position size ───────────────────────────────────────
  // size_pct = |alpha| × MAX_POSITION_PCT × (TARGET_VOL / realised_vol)
  // Capped at MAX_POSITION_PCT so we never risk more than the configured max.
  const volRatio = Math.min(
    2,
    ALPHA.TARGET_ANNUAL_VOL_PCT / Math.max(input.realisedVolPct, 5),
  );
  const sizePct = Math.min(
    ALPHA.MAX_POSITION_PCT,
    Math.abs(input.alpha) * ALPHA.MAX_POSITION_PCT * volRatio,
  );

  // ── Alpha threshold decision ─────────────────────────────────────────
  // Portfolio convention: BNB is capital (with a gas reserve); USDT is the
  // intraday position. BUY acquires USDT with BNB, SELL converts USDT to BNB.
  if (input.alpha >= ALPHA.ENTRY_THRESHOLD) {
    const tradableBnb = Math.max(
      0,
      input.balances.bnb_balance - Number(TRADE_GAS_RESERVE_BNB),
    );
    if (tradableBnb > 0) {
      return {
        action: "BUY",
        confidence,
        amount: tradableBnb * input.price * sizePct,
      };
    }
  }

  if (input.alpha <= -ALPHA.ENTRY_THRESHOLD && input.balances.usdt_balance > 0) {
    return {
      action: "SELL",
      confidence,
      amount: input.balances.usdt_balance * sizePct,
    };
  }

  return { action: "HOLD", confidence, amount: 0 };
}

// ── Summary & reasoning helpers ────────────────────────────────────────

function actionLabel(action: "BUY" | "SELL" | "HOLD"): string {
  if (action === "BUY") return "BUY USDT (BNB ke USDT)";
  if (action === "SELL") return "SELL USDT (USDT ke BNB)";
  return "HOLD";
}

function buildSummary(
  action: "BUY" | "SELL" | "HOLD",
  forecast: Awaited<ReturnType<typeof generateTradingForecast>>,
  calibration: { probability: number; sample_size: number; calibrated: boolean },
  input: TradingForecastInput,
): string {
  const alphaLabel = `Alpha ${forecast.alpha >= 0 ? "+" : ""}${forecast.alpha.toFixed(3)}`;
  const probabilityLabel = calibration.calibrated
    ? `Peluang model ${calibration.probability.toFixed(1)}% (terkalibrasi; n=${calibration.sample_size})`
    : `Peluang model ${forecast.up_probability.toFixed(1)}% (belum terkalibrasi; n=${calibration.sample_size})`;
  const fearGreed =
    input.fear_greed_index === null
      ? "Fear & Greed tidak tersedia"
      : `Fear & Greed ${input.fear_greed_index} (${input.fear_greed_label})`;
  return `Harga Binance $${input.current_price.toFixed(2)} | 5m ${input.change_5m_pct >= 0 ? "+" : ""}${input.change_5m_pct.toFixed(3)}% | 1h ${input.change_1h_pct >= 0 ? "+" : ""}${input.change_1h_pct.toFixed(2)}% | 4h ${input.change_4h_pct >= 0 ? "+" : ""}${input.change_4h_pct.toFixed(2)}% | 24h ${input.change_24h_pct >= 0 ? "+" : ""}${input.change_24h_pct.toFixed(2)}% | ${fearGreed} | MC naik ${(input.monte_carlo_probability_up * 100).toFixed(1)}% | ${alphaLabel} | ${probabilityLabel} | Keputusan: ${actionLabel(action)}.`;
}

function buildReasoning(
  action: "BUY" | "SELL" | "HOLD",
  confidence: number,
  forecast: Awaited<ReturnType<typeof generateTradingForecast>>,
  calibration: { probability: number; sample_size: number; calibrated: boolean },
  input: TradingForecastInput,
): string {
  const calibrationText = calibration.calibrated
    ? `Peluang sudah dikalibrasi dari ${calibration.sample_size} outcome paper yang selesai.`
    : `Peluang masih raw karena baru ada ${calibration.sample_size} outcome paper dalam bin yang sama.`;
  const factorText = Object.entries(forecast.factor_scores)
    .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v.toFixed(2)}`)
    .join(", ");
  return `Regime ${forecast.regime}. Alpha ${forecast.alpha >= 0 ? "+" : ""}${forecast.alpha.toFixed(3)} (threshold ±${MARKET_DECISION_FACTORS.ALPHA.ENTRY_THRESHOLD}). Faktor: ${factorText}. ${calibrationText} Volatilitas 24h ${input.volatility_24h_pct.toFixed(2)}%. ${forecast.reasoning} Keputusan: ${actionLabel(action)} (confidence ${confidence.toFixed(1)}%).`;
}

function buildRiskWarning(
  market: MarketData,
  bnbBalance: number,
  usdtBalance: number,
): string {
  const warnings: string[] = [];
  if (Math.abs(market.price_change_pct_24h) >= 5)
    warnings.push("Volatilitas BNB/USDT 24 jam sedang tinggi.");
  if (bnbBalance <= Number(MARKET_DECISION_FACTORS.TRADE_GAS_RESERVE_BNB))
    warnings.push("Saldo tBNB hanya cukup untuk cadangan gas; BUY USDT tidak dapat dieksekusi.");
  if (usdtBalance <= 0)
    warnings.push("Saldo tUSDT agent kosong; SELL ke BNB tidak dapat dieksekusi.");
  warnings.push("Harga berasal dari Binance, sementara swap memakai saldo tBNB/tUSDT on-chain. Bukan nasihat keuangan (DYOR).");
  return warnings.join(" ");
}
