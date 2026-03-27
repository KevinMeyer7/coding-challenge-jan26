"use client";

import { ChatVisualization } from "@/components/ChatVisualization";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ScoreDistribution } from "@/components/ScoreDistribution";
import { RecentMatches } from "@/components/RecentMatches";
import { CompatibilityBreakdown } from "@/components/CompatibilityBreakdown";
import { useMatchmakingStore } from "@/lib/store";
import { RefreshCw } from "lucide-react";

/**
 * Main Dashboard Page
 *
 * Layout:
 * - Top: Metrics overview (6 KPI cards)
 * - Middle: Chat visualization (main interaction area) + Compatibility breakdown
 * - Bottom: Score distribution chart + Recent matches list
 */
export default function DashboardPage() {
  const refreshStats = useMatchmakingStore((s) => s.refreshStats);
  const statsLoading = useMatchmakingStore((s) => s.statsLoading);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                🍎 Perfect Pear 🍊
              </h1>
              <p className="text-xs text-[var(--color-muted)] sm:text-sm">
                Matchmaking dashboard — creating perfect pears, one match at a
                time
              </p>
            </div>
            <button
              onClick={() => refreshStats()}
              disabled={statsLoading}
              className="btn-secondary flex items-center gap-2"
              title="Refresh stats"
            >
              <RefreshCw
                className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Metrics Row */}
        <section>
          <MetricsPanel />
        </section>

        {/* Main Content: Chat + Breakdown */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold mb-3 text-[var(--color-muted)] uppercase tracking-wide">
              Matchmaking Conversation
            </h2>
            <ChatVisualization />
          </div>
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold mb-3 text-[var(--color-muted)] uppercase tracking-wide">
                Match Analysis
              </h2>
              <CompatibilityBreakdown />
            </div>
            <RecentMatches />
          </div>
        </section>

        {/* Analytics Row */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-[var(--color-muted)] uppercase tracking-wide">
            Analytics
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ScoreDistribution />
            <div className="card h-[320px]">
              <h3 className="text-sm font-semibold mb-4">
                System Performance
              </h3>
              <SystemPerformanceContent />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SystemPerformanceContent() {
  const stats = useMatchmakingStore((s) => s.stats);
  const conversations = useMatchmakingStore((s) => s.conversations);

  const metrics = stats?.metrics;
  const completedConversations = conversations.filter(
    (c) => c.status === "complete"
  );
  const errorConversations = conversations.filter((c) => c.status === "error");

  const items = [
    {
      label: "Total conversations this session",
      value: conversations.length,
    },
    {
      label: "Successful conversations",
      value: completedConversations.length,
    },
    {
      label: "Failed conversations",
      value: errorConversations.length,
    },
    {
      label: "Forward score avg (apple → orange)",
      value: `${metrics?.avgForwardScore ?? 0}%`,
    },
    {
      label: "Reverse score avg (orange → apple)",
      value: `${metrics?.avgReverseScore ?? 0}%`,
    },
    {
      label: "Mutual score avg (geometric mean)",
      value: `${metrics?.avgMutualScore ?? 0}%`,
    },
    {
      label: "Unmatched apples",
      value: metrics?.unmatchedApples ?? 0,
    },
    {
      label: "Unmatched oranges",
      value: metrics?.unmatchedOranges ?? 0,
    },
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-[var(--color-muted)]">{item.label}</span>
          <span className="font-medium tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
