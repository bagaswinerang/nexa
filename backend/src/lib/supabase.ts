/**
 * Supabase client for database operations.
 *
 * Expected table schema (create in Supabase Dashboard):
 *
 * CREATE TABLE transactions (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_address TEXT NOT NULL,
 *   amount NUMERIC NOT NULL,
 *   category TEXT NOT NULL,
 *   note TEXT DEFAULT '',
 *   is_income BOOLEAN NOT NULL DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * -- Optional: enable RLS
 * ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
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
