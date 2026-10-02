/**
 * Deterministic answers for explicit journal requests.
 *
 * A request such as "cek transaksiku kemarin" must not depend on an LLM
 * selecting a function or on an AI provider being available. The chat route
 * uses this small intent handler before Gemini, while all other conversational
 * requests still go through Gemini and its tools.
 */

import { supabase, testSupabaseConnection } from "../lib/supabase.js";
import type { Transaction } from "../types/index.js";

const WALLET_PATTERN = /^0x[a-f0-9]{40}$/;
const JAKARTA_OFFSET = "+07:00";

function isTransactionRequest(message: string) {
  return /\b(transaksi\w*|transaction\w*|riwayat|history|histori|jurnal\w*|journal\w*|trade\s+saya)\b/i.test(
    message,
  );
}

function isDatabaseStatusRequest(message: string) {
  return /\b(db|database|supabase)\b/i.test(message) && /\b(cek|check|status|bisa|can|akses|access|connect|koneksi)\b/i.test(message);
}

function isYesterdayRequest(message: string) {
  return /\b(kemarin|yesterday)\b/i.test(message);
}

function dateInJakarta(offsetDays: number) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    today.find((part) => part.type === type)?.value || "";
  const utcDate = new Date(
    Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day")) + offsetDays),
  );
  return utcDate.toISOString().slice(0, 10);
}

function formatAmount(transaction: Transaction) {
  const sign = transaction.is_income ? "+" : "-";
  return `${sign}${Number(transaction.amount).toLocaleString("id-ID", {
    maximumFractionDigits: 6,
  })} USDT`;
}

function formatTransaction(transaction: Transaction) {
  const timestamp = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(transaction.created_at));
  const note = transaction.note ? ` — ${transaction.note}` : "";
  return `- ${transaction.category} (${transaction.pair || "BNB/USDT"}): ${formatAmount(transaction)} — ${timestamp}${note}`;
}

export async function answerTransactionRequest(
  message: string,
  userAddress?: string,
): Promise<{ reply: string; toolCalls: string[] } | null> {
  if (isDatabaseStatusRequest(message)) {
    const status = await testSupabaseConnection();
    if (!status.connected) {
      throw new Error("DATABASE_UNAVAILABLE");
    }
    return {
      reply: "Bisa. Database jurnal Nexa terhubung dan siap membaca transaksi wallet yang terhubung.",
      toolCalls: ["get_transactions"],
    };
  }

  if (!isTransactionRequest(message)) return null;

  const wallet = userAddress?.trim().toLowerCase() || "";
  if (!WALLET_PATTERN.test(wallet)) {
    return {
      reply:
        "Hubungkan wallet Anda terlebih dahulu agar saya dapat membaca riwayat transaksi wallet tersebut.",
      toolCalls: [],
    };
  }

  let query = supabase
    .from("transactions")
    .select("id, user_address, amount, category, note, is_income, pair, tx_hash, created_at")
    .eq("user_address", wallet)
    .order("created_at", { ascending: false })
    .limit(20);

  let label = "terbaru";
  if (isYesterdayRequest(message)) {
    const yesterday = dateInJakarta(-1);
    const today = dateInJakarta(0);
    query = query
      .gte("created_at", `${yesterday}T00:00:00.000${JAKARTA_OFFSET}`)
      .lt("created_at", `${today}T00:00:00.000${JAKARTA_OFFSET}`);
    label = "kemarin (WIB)";
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Chat DB] transaction lookup failed:", error.message);
    throw new Error("DATABASE_UNAVAILABLE");
  }

  const transactions = (data || []) as Transaction[];
  if (transactions.length === 0) {
    return {
      reply: `Tidak ada transaksi yang tercatat untuk ${label}.`,
      toolCalls: ["get_transactions"],
    };
  }

  const totalIn = transactions
    .filter((transaction) => transaction.is_income)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalOut = transactions
    .filter((transaction) => !transaction.is_income)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  return {
    reply: `Saya menemukan ${transactions.length} transaksi ${label}. Masuk: +${totalIn.toLocaleString("id-ID", { maximumFractionDigits: 6 })} USDT; keluar: -${totalOut.toLocaleString("id-ID", { maximumFractionDigits: 6 })} USDT.\n\n${transactions
      .slice(0, 10)
      .map(formatTransaction)
      .join("\n")}`,
    toolCalls: ["get_transactions"],
  };
}
