"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import ConnectWallet from "@/components/layout/connect-wallet";
import QuantStat from "@/components/ui/quant-stat";
import LivePancakeSwapCard from "@/components/dashboard/live-pancakeswap-card";
import { useLanguage } from "@/components/layout/language-provider";
import {
  getTradingRecommendation,
  executePaperTrade,
  executeAutoTrade,
  getPaperPortfolio,
  resetPaperPortfolio,
  type TradeRecommendation,
  type PaperPortfolioResponse,
  type TradeResult,
} from "@/lib/api";
import { env } from "@/lib/env";
import {
  Bot,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Wallet,
  Play,
  Activity,
  Layers,
  BarChart3,
  Check,
} from "lucide-react";
import Link from "next/link";

const PAIRS = [
  { symbol: "BNBUSDT", label: "BNB/USDT" },
  { symbol: "BTCUSDT", label: "BTC/USDT" },
  { symbol: "ETHUSDT", label: "ETH/USDT" },
  { symbol: "SOLUSDT", label: "SOL/USDT" },
];

const FORECAST_DAYS = [7, 14, 30];

export default function TradingAgentPage() {
  const { t, language } = useLanguage();
  const { isConnected, address } = useAccount();
  const targetWallet = address ? address.toLowerCase() : "";

  const [selectedPair, setSelectedPair] = useState("BNBUSDT");
  const [forecastDays, setForecastDays] = useState(14);
  const [portfolioData, setPortfolioData] = useState<PaperPortfolioResponse | null>(null);
  const [recommendation, setRecommendation] = useState<TradeRecommendation | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(0);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);

  const [recentTrades, setRecentTrades] = useState<TradeResult[]>([]);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // 1. Fetch Paper Portfolio
  const fetchPortfolio = async () => {
    if (!targetWallet) {
      setPortfolioData(null);
      return;
    }
    try {
      const data = await getPaperPortfolio(targetWallet);
      setPortfolioData(data);
    } catch (err) {
      console.error("Failed to load portfolio:", err);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [targetWallet]);

  // 2. Run AI Analysis
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setNotification(null);
    try {
      const res = await getTradingRecommendation(
        targetWallet,
        selectedPair,
        forecastDays
      );
      setRecommendation(res.recommendation);
      setCustomAmount(res.recommendation.amount_usdt);

      // If Auto Mode is ON and signal is actionable, trigger auto execution
      if (isAutoMode && res.recommendation.action !== "HOLD" && res.recommendation.confidence >= 70) {
        setAutoStatus(language === "id" ? "Keyakinan > 70%: Menjalankan eksekusi otomatis..." : "Confidence > 70%: Triggering auto execution...");
        const autoRes = await executeAutoTrade({
          user_address: targetWallet,
          symbol: selectedPair,
          forecast_days: forecastDays,
        });
        if (autoRes.auto_executed && autoRes.trade) {
          setRecentTrades((prev) => [autoRes.trade!, ...prev]);
          await fetchPortfolio();
          setNotification({
            type: "success",
            message: `${language === "id" ? "Order Otomatis Dieksekusi" : "Auto Order Executed"}: ${autoRes.trade.action} ${autoRes.trade.quantity.toFixed(4)} ${autoRes.trade.symbol} @ $${autoRes.trade.price.toFixed(2)}`,
          });
        }
        setAutoStatus(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (language === "id" ? "Analisis gagal" : "Analysis failed");
      setNotification({ type: "error", message: msg });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. Approve & Execute Trade (Semi-Autonomous)
  const handleExecute = async (actionOverride?: "BUY" | "SELL") => {
    if (!recommendation && !actionOverride) return;

    const action = actionOverride || recommendation!.action;
    if (action === "HOLD") {
      setNotification({
        type: "info",
        message: language === "id" ? "Rekomendasi AI adalah HOLD. Tidak ada eksekusi order." : "AI recommends HOLD. No trade execution required.",
      });
      return;
    }

    const amount = customAmount > 0 ? customAmount : (recommendation?.amount_usdt || 100);

    setIsExecuting(true);
    setNotification(null);
    try {
      const res = await executePaperTrade({
        user_address: targetWallet,
        action,
        symbol: selectedPair,
        amount_usdt: amount,
        reasoning:
          recommendation?.reasoning ||
          `Manual order based on market analysis`,
        source: "ai_agent",
      });

      setRecentTrades((prev) => [res.trade, ...prev]);
      await fetchPortfolio();
      setNotification({
        type: "success",
        message: t("orderSuccessMsg", {
          action: res.trade.action,
          quantity: res.trade.quantity.toFixed(4),
          symbol: res.trade.symbol,
          price: res.trade.price.toFixed(2),
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : (language === "id" ? "Eksekusi gagal" : "Execution failed");
      setNotification({ type: "error", message: msg });
    } finally {
      setIsExecuting(false);
    }
  };

  // 4. Reset Portfolio
  const handleReset = async () => {
    if (!confirm(t("resetConfirm"))) {
      return;
    }
    setIsResetting(true);
    try {
      await resetPaperPortfolio(targetWallet);
      await fetchPortfolio();
      setRecommendation(null);
      setRecentTrades([]);
      setNotification({
        type: "success",
        message: t("resetSuccess"),
      });
    } catch (err) {
      setNotification({
        type: "error",
        message: t("resetFailed"),
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Calculate Positions array
  const positions = portfolioData?.portfolio?.positions
    ? Object.values(portfolioData.portfolio.positions)
    : [];

  const portfolio = portfolioData?.portfolio;
  const totalEquity = portfolioData?.total_equity ?? 10000;
  const unrealizedPnl = portfolioData?.unrealized_pnl ?? 0;
  const winRate =
    portfolio && portfolio.total_trades > 0
      ? (portfolio.winning_trades / portfolio.total_trades) * 100
      : 0;

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-gradient-to-r from-accent/20 to-[#00D492]/20 text-[#00D492] font-semibold border border-[#00D492]/30 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-[#00D492]" />
              {t("autonomousQuantAgent")}
            </span>
            <span className="text-[11px] font-mono text-gray-400">
              {t("senseDecideAct")}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            {t("aiTradingAgent")}
            <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-[#1E2738] text-gray-300 border border-white/10 font-normal">
              {t("paperMode")}
            </span>
          </h1>
          <p className="text-sm text-gray-400">
            {t("aiTradingAgentSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ConnectWallet />
          <button
            onClick={handleReset}
            disabled={isResetting}
            title={t("reset10k")}
            className="p-2.5 rounded-xl border border-white/10 bg-[#080B11] text-gray-400 hover:text-white hover:border-accent/40 transition-all text-xs font-mono flex items-center gap-1.5"
          >
            <RotateCcw className={`w-4 h-4 ${isResetting ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("reset10k")}</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-fade-in ${
            notification.type === "success"
              ? "bg-[#00D492]/10 border-[#00D492]/30 text-[#00D492]"
              : notification.type === "error"
                ? "bg-danger/10 border-danger/30 text-danger"
                : "bg-accent/10 border-accent/30 text-accent"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : notification.type === "error" ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100 font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuantStat
          title={t("totalEquity")}
          value={`$${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={t("paperMode")}
          icon={<Wallet className="w-5 h-5 text-accent" />}
        />
        <QuantStat
          title={t("availableCash")}
          value={`$${(portfolio?.usdt_balance ?? 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel="USDT Liquid"
          icon={<Coins className="w-5 h-5 text-[#00D492]" />}
        />
        <QuantStat
          title={t("unrealizedPnL")}
          value={`${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toFixed(2)}`}
          change={`${totalEquity > 0 ? ((unrealizedPnl / totalEquity) * 100).toFixed(2) : "0.00"}%`}
          isPositive={unrealizedPnl >= 0}
          icon={unrealizedPnl >= 0 ? <TrendingUp className="w-5 h-5 text-success" /> : <TrendingDown className="w-5 h-5 text-danger" />}
        />
        <QuantStat
          title={t("winRate")}
          value={`${winRate.toFixed(1)}%`}
          sublabel={`${portfolio?.winning_trades ?? 0}W / ${portfolio?.losing_trades ?? 0}L (${portfolio?.total_trades ?? 0} trades)`}
          icon={<Activity className="w-5 h-5 text-warning" />}
        />
      </div>

      {/* Main Grid: Control & AI Decision Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Terminal Controls & Parameters */}
        <div className="space-y-6">
          <div className="glass-card p-6 border border-[#1E2738] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Layers className="w-4 h-4 text-[#00D492]" />
                {t("simParameters")}
              </div>
              <span className="text-xs font-mono text-gray-500">Binance Vision & CoinGecko</span>
            </div>

            {/* Asset Pair Selector */}
            <div>
              <label className="text-xs font-mono uppercase text-gray-400 mb-2 block">
                {t("assetPair")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAIRS.map((pair) => (
                  <button
                    key={pair.symbol}
                    onClick={() => setSelectedPair(pair.symbol)}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all text-left flex items-center justify-between ${
                      selectedPair === pair.symbol
                        ? "bg-[#26A17B] text-black font-bold shadow-md shadow-[#26A17B]/25"
                        : "bg-[#080B11] border border-[#1E2738] text-gray-400 hover:text-white hover:border-[#26A17B]/40"
                    }`}
                  >
                    <span>{pair.label}</span>
                    {selectedPair === pair.symbol && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Forecast Horizon */}
            <div>
              <label className="text-xs font-mono uppercase text-gray-400 mb-2 block">
                {t("forecastHorizon")}
              </label>
              <div className="flex gap-2">
                {FORECAST_DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setForecastDays(d)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                      forecastDays === d
                        ? "bg-accent/20 border border-accent text-accent font-bold"
                        : "bg-[#080B11] border border-[#1E2738] text-gray-400 hover:text-white"
                    }`}
                  >
                    {t("daysUnit", { days: d })}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Mode Switch */}
            <div className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2738] flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className={`w-3.5 h-3.5 ${isAutoMode ? "text-[#00D492]" : "text-gray-500"}`} />
                  {t("autoExecuteMode")}
                </div>
                <div className="text-[11px] text-gray-400">
                  {t("autoExecuteDesc")}
                </div>
              </div>
              <button
                onClick={() => setIsAutoMode(!isAutoMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isAutoMode ? "bg-[#00D492]" : "bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAutoMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Action Trigger */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isExecuting}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-black bg-gradient-to-r from-[#00D492] to-[#26A17B] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00D492]/20 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t("generatingRecommendation")}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t("generateRecommendation")}
                </>
              )}
            </button>
            {autoStatus && (
              <p className="text-xs text-center text-[#00D492] font-mono animate-pulse">
                {autoStatus}
              </p>
            )}
          </div>

          {/* Quick Manual Trade Card */}
          <div className="glass-card p-5 border border-[#1E2738] space-y-3">
            <div className="text-xs font-mono uppercase text-gray-400">
              {t("manualTradeTitle")}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={customAmount || ""}
                onChange={(e) => setCustomAmount(Number(e.target.value))}
                placeholder={language === "id" ? "Jumlah USDT (cth: 500)" : "USDT Amount (e.g. 500)"}
                className="flex-1 bg-[#080B11] border border-[#1E2738] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExecute("BUY")}
                disabled={isExecuting || !customAmount}
                className="py-2 rounded-xl text-xs font-bold font-mono bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-all disabled:opacity-40"
              >
                {t("buyAction")} {selectedPair.replace("USDT", "")}
              </button>
              <button
                onClick={() => handleExecute("SELL")}
                disabled={isExecuting || !customAmount}
                className="py-2 rounded-xl text-xs font-bold font-mono bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-all disabled:opacity-40"
              >
                {t("sellAction")} {selectedPair.replace("USDT", "")}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: AI Recommendation & Decision Card */}
        <div className="lg:col-span-2 space-y-6">
          {recommendation ? (
            <div className="glass-card p-6 md:p-8 border border-[#1E2738] relative overflow-hidden space-y-6">
              {/* Background Glow */}
              <div
                className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[100px] pointer-events-none opacity-20 ${
                  recommendation.action === "BUY"
                    ? "bg-[#00D492]"
                    : recommendation.action === "SELL"
                      ? "bg-danger"
                      : "bg-warning"
                }`}
              />

              {/* Recommendation Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
                <div>
                  <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">
                    {language === "id" ? "Putusan Kuant AI" : "AI Quantitative Verdict"} • {recommendation.pair}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-2xl font-black font-mono px-3.5 py-1 rounded-xl border flex items-center gap-2 ${
                        recommendation.action === "BUY"
                          ? "bg-success/20 text-success border-success/40 shadow-lg shadow-success/15"
                          : recommendation.action === "SELL"
                            ? "bg-danger/20 text-danger border-danger/40 shadow-lg shadow-danger/15"
                            : "bg-warning/20 text-warning border-warning/40 shadow-lg shadow-warning/15"
                      }`}
                    >
                      {recommendation.action === "BUY" ? (
                        <ArrowUpRight className="w-6 h-6" />
                      ) : recommendation.action === "SELL" ? (
                        <ArrowDownRight className="w-6 h-6" />
                      ) : (
                        <Activity className="w-6 h-6" />
                      )}
                      {recommendation.action}
                    </span>
                    <div>
                      <div className="text-lg font-bold text-white font-mono">
                        ${recommendation.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-400">
                        {t("currentPrice")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confidence Meter */}
                <div className="bg-[#080B11] p-3 rounded-xl border border-[#1E2738] min-w-[180px]">
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="text-gray-400">{t("confidenceLevel")}</span>
                    <span className="font-bold text-white">
                      {recommendation.confidence.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1E2738] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        recommendation.action === "BUY"
                          ? "bg-gradient-to-r from-accent to-[#00D492]"
                          : recommendation.action === "SELL"
                            ? "bg-gradient-to-r from-amber-500 to-danger"
                            : "bg-warning"
                      }`}
                      style={{ width: `${Math.min(recommendation.confidence, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Rationale & Reasoning */}
              <div className="p-4 rounded-xl bg-[#080B11]/80 border border-[#1E2738] space-y-2">
                <div className="text-xs font-mono uppercase text-[#00D492] font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {language === "id" ? "Sintesis & Alur Penalaran" : "Synthesis & Reasoning"}
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">
                  {recommendation.reasoning}
                </p>
              </div>

              {/* Multi-Factor Diagnostics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#080B11] border border-[#1E2738]">
                  <div className="text-[11px] font-mono text-gray-400">
                    {t("probAboveEntry")}
                  </div>
                  <div className="text-base font-bold font-mono text-white mt-0.5">
                    {(recommendation.monte_carlo.prob_above_current * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-gray-500">{t("aboveEntry")}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#080B11] border border-[#1E2738]">
                  <div className="text-[11px] font-mono text-gray-400">
                    {t("expected")} Return
                  </div>
                  <div className={`text-base font-bold font-mono mt-0.5 ${recommendation.monte_carlo.expected_return_pct >= 0 ? "text-success" : "text-danger"}`}>
                    {recommendation.monte_carlo.expected_return_pct >= 0 ? "+" : ""}
                    {recommendation.monte_carlo.expected_return_pct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-gray-500">{forecastDays}d Median: ${recommendation.monte_carlo.median_price.toFixed(1)}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#080B11] border border-[#1E2738]">
                  <div className="text-[11px] font-mono text-gray-400">
                    {t("fearGreedIndex")}
                  </div>
                  <div className="text-base font-bold font-mono text-white mt-0.5">
                    {recommendation.sentiment.fear_greed_index ?? "N/A"}
                  </div>
                  <div className="text-[10px] text-accent">
                    {recommendation.sentiment.fear_greed_label || "Neutral"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#080B11] border border-[#1E2738]">
                  <div className="text-[11px] font-mono text-gray-400">
                    24h Momentum
                  </div>
                  <div className={`text-base font-bold font-mono mt-0.5 ${recommendation.sentiment.price_change_24h_pct >= 0 ? "text-success" : "text-danger"}`}>
                    {recommendation.sentiment.price_change_24h_pct >= 0 ? "+" : ""}
                    {recommendation.sentiment.price_change_24h_pct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-gray-500">24h Volatility</div>
                </div>
              </div>

              {/* Execution Action Bar */}
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <label className="text-xs font-mono text-gray-400 uppercase">
                    {t("recommendedAmount")}:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-mono text-gray-500">$</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(Number(e.target.value))}
                      className="w-32 bg-[#080B11] border border-[#1E2738] rounded-xl pl-6 pr-3 py-1.5 text-xs font-mono text-white font-bold"
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-400">USDT</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {recommendation.action !== "HOLD" ? (
                    <button
                      onClick={() => handleExecute()}
                      disabled={isExecuting}
                      className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 shadow-lg ${
                        recommendation.action === "BUY"
                          ? "bg-success text-black hover:bg-success/90 shadow-success/20"
                          : "bg-danger text-white hover:bg-danger/90 shadow-danger/20"
                      } disabled:opacity-50`}
                    >
                      {isExecuting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          {t("executingOrder")}
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          {t("executeTradeBtn")} ({recommendation.action})
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs font-mono text-warning bg-warning/10 px-4 py-2 rounded-xl border border-warning/30">
                      {language === "id" ? "Rekomendasi adalah HOLD — Tidak perlu eksekusi" : "Recommendation is HOLD — No execution needed"}
                    </span>
                  )}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>
                  {recommendation.risk_warning} {language === "id" ? "Otomatis dicatat ke jurnal keuangan Supabase." : "Auto-logged to Supabase Finance journal upon execution."}
                </span>
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 border border-[#1E2738] text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D492]/20 to-accent/20 border border-[#00D492]/30 flex items-center justify-center mx-auto text-[#00D492]">
                <Bot className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-bold text-white mb-1">
                  {language === "id" ? "Siap Menganalisis Pasar" : "Ready to Analyze Market"}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-6">
                  {language === "id"
                    ? "Pilih aset kripto dan klik 'Analisis & Rekomendasi AI'. Agen akan mensimulasikan 3.000 jalur masa depan, memeriksa sentimen langsung, dan menghitung alokasi modal optimal."
                    : "Select your target crypto asset and click 'Generate AI Recommendation'. The agent will simulate 3,000 future price paths, poll live sentiment, and calculate optimal trade allocation."}
                </p>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs text-black bg-[#00D492] hover:bg-[#00D492]/90 transition-all font-mono inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {language === "id" ? `Analisis ${selectedPair} Sekarang` : `Analyze ${selectedPair} Now`}
                </button>
              </div>
            </div>
          )}

          {/* Active Positions Table */}
          <div className="glass-card p-6 border border-[#1E2738] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <BarChart3 className="w-4 h-4 text-accent" />
                {t("openPositions")}
              </div>
              <span className="text-xs font-mono text-gray-400">
                {positions.length} {language === "id" ? "Aset Terbuka" : "Open Asset(s)"}
              </span>
            </div>

            {positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/5">
                      <th className="pb-2">{language === "id" ? "Aset" : "Asset"}</th>
                      <th className="pb-2">{language === "id" ? "Kuantitas" : "Quantity"}</th>
                      <th className="pb-2">{language === "id" ? "Rata-rata Masuk" : "Avg Entry"}</th>
                      <th className="pb-2">{language === "id" ? "Nilai Saat Ini" : "Current Value"}</th>
                      <th className="pb-2 text-right">{t("action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {positions.map((pos) => (
                      <tr key={pos.symbol} className="text-gray-200">
                        <td className="py-3 font-bold text-white">
                          {pos.symbol}
                        </td>
                        <td className="py-3">{pos.quantity.toFixed(6)}</td>
                        <td className="py-3">${pos.avg_entry_price.toFixed(2)}</td>
                        <td className="py-3 font-bold text-accent">
                          ${pos.current_value.toFixed(2)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedPair(pos.symbol);
                              setCustomAmount(pos.current_value);
                              handleExecute("SELL");
                            }}
                            className="px-3 py-1 rounded-lg bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-all text-[11px] font-bold"
                          >
                            {t("sellAction")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-500 font-mono">
                {t("noOpenPositions")}
              </div>
            )}
          </div>

          {/* Sync Link to Finance Journal */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-surface to-[#080B11] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {language === "id" ? "Sinkronisasi Otomatis Jurnal Keuangan Aktif" : "Finance Journal Auto-Sync Active"}
                </div>
                <div className="text-[11px] text-gray-400">
                  {language === "id" ? "Setiap order yang dieksekusi di sini otomatis tersimpan di database Supabase." : "Every order executed here is automatically indexed with embeddings in Supabase."}
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/finance"
              className="text-xs font-mono text-accent hover:underline flex items-center gap-1"
            >
              {language === "id" ? "Buka Jurnal" : "Open Journal"} <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BANNER KE TRADING ASLI (LIVE PANCAKESWAP DEX)                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-6 border-t border-[#1E2738]/80">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#12161f] to-[#080B11] border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="text-base font-bold text-white flex items-center gap-2.5">
                {language === "id" ? "Siap Trading Asli di PancakeSwap?" : "Ready for Real PancakeSwap Trading?"}
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  LIVE DEX
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                {language === "id"
                  ? "Beralih ke mode robot otonom (Opsi 2) yang mengeksekusi order nyata langsung ke PancakeSwap Router di blockchain BSC. Dilengkapi wallet signer, saldo on-chain riil, dan bukti verifikasi BscScan."
                  : "Switch to autonomous AI agent mode that signs and executes real swaps on the PancakeSwap DEX. Verified on BscScan."}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/live-agent"
            className="px-5 py-3 rounded-xl font-bold text-xs text-black bg-amber-400 hover:bg-amber-300 transition-all font-mono inline-flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-amber-500/20"
          >
            <span>{language === "id" ? "Buka AI Agent Live DEX" : "Open Live Agent DEX"}</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
