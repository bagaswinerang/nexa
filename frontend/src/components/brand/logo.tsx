import React from "react";
import Image from "next/image";

interface LogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  variant?: string;
}

export function NexaLettermark({
  className = "",
  size = 36,
  showWordmark = false,
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0 flex items-center justify-center">
        <Image
          src="/logo-icon.png"
          alt="NEXA Logo"
          width={size}
          height={size}
          className="shrink-0 transition-transform duration-300 hover:scale-105 object-contain"
          priority
        />
      </div>

      {showWordmark && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-wider text-lg sm:text-xl font-sans text-white">
              NEXA
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#26A17B]/20 text-[#00D492] font-semibold border border-[#26A17B]/30">
              DeFi
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 tracking-widest uppercase">
            Quant Intelligence
          </span>
        </div>
      )}
    </div>
  );
}

export default NexaLettermark;
