/**
 * Environment variable validation and export.
 * Fails fast if required variables are missing.
 */

import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  // Google Gemini AI
  GEMINI_API_KEY: requireEnv("GOOGLE_GEMINI_API_KEY"),
  GEMINI_MODEL: optionalEnv("GEMINI_MODEL", ""),

  // Supabase
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_ANON_KEY: requireEnv("SUPABASE_ANON_KEY"),

  // Python Engine
  PYTHON_ENGINE_URL: optionalEnv("PYTHON_ENGINE_URL", "http://localhost:3002"),

  // Server
  PORT: parseInt(optionalEnv("PORT", "3001"), 10),

  // Web3 & PancakeSwap (BSC Testnet / Mainnet)
  BSC_RPC_URL: optionalEnv(
    "BSC_RPC_URL",
    "https://bsc-testnet-rpc.publicnode.com",
  ),
  BSC_CHAIN_ID: parseInt(optionalEnv("BSC_CHAIN_ID", "97"), 10),
  AGENT_PRIVATE_KEY: optionalEnv("AGENT_PRIVATE_KEY", ""),
  AGENT_WALLET_ADDRESS: optionalEnv(
    "AGENT_WALLET_ADDRESS",
    "0xB461205ea2392497d2D59EFEf6ff3928E3630a0b",
  ),
  PANCAKESWAP_ROUTER: optionalEnv(
    "PANCAKESWAP_ROUTER",
    "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
  ),
  WBNB_ADDRESS: optionalEnv(
    "WBNB_ADDRESS",
    "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
  ),
  USDT_ADDRESS: optionalEnv(
    "USDT_ADDRESS",
    "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
  ),
  MAX_DAILY_SPEND_USDT: parseFloat(
    optionalEnv("MAX_DAILY_SPEND_USDT", "9999999"),
  ),
} as const;
