/**
 * Wagmi & RainbowKit Web3 configuration for BSC.
 * Using connectorsForWallets to avoid Coinbase CDP SDK Turbopack bundle issues.
 */

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rabbyWallet,
  trustWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, fallback } from "wagmi";
import { bscTestnet, bsc } from "wagmi/chains";
import { env } from "./env";

export const projectId =
  env.WALLETCONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular Web3 Wallets",
      wallets: [metaMaskWallet, rabbyWallet, trustWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  {
    appName: "Nexa AI Co-Pilot",
    projectId,
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [bscTestnet, bsc],
  transports: {
    [bscTestnet.id]: fallback([
      http(env.BSC_TESTNET_RPC, { timeout: 6000 }),
      http("https://bsc-testnet-dataseed.bnbchain.org", { timeout: 6000 }),
      http("https://bsc-testnet.bnbchain.org", { timeout: 6000 }),
      http("https://bsc-prebsc-dataseed.bnbchain.org", { timeout: 6000 }),
      http("https://data-seed-prebsc-1-s1.binance.org:8545", { timeout: 6000 }),
      http("https://bsc-testnet-rpc.publicnode.com", { timeout: 6000 }),
      http("https://data-seed-prebsc-2-s1.binance.org:8545", { timeout: 6000 }),
    ]),
    [bsc.id]: fallback([
      http("https://bsc-dataseed.bnbchain.org", { timeout: 6000 }),
      http("https://bsc-dataseed-public.bnbchain.org", { timeout: 6000 }),
      http("https://bsc-dataseed.nariox.org", { timeout: 6000 }),
      http("https://bsc-dataseed.defibit.io", { timeout: 6000 }),
      http("https://bsc-dataseed.ninicoin.io", { timeout: 6000 }),
      http("https://bsc.nodereal.io", { timeout: 6000 }),
      http("https://rpc-bnb.blockmachine.io", { timeout: 6000 }),
      http("https://bsc-rpc.publicnode.com", { timeout: 6000 }),
    ]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
