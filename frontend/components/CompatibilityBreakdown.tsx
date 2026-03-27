"use client";

import { useMatchmakingStore, selectActiveConversation } from "@/lib/store";

/**
 * Shows the per-criterion breakdown of the active conversation's best match
 */
export function CompatibilityBreakdown() {
  const activeConversation = useMatchmakingStore(selectActiveConversation);

  if (
    !activeConversation ||
    activeConversation.status !== "complete" ||
    !activeConversation.response?.matches?.length
  ) {
    return (
      <div className="card h-[320px]">
        <h3 className="text-sm font-semibold mb-4">
          Compatibility Breakdown
        </h3>
        <div className="flex h-[240px] items-center justify-center text-[var(--color-muted)] text-sm">
          Select a conversation to see match details
        </div>
      </div>
    );
  }

  const bestMatch = activeConversation.response.matches[0];
  const breakdown = bestMatch.breakdown ?? [];

  // Separate forward and reverse criteria
  const forwardCriteria = breakdown.filter((b) => b.direction === "forward");
  const reverseCriteria = breakdown.filter((b) => b.direction === "reverse");

  return (
    <div className="card h-[320px] overflow-y-auto">
      <h3 className="text-sm font-semibold mb-3">
        Compatibility Breakdown
      </h3>
      <div className="text-xs text-[var(--color-muted)] mb-3">
        Best match: {(bestMatch.mutualScore * 100).toFixed(0)}% mutual score
      </div>

      {forwardCriteria.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-[var(--color-muted)] mb-2">
            → How well match fits our preferences
          </p>
          {forwardCriteria.map((c, i) => (
            <CriterionBar key={`f-${i}`} criterion={c} />
          ))}
        </div>
      )}

      {reverseCriteria.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--color-muted)] mb-2">
            ← How well we fit match&apos;s preferences
          </p>
          {reverseCriteria.map((c, i) => (
            <CriterionBar key={`r-${i}`} criterion={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CriterionBar({
  criterion,
}: {
  criterion: { criterion: string; score: number; reason: string };
}) {
  const percent = Math.round(criterion.score * 100);
  const barColor =
    percent >= 80
      ? "bg-green-500"
      : percent >= 50
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="font-medium capitalize">{criterion.criterion}</span>
        <span className="tabular-nums text-[var(--color-muted)]">
          {percent}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
