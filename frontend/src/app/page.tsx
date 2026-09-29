"use client";

import Link from "next/link";
import {
  BarChart3,
  Bot,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet,
  Activity,
  Cpu,
} from "lucide-react";

import NexaLettermark from "@/components/brand/logo";
import ConnectWallet from "@/components/layout/connect-wallet";
import LanguageSelector from "@/components/layout/language-selector";
import CardSpotlight from "@/components/ui/card-spotlight";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import QuantStat from "@/components/ui/quant-stat";
import { useLanguage } from "@/components/layout/language-provider";

export default function LandingPage() {
  const { language } = useLanguage();

  const copy = language === "id" ? {
    features: "Fitur", quant: "Mesin Kuant", howItWorks: "Cara Kerja", badge: "Kecerdasan Kuantitatif Web3 AI & Terminal DeFi",
    headlineStart: "Kecerdasan DeFi", headlineAccent: "Kelas Institusi", headlineEnd: "Bertenaga AI",
    subtitle: "Prediksi pasar kripto dengan 1.000+ jalur probabilitas Monte Carlo, analisis bersama AI Gemini, dan kelola jurnal keuangan on-chain Anda di BNB Smart Chain.", dashboard: "Dashboard", architecture: "Jelajahi Arsitektur",
    paths: "Jalur Monte Carlo", sentiment: "Indeks BNB/USDT", reasoning: "Mesin Penalaran", settlement: "Jaringan Penyelesaian", pathsChange: "Gerak Brownian Geometrik", live: "+0,12% (24j)", reasoningValue: "Gemini Flash", reasoningChange: "Mode Berpikir", settlementValue: "Jaringan BSC", settlementChange: "Bukti Instan",
    architectureLabel: "Arsitektur Generasi Berikutnya", infrastructure: "Infrastruktur Kelas Institusi", infrastructureDescription: "Menggabungkan algoritma kuantitatif Python terdistribusi dengan penalaran generatif dan integritas blockchain EVM.",
    monteCarlo: "Mesin Kuant Monte Carlo", monteCarloDescription: "Mensimulasikan 1.000 kemungkinan pergerakan harga dengan Geometric Brownian Motion dan volatilitas Binance aktual.", assistant: "Asisten AI Chain-of-Thought", assistantDescription: "Penalaran interaktif dengan model Gemini. Tinjau pemikiran internal AI, perencanaan strategi, dan bukti perhitungan.", journal: "Jurnal Keuangan On-Chain", journalDescription: "Pencatatan pendapatan dan pengeluaran yang tidak dapat diubah langsung ke kontrak pintar BNB Smart Chain.",
    ticker: "Ticker Pasar & Sentimen Langsung", tickerDescription: "Terhubung ke node data Binance multiwilayah untuk menyediakan harga real-time, indeks volatilitas 24 jam, dan sentimen Fear & Greed bahkan saat terdapat pembatasan ISP lokal.", operational: "Beroperasi", wallets: "Onboarding Multi-Wallet Mulus", walletsDescription: "Mendukung MetaMask, Rabby Wallet, Trust Wallet, Rainbow, dan WalletConnect dengan perpindahan jaringan otomatis ke BSC Testnet serta sinkronisasi saldo.", supportedWallets: "Dompet yang Didukung", footer: "Dibuat untuk Hackathon BNB Smart Chain.", runValue: "1.000 / proses", pythonEngine: "Mesin Python", liveVision: "Vision API Langsung", chainOfThought: "Alur Berpikir", smartContract: "Kontrak Pintar", reasoningBadge: "Mode Penalaran", thinkingFlow: "Alur Berpikir AI", evaluation: "> Mengevaluasi volatilitas BNB & pita risiko...", visionFallback: "Fallback Vision API Langsung", walletStandard: "Standar EVM Multi-Dompet"
  } : {
    features: "Features", quant: "Quant Engine", howItWorks: "How It Works", badge: "Web3 AI Quantitative Intelligence & DeFi Terminal",
    headlineStart: "Institutional", headlineAccent: "DeFi Intelligence", headlineEnd: "Powered by AI",
    subtitle: "Predict crypto markets with 1,000+ Monte Carlo probability paths, chat with Gemini reasoning AI, and manage your on-chain financial journal on BNB Smart Chain.", dashboard: "Dashboard", architecture: "Explore Architecture",
    paths: "Monte Carlo Paths", sentiment: "BNB/USDT Index", reasoning: "Reasoning Engine", settlement: "Settlement Chain", pathsChange: "Geometric Brownian", live: "+0.12% (24h)", reasoningValue: "Gemini Flash", reasoningChange: "Thinking Mode", settlementValue: "BSC Network", settlementChange: "Instant Proof",
    architectureLabel: "Next-Generation Architecture", infrastructure: "Institutional Grade Infrastructure", infrastructureDescription: "Combining distributed Python quantitative algorithms with generative reasoning and EVM blockchain integrity.",
    monteCarlo: "Monte Carlo Quant Engine", monteCarloDescription: "Simulates 1,000 possible future price trajectories using Geometric Brownian Motion and real Binance volatility.", assistant: "Chain-of-Thought AI Assistant", assistantDescription: "Interactive reasoning with Gemini models. Inspect the AI's internal thoughts, strategy planning, and math proofs.", journal: "On-Chain Financial Journal", journalDescription: "Immutable recording of income and expenditure directly into BNB Smart Chain smart contracts.",
    ticker: "Live Market Ticker & Sentiment", tickerDescription: "Connects directly to multi-region Binance data nodes to ensure real-time price feeds, 24h volatility index, and market Fear & Greed sentiment even with local ISP restrictions.", operational: "Operational", wallets: "Seamless Multi-Wallet Onboarding", walletsDescription: "Support for MetaMask, Rabby Wallet, Trust Wallet, Rainbow, and WalletConnect with automatic network switching to BSC Testnet and balance synchronization.", supportedWallets: "Supported Wallets", footer: "Built for BNB Smart Chain Hackathon.", runValue: "1,000 / run", pythonEngine: "Python Engine", liveVision: "Live Vision API", chainOfThought: "Chain-of-Thought", smartContract: "Smart Contract", reasoningBadge: "Reasoning Mode", thinkingFlow: "AI Thought Process", evaluation: "> Evaluating BNB volatility & risk bands...", visionFallback: "Direct Vision API Fallback", walletStandard: "Multi-Wallet EVM Standard"
  };
  return (
    <div className="min-h-screen bg-[#080B11] text-white overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[650px] h-[650px] bg-[#26A17B]/10 rounded-full blur-[150px]" />
        <div className="absolute top-[40%] right-[-5%] w-[550px] h-[550px] bg-[#00D492]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-[#26A17B]/5 rounded-full blur-[150px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between md:grid md:grid-cols-3 md:items-center px-6 sm:px-8 md:px-12 py-3.5 sm:py-4 md:py-5 max-w-7xl mx-auto border-b border-white/5 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <NexaLettermark size={30} showWordmark={true} />
        </Link>

        <div className="hidden md:flex items-center justify-center gap-6 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">
            {copy.features}
          </a>
          <a href="#quant" className="hover:text-white transition-colors">
            {copy.quant}
          </a>
          <a href="#how-it-works" className="hover:text-white transition-colors">
            {copy.howItWorks}
          </a>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <LanguageSelector />
          <ConnectWallet />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 md:px-12 pt-10 sm:pt-16 md:pt-20 pb-16 sm:pb-20 md:pb-28">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-[#26A17B]/10 border border-[#26A17B]/30 mb-6 sm:mb-8 animate-fade-in max-w-full">
            <Sparkles className="w-3.5 h-3.5 text-[#00D492] shrink-0" />
            <span className="text-[11px] sm:text-xs text-[#00D492] font-mono font-medium tracking-wide">
              {copy.badge}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold leading-[1.2] sm:leading-tight tracking-tight mb-4 sm:mb-6 animate-slide-up">
            {copy.headlineStart}{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00D492] via-[#26A17B] to-emerald-400">
              {copy.headlineAccent}
            </span>{" "}
            {copy.headlineEnd}
          </h1>

          {/* Subtitle */}
          <p
            className="text-sm sm:text-base md:text-lg text-gray-400 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2 sm:px-0 animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            {copy.subtitle}
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-slide-up w-full max-w-xs sm:max-w-none mx-auto"
            style={{ animationDelay: "0.2s" }}
          >
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-7 sm:px-8 py-3.5 rounded-xl bg-[#26A17B] text-black text-sm sm:text-base font-bold hover:bg-[#00D492] transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#26A17B]/25 active:scale-95"
            >
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
              {copy.dashboard}
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-7 sm:px-8 py-3.5 rounded-xl bg-[#0D121C] border border-[#1E2738] text-gray-300 text-sm sm:text-base font-medium hover:border-[#26A17B]/50 hover:text-white transition-all text-center justify-center"
            >
              {copy.architecture}
            </a>
          </div>
        </div>

        {/* Quant KPI Metrics (Tremor-style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-12 sm:mt-16 md:mt-20">
          <QuantStat
            title={copy.paths}
            value={copy.runValue}
            change={copy.pathsChange}
            isPositive={true}
            sublabel={copy.pythonEngine}
            icon={<Cpu className="w-4 h-4" />}
            tag="Quant"
          />
          <QuantStat
            title={copy.sentiment}
            value="$773.61"
            change={copy.live}
            isPositive={true}
            sublabel={copy.liveVision}
            icon={<TrendingUp className="w-4 h-4" />}
            tag="Market"
          />
          <QuantStat
            title={copy.reasoning}
            value={copy.reasoningValue}
            change={copy.reasoningChange}
            isPositive={true}
            sublabel={copy.chainOfThought}
            icon={<Bot className="w-4 h-4" />}
            tag="AI"
          />
          <QuantStat
            title={copy.settlement}
            value={copy.settlementValue}
            change={copy.settlementChange}
            isPositive={true}
            sublabel={copy.smartContract}
            icon={<Shield className="w-4 h-4" />}
            tag="Web3"
          />
        </div>
      </section>

      {/* Bento Grid Features (Aceternity UI Style) */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 md:px-12 py-12 sm:py-16 md:py-20 border-t border-white/5">
        <div id="how-it-works" className="text-center mb-10 sm:mb-16 scroll-mt-24">
          <div className="text-xs font-mono text-[#00D492] uppercase tracking-widest mb-2">
            {copy.architectureLabel}
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight">
            {copy.infrastructure}
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm max-w-xl mx-auto mt-2 sm:mt-3 px-2 sm:px-0">
            {copy.infrastructureDescription}
          </p>
        </div>

        <BentoGrid className="gap-4 sm:gap-6">
          <BentoGridItem
            title={copy.monteCarlo}
            description={copy.monteCarloDescription}
            badge="Python 3.12"
            icon={<BarChart3 className="w-5 h-5 text-[#00D492]" />}
            header={
              <div className="h-28 sm:h-32 w-full rounded-xl bg-[#080B11] border border-white/5 p-4 flex items-center justify-center font-mono text-xs text-[#00D492]">
                {"dS = \u03BCS dt + \u03C3S dW"}
              </div>
            }
          />
          <BentoGridItem
            title={copy.assistant}
            description={copy.assistantDescription}
            badge={copy.reasoningBadge}
            icon={<Bot className="w-5 h-5 text-[#00D492]" />}
            header={
              <div className="h-28 sm:h-32 w-full rounded-xl bg-[#080B11] border border-white/5 p-4 flex flex-col justify-center gap-2">
                <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-[#00D492] animate-ping" />
                  {copy.thinkingFlow}
                </div>
                <div className="text-[11px] font-mono text-gray-500 truncate">
                  {copy.evaluation}
                </div>
              </div>
            }
          />
          <BentoGridItem
            title={copy.journal}
            description={copy.journalDescription}
            badge="BSC EVM"
            icon={<Shield className="w-5 h-5 text-[#00D492]" />}
            header={
              <div className="h-28 sm:h-32 w-full rounded-xl bg-[#080B11] border border-white/5 p-4 flex items-center justify-center">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-[#26A17B]/40" />
              </div>
            }
          />
        </BentoGrid>
      </section>

      {/* Spotlight Cards Section */}
      <section id="quant" className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 md:px-12 py-12 sm:py-16 md:py-20 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 items-stretch">
          <CardSpotlight className="h-full">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#26A17B]/10 border border-[#26A17B]/20 flex items-center justify-center text-[#00D492] shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">{copy.ticker}</h3>
                  <span className="text-xs font-mono text-[#00D492]">{copy.visionFallback}</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-6">
                {copy.tickerDescription}
              </p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-xl bg-[#080B11] border border-white/5 flex items-center justify-between font-mono text-xs mt-auto h-12 sm:h-14">
              <span className="text-gray-400">Binance Vision API</span>
              <span className="text-[#00D492] flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D492]" /> {copy.operational}
              </span>
            </div>
          </CardSpotlight>

          <CardSpotlight className="h-full">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#26A17B]/10 border border-[#26A17B]/20 flex items-center justify-center text-[#00D492] shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">{copy.wallets}</h3>
                  <span className="text-xs font-mono text-[#00D492]">{copy.walletStandard}</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-6">
                {copy.walletsDescription}
              </p>
            </div>
            <div className="p-3.5 sm:p-4 rounded-xl bg-[#080B11] border border-white/5 flex items-center justify-between font-mono text-xs mt-auto h-12 sm:h-14">
              <span className="text-gray-400">{copy.supportedWallets}</span>
              <span className="text-[#00D492] flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D492]" /> MetaMask, Rabby &amp; Trust
              </span>
            </div>
          </CardSpotlight>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 md:px-12 py-8 sm:py-10 md:py-12 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 font-mono text-center sm:text-left">
        <div className="flex items-center gap-2">
          <NexaLettermark size={22} />
          <span>&copy; 2026 Nexa DeFi. {copy.footer}</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="hover:text-white transition-colors">{copy.dashboard}</Link>
          <a href="https://testnet.bscscan.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">BscScan</a>
        </div>
      </footer>
    </div>
  );
}






