"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  ShieldCheck,
  Coins,
  ArrowDownLeft,
} from "lucide-react";
import { useLanguage } from "@/components/layout/language-provider";

interface BalanceCardsProps {
  totalEquity?: number;
  netPnL?: number;
  totalDeposit?: number;
  totalWithdrawal?: number;
  winRate?: number;
  isConnected?: boolean;
}

export default function BalanceCards({
  totalEquity = 0,
  netPnL = 0,
  totalDeposit = 0,
  totalWithdrawal = 0,
  winRate = 0,
  isConnected = false,
}: BalanceCardsProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Equity Card (Institutional Hero) */}
      <div className="glass-card p-6 col-span-1 md:col-span-2 relative overflow-hidden group hover:border-[#26A17B]/40 transition-all duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#26A17B]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#26A17B]/15 border border-[#26A17B]/30 flex items-center justify-center text-[#00D492]">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs uppercase font-mono text-gray-400 tracking-wider">
                  {t("activeTradingEquity")}
                </span>
                <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#00D492]" />
                  {t("bscProof")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#26A17B]/10 border border-[#26A17B]/20 text-[#00D492] text-xs font-mono font-medium">
              <Coins className="w-3.5 h-3.5" />
              <span>BEP-20 / EVM</span>
            </div>
          </div>

          <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-white mb-3">
            ${totalEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-sans font-medium text-gray-400">USDT</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-1 text-[#00D492] font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              +{winRate}% {t("winRate")}
            </div>
            <span className="text-gray-500">{t("winRateClosed")}</span>
          </div>
        </div>
      </div>

      {/* Net PnL Card */}
      <div className="glass-card p-6 relative overflow-hidden hover:border-[#00D492]/40 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#00D492]/10 border border-[#00D492]/20 flex items-center justify-center text-[#00D492]">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-white/[0.04] text-gray-400">
            {t("realized")}
          </span>
        </div>
        <div className="text-xs uppercase font-mono text-gray-400 mb-1">
          {t("netRealizedPnL")}
        </div>
        <div
          className={`text-lg sm:text-xl md:text-2xl font-bold font-mono ${
            netPnL >= 0 ? "text-[#00D492]" : "text-rose-400"
          }`}
        >
          {netPnL >= 0 ? "+" : "-"}${Math.abs(netPnL).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-gray-500 font-mono mt-2">
          {t("gainsMinusLosses")}
        </div>
      </div>

      {/* Capital Inflow/Outflow Card */}
      <div className="glass-card p-6 relative overflow-hidden hover:border-blue-500/40 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-white/[0.04] text-gray-400">
            {t("capital")}
          </span>
        </div>
        <div className="text-xs uppercase font-mono text-gray-400 mb-1">
          {t("depositsWithdrawals")}
        </div>
        <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-white">
          ${totalDeposit.toLocaleString("en-US", { minimumFractionDigits: 0 })} <span className="text-xs text-gray-400 font-sans font-normal">{t("in")}</span> / ${totalWithdrawal.toLocaleString("en-US", { minimumFractionDigits: 0 })} <span className="text-xs text-gray-400 font-sans font-normal">{t("out")}</span>
        </div>
        <div className="text-[11px] text-gray-500 font-mono mt-2">
          {t("netCapitalIn")}: ${(totalDeposit - totalWithdrawal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}
