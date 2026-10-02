"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SimulationResult } from "@/lib/api";

interface MonteCarloChartProps {
  result: SimulationResult;
}

// Institutional Quant Color Palette (Tether Green & Emerald Highlights)
const COLORS = [
  "#00D492", // Bright Emerald / Tether Glow
  "#26A17B", // Institutional USDT Green
  "#06B6D4", // Cyan Vector
  "#3B82F6", // Deep Blue
  "#F59E0B", // Amber Outlier
];

export default function MonteCarloChart({ result }: MonteCarloChartProps) {
  // Transform sample paths to chart data
  const chartData = result.sample_paths[0].map((_, dayIndex) => {
    const point: Record<string, number> = { day: dayIndex };
    result.sample_paths.forEach((path, pathIndex) => {
      point[`path${pathIndex}`] = path[dayIndex];
    });
    return point;
  });

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            stroke="#4B5563"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            label={{
              value: result.period_label
                ? `Simulation Timeline (${result.period_label})`
                : "Simulation Timeline",
              position: "insideBottom",
              offset: -5,
              fill: "#6B7280",
              fontSize: 11,
              fontFamily: "JetBrains Mono",
            }}
          />
          <YAxis
            stroke="#4B5563"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            tickFormatter={(val: number) => `$${val.toLocaleString()}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0D121C",
              border: "1px solid #1E2738",
              borderRadius: "12px",
              color: "white",
              fontSize: 12,
              fontFamily: "JetBrains Mono",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            }}
            formatter={(value: number) => [
              `$${value.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}`,
            ]}
            labelFormatter={(label: number) => `Forecast Day ${label}`}
          />

          {/* Current price reference line */}
          <ReferenceLine
            y={result.current_price}
            stroke="#26A17B"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Entry: $${result.current_price.toLocaleString()}`,
              fill: "#00D492",
              fontSize: 11,
              position: "insideTopRight",
              fontFamily: "JetBrains Mono",
            }}
          />

          {/* Sample paths */}
          {result.sample_paths.map((_, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`path${i}`}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.75}
              dot={false}
              strokeOpacity={i === 0 ? 0.95 : 0.65}
              name={`Trajectory ${i + 1}`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
