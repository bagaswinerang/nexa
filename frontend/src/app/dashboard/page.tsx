"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import BalanceCards from "@/components/dashboard/balance-cards";
import ConnectWallet from "@/components/layout/connect-wallet";
import QuantStat from "@/components/ui/quant-stat";
import { useLanguage } from "@/components/layout/language-provider";
import { Activity, ArrowUpRight, TrendingUp, Wallet } from "lucide-react";
import { getTransactionSummary, getTradingRecommendation, getTransactions, type TradeRecommendation, type Transaction, type TransactionSummary } from "@/lib/api";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { t, language } = useLanguage();
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recommendation, setRecommendation] = useState<TradeRecommendation | null>(null);

  useEffect(() => {
    fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BNBUSDT")
      .then((response) => response.json())
      .then((data) => { setPrice(Number(data.lastPrice)); setChange(Number(data.priceChangePercent)); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!address || !isConnected) {
      setSummary(null); setTransactions([]); setRecommendation(null); return;
    }
    const wallet = address.toLowerCase();
    void Promise.all([
      getTransactionSummary(wallet).catch(() => null),
      getTransactions(wallet, 5).catch(() => ({ transactions: [] as Transaction[] })),
      getTradingRecommendation(wallet).catch(() => null),
    ]).then(([nextSummary, nextTransactions, nextRecommendation]) => {
      setSummary(nextSummary);
      setTransactions(nextTransactions.transactions);
      setRecommendation(nextRecommendation?.recommendation ?? null);
    });
  }, [address, isConnected]);

  const signal = recommendation?.signal.composite ?? null;
  const latest = transactions[0];
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t("dashboard")}</h1>
          <p className="text-gray-400">{isConnected ? t("welcomeBack", { address: `${address?.slice(0, 6)}...${address?.slice(-4)}` }) : t("connectWalletPrompt")}</p>
        </div>
        <ConnectWallet />
      </div>

      <BalanceCards totalEquity={summary?.balance ?? 0} netPnL={summary?.net_pnl ?? 0} totalDeposit={summary?.total_deposit ?? 0} totalWithdrawal={summary?.total_withdrawal ?? 0} winRate={summary?.win_rate ?? 0} isConnected={isConnected} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuantStat title="BNB/USDT" value={price ? `$${price.toFixed(2)}` : "$---.--"} change={change === null ? "Fetching..." : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% (24h)`} isPositive={(change ?? 0) >= 0} sublabel={t("binanceFeed")} icon={<TrendingUp className="w-4 h-4" />} tag={t("live")} />
        <QuantStat title={language === "id" ? "Sinyal AI" : "AI Signal"} value={signal === null ? "—" : `${signal >= 0 ? "+" : ""}${(signal * 100).toFixed(1)} pts`} change={recommendation?.action ?? "Connect wallet"} isPositive={(signal ?? 0) >= 0} sublabel="Binance momentum + Fear & Greed" icon={<Activity className="w-4 h-4" />} tag="BNB/USDT" />
        <QuantStat title="Agent tUSDT" value={recommendation ? `${recommendation.agent_balances.tUSDT.toFixed(2)} tUSDT` : "—"} change={recommendation?.agent_balances.network ?? "On-chain"} isPositive={true} sublabel={language === "id" ? "Saldo eksekusi on-chain" : "On-chain execution balance"} icon={<Wallet className="w-4 h-4" />} tag="LIVE" />
        <QuantStat title={t("latestTrade")} value={latest?.category ?? "—"} change={latest ? `$${Number(latest.amount).toFixed(2)} USDT` : "No trades"} isPositive={latest?.is_income ?? true} sublabel={latest?.pair ?? t("journal")} icon={<ArrowUpRight className="w-4 h-4" />} tag={latest ? "RECORDED" : "—"} />
      </div>
    </div>
  );
}
