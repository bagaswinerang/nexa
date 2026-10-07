"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMonteCarlo } from "@/hooks/use-monte-carlo";
import QuantStat from "@/components/ui/quant-stat";
import ConnectWallet from "@/components/layout/connect-wallet";
import { useLanguage } from "@/components/layout/language-provider";
import {
  Activity,
  BarChart3,
  Loader2,
  Play,
  TrendingUp,
  Target,
  AlertTriangle,
  Cpu,
  Layers,
} from "lucide-react";

// recharts (paling berat, ~380 KB source) baru di-download
// pas komponen ini beneran dirender, bukan di initial load
const MonteCarloChart = dynamic(
  () => import("@/components/dashboard/monte-carlo-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] rounded-xl bg-white/[0.03] border border-white/5 animate-pulse flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#00D492]" />
      </div>
    ),
  },
);

import type { QuantHorizon } from "@/lib/api";

const POPULAR_PAIRS = [
  { symbol: "BNBUSDT", label: "BNB/USDT" },
];

const HORIZON_OPTIONS: { value: QuantHorizon; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "2h", label: "2h" },
  { value: "4h", label: "4h" },
  { value: "6h", label: "6h" },
  { value: "8h", label: "8h" },
  { value: "12h", label: "12h" },
  { value: "24h", label: "24h" },
];

export default function QuantPage() {
  const { t, language } = useLanguage();
  const symbol = "BNBUSDT";
  const [horizon, setHorizon] = useState<QuantHorizon>("24h");
  const { result, isLoading, error, simulate } = useMonteCarlo();

  const handleSimulate = () => {
    simulate(symbol, horizon);
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-[#26A17B]/15 text-[#00D492] font-semibold border border-[#26A17B]/30">
              Geometric Brownian Motion (GBM)
            </span>
            <span className="text-[11px] font-mono text-gray-400">
              {t("gbmFormula")}
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t("quantLabTitle")}
          </h1>
          <p className="text-sm text-gray-400">{t("quantLabSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectWallet />
        </div>
      </div>

      {/* Controls Bar (Institutional Terminal Style) */}
      <div className="glass-card p-6 border border-[#1E2738]">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Cpu className="w-4 h-4 text-[#00D492]" />
            {t("simParameters")}
          </div>
          <div className="text-xs font-mono text-gray-500">
            {t("samplePathsRuns")}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Symbol Select */}
          <div>
            <label className="text-xs font-mono uppercase text-gray-400 mb-2.5 block">
              {t("assetPair")}
            </label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_PAIRS.map((pair) => (
                <button
                  key={pair.symbol}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                    symbol === pair.symbol
                      ? "bg-[#26A17B] text-black font-bold shadow-md shadow-[#26A17B]/25"
                      : "bg-[#080B11] border border-[#1E2738] text-gray-400 hover:text-white hover:border-[#26A17B]/40"
                  }`}
                >
                  {pair.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horizon Select */}
          <div>
            <label className="text-xs font-mono uppercase text-gray-400 mb-2.5 block">
              {t("forecastHorizon")} (Intraday)
            </label>
            <div className="flex flex-wrap gap-2">
              {HORIZON_OPTIONS.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setHorizon(h.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                    horizon === h.value
                      ? "bg-[#00D492]/20 text-[#00D492] font-semibold border border-[#00D492]/40"
                      : "bg-[#080B11] border border-[#1E2738] text-gray-400 hover:text-white"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <div className="flex items-end">
            <button
              onClick={handleSimulate}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#26A17B] text-black font-bold text-sm hover:bg-[#00D492] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#26A17B]/20 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  {t("runningSimulations")}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black stroke-none" />
                  {t("runQuantSimulation")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 flex items-center gap-3 text-danger text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-bold">{t("simulationError")}</div>
            <div className="text-xs opacity-90">{error}</div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <>
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuantStat
              title={t("currentPrice")}
              value={`$${result.current_price.toLocaleString()}`}
              change="Spot Feed"
              isPositive={true}
              sublabel={result.symbol}
              icon={<TrendingUp className="w-4 h-4" />}
              tag={t("entry")}
            />
            <QuantStat
              title={t("projectedMean")}
              value={`$${result.mean_price.toLocaleString()}`}
              change={`${(
                ((result.mean_price - result.current_price) /
                  result.current_price) *
                100
              ).toFixed(2)}% ${t("expected")}`}
              isPositive={result.mean_price >= result.current_price}
              sublabel={`Horizon ${result.period_label || result.horizon}`}
              icon={<Target className="w-4 h-4" />}
              tag={t("expected")}
            />
            <QuantStat
              title={t("bullishProbability")}
              value={`${(result.prob_above_current * 100).toFixed(1)}%`}
              change={t("aboveEntry")}
              isPositive={result.prob_above_current >= 0.5}
              sublabel={t("confidenceBand")}
              icon={<Layers className="w-4 h-4" />}
              tag={t("stochastic")}
            />
            <QuantStat
              title={t("annualVolatility")}
              value={`${(result.annual_volatility * 100).toFixed(1)}%`}
              change={t("historical365d")}
              isPositive={true}
              sublabel="Binance historical candles"
              icon={<Activity className="w-4 h-4" />}
              tag={t("volatility")}
            />
          </div>

          {/* Interactive Chart */}
          <div className="glass-card p-6 border border-[#1E2738]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#00D492]" />
                  {t("monteCarloTrajectories", { symbol: result.symbol })}
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {t("visualizingPaths", { days: result.days_simulated })}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-[#00D492]">
                  <span className="w-2 h-2 rounded-full bg-[#00D492]" />{" "}
                  {t("targetUpper")}
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-[#26A17B]" />{" "}
                  {t("median")}
                </span>
              </div>
            </div>

            <MonteCarloChart result={result} />
          </div>

          {/* Probability Matrix & Percentiles */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Probabilities Breakdown */}
            <div className="glass-card p-6 border border-[#1E2738] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono mb-4">
                  {t("outcomeDistribution")}
                </h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#080B11] border border-white/5">
                    <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-1">
                      <span>{t("probAboveEntry")}</span>
                      <span className="text-[#00D492] font-bold">
                        {(result.prob_above_current * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#00D492] rounded-full"
                        style={{ width: `${result.prob_above_current * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B11] border border-white/5">
                    <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-1">
                      <span>{t("probUpside10")}</span>
                      <span className="text-[#00D492] font-bold">
                        {(result.prob_above_10pct * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#26A17B] rounded-full"
                        style={{ width: `${result.prob_above_10pct * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B11] border border-white/5">
                    <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-1">
                      <span>{t("probDownside10")}</span>
                      <span className="text-danger font-bold">
                        {(result.prob_below_10pct * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-danger rounded-full"
                        style={{ width: `${result.prob_below_10pct * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-mono text-gray-500 mt-4 pt-3 border-t border-white/5">
                {t("gbmDescription")}
              </div>
            </div>

            {/* Percentiles Table */}
            <div className="glass-card p-6 border border-[#1E2738] lg:col-span-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono mb-4">
                {t("percentileValuation")}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] uppercase text-gray-500">
                      <th className="pb-3 pl-2">Percentile</th>
                      <th className="pb-3">
                        {language === "id" ? "Interpretasi" : "Interpretation"}
                      </th>
                      <th className="pb-3 text-right">
                        {language === "id"
                          ? "Nilai Proyeksi"
                          : "Projected Value"}
                      </th>
                      <th className="pb-3 text-right pr-2">
                        {language === "id"
                          ? "Ekspektasi Return"
                          : "Expected Yield"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] text-xs">
                    {result.percentiles.map((p) => {
                      const change =
                        ((p.price - result.current_price) /
                          result.current_price) *
                        100;
                      const isUp = change >= 0;
                      const label =
                        p.percentile <= 10
                          ? language === "id"
                            ? "Kasus Terburuk Bearish"
                            : "Bearish Worst Case"
                          : p.percentile === 50
                            ? language === "id"
                              ? "Ekspektasi Median"
                              : "Median Expectation"
                            : p.percentile >= 90
                              ? language === "id"
                                ? "Potensi Bullish Maksimal"
                                : "Bullish Outlier"
                              : language === "id"
                                ? "Moderat"
                                : "Moderate";

                      return (
                        <tr
                          key={p.percentile}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pl-2 font-bold text-white">
                            P{p.percentile}
                          </td>
                          <td className="py-3 text-gray-400 font-sans text-xs">
                            {label}
                          </td>
                          <td className="py-3 text-right font-medium text-white">
                            $
                            {p.price.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            className={`py-3 text-right pr-2 font-bold ${
                              isUp ? "text-[#00D492]" : "text-danger"
                            }`}
                          >
                            {isUp ? "+" : ""}
                            {change.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!result && !isLoading && !error && (
        <div className="glass-card p-16 text-center border border-[#1E2738]">
          <div className="w-14 h-14 rounded-2xl bg-[#26A17B]/10 border border-[#26A17B]/20 flex items-center justify-center mx-auto mb-4 text-[#00D492]">
            <Cpu className="w-7 h-7" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
            {language === "id"
              ? "Belum Ada Simulasi Dijalankan"
              : "No Simulation Run Yet"}
          </h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
            {language === "id"
              ? "Pilih pasangan kripto dan periode perkiraan di atas, lalu klik tombol untuk menghitung lintasan probabilitas Monte Carlo."
              : "Configure your desired crypto pair and forecast period above, then press 'Run Quant Simulation' to compute probabilistic trajectories."}
          </p>
          <button
            onClick={handleSimulate}
            className="px-6 py-2.5 rounded-xl bg-[#26A17B] text-black font-bold text-sm hover:bg-[#00D492] transition-all inline-flex items-center gap-2 shadow-lg shadow-[#26A17B]/20 active:scale-95"
          >
            <Play className="w-4 h-4 fill-black stroke-none" />
            {language === "id"
              ? `Jalankan Cepat BNB ${horizon}`
              : `Quick Run BNB ${horizon}`}
          </button>
        </div>
      )}
    </div>
  );
}
