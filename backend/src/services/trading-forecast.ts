import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../lib/env.js";
import { MARKET_DECISION_FACTORS } from "../config/trading-rules.js";
import type { MarketCandle } from "../types/index.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const configuredModel = env.GEMINI_MODEL.trim();
const modelCandidates = [
  ...(configuredModel && !/^gemini-2\.5/i.test(configuredModel)
    ? [configuredModel]
    : []),
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
].filter((model, index, models) => models.indexOf(model) === index);

/** Kept for compatibility with existing autonomous-agent status handling. */
export class TradingForecastUnavailableError extends Error {}

export interface TradingForecastInput {
  symbol: string;
  current_price: number;
  price_5m_ago: number;
  change_5m_pct: number;
  change_1h_pct: number;
  change_4h_pct: number;
  change_24h_pct: number;
  volatility_24h_pct: number;
  fear_greed_index: number | null;
  fear_greed_label: string | null;
  monte_carlo_horizon: "24h";
  monte_carlo_probability_up: number;
  monte_carlo_median_price: number;
  /** Hourly candles (≥15) for RSI and volume computation. */
  hourly_candles: MarketCandle[];
}

export interface TradingForecast {
  /** Composite alpha score: positive = bullish, negative = bearish. */
  alpha: number;
  /** Raw estimate until it has enough settled outcomes for calibration. */
  up_probability: number;
  factor_scores: Record<string, number>;
  summary: string;
  reasoning: string;
  regime: "trend" | "range" | "high_volatility";
  gemini_available: boolean;
}

const clamp = (value: number, min = -1, max = 1) =>
  Math.max(min, Math.min(max, value));

// ── Technical indicator helpers ────────────────────────────────────────

/**
 * 14-period RSI from hourly closes.
 * Returns a normalised score in [-1, 1]:
 *   RSI < 30 → positive (oversold = bullish)
 *   RSI > 70 → negative (overbought = bearish)
 */
export function computeRSI(candles: MarketCandle[]): number {
  const period = 14;
  if (candles.length < period + 1) return 0;
  const closes = candles.slice(-(period + 1)).map((c) => c.close);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  if (avgLoss === 0) return -0.5; // max strength → overbought
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  // Normalise: 50 → 0, 30 → +0.67, 70 → -0.67, 20 → +1, 80 → -1
  return clamp((50 - rsi) / 30);
}

/**
 * Z-score of the latest hourly volume relative to the trailing mean.
 * Positive z-score + price move = conviction; we pass it as-is and let
 * the weighting decide direction via the momentum factors.
 */
export function computeVolumeZScore(candles: MarketCandle[]): number {
  if (candles.length < 5) return 0;
  const volumes = candles.map((c) => c.volume);
  const latest = volumes[volumes.length - 1];
  const mean = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  if (mean === 0) return 0;
  const variance =
    volumes.reduce((s, v) => s + (v - mean) ** 2, 0) / volumes.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  // Directional: high volume amplifies the latest price direction.
  const lastClose = candles[candles.length - 1].close;
  const prevClose = candles[candles.length - 2].close;
  const priceDirection = lastClose >= prevClose ? 1 : -1;
  return clamp(((latest - mean) / std) * priceDirection * 0.5);
}

// ── Sentiment ──────────────────────────────────────────────────────────

function getSentimentScore(fearGreed: number | null): number {
  if (fearGreed === null) return 0;
  // Momentum-aligned sentiment: mild greed supports uptrend, only extreme
  // greed is a weak contrarian signal. Fear remains contrarian-bullish.
  if (fearGreed >= 80) return -0.10;
  if (fearGreed >= 70) return 0.05;
  if (fearGreed >= 55) return 0.10;
  if (fearGreed <= 20) return 0.20;
  if (fearGreed <= 30) return 0.10;
  if (fearGreed <= 45) return 0.05;
  return 0;
}

// ── Deterministic forecast ─────────────────────────────────────────────

function buildDeterministicForecast(input: TradingForecastInput): Omit<
  TradingForecast,
  "summary" | "reasoning" | "regime" | "gemini_available"
> {
  const weights = MARKET_DECISION_FACTORS.FORECAST_WEIGHTS;

  const rsiScore = computeRSI(input.hourly_candles);
  const volumeScore = computeVolumeZScore(input.hourly_candles);

  const factor_scores: Record<string, number> = {
    momentum_5m: clamp(input.change_5m_pct / 0.3),
    momentum_1h: clamp(input.change_1h_pct / 0.8),
    momentum_4h: clamp(input.change_4h_pct / 1.8),
    rsi: rsiScore,
    volume: volumeScore,
    sentiment: getSentimentScore(input.fear_greed_index),
    monte_carlo_24h: clamp(
      (input.monte_carlo_probability_up - 0.5) / 0.15,
    ),
  };

  // Weighted composite alpha score.
  let alpha = 0;
  for (const [key, weight] of Object.entries(weights)) {
    alpha += (factor_scores[key] ?? 0) * weight;
  }

  // up_probability kept for paper trading display: alpha → probability space
  const up_probability = clamp(50 + alpha * 35, 15, 85);

  return { alpha, factor_scores, up_probability };
}

// ── Fallback / Gemini narration ────────────────────────────────────────

function fallbackReasoning(input: TradingForecastInput): Pick<
  TradingForecast,
  "summary" | "reasoning" | "regime" | "gemini_available"
> {
  const regime =
    input.volatility_24h_pct >= 4
      ? "high_volatility"
      : Math.abs(input.change_4h_pct) >= 0.6
        ? "trend"
        : "range";
  return {
    regime,
    gemini_available: false,
    summary: `Regime ${regime}; keputusan memakai faktor numerik yang tercatat.`,
    reasoning:
      "Gemini tidak tersedia. Keputusan tetap memakai sinyal numerik deterministik; tidak ada skor atau probabilitas yang dibuat oleh LLM.",
  };
}

/**
 * The numeric model owns scores, alpha, and probability. Gemini is limited to
 * a natural-language regime explanation and can never alter the trade action.
 */
export async function generateTradingForecast(
  input: TradingForecastInput,
): Promise<TradingForecast> {
  const deterministic = buildDeterministicForecast(input);
  const fallback = fallbackReasoning(input);

  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction:
          "You are a market analyst. Explain the supplied deterministic BNB/USDT signal in Bahasa Indonesia. You must not create probabilities, factor scores, position sizes, or a BUY/SELL decision.",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });
      const response = await model.generateContent(
        [
          "Return JSON only with regime (trend, range, or high_volatility), summary (one short sentence), and reasoning (two short sentences).",
          "Describe conflicts and risks in the supplied data. The numeric model, not you, makes the trading decision.",
          JSON.stringify({ snapshot: input, deterministic_model: deterministic }),
        ].join("\n\n"),
        { timeout: 12_000 },
      );
      const result = JSON.parse(response.response.text()) as Partial<
        Pick<TradingForecast, "summary" | "reasoning" | "regime">
      >;
      if (
        (result.regime !== "trend" &&
          result.regime !== "range" &&
          result.regime !== "high_volatility") ||
        typeof result.summary !== "string" ||
        !result.summary.trim() ||
        typeof result.reasoning !== "string" ||
        !result.reasoning.trim()
      ) {
        throw new Error("Gemini returned an invalid regime explanation.");
      }
      return {
        ...deterministic,
        regime: result.regime,
        summary: result.summary.trim(),
        reasoning: result.reasoning.trim(),
        gemini_available: true,
      };
    } catch (error) {
      console.warn(
        `[TradingForecast] ${modelName} explanation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { ...deterministic, ...fallback };
}
