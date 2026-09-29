import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";
import { generateEmbedding } from "../services/embedding.js";
import type { CreateTransactionBody } from "../types/index.js";

const transactions = new Hono();

// GET /transactions?user_address=0x...&limit=50
transactions.get("/", async (c) => {
  const userAddress = c.req.query("user_address");
  const limit = parseInt(c.req.query("limit") || "50", 10);

  if (!userAddress) {
    return c.json({ error: "user_address query parameter is required" }, 400);
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_address", userAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[Supabase] ❌ Error fetching transactions: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }

  console.log(`[Supabase] 📥 GET /transactions for ${userAddress} → returned ${data?.length ?? 0} records`);
  return c.json({ transactions: data });
});

// POST /transactions
transactions.post("/", async (c) => {
  try {
    const body = await c.req.json<CreateTransactionBody>();

    if (!body.user_address || !body.amount || !body.category) {
      return c.json(
        { error: "user_address, amount, and category are required" },
        400
      );
    }

    // Optional vector embedding for semantic search
    let embedding: number[] | null = null;
    try {
      const textToEmbed = `${body.category} ${body.pair || ""} ${body.note || ""}`.trim();
      if (textToEmbed) {
        embedding = await generateEmbedding(textToEmbed);
      }
    } catch {
      // Non-blocking fallback
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_address: body.user_address.toLowerCase(),
        amount: body.amount,
        category: body.category,
        note: body.note || "",
        is_income: body.is_income ?? false,
        pair: body.pair || "BNB/USDT",
        tx_hash: body.tx_hash || "",
        ...(embedding && embedding.length > 0 ? { embedding } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error(`[Supabase] ❌ Error inserting transaction: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    console.log(
      `[Supabase] 💾 INSERT transaction [${body.category} $${body.amount} USDT (${body.pair || "BNB/USDT"})] for ${body.user_address}`
    );
    return c.json({ transaction: data }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create transaction";
    console.error(`[Supabase] ❌ Exception creating transaction: ${message}`);
    return c.json({ error: message }, 500);
  }
});

// DELETE /transactions/:id
transactions.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(`[Supabase] ❌ Error deleting transaction ${id}: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }

  console.log(`[Supabase] 🗑️ DELETE transaction ${id} successful`);
  return c.json({ success: true });
});

// GET /transactions/summary?user_address=0x...
transactions.get("/summary", async (c) => {
  const userAddress = c.req.query("user_address");

  if (!userAddress) {
    return c.json({ error: "user_address query parameter is required" }, 400);
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, is_income, category, pair")
    .eq("user_address", userAddress.toLowerCase());

  if (error) {
    console.error(`[Supabase] ❌ Error fetching summary: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }

  const summary = (data || []).reduce(
    (acc, tx) => {
      const amount = Number(tx.amount) || 0;
      const cat = (tx.category || "").toLowerCase();

      if (cat === "deposit") {
        acc.total_deposit += amount;
      } else if (cat === "withdrawal") {
        acc.total_withdrawal += amount;
      } else if (cat === "trade profit" || (tx.is_income && cat !== "deposit")) {
        acc.total_profit += amount;
        acc.winning_trades++;
      } else if (cat === "trade loss" || (!tx.is_income && cat !== "withdrawal")) {
        acc.total_loss += amount;
        acc.losing_trades++;
      }

      // Backward compatible fields
      if (tx.is_income) {
        acc.total_income += amount;
      } else {
        acc.total_expense += amount;
      }
      acc.total_entries++;
      return acc;
    },
    {
      total_deposit: 0,
      total_withdrawal: 0,
      total_profit: 0,
      total_loss: 0,
      net_pnl: 0,
      active_balance: 0,
      winning_trades: 0,
      losing_trades: 0,
      win_rate: 0,
      total_income: 0,
      total_expense: 0,
      total_entries: 0,
      balance: 0,
    }
  );

  summary.net_pnl = summary.total_profit - summary.total_loss;
  summary.active_balance = (summary.total_deposit - summary.total_withdrawal) + summary.net_pnl;
  const totalClosedTrades = summary.winning_trades + summary.losing_trades;
  summary.win_rate = totalClosedTrades > 0 ? (summary.winning_trades / totalClosedTrades) * 100 : 0;
  summary.balance = summary.total_income - summary.total_expense;

  return c.json(summary);
});

export default transactions;
