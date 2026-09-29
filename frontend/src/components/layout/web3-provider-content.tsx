"use client";

import React, { useState, useEffect } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi";
import { LanguageProvider } from "@/components/layout/language-provider";

export function Web3ProviderContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <LanguageProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            locale="en"
            theme={darkTheme({
              accentColor: "#26A17B",
              accentColorForeground: "black",
              borderRadius: "medium",
              fontStack: "system",
              overlayBlur: "small",
            })}
          >
            {mounted ? children : <div className="min-h-screen bg-[#080B11]" />}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </LanguageProvider>
  );
}

export default Web3ProviderContent;
