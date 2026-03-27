"use client";

import { useMatchmakingStore } from "@/lib/store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const BAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

/**
 * Bar chart showing distribution of match scores across buckets
 */
export function ScoreDistribution() {
  const stats = useMatchmakingStore((s) => s.stats);

  const data = stats?.scoreDistribution ?? [
    { label: "0-20%", count: 0 },
    { label: "20-40%", count: 0 },
    { label: "40-60%", count: 0 },
    { label: "60-80%", count: 0 },
    { label: "80-100%", count: 0 },
  ];

  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="card h-[320px]">
      <h3 className="text-sm font-semibold mb-4">
        Match Score Distribution
      </h3>
      {!hasData ? (
        <div className="flex h-[240px] items-center justify-center text-[var(--color-muted)] text-sm">
          No match data yet. Start some conversations!
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: 12,
              }}
              formatter={(value) => [`${value} matches`, "Count"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={index} fill={BAR_COLORS[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
