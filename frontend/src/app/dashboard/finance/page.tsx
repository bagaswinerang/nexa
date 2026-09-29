"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import ConnectWallet from "@/components/layout/connect-wallet";
import QuantStat from "@/components/ui/quant-stat";
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
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
  const [filterType, setFilterType] = useState<"all" | "trades" | "deposit" | "withdrawal">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);

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
      setIsLoading(false);
      setIsRefreshing(false);
      setSupabaseConnected(true);
      return;
    }
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const res = await getTransactions(targetWallet, 100);
      setSupabaseConnected(true);
      if (res.transactions) {
        setTransactions(
          res.transactions.map((t) => ({
            ...t,
            hash: t.tx_hash || "0x" + (t.id.slice(0, 4) + "..." + t.id.slice(-4)),
          }))
        );
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error("Could not fetch Supabase transactions:", err);
      setSupabaseConnected(false);
      setTransactions([]);
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
    .filter((t) => t.category === "Trade Profit" || t.category === "Staking Yield")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalLosses = transactions
    .filter((t) => t.category === "Trade Loss" || t.category === "Trading Fee")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const netPnL = totalProfits - totalLosses;
  const activeBalance = (totalDeposit - totalWithdrawal) + netPnL;

  const winCount = transactions.filter((t) => t.category === "Trade Profit").length;
  const lossCount = transactions.filter((t) => t.category === "Trade Loss").length;
  const totalTrades = winCount + lossCount;
  const winRate = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(1) : "0.0";

  const handleAdd = async () => {
    if (!newTx.amount || !newTx.category) return;
    const randomHex = "0x" + Math.random().toString(16).slice(2, 6) + "..." + Math.random().toString(16).slice(2, 6);
    
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
                : t
            )
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
      matchesFilter = tx.category === "Trade Profit" || tx.category === "Trade Loss";
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
              <span className={`w-1.5 h-1.5 rounded-full ${supabaseConnected ? "bg-[#00D492] animate-pulse" : "bg-gray-500"}`} />
              {supabaseConnected ? t("supabaseConnectedRecords", { count: transactions.length }) : t("connectingSupabase")}
            </span>

            <button
              onClick={() => fetchLedger(false)}
              disabled={isRefreshing}
              className="p-1 px-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-mono flex items-center gap-1 border border-white/5"
              title={t("sync")}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[#00D492]" : ""}`} />
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
            <h2 className="text-base sm:text-lg font-bold text-white">{t("journalHistory")}</h2>
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

        {/* Ledger Table */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left min-w-[620px]">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-mono uppercase text-gray-500 tracking-wider">
                <th className="pb-3 pl-4 sm:pl-2">{t("colStrategyNote")}</th>
                <th className="pb-3">{t("pairLabel")}</th>
                <th className="pb-3">{t("categoryLabel")}</th>
                <th className="pb-3">{t("colProofHash")}</th>
                <th className="pb-3 text-right">{t("colAmount")}</th>
                <th className="pb-3 text-right pr-4 sm:pr-2">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500 gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#00D492]" />
                      <span className="text-xs font-mono text-gray-400">
                        {language === "id" ? "Menyinkronkan transaksi dengan database Supabase..." : "Synchronizing records with Supabase database..."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                      <Database className="w-8 h-8 text-gray-600 mb-1" />
                      <span className="text-sm font-medium text-gray-300">
                        {copy.noTransactions}
                      </span>
                      <span className="text-xs font-mono text-gray-500">
                        {copy.recordTransaction}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                const isGain = tx.category === "Trade Profit" || tx.category === "Staking Yield";
                const isLoss = tx.category === "Trade Loss";
                const isDep = tx.category === "Deposit";
                const isWd = tx.category === "Withdrawal";

                const categoryDisplay = 
                  tx.category === "Trade Profit" ? t("tradeProfitCategory") :
                  tx.category === "Trade Loss" ? t("tradeLossCategory") :
                  tx.category === "Deposit" ? t("depositCategory") :
                  tx.category === "Withdrawal" ? t("withdrawalCategory") :
                  tx.category === "Trading Fee" ? t("tradingFeeCategory") :
                  tx.category === "Staking Yield" ? t("stakingYieldCategory") :
                  tx.category;

                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Type & Note */}
                    <td className="py-4 pl-4 sm:pl-2">
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
                          {isGain && <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />}
                          {isLoss && <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />}
                          {isDep && <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />}
                          {isWd && <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />}
                          {!isGain && !isLoss && !isDep && !isWd && (
                            <Coins className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-white">
                            {tx.note}
                          </div>
                          <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(tx.created_at).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
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
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${
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
                      <a
                        href="https://testnet.bscscan.com"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-400 hover:text-[#00D492] transition-colors"
                      >
                        <span>{tx.hash}</span>
                        <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-[#00D492]" />
                      </a>
                    </td>

                    {/* Amount */}
                    <td className="py-4 text-right">
                      <div
                        className={`font-mono font-bold text-sm md:text-base ${
                          isGain || isDep ? "text-[#00D492]" : "text-rose-400"
                        }`}
                      >
                        {isGain || isDep ? "+" : "-"}${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] font-mono text-gray-500">
                        {tx.category === "Deposit" ? (language === "id" ? "Modal Masuk" : "Capital In") : tx.category === "Withdrawal" ? (language === "id" ? "Modal Keluar" : "Capital Out") : categoryDisplay}
                      </div>
                    </td>

                    {/* Delete Action */}
                    <td className="py-4 text-right pr-4 sm:pr-2">
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
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Trade/Capital Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
          <div className="glass-card p-6 md:p-8 w-full max-w-md border border-[#26A17B]/30 shadow-2xl shadow-black/80 animate-slide-up">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-xl font-bold text-white">{t("addNewRecordTitle")}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {language === "id" ? "Catat deposit, penarikan, atau PnL trading ke jurnal BSC Anda." : "Append deposit, withdrawal, or trade PnL to your BSC journal."}
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
                      {cat === "Trade Profit" ? t("tradeProfitCategory") :
                       cat === "Trade Loss" ? t("tradeLossCategory") :
                       cat === "Deposit" ? t("depositCategory") :
                       cat === "Withdrawal" ? t("withdrawalCategory") :
                       cat === "Trading Fee" ? t("tradingFeeCategory") :
                       cat === "Staking Yield" ? t("stakingYieldCategory") : cat}
                    </span>
                    {newTx.category === cat && <CheckCircle2 className="w-3.5 h-3.5" />}
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
                    onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
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
