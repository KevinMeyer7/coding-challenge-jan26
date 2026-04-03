"use client";

import { useMatchmakingStore } from "@/lib/store";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/**
 * Scatter plot of forward score (x) vs reverse score (y) for each match.
 * The diagonal line represents perfect bidirectional balance.
 * Points above = "they like us more", below = "we like them more".
 */
export function ForwardReverseScatter() {
  const stats = useMatchmakingStore((s) => s.stats);
  const recentMatches = stats?.recentMatches ?? [];

  const data = recentMatches.map((m) => ({
    forward: Math.round(m.appleToOrangeScore * 100),
    reverse: Math.round(m.orangeToAppleScore * 100),
    mutual: Math.round(m.mutualScore * 100),
    id: m.id,
  }));

  if (data.length === 0) {
    return (
      <div className="card h-[320px]">
        <h3 className="text-sm font-semibold mb-4">
          Bidirectional Scoring
        </h3>
        <div className="flex h-[240px] items-center justify-center text-[var(--color-muted)] text-sm">
          No match data yet
        </div>
      </div>
    );
  }

  return (
    <div className="card h-[320px]">
      <h3 className="text-sm font-semibold mb-1">
        Bidirectional Scoring
      </h3>
      <p className="text-[10px] text-[var(--color-muted)] mb-3">
        Each dot is a match. Diagonal = perfect balance between both directions.
      </p>
      <ResponsiveContainer width="100%" height={245}>
        <ScatterChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
          <XAxis
            type="number"
            dataKey="forward"
            name="Forward"
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Match fits our prefs",
              position: "bottom",
              fontSize: 9,
              fill: "var(--color-muted)",
              offset: -5,
            }}
          />
          <YAxis
            type="number"
            dataKey="reverse"
            name="Reverse"
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: "We fit match's prefs",
              angle: -90,
              position: "insideLeft",
              fontSize: 9,
              fill: "var(--color-muted)",
              offset: 15,
            }}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ]}
            stroke="var(--color-muted)"
            strokeDasharray="4 4"
            opacity={0.4}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs shadow-lg">
                  <div className="font-medium mb-1">
                    Mutual: {d.mutual}%
                  </div>
                  <div className="text-[var(--color-muted)]">
                    Forward: {d.forward}% | Reverse: {d.reverse}%
                  </div>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            shape={(props) => {
              const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { mutual: number } };
              if (cx == null || cy == null || !payload) return null;
              const color =
                payload.mutual >= 80
                  ? "#22c55e"
                  : payload.mutual >= 50
                  ? "#eab308"
                  : "#ef4444";
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={color}
                  fillOpacity={0.7}
                  stroke={color}
                  strokeWidth={1}
                />
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
