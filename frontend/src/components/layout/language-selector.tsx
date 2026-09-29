"use client";

import { useLanguage } from "@/components/layout/language-provider";

export default function LanguageSelector({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs font-semibold backdrop-blur-sm ${className}`}
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-all duration-200 ${
          language === "en"
            ? "bg-[#26A17B] text-black shadow-sm font-bold"
            : "text-gray-400 hover:text-white"
        }`}
      >
        ENG
      </button>
      <button
        type="button"
        onClick={() => setLanguage("id")}
        aria-pressed={language === "id"}
        className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-all duration-200 ${
          language === "id"
            ? "bg-[#26A17B] text-black shadow-sm font-bold"
            : "text-gray-400 hover:text-white"
        }`}
      >
        IND
      </button>
    </div>
  );
}
