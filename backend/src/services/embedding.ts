/**
 * Vector embedding generator and semantic search helper for Nexa transactions.
 * Matches fina-app pgvector and Gemini embedding architecture.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../lib/env.js";
import { supabase } from "../lib/supabase.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

/**
 * Generate 768-dimensional vector embedding for text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    if (!result.embedding?.values) {
      throw new Error("Empty embedding returned");
    }
    return result.embedding.values;
  } catch (error) {
    console.warn("[Embedding] Failed with text-embedding-004, trying fallback:", error);
    try {
      const fallbackModel = genAI.getGenerativeModel({ model: "embedding-001" });
      const fallbackResult = await fallbackModel.embedContent(text);
      return fallbackResult.embedding?.values || [];
    } catch (e) {
      console.error("[Embedding] Error generating embedding:", e);
      return [];
    }
  }
}

/**
 * Perform semantic search over transactions in Supabase using pgvector.
 */
export async function semanticSearchTransactions(
  query: string,
  userAddress?: string,
  limit: number = 10,
  threshold: number = 0.25
) {
  const embedding = await generateEmbedding(query);

  if (!embedding || embedding.length === 0) {
    // Fallback to text search if vector generation fails
    let queryBuilder = supabase
      .from("transactions")
      .select("*")
      .ilike("note", `%${query}%`)
      .limit(limit);

    if (userAddress) {
      queryBuilder = queryBuilder.eq("user_address", userAddress.toLowerCase());
    }

    const { data } = await queryBuilder;
    return data || [];
  }

  // Call Supabase RPC match_transactions (from migrations/schema.sql)
  const { data, error } = await supabase.rpc("match_transactions", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    filter_user: userAddress ? userAddress.toLowerCase() : "",
  });

  if (error) {
    console.warn("[SemanticSearch] RPC error, falling back to text query:", error.message);
    let fallbackBuilder = supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userAddress) {
      fallbackBuilder = fallbackBuilder.eq("user_address", userAddress.toLowerCase());
    }
    const { data: fallbackData } = await fallbackBuilder;
    return fallbackData || [];
  }

  return data || [];
}
