"use client";

import React, { useRef, useState } from "react";

interface CardSpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function CardSpotlight({
  children,
  className = "",
  spotlightColor = "rgba(38, 161, 123, 0.15)", // Tether Green glow
  ...props
}: CardSpotlightProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-2xl bg-[#0D121C] border border-[#1E2738] p-5 sm:p-6 transition-all duration-300 hover:border-[#26A17B]/40 hover:shadow-lg hover:shadow-[#26A17B]/5 flex flex-col h-full ${className}`}
      {...props}
    >
      {/* Dynamic Radial Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      <div className="relative z-10 flex flex-col flex-1 h-full justify-between">{children}</div>
    </div>
  );
}

export default CardSpotlight;
