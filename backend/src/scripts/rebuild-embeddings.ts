import { supabase } from "../lib/supabase.js";
import { generateEmbedding } from "../services/embedding.js";

const PAGE_SIZE = 25;

async function rebuildTransactions(): Promise<number> {
  let offset = 0;
  let updated = 0;
  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, user_address, amount, category, note, is_income, pair, tx_hash, created_at",
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load transactions: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      const text = JSON.stringify({
        type: "transaction",
        user_address: row.user_address,
        amount: row.amount,
        category: row.category,
        pair: row.pair,
        note: row.note,
        is_income: row.is_income,
        tx_hash: row.tx_hash,
        created_at: row.created_at,
      });
      const embedding = await generateEmbedding(text, "RETRIEVAL_DOCUMENT");
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ embedding })
        .eq("id", row.id);
      if (updateError)
        throw new Error(
          `Could not update transaction ${row.id}: ${updateError.message}`,
        );
      updated++;
    }

    console.log(`[EmbeddingBackfill] Transactions: ${updated}`);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
  return updated;
}

async function rebuildPaperPredictions(): Promise<number> {
  let offset = 0;
  let updated = 0;
  while (true) {
    const { data, error } = await supabase
      .from("paper_predictions")
      .select(
        "id, user_address, pair, action, confidence, gemini_up_probability, entry_price, price_5m_ago, change_5m_pct, change_24h_pct, fear_greed_index, fear_greed_label, monte_carlo_probability_up, monte_carlo_median_price, gemini_factor_scores, simulated_notional_usdt, summary, reasoning, settles_at, settlement_price, actual_return_pct, simulated_pnl_usdt, direction_correct, settled_at, predicted_at",
      )
      .order("predicted_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error)
      throw new Error(`Could not load paper predictions: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      const embedding = await generateEmbedding(
        JSON.stringify({ type: "paper_prediction", ...row }),
        "RETRIEVAL_DOCUMENT",
      );
      const { error: updateError } = await supabase
        .from("paper_predictions")
        .update({ embedding })
        .eq("id", row.id);
      if (updateError)
        throw new Error(
          `Could not update paper prediction ${row.id}: ${updateError.message}`,
        );
      updated++;
    }

    console.log(`[EmbeddingBackfill] Paper predictions: ${updated}`);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
  return updated;
}

try {
  const transactionCount = await rebuildTransactions();
  const paperCount = await rebuildPaperPredictions();
  console.log(
    `[EmbeddingBackfill] Complete: ${transactionCount} transactions and ${paperCount} paper predictions rebuilt.`,
  );
} catch (error) {
  console.error(
    `[EmbeddingBackfill] Failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
