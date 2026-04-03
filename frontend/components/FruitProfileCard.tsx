"use client";

/**
 * Visual representation of a fruit's attributes.
 * Shows numeric values as bars, booleans as colored pills,
 * and shine factor as a gradient scale.
 */

const SIZE_MIN = 2;
const SIZE_MAX = 14;
const WEIGHT_MIN = 50;
const WEIGHT_MAX = 350;

const SHINE_LEVELS = ["dull", "neutral", "shiny", "extraShiny"] as const;
const SHINE_LABELS: Record<string, string> = {
  dull: "Dull",
  neutral: "Neutral",
  shiny: "Shiny",
  extraShiny: "Extra Shiny",
};

interface FruitProfileCardProps {
  type: "apple" | "orange";
  attributes: Record<string, unknown>;
  compact?: boolean;
  score?: number;
}

export function FruitProfileCard({
  type,
  attributes,
  compact = false,
  score,
}: FruitProfileCardProps) {
  const size = attributes.size as number | null;
  const weight = attributes.weight as number | null;
  const hasStem = attributes.hasStem as boolean | null;
  const hasLeaf = attributes.hasLeaf as boolean | null;
  const hasWorm = attributes.hasWorm as boolean | null;
  const shineFactor = attributes.shineFactor as string | null;
  const hasChemicals = attributes.hasChemicals as boolean | null;

  const emoji = type === "apple" ? "🍎" : "🍊";
  const borderColor =
    type === "apple"
      ? "border-red-200 dark:border-red-900"
      : "border-orange-200 dark:border-orange-900";
  const bgColor =
    type === "apple"
      ? "bg-red-100/70 dark:bg-red-950/20"
      : "bg-orange-100/70 dark:bg-orange-950/20";

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${borderColor} ${bgColor}`}
      >
        <span className="text-base">{emoji}</span>
        <div className="flex flex-col gap-0.5">
          {size !== null && (
            <span>
              Size: <strong>{size}</strong>
            </span>
          )}
          {shineFactor && (
            <span className="capitalize">{SHINE_LABELS[shineFactor] ?? shineFactor}</span>
          )}
        </div>
        {score !== undefined && (
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              score >= 0.8
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : score >= 0.5
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            }`}
          >
            {Math.round(score * 100)}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${borderColor} ${bgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <span className="text-sm font-semibold capitalize">{type}</span>
        </div>
        {score !== undefined && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              score >= 0.8
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : score >= 0.5
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            }`}
          >
            {Math.round(score * 100)}% match
          </span>
        )}
      </div>

      {/* Numeric bars */}
      <div className="space-y-2 mb-3">
        <NumericBar label="Size" value={size} min={SIZE_MIN} max={SIZE_MAX} />
        <NumericBar
          label="Weight"
          value={weight}
          min={WEIGHT_MIN}
          max={WEIGHT_MAX}
          unit="g"
        />
      </div>

      {/* Shine scale */}
      <div className="mb-3">
        <span className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
          Shine
        </span>
        <div className="flex gap-1 mt-1">
          {SHINE_LEVELS.map((level) => (
            <div
              key={level}
              className={`h-2 flex-1 rounded-full transition-all ${
                shineFactor === level
                  ? level === "dull"
                    ? "bg-zinc-400"
                    : level === "neutral"
                    ? "bg-zinc-300 dark:bg-zinc-500"
                    : level === "shiny"
                    ? "bg-yellow-400"
                    : "bg-yellow-300 ring-2 ring-yellow-200"
                  : "bg-zinc-100 dark:bg-zinc-800"
              }`}
              title={SHINE_LABELS[level]}
            />
          ))}
        </div>
        {shineFactor && (
          <span className="text-[10px] text-[var(--color-muted)] mt-0.5 block">
            {SHINE_LABELS[shineFactor]}
          </span>
        )}
      </div>

      {/* Boolean pills */}
      <div className="flex flex-wrap gap-1.5">
        <BooleanPill label="Stem" value={hasStem} />
        <BooleanPill label="Leaf" value={hasLeaf} />
        <BooleanPill label="Worm" value={hasWorm} invert />
        <BooleanPill label="Chemicals" value={hasChemicals} invert />
      </div>
    </div>
  );
}

function NumericBar({
  label,
  value,
  min,
  max,
  unit = "",
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  unit?: string;
}) {
  if (value === null) {
    return (
      <div>
        <div className="flex items-center justify-between text-[10px] mb-0.5">
          <span className="font-medium text-[var(--color-muted)] uppercase tracking-wider">
            {label}
          </span>
          <span className="text-[var(--color-muted)]">Unknown</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full w-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="font-medium text-[var(--color-muted)] uppercase tracking-wider">
          {label}
        </span>
        <span className="tabular-nums font-medium">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BooleanPill({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: boolean | null;
  invert?: boolean;
}) {
  if (value === null) {
    return (
      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
        {label}: ?
      </span>
    );
  }

  // For "invert" items (worm, chemicals), having them = bad
  const isGood = invert ? !value : value;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        isGood
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      }`}
    >
      {label}: {value ? "Yes" : "No"}
    </span>
  );
}
