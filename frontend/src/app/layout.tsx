import type { Metadata, Viewport } from "next";
import "./globals.css";
import Web3Provider from "@/components/layout/web3-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Nexa | DeFi Intelligence & Quant Terminal",
    template: "%s | Nexa",
  },
  description:
    "AI-powered DeFi intelligence platform for market analysis, Monte Carlo simulations, and on-chain financial journaling on BNB Smart Chain.",
  applicationName: "Nexa",
  keywords: [
    "DeFi",
    "quantitative finance",
    "Monte Carlo simulation",
    "BNB Smart Chain",
    "on-chain journal",
    "AI market analysis",
  ],
  authors: [{ name: "Nexa" }],
  creator: "Nexa",
  publisher: "Nexa",
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/logo-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Nexa",
    title: "Nexa | DeFi Intelligence & Quant Terminal",
    description:
      "AI-powered DeFi intelligence platform for market analysis, Monte Carlo simulations, and on-chain financial journaling.",
    images: [
      {
        url: "/logo-card.png",
        alt: "Nexa DeFi Intelligence & Quant Terminal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexa | DeFi Intelligence & Quant Terminal",
    description:
      "AI-powered DeFi intelligence for market analysis, simulations, and on-chain financial journaling.",
    images: ["/logo-card.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-white antialiased">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}


