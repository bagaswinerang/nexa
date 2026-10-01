/** Gemini assistant with live BNB/USDT and on-chain balance tools. */

import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionDeclaration,
  type Part,
} from "@google/generative-ai";
import { env } from "../lib/env.js";
import { getMarketData } from "./quant-client.js";
import { getLiveBalances } from "./pancakeswap-service.js";
import { supabase } from "../lib/supabase.js";
import { semanticSearchTransactions } from "./embedding.js";
import { generateRecommendation } from "./ai-recommend.js";
import type { ChatMessage, MarketData, Transaction } from "../types/index.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const tools: FunctionDeclaration[] = [
  {
    name: "get_market_data",
    description: "Get live Binance BNB/USDT price, 24-hour change, volume, and Fear & Greed index.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_agent_balances",
    description: "Get the Nexa agent's real on-chain tBNB and tUSDT balances used for PancakeSwap execution.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_transactions",
    description: "Get the user's recent on-chain trading-journal entries.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        user_address: { type: SchemaType.STRING, description: "User wallet address" },
        limit: { type: SchemaType.NUMBER, description: "Number of entries (default 20)" },
      },
    },
  },
  {
    name: "search_transactions",
    description: "Search the user's trading journal by strategy, pair, category, or meaning.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Search term" },
        user_address: { type: SchemaType.STRING, description: "User wallet address" },
        limit: { type: SchemaType.NUMBER, description: "Maximum results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_trading_recommendation",
    description: "Generate a BUY, SELL, or HOLD recommendation from live Binance BNB/USDT momentum and Fear & Greed. Sizing uses real agent tBNB/tUSDT balances.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { user_address: { type: SchemaType.STRING, description: "User wallet address" } },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, contextUserAddress?: string): Promise<unknown> {
  const effectiveAddress = (args.user_address as string) || contextUserAddress || "0x0000000000000000000000000000000000000000";
  switch (name) {
    case "get_market_data":
      return await getMarketData("BNBUSDT") as MarketData;
    case "get_agent_balances":
      return await getLiveBalances();
    case "get_transactions": {
      const { data, error } = await supabase.from("transactions").select("*")
        .eq("user_address", effectiveAddress).order("created_at", { ascending: false }).limit((args.limit as number) || 20);
      if (error) throw new Error(error.message);
      return data as Transaction[];
    }
    case "search_transactions":
      return await semanticSearchTransactions(args.query as string, effectiveAddress, (args.limit as number) || 10);
    case "get_trading_recommendation":
      return await generateRecommendation(effectiveAddress, "BNBUSDT");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const SYSTEM_INSTRUCTION = `
<role>
Kamu adalah Nexa AI, asisten analisis pasar BNB/USDT dan trading DeFi yang objektif. Kamu menggunakan harga dan perubahan 24 jam BNB/USDT dari Binance. Eksekusi Nexa hanya menggunakan saldo tBNB/tUSDT on-chain melalui PancakeSwap.
</role>
<capabilities>
1. get_market_data: data Binance BNB/USDT dan Fear & Greed.
2. get_agent_balances: saldo agent tBNB/tUSDT on-chain.
3. get_transactions dan search_transactions: jurnal transaksi pengguna.
4. get_trading_recommendation: rekomendasi BUY/SELL/HOLD dari momentum 24 jam dan sentimen; nominal disesuaikan dengan saldo agent on-chain.
</capabilities>
<constraints>
- Jangan menyebut atau menawarkan portofolio virtual maupun proyeksi harga tersintesis.
- Jangan mengklaim eksekusi transaksi dari chat. Arahkan pengguna ke Live Agent DEX untuk meninjau dan menjalankan swap.
- Gunakan tool untuk angka pasar atau saldo. Ini bukan nasihat keuangan; ingatkan DYOR.
</constraints>`;

const CANDIDATE_MODELS = [
  env.GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
].filter(Boolean) as string[];

async function attemptChatWithModel(
  modelName: string,
  message: string,
  history: ChatMessage[] = [],
  userAddress?: string,
  isThinking = false,
): Promise<{ reply: string; thought?: string; toolCalls: string[] }> {
  const dynamicInstruction = isThinking
    ? `${SYSTEM_INSTRUCTION}\n<thinking_mode>Berikan ringkasan pertimbangan data di dalam <thought> sebelum jawaban akhir.</thinking_mode>`
    : SYSTEM_INSTRUCTION;
  const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: dynamicInstruction, tools: [{ functionDeclarations: tools }] });
  const contents: Content[] = history.map((item) => ({ role: item.role === "user" ? "user" : "model", parts: [{ text: item.content }] }));
  const userText = userAddress ? `[User wallet: ${userAddress}]\n\n${message}` : message;
  contents.push({ role: "user", parts: [{ text: userText }] });
  const chatSession = model.startChat({ history: contents.slice(0, -1) });
  let response = await chatSession.sendMessage(contents.at(-1)!.parts);
  const toolCalls: string[] = [];

  while (true) {
    const parts = response.response.candidates?.[0]?.content.parts ?? [];
    const calls = parts.filter((part: Part) => "functionCall" in part);
    if (!calls.length) break;
    const functionResponses: Part[] = [];
    for (const part of calls) {
      if (!("functionCall" in part) || !part.functionCall) continue;
      const call = part.functionCall;
      toolCalls.push(call.name);
      try {
        functionResponses.push({ functionResponse: { name: call.name, response: { result: await executeTool(call.name, call.args as Record<string, unknown>, userAddress) } } });
      } catch (error) {
        functionResponses.push({ functionResponse: { name: call.name, response: { error: error instanceof Error ? error.message : "Unknown error" } } });
      }
    }
    response = await chatSession.sendMessage(functionResponses);
  }

  let rawText = "";
  for (const part of response.response.candidates?.[0]?.content.parts ?? []) {
    if ("text" in part && part.text) rawText += part.text;
  }
  const match = rawText.match(/<thought>([\s\S]*?)<\/thought>/i);
  const thought = match?.[1]?.trim();
  const reply = rawText.replace(/<thought>[\s\S]*?<\/thought>/i, "").trim() || "Maaf, saya tidak bisa merespons saat ini.";
  return { reply, thought: isThinking ? thought || "Memeriksa data pasar dan saldo on-chain yang relevan sebelum menyusun jawaban." : undefined, toolCalls };
}

export async function chat(message: string, history: ChatMessage[] = [], userAddress?: string, isThinking = false, preferredModel?: string) {
  const models = preferredModel ? [preferredModel, ...CANDIDATE_MODELS.filter((model) => model !== preferredModel)] : CANDIDATE_MODELS;
  let lastError: unknown;
  for (const modelName of models) {
    try {
      const result = await Promise.race([
        attemptChatWithModel(modelName, message, history, userAddress, isThinking),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Model ${modelName} request timed out after 10s`)), 10_000)),
      ]);
      return { ...result, model_used: modelName };
    } catch (error) {
      lastError = error;
      console.warn(`[Gemini] ${modelName} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw lastError || new Error("Semua model Gemini sedang tidak dapat diakses.");
}
