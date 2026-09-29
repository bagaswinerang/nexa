/**
 * PancakeSwap Autonomous DEX Execution Service (BSC / BSC Testnet).
 * Model B: Nexa Official Platform Quant Agent.
 *
 * Interacts directly with PancakeSwap Router smart contract using Viem.
 * Enables AI agents to autonomously swap BNB <-> USDT on-chain with real execution.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  parseUnits,
  formatUnits,
  formatEther,
  parseEther,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, bscTestnet } from "viem/chains";
import { env } from "../lib/env.js";
import { supabase } from "../lib/supabase.js";
import { generateEmbedding } from "./embedding.js";
import { ERC20_ABI, PANCAKE_ROUTER_ABI } from "../lib/abis.js";
import {
  TOKEN_LIMITS,
  GAS_SAFETY_CONFIG,
  EXECUTION_GUARDRAILS,
} from "../config/trading-rules.js";

// ─── Network & Clients Setup ─────────────────────────────────────

const isTestnet = env.BSC_CHAIN_ID === 97;
const chain = isTestnet ? bscTestnet : bsc;
const explorerUrl = isTestnet
  ? "https://testnet.bscscan.com"
  : "https://bscscan.com";

// High-availability RPC fallback arrays with official BNB Chain endpoints
const BSC_TESTNET_RPCS = [
  env.BSC_RPC_URL,
  "https://bsc-testnet-dataseed.bnbchain.org",
  "https://bsc-testnet.bnbchain.org",
  "https://bsc-prebsc-dataseed.bnbchain.org",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://bsc-testnet-rpc.publicnode.com",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
];

const BSC_MAINNET_RPCS = [
  env.BSC_RPC_URL,
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-dataseed-public.bnbchain.org",
  "https://bsc-dataseed.nariox.org",
  "https://bsc-dataseed.defibit.io",
  "https://bsc-dataseed.ninicoin.io",
  "https://bsc.nodereal.io",
  "https://rpc-bnb.blockmachine.io",
  "https://bsc-rpc.publicnode.com",
];

const rpcList = isTestnet ? BSC_TESTNET_RPCS : BSC_MAINNET_RPCS;
const bscTransport = fallback(
  rpcList.map((url) => http(url, { timeout: 8_000 })),
  { rank: true }
);

const publicClient = createPublicClient({
  chain,
  transport: bscTransport,
});

const routerAddress = env.PANCAKESWAP_ROUTER as Address;
const wbnbAddress = env.WBNB_ADDRESS as Address;
const usdtAddress = env.USDT_ADDRESS as Address;

function getAgentAccount() {
  if (!env.AGENT_PRIVATE_KEY || env.AGENT_PRIVATE_KEY.trim() === "") {
    return null;
  }
  const key = env.AGENT_PRIVATE_KEY.startsWith("0x")
    ? (env.AGENT_PRIVATE_KEY as `0x${string}`)
    : (`0x${env.AGENT_PRIVATE_KEY}` as `0x${string}`);
  return privateKeyToAccount(key);
}

// ─── Guardrail: Daily Safety Cap ─────────────────────────────────

async function assertWithinDailyCap(userAddress: string, additionalUsdt: number) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_address", userAddress.toLowerCase())
    .eq("category", "Live Trade")
    .eq("is_income", false)
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    console.warn(`[PancakeSwap] Failed to check daily cap: ${error.message}`);
    return;
  }

  const spentToday = (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  if (spentToday + additionalUsdt > env.MAX_DAILY_SPEND_USDT) {
    throw new Error(
      `Daily safety cap reached: already spent $${spentToday.toFixed(2)} USDT today (Limit: $${env.MAX_DAILY_SPEND_USDT} USDT). Swap prevented.`
    );
  }
}

// ─── Exact Allowance (Safer than infinite approve) ───────────────

async function ensureExactAllowance(
  walletClient: any,
  owner: Address,
  token: Address,
  amountNeeded: bigint
) {
  const currentAllowance = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, routerAddress],
  })) as bigint;

  if (currentAllowance >= amountNeeded) return;

  console.log(`[PancakeSwap] Approving exact amount of USDT (${amountNeeded}) for Router...`);
  const approveTx = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [routerAddress, amountNeeded],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`[PancakeSwap] Exact allowance confirmed: ${approveTx}`);
}

// ─── Balance & Status Methods ────────────────────────────────────

export async function getLiveBalances(customWallet?: string) {
  const agentAccount = getAgentAccount();
  const target = (customWallet || agentAccount?.address || env.AGENT_WALLET_ADDRESS) as Address | undefined;

  if (!target) {
    return {
      configured: false,
      wallet_address: null,
      bnb_balance: 0,
      usdt_balance: 0,
      network: isTestnet ? "BSC Testnet (Chain ID 97)" : "BSC Mainnet (Chain ID 56)",
      explorer_url: explorerUrl,
      max_daily_spend_usdt: env.MAX_DAILY_SPEND_USDT,
    };
  }

  try {
    const [rawBnb, rawUsdt, usdtDecimals] = await Promise.all([
      publicClient.getBalance({ address: target }),
      publicClient.readContract({
        address: usdtAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [target],
      }).catch(() => 0n),
      publicClient.readContract({
        address: usdtAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
      }).catch(() => 18),
    ]);

    const bnbBalance = parseFloat(formatEther(rawBnb));
    const usdtBalance = parseFloat(formatUnits(rawUsdt as bigint, usdtDecimals as number));

    return {
      configured: Boolean(agentAccount),
      wallet_address: target,
      bnb_balance: bnbBalance,
      usdt_balance: usdtBalance,
      network: isTestnet ? "BSC Testnet (Chain ID 97)" : "BSC Mainnet (Chain ID 56)",
      explorer_url: `${explorerUrl}/address/${target}`,
      max_daily_spend_usdt: env.MAX_DAILY_SPEND_USDT,
    };
  } catch (err) {
    console.error("[PancakeSwap] Error fetching balances:", err);
    return {
      configured: Boolean(agentAccount),
      wallet_address: target,
      bnb_balance: 0,
      usdt_balance: 0,
      network: isTestnet ? "BSC Testnet (Chain ID 97)" : "BSC Mainnet (Chain ID 56)",
      explorer_url: `${explorerUrl}/address/${target}`,
      max_daily_spend_usdt: env.MAX_DAILY_SPEND_USDT,
      error: String(err),
    };
  }
}

// ─── Swap Execution on PancakeSwap ───────────────────────────────

export interface LiveTradeRequest {
  action: "BUY" | "SELL";
  amountUsdt: number;
  userAddress: string;
  symbol?: string;
  reasoning?: string;
  slippagePct?: number; // default 1.0%
}

export interface LiveTradeResponse {
  success: boolean;
  action: "BUY" | "SELL";
  txHash: Hash;
  explorerUrl: string;
  amountIn: number;
  amountOut: number;
  tokenIn: string;
  tokenOut: string;
  symbol: string;
  reasoning?: string;
  gasUsed?: string;
  timestamp: string;
}

export async function executeLivePancakeSwap(
  req: LiveTradeRequest
): Promise<LiveTradeResponse> {
  const account = getAgentAccount();
  if (!account) {
    throw new Error(
      "AGENT_PRIVATE_KEY is not configured in backend/.env. Add your agent wallet private key to enable real PancakeSwap trades."
    );
  }

  const walletClient = createWalletClient({
    account,
    chain,
    transport: bscTransport,
  });

  const slippage = (req.slippagePct ?? EXECUTION_GUARDRAILS.DEFAULT_SLIPPAGE_PCT) / 100;
  const deadline = BigInt(
    Math.floor(Date.now() / 1000) + 60 * EXECUTION_GUARDRAILS.TX_DEADLINE_MINUTES
  );
  const symbol = req.symbol || "BNBUSDT";

  // Check USDT decimals
  const usdtDecimals = ((await publicClient.readContract({
    address: usdtAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
  }).catch(() => 18)) as number) || 18;

  let txHash: Hash;
  let actualAmountIn = 0;
  let estimatedAmountOut = 0;
  const tokenInName = req.action === "BUY" ? (isTestnet ? "tUSDT" : "USDT") : (isTestnet ? "tBNB" : "BNB");
  const tokenOutName = req.action === "BUY" ? (isTestnet ? "tBNB" : "BNB") : (isTestnet ? "tUSDT" : "USDT");

  if (req.action === "BUY") {
    // ─── BUY tBNB with tUSDT ────────────────────────────────────────
    await assertWithinDailyCap(req.userAddress, req.amountUsdt);

    const path: Address[] = [usdtAddress, wbnbAddress];
    let amountInWei = parseUnits(req.amountUsdt.toString(), usdtDecimals);

    // 2. Check tUSDT balance
    const usdtBal = (await publicClient.readContract({
      address: usdtAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;

    const minUsdtWei = parseUnits(TOKEN_LIMITS.MIN_SWAP_USDT.toString(), usdtDecimals);
    if (usdtBal < minUsdtWei) {
      throw new Error(
        `Saldo ${tokenInName} Agent tidak cukup (minimal ${TOKEN_LIMITS.MIN_SWAP_USDT} ${tokenInName}). Tersedia: ${formatUnits(usdtBal, usdtDecimals)} ${tokenInName}`
      );
    }

    if (usdtBal < amountInWei) {
      amountInWei = usdtBal;
      console.log(
        `[PancakeSwap] ⚠️ Menyesuaikan jumlah trade dengan saldo yang tersedia: ${formatUnits(amountInWei, usdtDecimals)} ${tokenInName}`
      );
    }

    actualAmountIn = parseFloat(formatUnits(amountInWei, usdtDecimals));

    // 3. Exact Approve (Safety Best Practice)
    await ensureExactAllowance(walletClient, account.address, usdtAddress, amountInWei);

    // 4. Estimate output amount & minimum received with slippage
    const amountsOut = (await publicClient.readContract({
      address: routerAddress,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [amountInWei, path],
    })) as bigint[];

    const expectedOut = amountsOut[1];
    const minOut = (expectedOut * BigInt(Math.floor((1 - slippage) * 1000))) / 1000n;
    estimatedAmountOut = parseFloat(formatEther(expectedOut));

    console.log(
      `[PancakeSwap] Swapping ${actualAmountIn} ${tokenInName} for ~${estimatedAmountOut.toFixed(6)} ${tokenOutName} (min: ${formatEther(minOut)})`
    );

    // 5. Execute swap on PancakeSwap Router
    txHash = await walletClient.writeContract({
      address: routerAddress,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "swapExactTokensForETH",
      args: [amountInWei, minOut, path, account.address, deadline],
    });
  } else {
    // ─── SELL tBNB for tUSDT ───────────────────────────────────────
    const path: Address[] = [wbnbAddress, usdtAddress];

    // Estimate BNB quantity needed from USDT target
    const sampleIn = parseEther("1");
    const sampleAmounts = (await publicClient.readContract({
      address: routerAddress,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [sampleIn, path],
    })) as bigint[];

    const bnbPriceInUsdt = parseFloat(formatUnits(sampleAmounts[1], usdtDecimals));
    const bnbToSell = req.amountUsdt / (bnbPriceInUsdt || 600);
    const amountInWei = parseEther(bnbToSell.toFixed(6));

    // Check BNB balance (keep gas reserve configured in trading-rules)
    const bnbBal = await publicClient.getBalance({ address: account.address });
    const gasReserve = parseEther(GAS_SAFETY_CONFIG.TRADE_GAS_RESERVE_BNB);

    // If not enough for requested amount + gas, auto-cap to (balance - gasReserve)
    let finalAmountInWei = amountInWei;
    if (bnbBal <= gasReserve) {
      throw new Error(
        `Saldo ${tokenInName} Agent tidak cukup bahkan untuk gas fee. Saldo: ${formatEther(bnbBal)} ${tokenInName}. Minimum gas reserve: ${GAS_SAFETY_CONFIG.TRADE_GAS_RESERVE_BNB} ${tokenInName}.`
      );
    }
    if (bnbBal < amountInWei + gasReserve) {
      // Auto-cap: use all available minus gas reserve
      finalAmountInWei = bnbBal - gasReserve;
      const adjustedBnb = parseFloat(formatEther(finalAmountInWei));
      console.log(
        `[PancakeSwap] ⚠️ Auto-adjusted trade amount: ${formatEther(amountInWei)} → ${adjustedBnb.toFixed(6)} ${tokenInName} (reserved ${GAS_SAFETY_CONFIG.TRADE_GAS_RESERVE_BNB} ${tokenInName} for gas)`
      );
    }

    if (finalAmountInWei < parseEther(TOKEN_LIMITS.MIN_SWAP_BNB.toString())) {
      throw new Error(
        `Saldo ${tokenInName} yang dapat ditradingkan terlalu kecil (minimal ${TOKEN_LIMITS.MIN_SWAP_BNB} ${tokenInName} di luar cadangan gas ${GAS_SAFETY_CONFIG.TRADE_GAS_RESERVE_BNB} ${tokenInName}).`
      );
    }

    actualAmountIn = parseFloat(formatEther(finalAmountInWei));

    const amountsOut = (await publicClient.readContract({
      address: routerAddress,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [finalAmountInWei, path],
    })) as bigint[];

    const expectedOut = amountsOut[1];
    const minOut = (expectedOut * BigInt(Math.floor((1 - slippage) * 1000))) / 1000n;
    estimatedAmountOut = parseFloat(formatUnits(expectedOut, usdtDecimals));

    console.log(
      `[PancakeSwap] Selling ${actualAmountIn.toFixed(6)} ${tokenInName} for ~${estimatedAmountOut.toFixed(4)} ${tokenOutName}`
    );

    txHash = await walletClient.writeContract({
      address: routerAddress,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "swapExactETHForTokens",
      args: [minOut, path, account.address, deadline],
      value: finalAmountInWei,
    });
  }

  // 6. Wait for on-chain confirmation
  console.log(`[PancakeSwap] Transaction broadcasted: ${txHash}. Waiting for receipt...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  const result: LiveTradeResponse = {
    success: receipt.status === "success",
    action: req.action,
    txHash,
    explorerUrl: `${explorerUrl}/tx/${txHash}`,
    amountIn: actualAmountIn,
    amountOut: estimatedAmountOut,
    tokenIn: tokenInName,
    tokenOut: tokenOutName,
    symbol,
    reasoning: req.reasoning,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: new Date().toISOString(),
  };

  // 7. Record to Supabase with Vector Embedding for RAG
  await recordLiveTradeToSupabase(req.userAddress, result);

  return result;
}

// ─── Record to Supabase & Generate Embedding ─────────────────────

async function recordLiveTradeToSupabase(
  userAddress: string,
  trade: LiveTradeResponse
) {
  try {
    const isIncome = trade.action === "SELL"; // selling to USDT increases liquid capital
    const category = "Live Trade";
    const note = `[PancakeSwap On-Chain] ${trade.action} ${trade.symbol} — Ditukar ${trade.amountIn.toFixed(4)} ${trade.tokenIn} menjadi ${trade.amountOut.toFixed(4)} ${trade.tokenOut}. Reasoning: ${trade.reasoning || "AI Autonomous Signal"}`;

    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(`${category} ${trade.symbol} ${note}`);
    } catch {
      // Non-blocking fallback
    }

    const { error } = await supabase.from("transactions").insert({
      user_address: userAddress.toLowerCase(),
      amount: trade.amountIn,
      category,
      note,
      is_income: isIncome,
      pair: isTestnet ? "tBNB/tUSDT" : "BNB/USDT",
      tx_hash: trade.txHash,
      ...(embedding && embedding.length > 0 ? { embedding } : {}),
    });

    if (error) {
      console.error(`[PancakeSwap] Failed to record trade to Supabase: ${error.message}`);
    } else {
      console.log(`[PancakeSwap] Trade recorded to Supabase & indexed for RAG! Tx: ${trade.txHash}`);
    }
  } catch (err) {
    console.error("[PancakeSwap] Error during Supabase record:", err);
  }
}

// ─── Live On-Chain Withdrawal ────────────────────────────────────

export async function executeLiveWithdrawal(params: {
  userAddress: string;
  amount: number;
  token?: "USDT" | "BNB" | "tUSDT" | "tBNB";
}): Promise<{ txHash: Hash; explorerUrl: string; amount: number; token: string }> {
  const account = getAgentAccount();
  if (!account) {
    throw new Error("AGENT_PRIVATE_KEY is not configured in backend/.env.");
  }

  const walletClient = createWalletClient({
    account,
    chain,
    transport: bscTransport,
  });

  const isBnb = params.token === "BNB" || params.token === "tBNB";
  const tokenName = isBnb ? (isTestnet ? "tBNB" : "BNB") : (isTestnet ? "tUSDT" : "USDT");
  let txHash: Hash;

  if (isBnb) {
    const amountInWei = parseEther(params.amount.toString());
    const bnbBal = await publicClient.getBalance({ address: account.address });
    const gasReserve = parseEther(GAS_SAFETY_CONFIG.WITHDRAW_GAS_RESERVE_BNB);
    
    if (bnbBal < amountInWei + gasReserve) {
      throw new Error(
        `Agent wallet has insufficient ${tokenName} for withdrawal + gas. Available: ${formatEther(bnbBal)} ${tokenName}`
      );
    }
    
    console.log(`[PancakeSwap] Transferring ${params.amount} ${tokenName} from Agent to ${params.userAddress}...`);
    txHash = await walletClient.sendTransaction({
      to: params.userAddress as Address,
      value: amountInWei,
    });
  } else {
    // USDT Withdrawal
    const usdtDecimals = ((await publicClient.readContract({
      address: usdtAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    }).catch(() => 18)) as number) || 18;

    const amountInWei = parseUnits(params.amount.toString(), usdtDecimals);

    const agentUsdtBal = (await publicClient.readContract({
      address: usdtAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;

    if (agentUsdtBal < amountInWei) {
      throw new Error(
        `Agent wallet has insufficient ${tokenName} for withdrawal. Available: ${formatUnits(agentUsdtBal, usdtDecimals)} ${tokenName}`
      );
    }

    console.log(`[PancakeSwap] Transferring ${params.amount} ${tokenName} from Agent to ${params.userAddress}...`);
    txHash = await walletClient.writeContract({
      address: usdtAddress,
      abi: [
        {
          name: "transfer",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ],
      functionName: "transfer",
      args: [params.userAddress as Address, amountInWei],
    });
  }

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Record to Supabase with Vector Embedding for RAG
  try {
    const note = `[On-Chain Withdrawal] Transferred ${params.amount.toFixed(4)} ${tokenName} back to user wallet`;
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(`Withdrawal ${tokenName} ${note}`);
    } catch {}

    await supabase.from("transactions").insert({
      user_address: params.userAddress.toLowerCase(),
      amount: params.amount,
      category: "Withdrawal",
      note,
      is_income: false,
      pair: tokenName,
      tx_hash: txHash,
      ...(embedding && embedding.length > 0 ? { embedding } : {}),
    });
  } catch (dbErr) {
    console.error("[PancakeSwap] DB record error on withdrawal:", dbErr);
  }

  return {
    txHash,
    explorerUrl: `${explorerUrl}/tx/${txHash}`,
    amount: params.amount,
    token: tokenName,
  };
}

