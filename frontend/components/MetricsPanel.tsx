"use client";

import { useEffect } from "react";
import { useMatchmakingStore } from "@/lib/store";
import {
  Apple,
  Citrus,
  Heart,
  TrendingUp,
  BarChart3,
  Target,
} from "lucide-react";

/**
 * Metrics overview cards showing key performance indicators
 */
export function MetricsPanel() {
  const stats = useMatchmakingStore((s) => s.stats);
  const statsLoading = useMatchmakingStore((s) => s.statsLoading);
  const refreshStats = useMatchmakingStore((s) => s.refreshStats);

  useEffect(() => {
    refreshStats();
  }, []);

  if (statsLoading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="metric-card animate-pulse">
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-3 h-8 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    );
  }

  const metrics = stats?.metrics;

  const cards = [
    {
      label: "Apples",
      value: metrics?.totalApples ?? 0,
      icon: Apple,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/30",
    },
    {
      label: "Oranges",
      value: metrics?.totalOranges ?? 0,
      icon: Citrus,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      label: "Matches",
      value: metrics?.totalMatches ?? 0,
      icon: Heart,
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950/30",
    },
    {
      label: "Avg Score",
      value: `${metrics?.avgMutualScore ?? 0}%`,
      icon: Target,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/30",
    },
    {
      label: "Match Rate",
      value: `${metrics?.matchRate ?? 0}%`,
      icon: TrendingUp,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Unmatched",
      value: (metrics?.unmatchedApples ?? 0) + (metrics?.unmatchedOranges ?? 0),
      icon: BarChart3,
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="metric-card">
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
