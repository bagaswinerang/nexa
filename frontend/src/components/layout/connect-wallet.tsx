"use client";

import dynamic from "next/dynamic";

// RainbowKit ConnectButton (+ semua UI wallet list) baru di-download
// begitu komponen ini nge-render, bukan ikut bundle awal tiap halaman.
const ConnectWalletContent = dynamic(() => import("./connect-wallet-content"), {
  ssr: false,
  loading: () => (
    <div className="h-10 w-32 rounded-xl bg-white/5 animate-pulse shrink-0" />
  ),
});

export default function ConnectWallet() {
  return <ConnectWalletContent />;
}
