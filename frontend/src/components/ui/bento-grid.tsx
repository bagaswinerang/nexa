import React from "react";

export function BentoGrid({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto ${className}`}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className = "",
  title,
  description,
  header,
  icon,
  badge,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
}) {
  return (
    <div
      className={`row-span-1 rounded-2xl group/bento transition duration-300 p-5 sm:p-6 bg-[#0D121C] border border-[#1E2738] justify-between flex flex-col space-y-4 hover:border-[#26A17B]/40 hover:shadow-xl hover:shadow-[#26A17B]/5 ${className}`}
    >
      {header}
      <div className="group-hover/bento:translate-x-1 transition duration-200">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <div className="font-sans font-bold text-white tracking-wide">
            {title}
          </div>
        </div>
        {badge && (
          <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-[#26A17B]/10 text-[#00D492] border border-[#26A17B]/30 font-medium mb-2">
            {badge}
          </span>
        )}
        <div className="font-sans font-normal text-gray-400 text-xs leading-relaxed">
          {description}
        </div>
      </div>
    </div>
  );
}
