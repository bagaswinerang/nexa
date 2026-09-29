import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface QuantStatProps {
  title: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  sublabel?: string;
  icon?: React.ReactNode;
  tag?: string;
}

export function QuantStat({
  title,
  value,
  change,
  isPositive = true,
  sublabel,
  icon,
  tag,
}: QuantStatProps) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-[#0D121C] border border-[#1E2738] flex flex-col justify-between hover:border-[#26A17B]/40 transition-all group">
      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#26A17B]/10 flex items-center justify-center text-[#00D492] shrink-0">
              {icon}
            </div>
          )}
          <span className="text-[11px] sm:text-xs font-mono uppercase text-gray-400 tracking-wider">
            {title}
          </span>
        </div>
        {tag && (
          <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10 shrink-0">
            {tag}
          </span>
        )}
      </div>

      <div className="my-1">
        <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white group-hover:text-[#00D492] transition-colors">
          {value}
        </div>
      </div>

      {(change || sublabel) && (
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
          {change && (
            <div
              className={`flex items-center gap-1 font-mono font-medium ${
                isPositive ? "text-[#00D492]" : "text-[#F43F5E]"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>{change}</span>
            </div>
          )}
          {sublabel && (
            <span className="text-gray-500 font-mono text-[11px] ml-auto">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default QuantStat;
