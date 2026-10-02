import { supabase } from "../lib/supabase.js";
import { MARKET_DECISION_FACTORS } from "../config/trading-rules.js";
import { getMarketData } from "./quant-client.js";
import type { TradingForecastInput } from "./trading-forecast.js";
import { generateEmbedding } from "./embedding.js";

export interface PaperPrediction {
  id: string;
  user_address: string;
  pair: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  gemini_up_probability: number;
  entry_price: number;
  price_5m_ago: number;
  change_5m_pct: number;
  change_24h_pct: number;
  fear_greed_index: number | null;
  fear_greed_label: string | null;
  monte_carlo_probability_up: number;
  monte_carlo_median_price: number;
  gemini_factor_scores: Record<string, number>;
  simulated_notional_usdt: number;
  summary: string;
  reasoning: string;
  settles_at: string;
  settlement_price: number | null;
  actual_return_pct: number | null;
  simulated_pnl_usdt: number | null;
  direction_correct: boolean | null;
  settled_at: string | null;
  predicted_at: string;
  decision_bucket?: string;
  model_version?: string;
}

function isMissingModelSchema(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    /column paper_predictions\.(decision_bucket|model_version) does not exist/i.test(
      error.message || "",
    )
  );
}

export async function recordPaperPrediction(input: {
  userAddress: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  geminiUpProbability: number;
  geminiFactorScores: PaperPrediction["gemini_factor_scores"];
  snapshot: TradingForecastInput;
  summary: string;
  reasoning: string;
}): Promise<string> {
  // Hackathon: bucket per-hour instead of per-day so paper predictions
  // accumulate faster (up to 24/day instead of 1/day).
  const decisionBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const normalizedAddress = input.userAddress.toLowerCase();
  const { data: existing, error: existingError } = await supabase
    .from("paper_predictions")
    .select("id")
    .eq("user_address", normalizedAddress)
    .eq("pair", "BNB/USDT")
    .eq("decision_bucket", decisionBucket)
    .eq("model_version", MARKET_DECISION_FACTORS.MODEL_VERSION)
    .maybeSingle();
  const supportsModelSchema = !existingError || !isMissingModelSchema(existingError);
  if (existingError && supportsModelSchema) {
    throw new Error(
      `Could not check paper prediction bucket: ${existingError.message}`,
    );
  }
  if (existingError) {
    console.warn(
      "[PaperTrading] V2 schema is not installed; recording a legacy paper prediction. Run paper-trading.sql to enable deduplication and calibration.",
    );
  }
  if (existing) return existing.id as string;

  const { hourly_candles: _candles, ...snapshotForEmbedding } = (input.snapshot as unknown as Record<string, unknown>);
  const embeddingText = JSON.stringify({
    type: "paper_prediction",
    pair: "BNB/USDT",
    action: input.action,
    confidence: input.confidence,
    gemini_up_probability: input.geminiUpProbability,
    gemini_factor_scores: input.geminiFactorScores,
    summary: input.summary,
    ...snapshotForEmbedding,
    reasoning: input.reasoning,
  });

  const paperRow = {
    user_address: normalizedAddress,
    pair: "BNB/USDT",
    action: input.action,
    confidence: input.confidence,
    gemini_up_probability: input.geminiUpProbability,
    gemini_factor_scores: input.geminiFactorScores,
    entry_price: input.snapshot.current_price,
    price_5m_ago: input.snapshot.price_5m_ago,
    change_5m_pct: input.snapshot.change_5m_pct,
    change_24h_pct: input.snapshot.change_24h_pct,
    fear_greed_index: input.snapshot.fear_greed_index,
    fear_greed_label: input.snapshot.fear_greed_label,
    monte_carlo_probability_up: input.snapshot.monte_carlo_probability_up,
    monte_carlo_median_price: input.snapshot.monte_carlo_median_price,
    simulated_notional_usdt:
      input.snapshot.current_price *
      MARKET_DECISION_FACTORS.SIZING.PAPER_INITIAL_BNB,
    summary: input.summary,
    reasoning: input.reasoning,
    settles_at: new Date(
      Date.now() +
        MARKET_DECISION_FACTORS.PAPER_HORIZON_HOURS * 60 * 60 * 1000,
    ).toISOString(),
    ...(supportsModelSchema
      ? {
          decision_bucket: decisionBucket,
          model_version: MARKET_DECISION_FACTORS.MODEL_VERSION,
        }
      : {}),
  };
  const { data, error } = await supabase
    .from("paper_predictions")
    .insert(paperRow)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not record paper prediction: ${error?.message || "no row returned"}`,
    );
  }

  const predictionId = data.id as string;
  void generateEmbedding(embeddingText, "RETRIEVAL_DOCUMENT")
    .then(async (embedding) => {
      const { error: embeddingError } = await supabase
        .from("paper_predictions")
        .update({ embedding })
        .eq("id", predictionId);
      if (embeddingError) throw new Error(embeddingError.message);
    })
    .catch((embeddingError) => {
      console.error(
        `[PaperTrading] Prediction ${predictionId} saved; embedding failed: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`,
      );
    });
  return predictionId;
}

export type ProbabilityCalibration = {
  probability: number;
  sample_size: number;
  calibrated: boolean;
};

/**
 * Uses only already-settled predictions from the same model version. Until a
 * bin has enough examples, the model remains explicitly uncalibrated.
 */
export async function calibrateUpProbability(
  rawProbability: number,
): Promise<ProbabilityCalibration> {
  const { CALIBRATION_BIN_HALF_WIDTH_PCT, MIN_CALIBRATION_SAMPLES } =
    MARKET_DECISION_FACTORS.THRESHOLDS;
  const { data, error } = await supabase
    .from("paper_predictions")
    .select("actual_return_pct")
    .eq("pair", "BNB/USDT")
    .eq("model_version", MARKET_DECISION_FACTORS.MODEL_VERSION)
    .not("settled_at", "is", null)
    .not("actual_return_pct", "is", null)
    .gte(
      "gemini_up_probability",
      rawProbability - CALIBRATION_BIN_HALF_WIDTH_PCT,
    )
    .lte(
      "gemini_up_probability",
      rawProbability + CALIBRATION_BIN_HALF_WIDTH_PCT,
    );
  if (error) {
    console.warn(`[PaperTrading] Probability calibration skipped: ${error.message}`);
    return { probability: rawProbability, sample_size: 0, calibrated: false };
  }
  const rows = data || [];
  if (rows.length < MIN_CALIBRATION_SAMPLES) {
    return {
      probability: rawProbability,
      sample_size: rows.length,
      calibrated: false,
    };
  }
  const upCount = rows.filter(
    (row) => Number(row.actual_return_pct) > 0,
  ).length;
  return {
    probability: (upCount / rows.length) * 100,
    sample_size: rows.length,
    calibrated: true,
  };
}

export async function getSettledPaperSampleCount(): Promise<number> {
  const { count, error } = await supabase
    .from("paper_predictions")
    .select("id", { count: "exact", head: true })
    .eq("pair", "BNB/USDT")
    .eq("model_version", MARKET_DECISION_FACTORS.MODEL_VERSION)
    .not("settled_at", "is", null);
  if (error) {
    console.warn(`[PaperTrading] Sample count unavailable: ${error.message}`);
    return 0;
  }
  return count || 0;
}

export async function getPaperPredictions(userAddress: string, limit = 50) {
  const selectColumns =
    "id, user_address, pair, action, confidence, gemini_up_probability, entry_price, price_5m_ago, change_5m_pct, change_24h_pct, fear_greed_index, fear_greed_label, monte_carlo_probability_up, monte_carlo_median_price, gemini_factor_scores, simulated_notional_usdt, summary, reasoning, settles_at, settlement_price, actual_return_pct, simulated_pnl_usdt, direction_correct, settled_at, predicted_at";
  const query = () =>
    supabase
      .from("paper_predictions")
      .select(`${selectColumns}, decision_bucket, model_version`)
      .eq("user_address", userAddress.toLowerCase())
      .order("predicted_at", { ascending: false })
      .limit(limit);
  const primaryResult = await query();
  let data = primaryResult.data as PaperPrediction[] | null;
  let error = primaryResult.error;
  if (error && isMissingModelSchema(error)) {
    const legacyResult = await supabase
      .from("paper_predictions")
      .select(selectColumns)
      .eq("user_address", userAddress.toLowerCase())
      .order("predicted_at", { ascending: false })
      .limit(limit);
    data = legacyResult.data as PaperPrediction[] | null;
    error = legacyResult.error;
  }
  if (error) throw new Error(error.message);
  return data || [];
}

export async function settleDuePaperPredictions(): Promise<void> {
  const { data: pending, error } = await supabase
    .from("paper_predictions")
    .select(
      "id, action, pair, confidence, gemini_up_probability, entry_price, price_5m_ago, change_5m_pct, change_24h_pct, fear_greed_index, monte_carlo_probability_up, monte_carlo_median_price, gemini_factor_scores, simulated_notional_usdt, summary, reasoning",
    )
    .is("settled_at", null)
    .lte("settles_at", new Date().toISOString())
    .limit(100);

  if (error)
    throw new Error(
      `Could not load paper predictions to settle: ${error.message}`,
    );
  if (!pending?.length) return;

  const market = await getMarketData("BNBUSDT");
  const settledAt = new Date().toISOString();
  const feePct = 2 * MARKET_DECISION_FACTORS.SIZING.PAPER_FEE_PER_SIDE_PCT;
  const neutralMovePct =
    MARKET_DECISION_FACTORS.SIZING.PAPER_HOLD_NEUTRAL_MOVE_PCT;

  for (const prediction of pending) {
    const entryPrice = Number(prediction.entry_price);
    const actualReturnPct = ((market.price - entryPrice) / entryPrice) * 100;
    const notional = Number(prediction.simulated_notional_usdt);
    const action = prediction.action as PaperPrediction["action"];
    // BUY holds USDT bought with BNB, so performance is measured in BNB and
    // moves inversely to BNB/USDT. SELL returns the USDT position to BNB.
    const directionalReturnPct =
      action === "BUY"
        ? -actualReturnPct
        : action === "SELL"
          ? actualReturnPct
          : 0;
    const simulatedPnl =
      action === "HOLD"
        ? 0
        : (notional * (directionalReturnPct - feePct)) / 100;
    const directionCorrect =
      action === "BUY"
        ? actualReturnPct < 0
        : action === "SELL"
          ? actualReturnPct > 0
          : Math.abs(actualReturnPct) <= neutralMovePct;

    const settlementText = JSON.stringify({
      type: "paper_prediction_settled",
      ...prediction,
      settlement_price: market.price,
      actual_return_pct: actualReturnPct,
      simulated_pnl_usdt: simulatedPnl,
      direction_correct: directionCorrect,
      settled_at: settledAt,
    });
    let embedding: number[] | undefined;
    try {
      embedding = await generateEmbedding(settlementText, "RETRIEVAL_DOCUMENT");
    } catch (embeddingError) {
      console.error(
        `[PaperTrading] Settlement embedding failed for ${prediction.id}: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`,
      );
    }

    const { error: updateError } = await supabase
      .from("paper_predictions")
      .update({
        settlement_price: market.price,
        actual_return_pct: actualReturnPct,
        simulated_pnl_usdt: simulatedPnl,
        direction_correct: directionCorrect,
        settled_at: settledAt,
        ...(embedding ? { embedding } : {}),
      })
      .eq("id", prediction.id)
      .is("settled_at", null);

    if (updateError) {
      console.error(
        `[PaperTrading] Failed to settle ${prediction.id}: ${updateError.message}`,
      );
    }
  }
}

export function startPaperPredictionSettlementWorker(): void {
  const run = () => {
    void settleDuePaperPredictions().catch((error) => {
      console.error(
        `[PaperTrading] Settlement worker failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  };
  run();
  const timer = setInterval(run, 60_000);
  Reflect.get(Object(timer), "unref")?.call(timer);
}
