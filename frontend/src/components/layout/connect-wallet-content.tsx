"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function ConnectWalletContent() {
  return (
    <div className="flex items-center shrink-0 origin-right scale-[0.92] sm:scale-100 transition-transform">
      <ConnectButton
        showBalance={{
          smallScreen: false,
          largeScreen: true,
        }}
        chainStatus="icon"
        accountStatus={{
          smallScreen: "avatar",
          largeScreen: "full",
        }}
      />
    </div>
  );
}
