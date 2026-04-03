"use client";

import { useMatchmakingStore } from "@/lib/store";
import { formatRelativeTime } from "@/lib/utils";

/**
 * Table/list of recent matches with scores and fruit details
 */
export function RecentMatches() {
  const stats = useMatchmakingStore((s) => s.stats);
  const recentMatches = stats?.recentMatches ?? [];

  if (recentMatches.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold mb-4">Recent Matches</h3>
        <div className="flex h-32 items-center justify-center text-[var(--color-muted)] text-sm">
          <div className="text-center">
            <p className="text-3xl mb-2">🍐</p>
            <p>No matches yet. Start a conversation to create your first pear!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold mb-4">
        Recent Matches ({recentMatches.length})
      </h3>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {recentMatches.map((match) => {
          const scorePercent = Math.round(match.mutualScore * 100);
          const scoreColor =
            scorePercent >= 80
              ? "text-green-600 bg-green-100 dark:bg-green-950/30"
              : scorePercent >= 60
              ? "text-blue-600 bg-blue-50 dark:bg-blue-950/30"
              : scorePercent >= 40
              ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
              : "text-red-600 bg-red-50 dark:bg-red-950/30";

          const appleAttrs = match.appleAttributes as Record<string, unknown> | undefined;
          const orangeAttrs = match.orangeAttributes as Record<string, unknown> | undefined;

          return (
            <div
              key={match.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-card-hover)]"
            >
              {/* Apple side */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span>🍎</span>
                  <span className="text-xs font-medium truncate">
                    {appleAttrs?.shineFactor
                      ? `${appleAttrs.shineFactor}`
                      : "Apple"}
                    {appleAttrs?.size ? ` (${appleAttrs.size})` : ""}
                  </span>
                </div>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${scoreColor}`}
                >
                  {scorePercent}%
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  mutual
                </span>
              </div>

              {/* Orange side */}
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs font-medium truncate">
                    {orangeAttrs?.shineFactor
                      ? `${orangeAttrs.shineFactor}`
                      : "Orange"}
                    {orangeAttrs?.size ? ` (${orangeAttrs.size})` : ""}
                  </span>
                  <span>🍊</span>
                </div>
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-[var(--color-muted)] shrink-0">
                {match.createdAt
                  ? formatRelativeTime(match.createdAt)
                  : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
