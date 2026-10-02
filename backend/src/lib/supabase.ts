/**
 * Supabase client for database operations.
 *
 * Run backend/migrations/schema.sql first, then semantic-search.sql for pgvector.
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

/**
 * Ping and verify active connection to Supabase database.
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  count?: number;
}> {
  try {
    const { data, error, count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true });

    if (error) {
      return { connected: false, error: error.message };
    }
    return { connected: true, count: count ?? 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { connected: false, error: msg };
  }
}
