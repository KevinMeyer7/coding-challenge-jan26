/**
 * Bidirectional weighted compatibility scoring.
 *
 * Scores each fruit pair in both directions (forward + reverse) and combines
 * with geometric mean — so a 100%/0% pair scores 0%, not 50%. This catches
 * one-sided mismatches that arithmetic mean would hide.
 *
 * Criteria are weighted: worm (3x) and chemicals (2.5x) are dealbreakers,
 * shine and leaf (0.7x) are cosmetic. Numeric ranges use exponential decay
 * near boundaries instead of hard cutoffs. Null attributes score 0.5 (neutral).
 */

import type { FruitAttributes, FruitPreferences, ShineFactor, NumberRange } from "./generateFruit.ts";

export interface MatchCandidate {
  id: string;
  attributes: FruitAttributes;
  preferences: FruitPreferences;
}

export interface MatchScore {
  candidateId: string;
  /** How well the candidate satisfies the incoming fruit's preferences */
  forwardScore: number;
  /** How well the incoming fruit satisfies the candidate's preferences */
  reverseScore: number;
  /** Geometric mean of forward and reverse scores */
  mutualScore: number;
  /** Per-criterion breakdown */
  breakdown: CriterionScore[];
}

export interface CriterionScore {
  criterion: string;
  direction: "forward" | "reverse";
  score: number;
  weight: number;
  reason: string;
}

interface RawCriterionScore {
  criterion: string;
  score: number;
  weight: number;
  reason: string;
}

/**
 * Criterion weights model real-world preference intensity.
 * Dealbreakers (worm, chemicals) have high weight; cosmetic preferences have lower weight.
 */
const CRITERION_WEIGHTS: Record<string, number> = {
  size: 1.0,
  weight: 1.0,
  stem: 0.8,
  leaf: 0.7,
  worm: 3.0,       // dealbreaker — nobody wants a worm
  chemicals: 2.5,  // strong preference — health concern
  shineFactor: 0.7, // cosmetic — nice to have
};

/**
 * Score how well a set of attributes satisfies a set of preferences.
 * Returns raw scores without direction (direction is assigned by the caller).
 */
function scorePreferenceSatisfaction(
  attributes: FruitAttributes,
  preferences: FruitPreferences
): { score: number; breakdown: RawCriterionScore[] } {
  const breakdown: RawCriterionScore[] = [];

  // Size preference
  if (preferences.size !== undefined) {
    const result = scoreNumericRange(attributes.size, preferences.size, "size");
    breakdown.push(result);
  }

  // Weight preference
  if (preferences.weight !== undefined) {
    const result = scoreNumericRange(attributes.weight, preferences.weight, "weight");
    breakdown.push(result);
  }

  // Boolean preferences
  const booleanPrefs: Array<{ key: keyof FruitAttributes & keyof FruitPreferences; label: string }> = [
    { key: "hasStem", label: "stem" },
    { key: "hasLeaf", label: "leaf" },
    { key: "hasWorm", label: "worm" },
    { key: "hasChemicals", label: "chemicals" },
  ];

  for (const { key, label } of booleanPrefs) {
    if (preferences[key] !== undefined) {
      const attrValue = attributes[key as keyof FruitAttributes];
      const prefValue = preferences[key as keyof FruitPreferences];
      const w = CRITERION_WEIGHTS[label] ?? 1.0;

      if (attrValue === null || attrValue === undefined) {
        breakdown.push({ criterion: label, score: 0.5, weight: w, reason: `${label} unknown (null attribute)` });
      } else if (attrValue === prefValue) {
        breakdown.push({ criterion: label, score: 1.0, weight: w, reason: `${label} matches preference` });
      } else {
        breakdown.push({
          criterion: label,
          score: 0.0,
          weight: w,
          reason: `${label} does not match (has: ${attrValue}, wants: ${prefValue})`,
        });
      }
    }
  }

  // Shine factor preference
  if (preferences.shineFactor !== undefined) {
    const result = scoreShinePreference(attributes.shineFactor, preferences.shineFactor);
    breakdown.push(result);
  }

  // If no preferences specified, everything is acceptable
  if (breakdown.length === 0) {
    return { score: 1.0, breakdown: [] };
  }

  // Weighted average: dealbreakers (worm=3x, chemicals=2.5x) count more than cosmetics (shine=0.7x)
  const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
  const weightedScore = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0) / totalWeight;
  return { score: weightedScore, breakdown };
}

/**
 * Score a numeric attribute against a range preference.
 * Uses exponential decay for out-of-range values with a fixed scale constant
 * derived from the range span (or a sensible default for open-ended ranges).
 */
function scoreNumericRange(
  value: number | null,
  range: NumberRange,
  criterion: string
): RawCriterionScore {
  const w = CRITERION_WEIGHTS[criterion] ?? 1.0;

  if (value === null) {
    return { criterion, score: 0.5, weight: w, reason: `${criterion} unknown` };
  }

  const { min, max } = range;

  // Check if in range
  if ((min === undefined || value >= min) && (max === undefined || value <= max)) {
    return {
      criterion,
      score: 1.0,
      weight: w,
      reason: `${criterion} ${value} is within preferred range [${min ?? "-inf"}, ${max ?? "+inf"}]`,
    };
  }

  // Out of range - calculate decay based on distance
  let distance = 0;
  if (min !== undefined && value < min) {
    distance = min - value;
  } else if (max !== undefined && value > max) {
    distance = value - max;
  }

  // Use range span as scale basis, or a sensible default for open-ended ranges
  const rangeSpan = (min !== undefined && max !== undefined) ? (max - min) : 10;
  const scale = Math.max(rangeSpan * 0.3, 1); // at least 1 to avoid division issues

  const score = Math.max(0, Math.exp(-distance / scale));

  return {
    criterion,
    score: Math.round(score * 100) / 100,
    weight: w,
    reason: `${criterion} ${value} is outside preferred range [${min ?? "-inf"}, ${max ?? "+inf"}] (distance: ${distance.toFixed(1)})`,
  };
}

/**
 * Score shine factor preference
 */
function scoreShinePreference(
  value: ShineFactor | null,
  preference: ShineFactor | ShineFactor[]
): RawCriterionScore {
  const w = CRITERION_WEIGHTS["shineFactor"] ?? 0.7;

  if (value === null) {
    return { criterion: "shineFactor", score: 0.5, weight: w, reason: "shine factor unknown" };
  }

  const acceptable = Array.isArray(preference) ? preference : [preference];

  if (acceptable.includes(value)) {
    return {
      criterion: "shineFactor",
      score: 1.0,
      weight: w,
      reason: `shine factor "${value}" matches preference`,
    };
  }

  // Partial credit based on proximity on the shine scale
  const shineOrder: ShineFactor[] = ["dull", "neutral", "shiny", "extraShiny"];
  const valueIdx = shineOrder.indexOf(value);
  const closestDist = Math.min(
    ...acceptable.map((p) => Math.abs(shineOrder.indexOf(p) - valueIdx))
  );

  const score = Math.max(0, 1 - closestDist * 0.33);

  return {
    criterion: "shineFactor",
    score: Math.round(score * 100) / 100,
    weight: w,
    reason: `shine factor "${value}" not in preferred [${acceptable.join(", ")}] (distance: ${closestDist})`,
  };
}

/**
 * Calculate match scores between an incoming fruit and all candidates.
 * Returns candidates sorted by mutual score (descending).
 */
export function calculateMatches(
  incoming: { attributes: FruitAttributes; preferences: FruitPreferences },
  candidates: MatchCandidate[]
): MatchScore[] {
  return candidates
    .map((candidate) => {
      // Forward: how well does this candidate satisfy the incoming fruit's preferences?
      const forward = scorePreferenceSatisfaction(candidate.attributes, incoming.preferences);

      // Reverse: how well does the incoming fruit satisfy this candidate's preferences?
      const reverse = scorePreferenceSatisfaction(incoming.attributes, candidate.preferences);

      // Mutual score: geometric mean rewards balance between both directions
      const mutualScore =
        forward.score === 0 || reverse.score === 0
          ? 0
          : Math.sqrt(forward.score * reverse.score);

      const breakdown: CriterionScore[] = [
        ...forward.breakdown.map((b) => ({ ...b, direction: "forward" as const })),
        ...reverse.breakdown.map((b) => ({ ...b, direction: "reverse" as const })),
      ];

      return {
        candidateId: candidate.id,
        forwardScore: Math.round(forward.score * 100) / 100,
        reverseScore: Math.round(reverse.score * 100) / 100,
        mutualScore: Math.round(mutualScore * 100) / 100,
        breakdown,
      };
    })
    .sort((a, b) => b.mutualScore - a.mutualScore);
}
