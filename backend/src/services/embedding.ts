/**
 * Vector embedding generator and semantic search helper for Nexa transactions.
 * Matches fina-app pgvector and Gemini embedding architecture.
 */

import { env } from "../lib/env.js";
import { supabase } from "../lib/supabase.js";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

export type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface UserHistorySearchResult {
  id: string;
  record_type: "transaction" | "paper_prediction";
  user_address: string;
  created_at: string;
  content: string;
  tx_hash: string | null;
  similarity: number;
}

export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTask = "RETRIEVAL_DOCUMENT",
): Promise<number[]> {
  if (!text.trim()) throw new Error("Cannot embed empty text.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Gemini embedding request failed (${response.status}): ${await response.text()}`,
    );
  }

  const result = (await response.json()) as {
    embedding?: { values?: number[] };
  };
  const values = result.embedding?.values;
  if (
    !values ||
    values.length !== EMBEDDING_DIMENSIONS ||
    values.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `Gemini returned an invalid embedding; expected ${EMBEDDING_DIMENSIONS} finite dimensions.`,
    );
  }

  const magnitude = Math.sqrt(
    values.reduce((sum, value) => sum + value * value, 0),
  );
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Gemini returned a zero-magnitude embedding.");
  }
  return values.map((value) => value / magnitude);
}

export async function semanticSearchUserHistory(
  query: string,
  userAddress: string,
  limit = 10,
  threshold = 0.25,
): Promise<UserHistorySearchResult[]> {
  const address = userAddress.trim().toLowerCase();
  if (!address)
    throw new Error("A wallet address is required for history search.");
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 10, 50));

  try {
    const queryEmbedding = await generateEmbedding(query, "RETRIEVAL_QUERY");
    const { data, error } = await supabase.rpc("match_user_history", {
      query_embedding: queryEmbedding,
      filter_user: address,
      match_threshold: threshold,
      match_count: safeLimit,
    });
    if (error) throw new Error(error.message);
    return (data || []) as UserHistorySearchResult[];
  } catch (error) {
    console.warn(
      `[SemanticSearch] Vector search failed; using wallet-scoped text search: ${error instanceof Error ? error.message : String(error)}`,
    );
    return searchUserHistoryText(query, address, safeLimit);
  }
}

async function searchUserHistoryText(
  query: string,
  userAddress: string,
  limit: number,
): Promise<UserHistorySearchResult[]> {
  const [transactions, predictions] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, user_address, category, pair, note, tx_hash, amount, created_at",
      )
      .eq("user_address", userAddress)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("paper_predictions")
      .select(
        "id, user_address, pair, action, confidence, gemini_up_probability, entry_price, monte_carlo_probability_up, gemini_factor_scores, simulated_pnl_usdt, direction_correct, summary, reasoning, predicted_at",
      )
      .eq("user_address", userAddress)
      .order("predicted_at", { ascending: false })
      .limit(100),
  ]);

  if (transactions.error) throw new Error(transactions.error.message);
  if (predictions.error) throw new Error(predictions.error.message);

  const candidates: UserHistorySearchResult[] = [
    ...(transactions.data || []).map((row) => ({
      id: row.id,
      record_type: "transaction" as const,
      user_address: row.user_address,
      created_at: row.created_at,
      content: [row.category, row.pair, row.note, `amount=${row.amount}`].join(
        " | ",
      ),
      tx_hash: row.tx_hash || null,
      similarity: 0,
    })),
    ...(predictions.data || []).map((row) => ({
      id: row.id,
      record_type: "paper_prediction" as const,
      user_address: row.user_address,
      created_at: row.predicted_at,
      content: JSON.stringify(row),
      tx_hash: null,
      similarity: 0,
    })),
  ];
  const terms = [
    ...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []),
  ];

  return candidates
    .map((candidate) => ({
      candidate,
      matches: terms.filter((term) =>
        candidate.content.toLowerCase().includes(term),
      ).length,
    }))
    .filter((item) => item.matches > 0)
    .sort(
      (left, right) =>
        right.matches - left.matches ||
        right.candidate.created_at.localeCompare(left.candidate.created_at),
    )
    .slice(0, limit)
    .map((item) => item.candidate);
}
