"use client";

import { useEffect, useRef, useState } from "react";
import {
  Zap,
  ExternalLink,
  Wallet,
  Coins,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Minus,
  X,
  ShieldCheck,
  Loader2,
  Bot,
  Cpu,
} from "lucide-react";
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useWriteContract,
} from "wagmi";
import { parseEther, parseUnits, type Address } from "viem";
import {
  getLiveBalances,
  executeLiveSwap,
  executeLiveAutoTrade,
  getLiveAutoTradeStatus,
  stopLiveAutoTrade,
  executeLiveWithdrawal,
  getTransactionSummary,
  getPaperPredictions,
  getTransactions,
  createTransaction,
  type PaperPrediction,
  type LiveBalancesResponse,
  type LiveAutonomousStatus,
  type LiveAutonomousDecision,
  type Transaction,
  type TransactionSummary,
} from "@/lib/api";
import { TRADING_UI_CONFIG } from "@/config/trading-config";

const USDT_TESTNET_ADDRESS =
  "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as Address;

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface LivePancakeSwapCardProps {
  userAddress: string;
}

type AgentActivityRow = {
  id: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number | null;
  summary: string;
  timestamp: string;
  status: string;
  txHash?: string;
  explorerUrl?: string;
};

export default function LivePancakeSwapCard({
  userAddress,
}: LivePancakeSwapCardProps) {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [balances, setBalances] = useState<LiveBalancesResponse | null>(null);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isAutoExecuting, setIsAutoExecuting] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [analysisCycle, setAnalysisCycle] = useState<{
    state: "idle" | "analyzing" | "error";
    error?: string;
    startedAt?: string;
  }>({ state: "idle" });
  const [copied, setCopied] = useState(false);
  const [amountUsdt, setAmountUsdt] = useState<number>(
    TRADING_UI_CONFIG.SWAP.DEFAULT_INPUT_USDT,
  );
  const [paperPredictions, setPaperPredictions] = useState<PaperPrediction[]>(
    [],
  );
  const [tradeJournal, setTradeJournal] = useState<Transaction[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const lastAutoTradeHashRef = useRef<string | null>(null);
  const [autoDecisionLogs, setAutoDecisionLogs] = useState<
    LiveAutonomousDecision[]
  >([]);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
    txHash?: string;
  } | null>(null);

  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    action: string;
    confidence: number;
    summary: string;
    reasoning: string;
    executed: boolean | null;
    source: "session" | "paper";
    timestamp?: string;
  } | null>(null);

  // Auto Trade Confirmation Modal
  const [isAutoConfirmOpen, setIsAutoConfirmOpen] = useState(false);

  // Deposit & Withdrawal Modal States
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [depositCurrency, setDepositCurrency] = useState<"BNB" | "USDT">("BNB");
  const [depositAmount, setDepositAmount] = useState<number>(
    TRADING_UI_CONFIG.DEPOSIT.DEFAULT_BNB,
  );
  const [withdrawCurrency, setWithdrawCurrency] = useState<"BNB" | "USDT">(
    "USDT",
  );
  const [withdrawAmount, setWithdrawAmount] = useState<number>(
    TRADING_UI_CONFIG.WITHDRAW.DEFAULT_USDT,
  );
  const [isSigningWallet, setIsSigningWallet] = useState(false);

  const fetchBalancesAndSummary = async () => {
    setIsLoading(true);
    try {
      const [liveBal, userSummary] = await Promise.all([
        getLiveBalances(),
        userAddress
          ? getTransactionSummary(userAddress).catch(() => null)
          : Promise.resolve(null),
      ]);
      setBalances(liveBal);
      if (userSummary) {
        setSummary(userSummary);
      } else if (!userAddress) {
        setSummary(null);
      }
    } catch (err) {
      console.error("Failed to load balances & summary:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyAutoStatus = (status?: LiveAutonomousStatus) => {
    if (!status || typeof status.active !== "boolean") {
      setMessage({
        type: "error",
        text: "Status AI Agent tidak valid dari backend. Restart backend lalu coba lagi.",
      });
      return;
    }
    setIsAutoRunning(status.active);
    setIsAutoPaused(status.paused ?? false);
    const cycleError = status.pause_reason || status.last_error;
    const isAnalyzing =
      status.is_analyzing ??
      (status.active &&
        Boolean(status.last_cycle_at) &&
        !status.last_recommendation &&
        !status.last_error);
    setAnalysisCycle({
      state: cycleError ? "error" : isAnalyzing ? "analyzing" : "idle",
      error: cycleError,
      startedAt: status.last_cycle_at,
    });
    if (status.recent_decisions?.length)
      setAutoDecisionLogs(status.recent_decisions);
    if (status.last_recommendation) {
      const decision = status.recent_decisions?.[0];
      setAiAnalysisResult({
        action: status.last_recommendation.action,
        confidence: status.last_recommendation.confidence,
        summary: status.last_recommendation.summary,
        reasoning: status.last_recommendation.reasoning,
        executed: decision?.executed ?? null,
        source: "session",
        timestamp: status.last_cycle_at,
      });
    }
    const latestDecision = status.recent_decisions?.[0];
    if (
      latestDecision?.executed &&
      status.last_trade?.success &&
      status.last_trade.txHash !== lastAutoTradeHashRef.current
    ) {
      lastAutoTradeHashRef.current = status.last_trade.txHash;
      setMessage({
        type: "success",
        text: "AI Recommend berhasil dieksekusi di PancakeSwap. Tx Hash terverifikasi di BscScan.",
        txHash: status.last_trade.txHash,
      });
      void fetchBalancesAndSummary();
    }
  };
  useEffect(() => {
    fetchBalancesAndSummary();
  }, [userAddress]);

  useEffect(() => {
    setIsAutoRunning(false);
    setIsAutoPaused(false);
    setAnalysisCycle({ state: "idle" });
    setAutoDecisionLogs([]);
    setPaperPredictions([]);
    setTradeJournal([]);
    lastAutoTradeHashRef.current = null;
    setAiAnalysisResult(null);
    if (!userAddress) {
      return;
    }

    let disposed = false;
    const refreshAutoStatus = async () => {
      try {
        const [statusResult, paperResult, transactionResult] =
          await Promise.all([
            getLiveAutoTradeStatus(userAddress).catch((error) => {
              console.error("Failed to load autonomous trading status:", error);
              return null;
            }),
            getPaperPredictions(userAddress, 50).catch(() => null),
            getTransactions(userAddress, 100).catch(() => null),
          ]);
        if (disposed) return;
        setHistoryError(
          paperResult && transactionResult
            ? null
            : "Riwayat Supabase belum tersedia. Periksa koneksi backend dan migrasi database.",
        );
        if (statusResult) applyAutoStatus(statusResult.status);
        if (paperResult) {
          setPaperPredictions(paperResult.predictions);
          if (
            !statusResult?.status.last_recommendation &&
            paperResult.predictions[0]
          ) {
            const latest = paperResult.predictions[0];
            setAiAnalysisResult(
              (current) =>
                current ?? {
                  action: latest.action,
                  confidence: latest.confidence,
                  summary: latest.summary,
                  reasoning: latest.reasoning,
                  executed: null,
                  source: "paper",
                  timestamp: latest.predicted_at,
                },
            );
          }
        }
        if (transactionResult) {
          setTradeJournal(
            transactionResult.transactions.filter(
              (transaction) => transaction.category === "Live Trade",
            ),
          );
        }
      } catch (error) {
        console.error("Failed to load AI Agent history:", error);
      }
    };

    void refreshAutoStatus();
    const interval = window.setInterval(() => void refreshAutoStatus(), 10_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [userAddress]);

  const handleCopyWallet = () => {
    if (balances?.wallet_address) {
      navigator.clipboard.writeText(balances.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ─── REAL ON-CHAIN DEPOSIT (SIGNS WITH WALLET) ──────────────
  const handleConfirmDeposit = async () => {
    if (!userAddress) {
      setMessage({
        type: "error",
        text: "Silakan hubungkan dompet Web3 Anda terlebih dahulu.",
      });
      return;
    }
    if (!depositAmount || depositAmount <= 0) return;
    if (!balances?.wallet_address) {
      setMessage({
        type: "error",
        text: "Alamat agent wallet belum tersedia di backend.",
      });
      return;
    }
    if (!publicClient) {
      setMessage({
        type: "error",
        text: "Koneksi ke blockchain BSC belum siap.",
      });
      return;
    }

    setIsSigningWallet(true);
    setMessage(null);

    try {
      let onChainTxHash: string;

      if (depositCurrency === "BNB") {
        onChainTxHash = await sendTransactionAsync({
          to: balances.wallet_address as Address,
          value: parseEther(depositAmount.toString()),
        });
      } else {
        onChainTxHash = await writeContractAsync({
          address: USDT_TESTNET_ADDRESS,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [
            balances.wallet_address as Address,
            parseUnits(depositAmount.toString(), 18),
          ],
        });
      }

      setMessage({
        type: "info",
        text: `Transaksi dikirim ke BSC (${onChainTxHash.slice(0, 10)}...). Menunggu konfirmasi on-chain...`,
        txHash: onChainTxHash,
      });

      await publicClient.waitForTransactionReceipt({
        hash: onChainTxHash as Address,
      });

      await createTransaction({
        user_address: userAddress,
        amount: depositAmount,
        category: "Deposit",
        note: `On-chain deposit ${depositAmount} ${depositCurrency === "BNB" ? "tBNB" : "tUSDT"} ke Nexa Agent`,
        is_income: true,
        pair: depositCurrency === "BNB" ? "tBNB" : "tUSDT",
        tx_hash: onChainTxHash,
      });

      setMessage({
        type: "success",
        text: `Deposit ${depositAmount} ${depositCurrency === "BNB" ? "tBNB" : "tUSDT"} Berhasil & Terkonfirmasi On-Chain!`,
        txHash: onChainTxHash,
      });

      setIsDepositModalOpen(false);
      fetchBalancesAndSummary();
    } catch (err: any) {
      const errMsg =
        err?.shortMessage || err?.message || "Deposit dibatalkan atau gagal";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setIsSigningWallet(false);
    }
  };

  // ─── REAL ON-CHAIN WITHDRAWAL ──────────────────────────────────
  const handleConfirmWithdraw = async () => {
    if (!userAddress) {
      setMessage({
        type: "error",
        text: "Silakan hubungkan dompet Web3 Anda terlebih dahulu.",
      });
      return;
    }
    if (!withdrawAmount || withdrawAmount <= 0) return;

    setIsSigningWallet(true);
    setMessage(null);

    try {
      const res = await executeLiveWithdrawal({
        user_address: userAddress,
        amount: withdrawAmount,
        token: withdrawCurrency,
      });

      setMessage({
        type: "success",
        text: `Penarikan ${withdrawAmount} ${withdrawCurrency === "BNB" ? "tBNB" : "tUSDT"} Berhasil! Token dikirim langsung dari Agent ke dompet Anda.`,
        txHash: res.withdrawal.txHash,
      });

      setIsWithdrawModalOpen(false);
      fetchBalancesAndSummary();
    } catch (err: any) {
      const errMsg = err?.message || "Penarikan gagal diproses";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setIsSigningWallet(false);
    }
  };

  // ─── REAL SWAP EXECUTION ON PANCAKESWAP ─────────────────────────
  const handleManualSwap = async (action: "BUY" | "SELL") => {
    if (!userAddress) {
      setMessage({
        type: "error",
        text: "Silakan hubungkan dompet Web3 Anda terlebih dahulu.",
      });
      return;
    }
    setIsSwapping(true);
    setMessage(null);
    try {
      const res = await executeLiveSwap({
        user_address: userAddress,
        action,
        amount_usdt: amountUsdt,
        symbol: "BNBUSDT",
        reasoning: `Manual swap on PancakeSwap by ${userAddress.slice(0, 6)}...`,
      });

      setMessage({
        type: "success",
        text: `Swap on PancakeSwap Berhasil! Tx Hash terverifikasi di BscScan.`,
        txHash: res.trade.txHash,
      });
      fetchBalancesAndSummary();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Swap failed";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAutoTradeClick = () => {
    if (!userAddress) {
      setMessage({
        type: "error",
        text: "Silakan hubungkan dompet Web3 Anda terlebih dahulu.",
      });
      return;
    }
    setIsAutoConfirmOpen(true);
  };

  const handleAutoTradeExecute = async () => {
    setIsAutoConfirmOpen(false);
    setIsAutoExecuting(true);
    setMessage(null);
    setAiAnalysisResult(null);
    try {
      const response = await executeLiveAutoTrade({
        user_address: userAddress,
        symbol: "BNBUSDT",
      });
      if (!response.status)
        throw new Error("Backend tidak mengembalikan status AI Agent.");
      applyAutoStatus(response.status);
      setMessage({
        type: "success",
        text: "AI Agent aktif dan akan terus menganalisis serta mengeksekusi sinyal sampai Anda menekan Stop.",
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Auto execution failed";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setIsAutoExecuting(false);
    }
  };

  const handleStopAutoTrade = async () => {
    if (!userAddress) return;
    setIsAutoExecuting(true);
    try {
      await stopLiveAutoTrade(userAddress);
      setIsAutoRunning(false);
      setMessage({
        type: "info",
        text: "AI Agent dihentikan. Tidak ada siklus trading baru yang akan dijalankan.",
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Unable to stop AI Agent";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setIsAutoExecuting(false);
    }
  };

  const userActiveCapital = summary?.active_balance ?? 0;
  const userTotalDeposit = summary?.total_deposit ?? 0;
  const userTotalWithdraw = summary?.total_withdrawal ?? 0;

  const agentExplorerBase = balances?.network.includes("Testnet")
    ? "https://testnet.bscscan.com"
    : "https://bscscan.com";
  const agentWalletExplorerUrl = balances?.wallet_address
    ? `${agentExplorerBase}/address/${balances.wallet_address}`
    : "";
  const latestPaperPrediction = paperPredictions[0];
  const analysisToDisplay =
    aiAnalysisResult ??
    (latestPaperPrediction
      ? {
          action: latestPaperPrediction.action,
          confidence: latestPaperPrediction.confidence,
          summary: latestPaperPrediction.summary,
          reasoning: latestPaperPrediction.reasoning,
          executed: null,
          source: "paper" as const,
          timestamp: latestPaperPrediction.predicted_at,
        }
      : null);
  const analysisActionColor =
    analysisToDisplay?.action === "BUY"
      ? "text-emerald-400"
      : analysisToDisplay?.action === "SELL"
        ? "text-rose-400"
        : analysisToDisplay?.action === "HOLD"
          ? "text-amber-400"
          : "text-slate-400";
  const analysisBadgeColor =
    analysisCycle.state === "analyzing"
      ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
      : analysisCycle.state === "error"
        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
        : analysisToDisplay?.executed === true ||
            analysisToDisplay?.action === "BUY"
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          : analysisToDisplay?.action === "SELL"
            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
            : "bg-amber-500/10 text-amber-400 border-amber-500/30";
  const decisionLogRows: AgentActivityRow[] = autoDecisionLogs.length
    ? autoDecisionLogs.map((decision) => ({
        id: `${decision.timestamp}-${decision.action}`,
        action: decision.action,
        confidence: decision.confidence,
        summary: decision.summary,
        reasoning: decision.reasoning,
        timestamp: decision.timestamp,
        status: decision.executed ? "on-chain executed" : "no swap",
        txHash: decision.trade?.txHash,
        explorerUrl: decision.trade?.explorerUrl,
      }))
    : paperPredictions.map((prediction) => ({
        id: prediction.id,
        action: prediction.action,
        confidence: prediction.confidence,
        summary: prediction.summary,
        reasoning: prediction.reasoning,
        timestamp: prediction.predicted_at,
        status: !prediction.settled_at
          ? "menunggu hasil 24 jam"
          : prediction.direction_correct
            ? "arah tepat"
            : "arah meleset",
      }));
  const decisionTradeHashes = new Set(
    decisionLogRows
      .map((row) => row.txHash)
      .filter((hash): hash is string => Boolean(hash)),
  );
  const liveTradeRows: AgentActivityRow[] = tradeJournal
    .map((transaction) => {
      const note = String(transaction.note || "")
        .replace(/^\[PancakeSwap On-Chain\]\s*/, "")
        .replace(/\s*\.\s*Reasoning:[\s\S]*$/, "")
        .replace(/\bBNBUSDT\b/g, "BNB/USDT")
        .replace(/\s*[·]\s*(?=\d)/, " — Ditukar ");
      const action = /^(BUY|SELL|HOLD)\b/.exec(note)?.[1] as
        | "BUY"
        | "SELL"
        | "HOLD"
        | undefined;
      const hash = transaction.tx_hash || "";
      const isTestnet = transaction.pair?.startsWith("t") ?? false;
      const explorerBase = isTestnet
        ? "https://testnet.bscscan.com"
        : "https://bscscan.com";
      return {
        id: `trade-${transaction.id}`,
        action: action ?? "HOLD",
        confidence: null,
        summary: action ? note.slice(action.length).trimStart() : note,
        timestamp: transaction.created_at,
        status: "swap on-chain confirmed",
        txHash: /^0x[a-fA-F0-9]{64}$/.test(hash) ? hash : undefined,
        explorerUrl: /^0x[a-fA-F0-9]{64}$/.test(hash)
          ? `${explorerBase}/tx/${hash}`
          : undefined,
      };
    })
    .filter((row) => !row.txHash || !decisionTradeHashes.has(row.txHash));
  const activityLogRows = [...decisionLogRows, ...liveTradeRows]
    .sort(
      (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    )
    .slice(0, 50);
  return (
    <div className="bg-[#12161f]/90 border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background glow badge */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-wide">
                Nexa Autonomous BNB Agent
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                Real On-Chain
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Agent mengeksekusi order riil di PancakeSwap menggunakan modal
              yang Anda depositkan via tanda tangan wallet.
            </p>
          </div>
        </div>

        <button
          onClick={fetchBalancesAndSummary}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* ─── REAL USER CAPITAL DEPOSIT / WITHDRAWAL BAR ──────────────── */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-[#0b0e14] to-cyan-500/10 border border-emerald-500/30 mb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Modal Pribadi Dompet Anda di Agent
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-amber-400">
                  {balances?.bnb_balance.toFixed(4) ?? "0.0000"}{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    tBNB
                  </span>
                </span>
              </div>
              <div className="hidden sm:block w-px h-8 bg-white/10"></div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-emerald-400">
                  ${balances?.usdt_balance.toFixed(4) ?? "0.0000"}{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    tUSDT
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDepositModalOpen(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Deposit Modal
            </button>
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Minus className="w-3.5 h-3.5" />
              Tarik (Withdraw)
            </button>
          </div>
        </div>
      </div>

      {/* Agent On-Chain Wallet Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-[#0b0e14] p-3.5 rounded-xl border border-white/5">
          <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-slate-400" />
              Official Agent Signer Wallet
            </span>
            {balances?.wallet_address && (
              <button
                onClick={handleCopyWallet}
                className="text-slate-400 hover:text-white flex items-center gap-1"
                title="Copy Address"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
          <div className="font-mono text-xs text-amber-400 truncate">
            {balances?.wallet_address ? (
              <a
                href={agentWalletExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                {balances.wallet_address.slice(0, 8)}...
                {balances.wallet_address.slice(-6)}
                <ExternalLink className="w-3 h-3 inline" />
              </a>
            ) : (
              <span className="text-rose-400">
                Belum di-set di backend/.env
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#0b0e14] p-3.5 rounded-xl border border-white/5">
          <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            Modal & Gas Reserve (tBNB)
          </div>
          <div className="text-base font-bold text-white">
            {balances?.bnb_balance.toFixed(4) ?? "0.0000"}{" "}
            <span className="text-xs text-slate-400 font-normal">tBNB</span>
          </div>
        </div>

        <div className="bg-[#0b0e14] p-3.5 rounded-xl border border-white/5">
          <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            Posisi Trading Agent (tUSDT)
          </div>
          <div className="text-base font-bold text-emerald-400">
            ${balances?.usdt_balance.toFixed(4) ?? "0.0000"}{" "}
            <span className="text-xs text-slate-400 font-normal">
              tUSDT On-Chain
            </span>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row items-end gap-3 mb-4">
        <div className="w-full sm:w-44">
          <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
            Nominal Trade (tUSDT)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
              $
            </span>
            <input
              type="number"
              min="0"
              step="any"
              value={amountUsdt}
              onChange={(e) => setAmountUsdt(Number(e.target.value))}
              className="w-full bg-[#0b0e14] border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 flex-1">
          <button
            onClick={() => handleManualSwap("BUY")}
            disabled={isSwapping || !balances?.configured}
            className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <Coins className="w-3.5 h-3.5" />
            {isSwapping ? "Swapping..." : "BUY tUSDT dari tBNB"}
          </button>

          <button
            onClick={() => handleManualSwap("SELL")}
            disabled={isSwapping || !balances?.configured}
            className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <Coins className="w-3.5 h-3.5" />
            {isSwapping ? "Swapping..." : "SELL tUSDT ke tBNB"}
          </button>

          <button
            onClick={isAutoRunning ? handleStopAutoTrade : handleAutoTradeClick}
            disabled={isAutoExecuting || !balances?.configured}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isAutoExecuting
              ? "Menyiapkan AI..."
              : isAutoRunning
                ? "Stop AI Agent"
                : isAutoPaused
                  ? "Lanjutkan AI Agent"
                  : "Mulai AI Agent"}
          </button>
        </div>
      </div>

      {/* Message Banner with BscScan Link */}
      {message && (
        <div
          className={`p-3 rounded-xl mb-4 text-xs flex flex-wrap items-center justify-between gap-2 border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : message.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-blue-500/10 border-blue-500/30 text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          {message.txHash && (
            <a
              href={`https://testnet.bscscan.com/tx/${message.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:underline flex items-center gap-1 font-mono font-bold"
            >
              Lihat di BscScan <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* AI Analysis Result Card */}
      <div
        className={`mb-5 p-5 rounded-2xl border ${analysisToDisplay?.executed === true ? "bg-emerald-500/10 border-emerald-500/30" : "bg-[#0b0e14] border-white/10"} relative overflow-hidden shadow-lg`}
      >
        <div className="flex items-center gap-2 mb-4">
          <Bot
            className={`w-5 h-5 ${analysisToDisplay?.executed === true ? "text-emerald-400" : "text-amber-400"}`}
          />
          <h4
            className={`text-sm font-bold ${analysisToDisplay?.executed === true ? "text-emerald-400" : "text-white"}`}
          >
            Laporan Analisis AI Agent
          </h4>
          <span
            className={`ml-auto text-[10px] font-mono px-2.5 py-1 rounded-full border font-semibold ${analysisBadgeColor}`}
          >
            {isAutoPaused
              ? "AI AGENT DIJEDA"
              : analysisCycle.state === "analyzing"
                ? "SEDANG MENGANALISIS"
                : analysisCycle.state === "error"
                  ? "ANALISIS GAGAL"
                  : analysisToDisplay?.source === "paper"
                    ? "PREDIKSI TERSIMPAN"
                    : analysisToDisplay?.executed === true
                      ? "EKSEKUSI BERHASIL"
                      : analysisToDisplay?.action === "HOLD"
                        ? "HOLD — MENUNGGU SINYAL"
                        : analysisToDisplay?.action
                          ? "TIDAK DIEKSEKUSI"
                          : "MENUNGGU ANALISIS"}
          </span>
        </div>
        <p
          className={`text-[10px] -mt-2 mb-4 ${analysisCycle.state === "error" ? "text-rose-400" : "text-slate-500"}`}
        >
          {analysisCycle.state === "analyzing"
            ? `Mengambil data market dan menunggu Gemini${analysisCycle.startedAt ? ` · mulai ${new Date(analysisCycle.startedAt).toLocaleTimeString()}` : ""}`
            : analysisCycle.state === "error"
              ? `Siklus terakhir gagal: ${analysisCycle.error}`
              : analysisToDisplay?.timestamp
                ? `Analisis terakhir · ${new Date(analysisToDisplay.timestamp).toLocaleString()}`
                : isConnected
                  ? "Belum ada analisis tersimpan untuk wallet ini."
                  : "Hubungkan wallet untuk melihat histori analisis."}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#12161f]/80 p-3 rounded-xl border border-white/5 shadow-inner">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Keputusan (BUY = USDT)
            </div>
            <div className={`font-black text-lg ${analysisActionColor}`}>
              {analysisToDisplay?.action ?? "—"}
            </div>
          </div>
          <div className="bg-[#12161f]/80 p-3 rounded-xl border border-white/5 shadow-inner">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Keyakinan
            </div>
            <div className="font-bold text-lg text-white">
              {analysisToDisplay
                ? `${analysisToDisplay.confidence.toFixed(1)}%`
                : "—"}
            </div>
          </div>
          <div className="bg-[#12161f]/80 p-3 rounded-xl border border-white/5 shadow-inner">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Target Market
            </div>
            <div className="font-bold text-lg text-white">tBNB/tUSDT</div>
          </div>
          <div className="bg-[#12161f]/80 p-3 rounded-xl border border-white/5 shadow-inner">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Syarat Trade
            </div>
            <div className="font-bold text-lg text-white">
              Sinyal ≥ 15% · Jeda 5 menit
            </div>
          </div>
        </div>

        <div className="bg-[#12161f] p-4 rounded-xl border border-white/5">
          <div className="text-[11px] font-mono font-bold text-slate-400 mb-2 flex items-center gap-1.5 uppercase">
            <Cpu className="w-3.5 h-3.5" /> Log Pemikiran (Reasoning)
          </div>
          <p className="text-[13px] text-slate-300 leading-relaxed">
            {analysisToDisplay?.reasoning ??
              (analysisCycle.state === "error"
                ? analysisCycle.error
                : analysisCycle.state === "analyzing"
                  ? "Analisis pertama sedang berjalan. Laporan akan muncul setelah semua data dan guardrail selesai diperiksa."
                  : isConnected
                    ? "Laporan akan muncul setelah AI Agent menghasilkan analisis pertamanya."
                    : "Hubungkan wallet untuk memuat laporan analisis.")}
          </p>
        </div>
      </div>

      <div className="mb-5 p-4 rounded-xl bg-[#0b0e14] border border-white/10">
        <h4 className="text-xs font-semibold text-slate-300 mb-3">
          Log Keputusan AI Agent
        </h4>
        {historyError && (
          <p className="text-[11px] text-amber-400 mb-3">{historyError}</p>
        )}
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {activityLogRows.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              Belum ada log. Keputusan pertama akan tersimpan di sini dan tetap
              terlihat setelah agent dihentikan.
            </p>
          ) : (
            activityLogRows.map((decision) => (
              <div
                key={decision.id}
                className="flex items-start justify-between gap-3 text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <span
                    className={`font-bold ${decision.action === "BUY" ? "text-emerald-400" : decision.action === "SELL" ? "text-rose-400" : "text-amber-400"}`}
                  >
                    {decision.action}
                  </span>
                  <span className="text-slate-500">
                    {decision.confidence !== null
                      ? ` · ${decision.confidence.toFixed(1)}% · ${decision.status}`
                      : ` · ${decision.status}`}
                  </span>
                  <p className="text-slate-400 mt-1 line-clamp-2">
                    {decision.summary}
                  </p>
                </div>
                <span className="text-slate-500 whitespace-nowrap">
                  {new Date(decision.timestamp).toLocaleString()}
                </span>
                {decision.explorerUrl && (
                  <a
                    href={decision.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={decision.txHash}
                    className="font-mono text-amber-400 hover:text-amber-300 shrink-0"
                  >
                    {`${decision.txHash?.slice(0, 8)}...${decision.txHash?.slice(-6)}`}
                    <ExternalLink className="inline w-3 h-3 ml-1" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      {/* ─── MODAL: REAL ON-CHAIN DEPOSIT (SIGNS WITH WALLET) ────────── */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12161f] border border-emerald-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsDepositModalOpen(false)}
              disabled={isSigningWallet}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-emerald-400">
              <ArrowDownLeft className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">
                Deposit Modal On-Chain
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Kirim modal dari dompet Anda ke Agent. Transaksi memerlukan
              konfirmasi tanda tangan wallet.
            </p>

            {/* Currency Choice */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDepositCurrency("BNB");
                  setDepositAmount(TRADING_UI_CONFIG.DEPOSIT.DEFAULT_BNB);
                }}
                className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                  depositCurrency === "BNB"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-black/30 text-slate-400 border-white/5 hover:text-white"
                }`}
              >
                Koin tBNB
              </button>
              <button
                type="button"
                onClick={() => {
                  setDepositCurrency("USDT");
                  setDepositAmount(TRADING_UI_CONFIG.DEPOSIT.DEFAULT_USDT);
                }}
                className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                  depositCurrency === "USDT"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-black/30 text-slate-400 border-white/5 hover:text-white"
                }`}
              >
                Token tUSDT
              </button>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1.5">
                Nominal Deposit ({depositCurrency === "BNB" ? "tBNB" : "tUSDT"})
              </label>
              <input
                type="number"
                step="any"
                min={TRADING_UI_CONFIG.DEPOSIT.MIN_AMOUNT}
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsDepositModalOpen(false)}
                disabled={isSigningWallet}
                className="flex-1 py-2.5 text-xs text-slate-400 hover:text-white bg-white/5 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeposit}
                disabled={isSigningWallet}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSigningWallet ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menunggu konfirmasi dompet...
                  </>
                ) : (
                  "Konfirmasi & Sign"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: REAL ON-CHAIN WITHDRAWAL ─────────────────────────── */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12161f] border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsWithdrawModalOpen(false)}
              disabled={isSigningWallet}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-amber-400">
              <ArrowUpRight className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">
                Tarik Modal On-Chain
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Agent akan mengirimkan token pilihan Anda langsung dari brankas
              on-chain ke alamat dompet Anda:{" "}
              {userAddress ? (
                <code className="text-amber-300 font-mono text-[10px]">
                  {userAddress.slice(0, 8)}...{userAddress.slice(-6)}
                </code>
              ) : (
                <span className="text-rose-400 text-[10px]">
                  Hubungkan dompet terlebih dahulu
                </span>
              )}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setWithdrawCurrency("BNB");
                  setWithdrawAmount(TRADING_UI_CONFIG.WITHDRAW.DEFAULT_BNB);
                }}
                className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                  withdrawCurrency === "BNB"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-black/30 text-slate-400 border-white/5 hover:text-white"
                }`}
              >
                Koin tBNB
              </button>
              <button
                type="button"
                onClick={() => {
                  setWithdrawCurrency("USDT");
                  setWithdrawAmount(TRADING_UI_CONFIG.WITHDRAW.DEFAULT_USDT);
                }}
                className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                  withdrawCurrency === "USDT"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-black/30 text-slate-400 border-white/5 hover:text-white"
                }`}
              >
                Token tUSDT
              </button>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1.5">
                Nominal Tarik ({withdrawCurrency === "BNB" ? "tBNB" : "tUSDT"})
              </label>
              <input
                type="number"
                min={TRADING_UI_CONFIG.WITHDRAW.MIN_AMOUNT}
                step="any"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                className="w-full bg-[#0b0e14] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                disabled={isSigningWallet}
                className="flex-1 py-2.5 text-xs text-slate-400 hover:text-white bg-white/5 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmWithdraw}
                disabled={isSigningWallet}
                className="flex-1 py-2.5 text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSigningWallet ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memproses di BSC...
                  </>
                ) : (
                  "Konfirmasi Tarik On-Chain"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── MODAL: AI AUTO SWAP CONFIRMATION ──────────────────────── */}
      {isAutoConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12161f] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsAutoConfirmOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-amber-400">
              <Bot className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">
                Konfirmasi AI Auto Swap
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              AI Agent akan menganalisis harga dan perubahan 24 jam BNB/USDT
              langsung dari Binance, kemudian memakai{" "}
              <span className="text-amber-300 font-semibold">
                Fear & Greed Index
              </span>
              , dan{" "}
              <span className="text-amber-300 font-semibold">
                Momentum 24 Jam
              </span>
              . Nominal swap dihitung dari saldo tBNB/tUSDT agent yang terbaca
              on-chain, lalu dieksekusi di PancakeSwap sampai Anda menekan Stop.
            </p>

            {/* Balance Info */}
            <div className="bg-[#0b0e14] rounded-xl p-3.5 border border-white/5 space-y-2">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold">
                Saldo Tersedia di Agent
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">tBNB (Native)</span>
                <span className="text-sm font-bold text-amber-400">
                  {balances?.bnb_balance.toFixed(4) ?? "0.0000"} tBNB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">tUSDT (Token)</span>
                <span className="text-sm font-bold text-emerald-400">
                  ${balances?.usdt_balance.toFixed(4) ?? "0.0000"} tUSDT
                </span>
              </div>
            </div>

            {/* Gas Fee Notice */}
            <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-300 leading-relaxed">
                  <span className="font-bold">Gas Fee Reserve:</span> Sistem
                  otomatis menyisakan{" "}
                  <span className="font-mono font-bold">
                    {TRADING_UI_CONFIG.AI_GUARDRAIL.GAS_RESERVE_BNB} tBNB
                  </span>{" "}
                  untuk biaya gas (ongkos transaksi blockchain). Sisanya akan
                  dipakai untuk trading.
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsAutoConfirmOpen(false)}
                className="flex-1 py-2.5 text-xs text-slate-400 hover:text-white bg-white/5 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleAutoTradeExecute}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isAutoPaused
                  ? "Lanjutkan AI Agent"
                  : "Mulai AI Agent Berkelanjutan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
