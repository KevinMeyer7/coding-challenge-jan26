"use client";

import { useMatchmakingStore, selectActiveConversation } from "@/lib/store";
import { Check, X, HelpCircle } from "lucide-react";

/**
 * Side-by-side compatibility view showing:
 * - What the incoming fruit wanted (preferences)
 * - What the matched fruit actually has (attributes)
 * - Per-criterion score connecting them
 */
export function CompatibilityBreakdown() {
  const activeConversation = useMatchmakingStore(selectActiveConversation);

  if (
    !activeConversation ||
    activeConversation.status !== "complete" ||
    !activeConversation.response?.matches?.length
  ) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold mb-4">Compatibility Breakdown</h3>
        <div className="flex h-[200px] items-center justify-center text-[var(--color-muted)] text-sm">
          Run a conversation to see match details
        </div>
      </div>
    );
  }

  const { response } = activeConversation;
  const best = response.matches[0];
  const breakdown = best.breakdown ?? [];
  const incomingType = response.fruit.type;
  const matchType = incomingType === "apple" ? "orange" : "apple";
  const matchAttrs = (best.orangeAttributes || best.appleAttributes || {}) as Record<string, unknown>;
  const incomingAttrs = response.fruit.attributes as unknown as Record<string, unknown>;
  const incomingPrefs = response.fruit.preferences;

  const forwardCriteria = breakdown.filter((b) => b.direction === "forward");
  const reverseCriteria = breakdown.filter((b) => b.direction === "reverse");

  const mutualPercent = Math.round(best.mutualScore * 100);

  return (
    <div className="card overflow-y-auto max-h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Compatibility Breakdown</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            mutualPercent >= 80
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : mutualPercent >= 50
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
          }`}
        >
          {mutualPercent}% mutual
        </span>
      </div>

      {/* Forward: how well match fits our preferences */}
      {forwardCriteria.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span>{incomingType === "apple" ? "🍎" : "🍊"}</span>
            <span className="text-xs font-medium">
              Our preferences vs match&apos;s attributes
            </span>
            <span className="ml-auto text-xs text-[var(--color-muted)]">
              {Math.round(best.forwardScore * 100)}%
            </span>
          </div>
          <div className="space-y-2">
            {forwardCriteria.map((c, i) => (
              <CriterionRow
                key={`f-${i}`}
                criterion={c.criterion}
                score={c.score}
                reason={c.reason}
                wantValue={getPreferenceDisplay(c.criterion, incomingPrefs)}
                hasValue={getAttributeDisplay(c.criterion, matchAttrs)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reverse: how well we fit match's preferences */}
      {reverseCriteria.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span>{matchType === "apple" ? "🍎" : "🍊"}</span>
            <span className="text-xs font-medium">
              Match&apos;s preferences vs our attributes
            </span>
            <span className="ml-auto text-xs text-[var(--color-muted)]">
              {Math.round(best.reverseScore * 100)}%
            </span>
          </div>
          <div className="space-y-2">
            {reverseCriteria.map((c, i) => (
              <CriterionRow
                key={`r-${i}`}
                criterion={c.criterion}
                score={c.score}
                reason={c.reason}
                wantValue={null}
                hasValue={getAttributeDisplay(c.criterion, incomingAttrs)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CriterionRow({
  criterion,
  score,
  reason,
  wantValue,
  hasValue,
}: {
  criterion: string;
  score: number;
  reason: string;
  wantValue: string | null;
  hasValue: string | null;
}) {
  const percent = Math.round(score * 100);
  const icon =
    percent >= 80 ? (
      <Check className="h-3.5 w-3.5 text-green-500" />
    ) : percent >= 50 ? (
      <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
    ) : (
      <X className="h-3.5 w-3.5 text-red-500" />
    );

  const barColor =
    percent >= 80
      ? "bg-green-500"
      : percent >= 50
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/50 p-2">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium capitalize flex-1">
          {criterion}
        </span>
        <span className="text-xs tabular-nums font-medium">{percent}%</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 mb-1.5">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
        {wantValue && <span>Want: {wantValue}</span>}
        {hasValue && <span>Has: {hasValue}</span>}
      </div>
    </div>
  );
}

function getPreferenceDisplay(
  criterion: string,
  prefs: Record<string, unknown>
): string | null {
  const key = criterionToKey(criterion);
  const val = prefs[key];
  if (val === undefined) return null;
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object" && val !== null) {
    const range = val as { min?: number; max?: number };
    if (range.min !== undefined && range.max !== undefined)
      return `${range.min}-${range.max}`;
    if (range.min !== undefined) return `${range.min}+`;
    if (range.max !== undefined) return `up to ${range.max}`;
  }
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function getAttributeDisplay(
  criterion: string,
  attrs: Record<string, unknown>
): string | null {
  const key = criterionToKey(criterion);
  const val = attrs[key];
  if (val === undefined || val === null) return "Unknown";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

function criterionToKey(criterion: string): string {
  const map: Record<string, string> = {
    size: "size",
    weight: "weight",
    stem: "hasStem",
    leaf: "hasLeaf",
    worm: "hasWorm",
    chemicals: "hasChemicals",
    shineFactor: "shineFactor",
    shinefactor: "shineFactor",
  };
  return map[criterion.toLowerCase()] ?? criterion;
}
