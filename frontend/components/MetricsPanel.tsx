"use client";

import { useEffect } from "react";
import { useMatchmakingStore } from "@/lib/store";
import {
  Apple,
  Citrus,
  Heart,
  Trophy,
  Activity,
  Scale,
} from "lucide-react";

export function MetricsPanel() {
  const stats = useMatchmakingStore((s) => s.stats);
  const statsLoading = useMatchmakingStore((s) => s.statsLoading);
  const refreshStats = useMatchmakingStore((s) => s.refreshStats);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  if (statsLoading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="metric-card animate-pulse">
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-3 h-8 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    );
  }

  const m = stats?.metrics;
  const matches = stats?.recentMatches ?? [];

  // Best match score
  const bestScore = matches.length > 0
    ? Math.max(...matches.map((m) => m.mutualScore))
    : 0;

  // Pool health: % of fruits that found a match
  const totalFruits = (m?.totalApples ?? 0) + (m?.totalOranges ?? 0);
  const matchedFruits =
    totalFruits - (m?.unmatchedApples ?? 0) - (m?.unmatchedOranges ?? 0);
  const poolHealth = totalFruits > 0 ? Math.round((matchedFruits / totalFruits) * 100) : 0;

  // Balance: |forward - reverse|
  const balanceDiff = Math.abs((m?.avgForwardScore ?? 0) - (m?.avgReverseScore ?? 0));
  const balanceLabel =
    balanceDiff <= 5 ? "Balanced" : balanceDiff <= 15 ? "Slight lean" : "Lopsided";

  const cards = [
    {
      label: "Apples",
      value: m?.totalApples ?? 0,
      hint: "Total apples in the SurrealDB pool",
      icon: Apple,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/30",
    },
    {
      label: "Oranges",
      value: m?.totalOranges ?? 0,
      hint: "Total oranges in the SurrealDB pool",
      icon: Citrus,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      label: "Matches Made",
      value: m?.totalMatches ?? 0,
      hint: "Total successful pairings created",
      icon: Heart,
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950/30",
    },
    {
      label: "Best Match",
      value: `${Math.round(bestScore * 100)}%`,
      hint: "Highest mutual compatibility score achieved",
      icon: Trophy,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    },
    {
      label: "Pool Health",
      value: `${poolHealth}%`,
      hint: "% of fruits that found a match (higher = system is working well)",
      icon: Activity,
      color:
        poolHealth >= 70
          ? "text-green-500"
          : poolHealth >= 40
          ? "text-amber-500"
          : "text-red-500",
      bgColor:
        poolHealth >= 70
          ? "bg-green-100 dark:bg-green-950/30"
          : poolHealth >= 40
          ? "bg-amber-50 dark:bg-amber-950/30"
          : "bg-red-50 dark:bg-red-950/30",
    },
    {
      label: "Balance",
      value: balanceLabel,
      hint: `Forward avg ${m?.avgForwardScore ?? 0}% vs Reverse avg ${m?.avgReverseScore ?? 0}% — balanced means matching works equally well in both directions`,
      icon: Scale,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="metric-card group" title={card.hint}>
            <div className="flex items-center justify-between">
              <div className={`rounded-lg p-2 ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tabular-nums">{card.value}</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                {card.label}
              </p>
              <p className="text-[9px] text-[var(--color-muted)] mt-1 opacity-0 group-hover:opacity-60 transition-opacity leading-tight">
                {card.hint}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
