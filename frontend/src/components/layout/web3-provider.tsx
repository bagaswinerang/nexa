"use client";

import dynamic from "next/dynamic";
import React from "react";

// Web3ProviderContent (wagmi + RainbowKit + semua wallet SDK) baru
// di-download setelah initial paint, bukan blocking dari awal.
const Web3ProviderContent = dynamic(() => import("./web3-provider-content"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-[#080B11]" />,
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return <Web3ProviderContent>{children}</Web3ProviderContent>;
}

export default Web3Provider;
