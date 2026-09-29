"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import BalanceCards from "@/components/dashboard/balance-cards";
import ConnectWallet from "@/components/layout/connect-wallet";
import QuantStat from "@/components/ui/quant-stat";
import { useLanguage } from "@/components/layout/language-provider";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  Wallet,
  AlertCircle,
} from "lucide-react";
import {
  getTransactions,
  getTransactionSummary,
  type Transaction,
  type TransactionSummary,
} from "@/lib/api";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { t, language } = useLanguage();

  // Public live market data (Binance + Fear & Greed)
  const [bnbPrice, setBnbPrice] = useState<number | null>(null);
  const [bnbChange, setBnbChange] = useState<number | null>(null);
  const [fngValue, setFngValue] = useState<number | null>(null);
  const [fngLabel, setFngLabel] = useState<string | null>(null);

  // Real user portfolio data
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  // Fetch real market ticker (CORS-enabled public APIs)
  useEffect(() => {
    fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BNBUSDT")
      .then((res) => res.json())
      .then((data) => {
        if (data.lastPrice) {
          setBnbPrice(parseFloat(data.lastPrice));
          setBnbChange(parseFloat(data.priceChangePercent));
        }
      })
      .catch((err) => console.warn("Failed to fetch Binance ticker:", err));

    fetch("https://api.alternative.me/fng/?limit=1")
      .then((res) => res.json())
      .then((data) => {
        if (data.data && data.data[0]) {
          setFngValue(parseInt(data.data[0].value, 10));
          setFngLabel(data.data[0].value_classification);
        }
      })
      .catch((err) => console.warn("Failed to fetch Fear & Greed:", err));
  }, []);

  // Fetch real user data when wallet is connected
  useEffect(() => {
    if (!isConnected || !address) {
      setSummary(null);
      setTransactions([]);
      return;
    }

    setIsLoadingUser(true);
    const targetWallet = address.toLowerCase();

    Promise.all([
      getTransactionSummary(targetWallet).catch(() => null),
      getTransactions(targetWallet, 5).catch(() => ({ transactions: [] })),
    ])
      .then(([summaryRes, txRes]) => {
        if (summaryRes) setSummary(summaryRes);
        if (txRes?.transactions) setTransactions(txRes.transactions);
      })
      .finally(() => setIsLoadingUser(false));
  }, [isConnected, address]);

  const latestTx = transactions.length > 0 ? transactions[0] : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t("dashboard")}</h1>
          <p className="text-gray-400">
            {isConnected
              ? t("welcomeBack", {
                  address: `${address?.slice(0, 6)}...${address?.slice(-4)}`,
                })
              : t("connectWalletPrompt")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectWallet />
        </div>
      </div>

      {/* Balance Cards (Empty/0 when disconnected, real when connected) */}
      <BalanceCards
        totalEquity={summary?.balance ?? 0}
        netPnL={summary?.net_pnl ?? 0}
        totalDeposit={summary?.total_deposit ?? 0}
        totalWithdrawal={summary?.total_withdrawal ?? 0}
        winRate={summary?.win_rate ?? 0}
        isConnected={isConnected}
      />

      {/* Quick Stats: Real Market APIs + Connected Trade Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Real Live Binance Feed */}
        <QuantStat
          title="BNB/USDT"
          value={bnbPrice ? `$${bnbPrice.toFixed(2)}` : "$---.--"}
          change={
            bnbChange !== null
              ? `${bnbChange >= 0 ? "+" : ""}${bnbChange.toFixed(2)}% (24h)`
              : "Fetching..."
          }
          isPositive={bnbChange !== null ? bnbChange >= 0 : true}
          sublabel={t("binanceFeed")}
          icon={<TrendingUp className="w-4 h-4" />}
          tag={t("live")}
        />

        {/* Real Live Market Sentiment (Fear & Greed) */}
        <QuantStat
          title={t("marketSentiment")}
          value={fngValue !== null ? `${fngValue} / 100` : "--- / 100"}
          change={fngLabel || "Neutral"}
          isPositive={fngValue !== null ? fngValue >= 50 : true}
          sublabel={t("fearGreedIndex")}
          icon={<Activity className="w-4 h-4" />}
          tag={t("index")}
        />

        {/* Quant Projection */}
        <QuantStat
          title={t("quantProjection")}
          value={
            bnbChange !== null
              ? `${(50 + Math.min(Math.max(bnbChange * 4, -30), 40)).toFixed(1)}% ${
                  bnbChange >= 0 ? t("bullish") : t("bearish")
                }`
              : `---% ${t("bullish")}`
          }
          change={t("outlook")}
          isPositive={bnbChange !== null ? bnbChange >= 0 : true}
          sublabel={t("monteCarloEngine")}
          icon={<ArrowUpRight className="w-4 h-4" />}
          tag={t("probability")}
        />

        {/* Latest Real Trade / Record */}
        <QuantStat
          title={t("latestTrade")}
          value={
            latestTx
              ? latestTx.category
              : isConnected
              ? language === "id"
                ? "Belum ada"
                : "No trades"
              : "—"
          }
          change={
            latestTx
              ? `${latestTx.is_income ? "+" : "-"}$${Number(latestTx.amount).toFixed(2)} USDT`
              : isConnected
              ? "0 Orders"
              : language === "id"
              ? "Konek Wallet"
              : "Connect Wallet"
          }
          isPositive={latestTx ? latestTx.is_income : true}
          sublabel={
            latestTx
              ? latestTx.pair || "BEP-20"
              : isConnected
              ? "Awaiting execution"
              : "Unlinked"
          }
          icon={<Clock className="w-4 h-4" />}
          tag={t("journal")}
        />
      </div>

      {/* Recent Transactions Journal */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{t("recentTradingJournal")}</h2>
          <a
            href="/dashboard/finance"
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            {t("viewAll")}
          </a>
        </div>

        {/* When wallet is NOT connected */}
        {!isConnected ? (
          <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-light border border-white/10 flex items-center justify-center text-gray-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="font-medium text-white">
              {language === "id"
                ? "Wallet Belum Terhubung"
                : "Wallet Not Connected"}
            </div>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              {language === "id"
                ? "Hubungkan Web3 wallet Anda untuk melihat portofolio riil, riwayat transaksi, dan jurnal eksekusi bot di BSC."
                : "Connect your Web3 wallet to inspect your real portfolio, transaction history, and bot execution journal on BSC."}
            </p>
            <div className="pt-2 flex justify-center">
              <ConnectWallet />
            </div>
          </div>
        ) : isLoadingUser ? (
          <div className="p-8 text-center text-sm text-gray-500 font-mono">
            Loading transaction journal...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-white/5 flex items-center justify-center text-gray-500">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="text-sm font-medium text-gray-300">
              {language === "id"
                ? "Belum ada riwayat transaksi"
                : "No transaction records found"}
            </div>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {language === "id"
                ? "Catatan deposit, withdrawal, dan trade yang dieksekusi akan otomatis tampil di sini."
                : "Executed swaps, deposits, and withdrawals will automatically show up here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      tx.is_income
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    {tx.is_income ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span>{tx.category}</span>
                      {tx.pair && (
                        <span className="text-xs font-mono text-[#00D492] bg-[#26A17B]/15 px-2 py-0.5 rounded border border-[#26A17B]/30">
                          {tx.pair}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{tx.note || "No note"}</div>
                  </div>
                </div>
                <div
                  className={`font-semibold font-mono ${
                    tx.is_income ? "text-success" : "text-danger"
                  }`}
                >
                  {tx.is_income ? "+" : "-"}${Number(tx.amount).toFixed(2)} USDT
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
