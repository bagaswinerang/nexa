/**
 * Centralized Frontend Environment Variables Configuration.
 * 
 * IMPORTANT: In Next.js client-side bundles, environment variables MUST be
 * referenced statically (e.g., process.env.NEXT_PUBLIC_*) so that Webpack /
 * Turbopack can inline them during compilation. Dynamic indexing like
 * process.env[key] will resolve to undefined in browser runtime.
 */

export const env = {
  // Backend REST API URL
  //
  // Production defaults to the same-origin proxy (`/api/backend`). This keeps
  // the backend origin private and, importantly, never makes a visitor's
  // browser try to call its own localhost. Set NEXT_PUBLIC_BACKEND_URL only
  // when the API is intentionally exposed as a separate public origin.
  BACKEND_URL:
    process.env.NODE_ENV === "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(
      process.env.NEXT_PUBLIC_BACKEND_URL || "",
    )
      ? "/api/backend"
      : process.env.NEXT_PUBLIC_BACKEND_URL || "/api/backend",

  // WalletConnect Cloud Project ID (dibaca langsung dari .env.local)
  WALLETCONNECT_PROJECT_ID:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",

  // BSC Network RPC
  BSC_TESTNET_RPC:
    process.env.NEXT_PUBLIC_BSC_TESTNET_RPC ||
    "https://data-seed-prebsc-1-s1.binance.org:8545",

  // Smart Contract Addresses (Set after deployment)
  NEXA_IDENTITY_ADDRESS: (process.env.NEXT_PUBLIC_NEXA_IDENTITY_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  NEXA_JOURNAL_ADDRESS: (process.env.NEXT_PUBLIC_NEXA_JOURNAL_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  // Optional Default Dev Wallet for preview mode
  DEFAULT_DEV_WALLET:
    process.env.NEXT_PUBLIC_ENABLE_DEV_WALLET === "true"
      ? process.env.NEXT_PUBLIC_DEFAULT_DEV_WALLET ||
        "0xb461205ea2392497d2d59efef6ff3928e3630a0b"
      : "",
} as const;

export default env;
