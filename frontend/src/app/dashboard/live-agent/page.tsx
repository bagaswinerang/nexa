"use client";

import { useLanguage } from "@/components/layout/language-provider";
import { useAccount } from "wagmi";
import ConnectWallet from "@/components/layout/connect-wallet";
import LivePancakeSwapCard from "@/components/dashboard/live-pancakeswap-card";
import { Zap, ShieldCheck, ArrowRight, Bot, Coins, Cpu } from "lucide-react";
import Link from "next/link";

export default function LiveAgentPage() {
  const { language } = useLanguage();
  const { address } = useAccount();
  const targetWallet = address ? address.toLowerCase() : "";

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
              {language === "id"
                ? "Trading On-Chain Asli"
                : "Live On-Chain Trading"}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              PancakeSwap V2 • BSC Testnet (97) / Mainnet (56)
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            {language === "id" ? "AI Agent Live DEX" : "Live Agent DEX Trading"}
            <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
              Autonomous Bot
            </span>
          </h1>

          <p className="text-sm text-slate-400 max-w-2xl mt-1">
            {language === "id"
              ? "Robot AI mengeksekusi order nyata langsung ke PancakeSwap Router di blockchain. Saldo modal, gas fee tBNB, dan transaksi tercatat permanen di BSC Explorer."
              : "Autonomous AI Agent executing live swaps directly on the PancakeSwap DEX Router. Balances and transaction hashes are verifiable on BscScan."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ConnectWallet />
          <Link
            href="/dashboard/trading"
            className="px-3.5 py-2 rounded-xl border border-white/10 bg-[#080B11] text-xs font-mono text-slate-300 hover:text-white hover:border-[#00D492]/40 transition-all flex items-center gap-1.5"
          >
            <Bot className="w-3.5 h-3.5 text-[#00D492]" />
            <span>
              {language === "id" ? "Ke Sandbox Latihan" : "To Paper Sandbox"}
            </span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface/40 border border-white/5 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
            <Cpu className="w-4 h-4" />
            1. Autonomous Signer
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {language === "id"
              ? "Agent memegang wallet signer sendiri di server, sehingga dapat bertransaksi instan tanpa popup izin terus-menerus."
              : "The agent holds its own dedicated signer wallet on the backend to execute trades autonomously without manual approval prompts."}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface/40 border border-white/5 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
            <Coins className="w-4 h-4" />
            2. Real DEX Liquidity
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {language === "id"
              ? "Semua token yang dibeli/dijual adalah saldo token nyata (tBNB & tUSDT) yang terikat langsung ke smart contract PancakeSwap Router."
              : "Tokens swapped represent real on-chain balances (tBNB & tUSDT) processed by the PancakeSwap liquidity pools."}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface/40 border border-white/5 space-y-1.5">
          <div className="flex items-center gap-2 text-accent text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            3. Verifiable & RAG Ready
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {language === "id"
              ? "Setiap trade memiliki Transaction Hash BscScan dan otomatis diindeks vector di database agar Chatbot AI tahu histori Anda."
              : "Every swap produces a verifiable BscScan transaction hash, auto-indexed in the database for contextual chatbot queries."}
          </p>
        </div>
      </div>

      {/* Main Execution Card */}
      <LivePancakeSwapCard userAddress={targetWallet} />
    </div>
  );
}
