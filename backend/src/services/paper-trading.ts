/**
 * Paper Trading Engine — Virtual balance & order execution.
 *
 * Manages a virtual USDT portfolio per wallet address.
 * Supports BUY/SELL with real market prices from Binance,
 * and auto-records every trade to Supabase Finance journal.
 */

import { supabase } from "../lib/supabase.js";
import { getMarketData } from "./quant-client.js";
import { generateEmbedding } from "./embedding.js";
import type { MarketData } from "../types/index.js";

// ─── Types ──────────────────────────────────────────────────────

export interface PaperPortfolio {
  user_address: string;
  usdt_balance: number;
  positions: Record<string, PaperPosition>; // e.g. { "BNBUSDT": { ... } }
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  created_at: string;
}

export interface PaperPosition {
  symbol: string;
  quantity: number;
  avg_entry_price: number;
  current_value: number;
}

export interface TradeOrder {
  action: "BUY" | "SELL";
  symbol: string;
  amount_usdt: number;
  price?: number; // Will be fetched if not provided
  reasoning?: string;
  source: "manual" | "ai_agent";
}

export interface TradeResult {
  success: boolean;
  order_id: string;
  action: "BUY" | "SELL";
  symbol: string;
  price: number;
  quantity: number;
  amount_usdt: number;
  pnl?: number;
  new_balance: number;
  reasoning?: string;
  timestamp: string;
}

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_BALANCE = 10_000; // $10,000 USDT starting capital
const TRADING_FEE_RATE = 0.001; // 0.1% per trade (simulates exchange fee)

// ─── In-Memory Portfolio Store (per wallet) ─────────────────────
// For hackathon simplicity; production would use Supabase table.

const portfolios = new Map<string, PaperPortfolio>();

function getPortfolio(walletAddress: string): PaperPortfolio {
  const addr = walletAddress.toLowerCase();
  if (!portfolios.has(addr)) {
    portfolios.set(addr, {
      user_address: addr,
      usdt_balance: DEFAULT_BALANCE,
      positions: {},
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      total_pnl: 0,
      created_at: new Date().toISOString(),
    });
  }
  return portfolios.get(addr)!;
}

// ─── Core Trading Functions ─────────────────────────────────────

/**
 * Execute a paper trade (BUY or SELL) at current market price.
 */
export async function executePaperTrade(
  walletAddress: string,
  order: TradeOrder
): Promise<TradeResult> {
  const portfolio = getPortfolio(walletAddress);

  // 1. Get live market price
  let price = order.price;
  let marketData: MarketData | null = null;
  if (!price) {
    try {
      marketData = await getMarketData(order.symbol);
      price = marketData.price;
    } catch (err) {
      throw new Error(`Failed to fetch price for ${order.symbol}: ${err}`);
    }
  }

  const fee = order.amount_usdt * TRADING_FEE_RATE;
  const orderId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = new Date().toISOString();

  let result: TradeResult;

  if (order.action === "BUY") {
    // ── BUY Logic ──
    const totalCost = order.amount_usdt + fee;
    if (portfolio.usdt_balance < totalCost) {
      throw new Error(
        `Insufficient balance. Need $${totalCost.toFixed(2)} but have $${portfolio.usdt_balance.toFixed(2)}`
      );
    }

    const quantity = order.amount_usdt / price;
    portfolio.usdt_balance -= totalCost;

    // Update or create position
    const existing = portfolio.positions[order.symbol];
    if (existing) {
      const totalQty = existing.quantity + quantity;
      existing.avg_entry_price =
        (existing.avg_entry_price * existing.quantity + price * quantity) / totalQty;
      existing.quantity = totalQty;
      existing.current_value = totalQty * price;
    } else {
      portfolio.positions[order.symbol] = {
        symbol: order.symbol,
        quantity,
        avg_entry_price: price,
        current_value: quantity * price,
      };
    }

    portfolio.total_trades++;

    result = {
      success: true,
      order_id: orderId,
      action: "BUY",
      symbol: order.symbol,
      price,
      quantity,
      amount_usdt: order.amount_usdt,
      new_balance: portfolio.usdt_balance,
      reasoning: order.reasoning,
      timestamp,
    };
  } else {
    // ── SELL Logic ──
    const position = portfolio.positions[order.symbol];
    if (!position || position.quantity <= 0) {
      throw new Error(`No position in ${order.symbol} to sell.`);
    }

    const quantity = order.amount_usdt / price;
    if (quantity > position.quantity) {
      throw new Error(
        `Cannot sell ${quantity.toFixed(6)} ${order.symbol}. Only hold ${position.quantity.toFixed(6)}.`
      );
    }

    const proceeds = order.amount_usdt - fee;
    const costBasis = position.avg_entry_price * quantity;
    const pnl = proceeds - costBasis;

    portfolio.usdt_balance += proceeds;
    position.quantity -= quantity;
    position.current_value = position.quantity * price;

    if (position.quantity <= 0.0000001) {
      delete portfolio.positions[order.symbol];
    }

    portfolio.total_trades++;
    portfolio.total_pnl += pnl;
    if (pnl >= 0) {
      portfolio.winning_trades++;
    } else {
      portfolio.losing_trades++;
    }

    result = {
      success: true,
      order_id: orderId,
      action: "SELL",
      symbol: order.symbol,
      price,
      quantity,
      amount_usdt: order.amount_usdt,
      pnl,
      new_balance: portfolio.usdt_balance,
      reasoning: order.reasoning,
      timestamp,
    };
  }

  // 3. Auto-journal: record to Supabase transactions table
  await autoRecordTrade(walletAddress, result);

  console.log(
    `[PaperTrading] ${result.action} ${result.quantity.toFixed(6)} ${result.symbol} @ $${result.price.toFixed(2)} | PnL: ${result.pnl !== undefined ? `$${result.pnl.toFixed(2)}` : "N/A"} | Balance: $${result.new_balance.toFixed(2)}`
  );

  return result;
}

/**
 * Get current portfolio status with live position values.
 */
export async function getPortfolioStatus(walletAddress: string): Promise<{
  portfolio: PaperPortfolio;
  total_equity: number;
  unrealized_pnl: number;
}> {
  const portfolio = getPortfolio(walletAddress);
  let unrealizedPnl = 0;

  // Update current values for all positions
  for (const [symbol, pos] of Object.entries(portfolio.positions)) {
    try {
      const market = await getMarketData(symbol);
      pos.current_value = pos.quantity * market.price;
      unrealizedPnl += (market.price - pos.avg_entry_price) * pos.quantity;
    } catch {
      // Keep last known value
    }
  }

  const positionsValue = Object.values(portfolio.positions).reduce(
    (sum, p) => sum + p.current_value,
    0
  );

  return {
    portfolio,
    total_equity: portfolio.usdt_balance + positionsValue,
    unrealized_pnl: unrealizedPnl,
  };
}

/**
 * Reset portfolio to initial state.
 */
export function resetPortfolio(walletAddress: string): PaperPortfolio {
  const addr = walletAddress.toLowerCase();
  portfolios.delete(addr);
  return getPortfolio(addr);
}

// ─── Auto-Journal: Record trade to Supabase ────────────────────

async function autoRecordTrade(
  walletAddress: string,
  result: TradeResult
): Promise<void> {
  try {
    const pairLabel =
      result.symbol.replace("USDT", "") + "/USDT";

    const isProfit = result.pnl !== undefined ? result.pnl >= 0 : true;
    const category =
      result.action === "BUY"
        ? "Deposit" // BUY is capital deployment
        : isProfit
          ? "Trade Profit"
          : "Trade Loss";

    const amount =
      result.action === "SELL" && result.pnl !== undefined
        ? Math.abs(result.pnl)
        : result.amount_usdt;

    const note = [
      `[AI Paper Trade] ${result.action} ${result.quantity.toFixed(6)} ${pairLabel} @ $${result.price.toFixed(2)}`,
      result.reasoning ? `Reason: ${result.reasoning}` : "",
      result.pnl !== undefined ? `PnL: $${result.pnl.toFixed(2)}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    // Generate embedding for RAG searchability
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(
        `${category} ${pairLabel} ${result.action} ${result.reasoning || ""}`
      );
    } catch {
      // Non-blocking
    }

    await supabase.from("transactions").insert({
      user_address: walletAddress.toLowerCase(),
      amount,
      category,
      note,
      is_income: result.action === "SELL" ? isProfit : false,
      pair: pairLabel,
      tx_hash: result.order_id,
      ...(embedding && embedding.length > 0 ? { embedding } : {}),
    });

    console.log(
      `[AutoJournal] 📝 Recorded ${category} $${amount.toFixed(2)} for ${walletAddress}`
    );
  } catch (err) {
    console.error(`[AutoJournal] ❌ Failed to record trade: ${err}`);
  }
}
