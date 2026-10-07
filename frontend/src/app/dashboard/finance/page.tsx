"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import ConnectWallet from "@/components/layout/connect-wallet";
import QuantStat from "@/components/ui/quant-stat";
import {
  getTransactions,
  getPaperPredictions,
  createTransaction,
  deleteTransaction,
  type PaperPrediction,
  type Transaction,
} from "@/lib/api";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
  ExternalLink,
  CheckCircle2,
  Clock,
  Search,
  ArrowDownLeft,
  Coins,
  Percent,
  Database,
  RefreshCw,
} from "lucide-react";
import { env } from "@/lib/env";
import { uiCopy } from "@/lib/i18n";
import { useLanguage } from "@/components/layout/language-provider";

const CATEGORIES = [
  "Trade Profit",
  "Trade Loss",
  "Deposit",
  "Withdrawal",
  "Trading Fee",
  "Staking Yield",
];

const COMMON_PAIRS = ["BNB/USDT", "BTC/USDT", "ETH/USDT", "SOL/USDT", "USDT"];

export default function FinancePage() {
  const { language, t } = useLanguage();
  const copy = uiCopy[language];
  const { isConnected, address } = useAccount();
  const targetWallet = address ? address.toLowerCase() : "";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [paperPredictions, setPaperPredictions] = useState<PaperPrediction[]>(
    [],
  );
  const [paperError, setPaperError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<
    "all" | "trades" | "deposit" | "withdrawal"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(
    null,
  );

  const [newTx, setNewTx] = useState({
    category: "Trade Profit",
    amount: "",
    pair: "BNB/USDT",
    note: "",
    is_income: true,
  });

  // Fetch real data from Supabase via backend API
  const fetchLedger = async (showLoading = true) => {
    if (!targetWallet) {
      setTransactions([]);
      setPaperPredictions([]);
      setPaperError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      setSupabaseConnected(true);
      return;
    }
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    try {
      let predictionFetchFailed = false;
      const [res, paperResult] = await Promise.all([
        getTransactions(targetWallet, 100),
        getPaperPredictions(targetWallet, 100).catch((error) => {
          predictionFetchFailed = true;
          console.error("Could not fetch paper predictions:", error);
          return { predictions: [] as PaperPrediction[] };
        }),
      ]);
      setSupabaseConnected(true);
      setPaperPredictions(paperResult.predictions);
      setPaperError(
        predictionFetchFailed
          ? "Jalankan backend/migrations/paper-trading.sql di Supabase untuk mengaktifkan evaluasi model."
          : null,
      );
      if (res.transactions) {
        setTransactions(
          res.transactions.map((t) => ({
            ...t,
            hash: t.tx_hash || "",
          })),
        );
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error("Could not fetch Supabase transactions:", err);
      setSupabaseConnected(false);
      setTransactions([]);
      setPaperPredictions([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLedger(true);
  }, [targetWallet]);

  // Calculate Trading Specific Metrics
  const totalDeposit = transactions
    .filter((t) => t.category === "Deposit")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalWithdrawal = transactions
    .filter((t) => t.category === "Withdrawal")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalProfits = transactions
    .filter(
      (t) => t.category === "Trade Profit" || t.category === "Staking Yield",
    )
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalLosses = transactions
    .filter((t) => t.category === "Trade Loss" || t.category === "Trading Fee")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const settledPaper = paperPredictions.filter(
    (prediction) => prediction.settled_at,
  );
  const settledPaperTrades = settledPaper.filter(
    (prediction) => prediction.action !== "HOLD",
  );
  const paperNetPnl = settledPaperTrades.reduce((sum, prediction) => {
    const isManual =
      prediction.model_version === "manual" ||
      prediction.summary?.startsWith("[Manual Swap]");
    const hasPrices =
      prediction.settlement_price !== null && prediction.entry_price !== null;
    const priceDiff = hasPrices
      ? Number(
          (
            Number(prediction.settlement_price) - Number(prediction.entry_price)
          ).toFixed(2),
        )
      : 0;
    const pnl = !hasPrices
      ? Number(prediction.simulated_pnl_usdt) || 0
      : isManual
        ? priceDiff
        : prediction.action === "SELL"
          ? -priceDiff
          : priceDiff;
    return sum + pnl;
  }, 0);
  const paperTradeAccuracy = settledPaperTrades.length
    ? (settledPaperTrades.filter((prediction) => prediction.direction_correct)
        .length /
        settledPaperTrades.length) *
      100
    : null;
  const paperTradeCoverage = settledPaper.length
    ? (settledPaperTrades.length / settledPaper.length) * 100
    : null;

  const netPnL = totalProfits - totalLosses;
  const activeBalance = totalDeposit - totalWithdrawal + netPnL;

  const winCount = transactions.filter(
    (t) => t.category === "Trade Profit",
  ).length;
  const lossCount = transactions.filter(
    (t) => t.category === "Trade Loss",
  ).length;
  const totalTrades = winCount + lossCount;
  const winRate =
    totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(1) : "0.0";

  const handleAdd = async () => {
    if (!newTx.amount || !newTx.category) return;
    const randomHex =
      "0x" +
      Math.random().toString(16).slice(2, 6) +
      "..." +
      Math.random().toString(16).slice(2, 6);

    // Automatically set is_income based on trading category
    const isIncome =
      newTx.category === "Trade Profit" ||
      newTx.category === "Deposit" ||
      newTx.category === "Staking Yield";

    const optimisticTx = {
      id: `tx-${Date.now()}`,
      user_address: targetWallet,
      category: newTx.category,
      amount: parseFloat(newTx.amount),
      is_income: isIncome,
      pair: newTx.pair || "BNB/USDT",
      note: newTx.note || `${newTx.category} Execution`,
      hash: randomHex,
      tx_hash: randomHex,
      created_at: new Date().toISOString(),
    };

    setTransactions([optimisticTx, ...transactions]);
    setShowAddModal(false);

    // Save to Supabase backend
    if (targetWallet) {
      try {
        const res = await createTransaction({
          user_address: targetWallet,
          amount: parseFloat(newTx.amount),
          category: newTx.category,
          note: newTx.note || `${newTx.category} Execution`,
          is_income: isIncome,
          pair: newTx.pair || "BNB/USDT",
          tx_hash: randomHex,
        });

        if (res.transaction) {
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === optimisticTx.id
                ? { ...res.transaction, hash: randomHex }
                : t,
            ),
          );
        }
      } catch (err) {
        console.error("Failed to persist to Supabase:", err);
      }
    }

    setNewTx({
      category: "Trade Profit",
      amount: "",
      pair: "BNB/USDT",
      note: "",
      is_income: true,
    });
  };

  const handleDelete = async (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
    if (targetWallet && !id.startsWith("tx-")) {
      try {
        await deleteTransaction(id);
      } catch (err) {
        console.error("Failed to delete from Supabase:", err);
      }
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    let matchesFilter = true;
    if (filterType === "trades") {
      matchesFilter =
        tx.category === "Trade Profit" || tx.category === "Trade Loss";
    } else if (filterType === "deposit") {
      matchesFilter = tx.category === "Deposit";
    } else if (filterType === "withdrawal") {
      matchesFilter = tx.category === "Withdrawal";
    }

    const matchesSearch =
      tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.pair && tx.pair.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-[#26A17B]/15 text-[#00D492] font-semibold border border-[#26A17B]/30">
              {t("institutionalLedger")}
            </span>

            {/* Supabase Real-time Connection Indicator */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border transition-all ${
                supabaseConnected
                  ? "bg-[#26A17B]/15 text-[#00D492] border-[#26A17B]/30"
                  : supabaseConnected === false
                    ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    : "bg-white/5 text-gray-400 border-white/10"
              }`}
            >
              <Database className="w-3 h-3" />
              <span
                className={`w-1.5 h-1.5 rounded-full ${supabaseConnected ? "bg-[#00D492] animate-pulse" : "bg-gray-500"}`}
              />
              {supabaseConnected
                ? t("supabaseConnectedRecords", { count: transactions.length })
                : t("connectingSupabase")}
            </span>

            <button
              onClick={() => fetchLedger(false)}
              disabled={isRefreshing}
              className="p-1 px-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-mono flex items-center gap-1 border border-white/5"
              title={t("sync")}
            >
              <RefreshCw
                className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[#00D492]" : ""}`}
              />
              <span>{t("sync")}</span>
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t("tradingJournalTitle")}
          </h1>
          <p className="text-xs sm:text-sm text-gray-400">
            {t("tradingJournalSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <ConnectWallet />
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#26A17B] text-black text-xs sm:text-sm font-bold hover:bg-[#00D492] transition-all flex items-center gap-2 shadow-lg shadow-[#26A17B]/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> {t("recordTradeCapital")}
          </button>
        </div>
      </div>

      {/* KPI Stats (Quant Trading Architecture) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuantStat
          title={t("netRealizedPnL")}
          value={`${netPnL >= 0 ? "+" : ""}$${netPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={`${winRate}% ${t("winRate")} (${winCount}W / ${lossCount}L)`}
          isPositive={netPnL >= 0}
          sublabel={t("winRateClosed")}
          icon={<TrendingUp className="w-4 h-4" />}
          tag={t("realized")}
        />
        <QuantStat
          title={t("activeTradingEquity")}
          value={`$${activeBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change="(Dep - Wd) + PnL"
          isPositive={activeBalance >= 0}
          sublabel={t("bscProof")}
          icon={<Wallet className="w-4 h-4" />}
          tag={t("capital")}
        />
        <QuantStat
          title={t("totalDeposited")}
          value={`$${totalDeposit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={language === "id" ? "Arus Masuk" : "Capital Inflow"}
          isPositive={true}
          sublabel={language === "id" ? "Margin Trading" : "Trading Margin"}
          icon={<ArrowDownLeft className="w-4 h-4" />}
          tag={t("depositCategory")}
        />
        <QuantStat
          title={t("totalWithdrawn")}
          value={`$${totalWithdrawal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={language === "id" ? "Realisasi Profit" : "Profit Realized"}
          isPositive={false}
          sublabel={language === "id" ? "Ke Cold Storage" : "To Cold Storage"}
          icon={<ArrowUpRight className="w-4 h-4" />}
          tag={t("withdrawalCategory")}
        />
      </div>

      {/* Transactions Table Section */}
      <div className="glass-card p-4 sm:p-6 border border-[#1E2738]">
        {/* Table Controls / Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white">
              {t("journalHistory")}
            </h2>
            <span className="text-xs font-mono text-gray-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
              {filteredTransactions.length} entries
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#080B11] border border-[#1E2738] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#26A17B]/60 transition-all font-mono"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-[#080B11] p-1 rounded-xl border border-[#1E2738] text-xs font-mono overflow-x-auto max-w-full">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  filterType === "all"
                    ? "bg-[#26A17B] text-black font-bold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t("filterAll")}
              </button>
              <button
                onClick={() => setFilterType("trades")}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  filterType === "trades"
                    ? "bg-[#00D492]/20 text-[#00D492] font-semibold border border-[#00D492]/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t("filterTrades")} (PnL)
              </button>
              <button
                onClick={() => setFilterType("deposit")}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  filterType === "deposit"
                    ? "bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t("filterDeposit")}
              </button>
              <button
                onClick={() => setFilterType("withdrawal")}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  filterType === "withdrawal"
                    ? "bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t("filterWithdrawal")}
              </button>
            </div>
          </div>
        </div>

        {/* Ledger — Mobile Cards + Desktop Table */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-gray-500 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#00D492]" />
            <span className="text-xs font-mono text-gray-400">
              {language === "id"
                ? "Menyinkronkan transaksi dengan database Supabase..."
                : "Synchronizing records with Supabase database..."}
            </span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-gray-500 gap-2">
            <Database className="w-8 h-8 text-gray-600 mb-1" />
            <span className="text-sm font-medium text-gray-300">
              {copy.noTransactions}
            </span>
            <span className="text-xs font-mono text-gray-500">
              {copy.recordTransaction}
            </span>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filteredTransactions.map((tx) => {
                const isGain =
                  tx.category === "Trade Profit" ||
                  tx.category === "Staking Yield";
                const isLoss = tx.category === "Trade Loss";
                const isDep = tx.category === "Deposit";
                const isWd = tx.category === "Withdrawal";
                const isLiveTrade = tx.category === "Live Trade";

                const categoryDisplay =
                  tx.category === "Trade Profit"
                    ? t("tradeProfitCategory")
                    : tx.category === "Trade Loss"
                      ? t("tradeLossCategory")
                      : tx.category === "Deposit"
                        ? t("depositCategory")
                        : tx.category === "Withdrawal"
                          ? t("withdrawalCategory")
                          : tx.category === "Trading Fee"
                            ? t("tradingFeeCategory")
                            : tx.category === "Staking Yield"
                              ? t("stakingYieldCategory")
                              : tx.category;

                const cleanNote = String(tx.note || "")
                  .replace(/^\[PancakeSwap On-Chain\]\s*/, "")
                  .replace(/\s*[—-]\s*Ditukar\s*/, " · ")
                  .replace(/\s*\.\s*Reasoning:[\s\S]*$/, "")
                  .replace(/\s+menjadi\s+/, " → ")
                  .replace(/\bBNBUSDT\b/g, "BNB/USDT");
                const hasValidTxHash = /^0x[a-fA-F0-9]{64}$/.test(tx.hash);
                const explorerBase = String(tx.pair || "").startsWith("t")
                  ? "https://testnet.bscscan.com"
                  : "https://bscscan.com";

                return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-xl bg-[#080B11] border border-white/5 space-y-3"
                  >
                    {/* Top: Icon + Note + Amount */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isGain
                              ? "bg-[#00D492]/10 border-[#00D492]/30 text-[#00D492]"
                              : isLoss
                                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                : isDep
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          }`}
                        >
                          {isGain && (
                            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                          )}
                          {isLoss && (
                            <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                          )}
                          {isDep && (
                            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                          )}
                          {isWd && (
                            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                          )}
                          {!isGain && !isLoss && !isDep && !isWd && (
                            <Coins className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-white truncate">
                            {cleanNote}
                          </div>
                          <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            {new Date(tx.created_at).toLocaleDateString(
                              language === "id" ? "id-ID" : "en-US",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-bold text-sm ${
                            isGain || isDep
                              ? "text-[#00D492]"
                              : isLiveTrade
                                ? "text-gray-300"
                                : "text-rose-400"
                          }`}
                        >
                          {isLiveTrade ? "" : isGain || isDep ? "+" : "-"}$
                          {tx.amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Badges + Hash + Delete */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-mono text-[10px] text-[#00D492] font-semibold bg-[#26A17B]/10 px-1.5 py-0.5 rounded border border-[#26A17B]/20 shrink-0">
                          {tx.pair || "BNB/USDT"}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono border shrink-0 ${
                            isGain
                              ? "bg-[#00D492]/10 text-[#00D492] border-[#00D492]/30"
                              : isLoss
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : isDep
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {categoryDisplay}
                        </span>
                        {hasValidTxHash && (
                          <a
                            href={`${explorerBase}/tx/${tx.hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[10px] text-gray-500 hover:text-[#00D492] transition-colors"
                          >
                            {`${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}`}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
                        title={t("delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] font-mono uppercase text-gray-500 tracking-wider">
                    <th className="pb-3 pl-2 w-[30%]">{t("colStrategyNote")}</th>
                    <th className="pb-3 w-[10%]">{t("pairLabel")}</th>
                    <th className="pb-3 w-[12%]">{t("categoryLabel")}</th>
                    <th className="pb-3 w-[20%]">{t("colProofHash")}</th>
                    <th className="pb-3 text-right w-[18%]">{t("colAmount")}</th>
                    <th className="pb-3 text-right pr-2 w-[10%]">
                      {t("colActions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filteredTransactions.map((tx) => {
                    const isGain =
                      tx.category === "Trade Profit" ||
                      tx.category === "Staking Yield";
                    const isLoss = tx.category === "Trade Loss";
                    const isDep = tx.category === "Deposit";
                    const isWd = tx.category === "Withdrawal";
                    const isLiveTrade = tx.category === "Live Trade";

                    const categoryDisplay =
                      tx.category === "Trade Profit"
                        ? t("tradeProfitCategory")
                        : tx.category === "Trade Loss"
                          ? t("tradeLossCategory")
                          : tx.category === "Deposit"
                            ? t("depositCategory")
                            : tx.category === "Withdrawal"
                              ? t("withdrawalCategory")
                              : tx.category === "Trading Fee"
                                ? t("tradingFeeCategory")
                                : tx.category === "Staking Yield"
                                  ? t("stakingYieldCategory")
                                  : tx.category;

                    const cleanNote = String(tx.note || "")
                      .replace(/^\[PancakeSwap On-Chain\]\s*/, "")
                      .replace(/\s*[—-]\s*Ditukar\s*/, " · ")
                      .replace(/\s*\.\s*Reasoning:[\s\S]*$/, "")
                      .replace(/\s+menjadi\s+/, " → ")
                      .replace(/\bBNBUSDT\b/g, "BNB/USDT");
                    const hasValidTxHash = /^0x[a-fA-F0-9]{64}$/.test(tx.hash);
                    const explorerBase = String(tx.pair || "").startsWith("t")
                      ? "https://testnet.bscscan.com"
                      : "https://bscscan.com";

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Type & Note */}
                        <td className="py-4 pl-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                isGain
                                  ? "bg-[#00D492]/10 border-[#00D492]/30 text-[#00D492]"
                                  : isLoss
                                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                    : isDep
                                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              }`}
                            >
                              {isGain && (
                                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                              )}
                              {isLoss && (
                                <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                              )}
                              {isDep && (
                                <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                              )}
                              {isWd && (
                                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                              )}
                              {!isGain && !isLoss && !isDep && !isWd && (
                                <Coins className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-white truncate">
                                {cleanNote}
                              </div>
                              <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 mt-0.5">
                                <Clock className="w-3 h-3 shrink-0" />
                                {new Date(tx.created_at).toLocaleDateString(
                                  language === "id" ? "id-ID" : "en-US",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Pair */}
                        <td className="py-4">
                          <span className="font-mono text-xs text-[#00D492] font-semibold bg-[#26A17B]/10 px-2 py-0.5 rounded border border-[#26A17B]/20">
                            {tx.pair || "BNB/USDT"}
                          </span>
                        </td>

                        {/* Category Badge */}
                        <td className="py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border whitespace-nowrap ${
                              isGain
                                ? "bg-[#00D492]/10 text-[#00D492] border-[#00D492]/30"
                                : isLoss
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                  : isDep
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {categoryDisplay}
                          </span>
                        </td>

                        {/* BSC On-Chain Proof */}
                        <td className="py-4">
                          {hasValidTxHash ? (
                            <a
                              href={`${explorerBase}/tx/${tx.hash}`}
                              target="_blank"
                              rel="noreferrer"
                              title={tx.hash}
                              className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-400 hover:text-[#00D492] transition-colors"
                            >
                              <span>{`${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}`}</span>
                              <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-[#00D492]" />
                            </a>
                          ) : (
                            <span className="font-mono text-xs text-gray-600">
                              —
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-4 text-right">
                          <div
                            className={`font-mono font-bold text-base ${
                              isGain || isDep
                                ? "text-[#00D492]"
                                : isLiveTrade
                                  ? "text-gray-300"
                                  : "text-rose-400"
                            }`}
                          >
                            {isLiveTrade ? "" : isGain || isDep ? "+" : "-"}$
                            {tx.amount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-[10px] font-mono text-gray-500">
                            {isLiveTrade
                              ? language === "id"
                                ? "Swap on-chain · bukan PnL"
                                : "On-chain swap · not PnL"
                              : tx.category === "Deposit"
                                ? language === "id"
                                  ? "Modal Masuk"
                                  : "Capital In"
                                : tx.category === "Withdrawal"
                                  ? language === "id"
                                    ? "Modal Keluar"
                                    : "Capital Out"
                                  : categoryDisplay}
                          </div>
                        </td>

                        {/* Delete Action */}
                        <td className="py-4 text-right pr-2">
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-40 group-hover:opacity-100 transition-all"
                            title={t("delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <section className="glass-card p-4 sm:p-6 border border-[#1E2738]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Evaluasi Model · Paper Trading
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Prediksi BNB/USDT dibandingkan dengan harga Binance setelah 24
              jam; tidak ada dana on-chain yang dihitung.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <span className="text-gray-400">
              Selesai <b className="text-white">{settledPaper.length}</b>
            </span>

            <span className="text-gray-400">
              Trade{" "}
              <b className="text-white">
                {paperTradeCoverage !== null
                  ? `${settledPaperTrades.length} (${paperTradeCoverage.toFixed(1)}%)`
                  : "—"}
              </b>
            </span>
            <span className="text-gray-400">
              Akurasi trade{" "}
              <b className="text-white">
                {paperTradeAccuracy !== null
                  ? `${paperTradeAccuracy.toFixed(1)}%`
                  : "—"}
              </b>
            </span>
            <span className="text-gray-400">
              PnL simulasi{" "}
              <b
                className={
                  paperNetPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                {paperNetPnl >= 0 ? "+" : ""}${paperNetPnl.toFixed(2)}
              </b>
            </span>
          </div>
        </div>
        {paperError && (
          <p className="text-xs text-amber-400 mb-3">{paperError}</p>
        )}
        {paperPredictions.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-500">
            Belum ada prediksi tersimpan.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] text-left">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-mono uppercase text-gray-500">
                  <th className="py-2">Waktu</th>
                  <th>Prediksi</th>
                  <th>Peluang model</th>
                  <th>Skor faktor model</th>
                  <th>MC naik 24h</th>
                  <th>5m Δ</th>
                  <th>Fear & Greed</th>
                  <th>BNB/USDT</th>
                  <th>Hasil</th>
                  <th className="text-right">PnL simulasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {paperPredictions.map((prediction) => {
                  const pending = !prediction.settled_at;
                  const isManual =
                    prediction.model_version === "manual" ||
                    prediction.summary?.startsWith("[Manual Swap]");

                  // Selisih harga aktual: settlement_price - entry_price
                  const hasPrices =
                    prediction.settlement_price !== null &&
                    prediction.entry_price !== null;
                  const priceDiff = hasPrices
                    ? Number(
                        (
                          Number(prediction.settlement_price) -
                          Number(prediction.entry_price)
                        ).toFixed(2),
                      )
                    : 0;

                  // PnL adalah selisih harga langsung:
                  // - BUY: untung jika harga naik (+priceDiff)
                  // - HOLD: untung jika aset naik (+priceDiff)
                  // - SELL (AI): jika harga naik maka minus (-priceDiff), jika harga turun maka untung (-priceDiff)
                  // - SELL (Manual): untung jika harga jual lebih tinggi (+priceDiff)
                  const pnl = !hasPrices
                    ? Number(prediction.simulated_pnl_usdt) || 0
                    : isManual
                      ? priceDiff
                      : prediction.action === "SELL"
                        ? -priceDiff
                        : priceDiff;

                  const isCorrect =
                    isManual
                      ? priceDiff >= 0
                      : prediction.action === "BUY"
                        ? priceDiff > 0
                        : prediction.action === "SELL"
                          ? priceDiff < 0
                          : priceDiff >= 0;

                  const result = pending
                    ? "Pending"
                    : isManual
                      ? prediction.action === "SELL"
                        ? isCorrect
                          ? "SELL tepat"
                          : "SELL meleset"
                        : isCorrect
                          ? "BUY tepat"
                          : "BUY meleset"
                      : prediction.action === "HOLD"
                        ? isCorrect
                          ? "HOLD tepat"
                          : "HOLD meleset"
                        : prediction.action === "BUY"
                          ? isCorrect
                            ? "BUY tepat"
                            : "BUY meleset"
                          : isCorrect
                            ? "SELL tepat"
                            : "SELL meleset";
                  return (
                    <tr key={prediction.id} className="text-xs">
                      <td className="py-3 font-mono text-gray-400">
                        {new Date(prediction.predicted_at).toLocaleString(
                          language === "id" ? "id-ID" : "en-US",
                        )}
                      </td>
                      <td
                        className={`font-bold ${prediction.action === "BUY" ? "text-emerald-400" : prediction.action === "SELL" ? "text-rose-400" : "text-gray-300"}`}
                      >
                        {isManual ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 uppercase">
                              Manual
                            </span>
                            <span>{prediction.action}</span>
                          </span>
                        ) : (
                          <>
                            {prediction.action}{" "}
                            <span className="font-normal text-gray-500">
                              · {Number(prediction.confidence).toFixed(1)}%
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        {Number(prediction.gemini_up_probability).toFixed(1)}%
                      </td>
                      <td className="font-mono text-[10px] text-gray-400 whitespace-nowrap">
                        {prediction.gemini_factor_scores?.momentum_5m !==
                        undefined
                          ? `5m ${prediction.gemini_factor_scores.momentum_5m.toFixed(2)} · RSI ${prediction.gemini_factor_scores.rsi?.toFixed(2) ?? "—"} · Vol ${prediction.gemini_factor_scores.volume?.toFixed(2) ?? "—"} · F&G ${prediction.gemini_factor_scores.sentiment?.toFixed(2) ?? "—"} · MC ${prediction.gemini_factor_scores.monte_carlo_24h?.toFixed(2) ?? "—"}`
                          : "Skor historis tidak tersedia"}
                      </td>
                      <td>
                        {(
                          Number(prediction.monte_carlo_probability_up) * 100
                        ).toFixed(1)}
                        %
                      </td>
                      <td>{Number(prediction.change_5m_pct).toFixed(3)}%</td>
                      <td>
                        {prediction.fear_greed_index === null
                          ? "—"
                          : `${prediction.fear_greed_index} · ${prediction.fear_greed_label || ""}`}
                      </td>
                      <td className="font-mono text-gray-400">
                        ${Number(prediction.entry_price).toFixed(2)}
                        {prediction.settlement_price !== null &&
                          ` → $${Number(prediction.settlement_price).toFixed(2)}`}
                      </td>
                      <td
                        className={
                          pending
                            ? "text-amber-400"
                            : isManual
                              ? "text-cyan-400 font-medium"
                              : isCorrect
                                ? "text-emerald-400 font-medium"
                                : "text-rose-400 font-medium"
                        }
                      >
                        {result}
                      </td>
                      <td
                        className={`text-right font-mono ${pending ? "text-gray-500" : pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {pending
                          ? "—"
                          : `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-gray-600 mt-3">
          Evaluasi independen memakai eksposur 1 BNB per sinyal (dinilai dalam
          USDT saat prediksi) dan biaya round-trip 0,2%. Akumulasi PnL per
          sinyal bukan saldo portfolio atau transaksi on-chain.
        </p>
      </section>

      {/* Add Trade/Capital Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
          <div className="glass-card p-6 md:p-8 w-full max-w-md border border-[#26A17B]/30 shadow-2xl shadow-black/80 animate-slide-up">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {t("addNewRecordTitle")}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {language === "id"
                    ? "Catat deposit, penarikan, atau PnL trading ke jurnal BSC Anda."
                    : "Append deposit, withdrawal, or trade PnL to your BSC journal."}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Selector */}
            <div className="mb-4">
              <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">
                {t("categoryLabel")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewTx({ ...newTx, category: cat })}
                    className={`p-2.5 rounded-xl border text-xs font-mono font-medium transition-all text-left flex items-center justify-between ${
                      newTx.category === cat
                        ? "bg-[#26A17B]/20 border-[#26A17B] text-[#00D492]"
                        : "bg-[#080B11] border-[#1E2738] text-gray-400 hover:border-gray-600 hover:text-white"
                    }`}
                  >
                    <span>
                      {cat === "Trade Profit"
                        ? t("tradeProfitCategory")
                        : cat === "Trade Loss"
                          ? t("tradeLossCategory")
                          : cat === "Deposit"
                            ? t("depositCategory")
                            : cat === "Withdrawal"
                              ? t("withdrawalCategory")
                              : cat === "Trading Fee"
                                ? t("tradingFeeCategory")
                                : cat === "Staking Yield"
                                  ? t("stakingYieldCategory")
                                  : cat}
                    </span>
                    {newTx.category === cat && (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Pair & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">
                  {t("pairLabel")}
                </label>
                <select
                  value={newTx.pair}
                  onChange={(e) => setNewTx({ ...newTx, pair: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#080B11] border border-[#1E2738] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#26A17B]/60 transition-all"
                >
                  {COMMON_PAIRS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">
                  {t("amountUsdtLabel")}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={newTx.amount}
                    onChange={(e) =>
                      setNewTx({ ...newTx, amount: e.target.value })
                    }
                    placeholder="250.00"
                    className="w-full pl-8 pr-3 py-2 bg-[#080B11] border border-[#1E2738] rounded-xl text-white font-mono text-xs placeholder-gray-600 focus:outline-none focus:border-[#26A17B]/60 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Strategy / Note */}
            <div className="mb-6">
              <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">
                {t("strategyNoteLabel")}
              </label>
              <input
                type="text"
                value={newTx.note}
                onChange={(e) => setNewTx({ ...newTx, note: e.target.value })}
                placeholder={t("notePlaceholder")}
                className="w-full px-4 py-2.5 bg-[#080B11] border border-[#1E2738] rounded-xl text-white text-xs placeholder-gray-600 focus:outline-none focus:border-[#26A17B]/60 transition-all"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-mono text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newTx.amount}
                className="px-6 py-2.5 rounded-xl bg-[#26A17B] text-black font-bold text-xs font-mono hover:bg-[#00D492] transition-all shadow-lg shadow-[#26A17B]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("saveToLedger")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
