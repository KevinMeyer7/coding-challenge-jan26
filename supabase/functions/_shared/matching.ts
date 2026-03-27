/**
 * Matching Algorithm
 *
 * Calculates compatibility scores between apples and oranges based on
 * how well each fruit's attributes satisfy the other's preferences.
 *
 * Scoring approach:
 * - Each preference criterion is evaluated independently
 * - Boolean preferences: exact match = 1.0, mismatch = 0.0
 * - Numeric range preferences: in range = 1.0, out of range = decaying score based on distance
 * - Shine factor: match = 1.0, no match = 0.0
 * - Missing attribute (null): scored as 0.5 (neutral - we don't know)
 * - Omitted preference: not counted (any value acceptable)
 *
 * The final score is the weighted average of all evaluated criteria.
 * Mutual score = geometric mean of both directional scores (rewards balance).
 */

import type { Fruit, FruitAttributes, FruitPreferences, ShineFactor, NumberRange } from "./generateFruit.ts";

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
  reason: string;
}

/**
 * Score how well a set of attributes satisfies a set of preferences
 */
function scorePreferenceSatisfaction(
  attributes: FruitAttributes,
  preferences: FruitPreferences
): { score: number; breakdown: CriterionScore[] } {
  const breakdown: CriterionScore[] = [];
  const scores: number[] = [];

  // Size preference
  if (preferences.size !== undefined) {
    const result = scoreNumericRange(attributes.size, preferences.size, "size");
    breakdown.push(result);
    scores.push(result.score);
  }

  // Weight preference
  if (preferences.weight !== undefined) {
    const result = scoreNumericRange(attributes.weight, preferences.weight, "weight");
    breakdown.push(result);
    scores.push(result.score);
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

      if (attrValue === null || attrValue === undefined) {
        breakdown.push({
          criterion: label,
          direction: "forward",
          score: 0.5,
          reason: `${label} unknown (null attribute)`,
        });
        scores.push(0.5);
      } else if (attrValue === prefValue) {
        breakdown.push({
          criterion: label,
          direction: "forward",
          score: 1.0,
          reason: `${label} matches preference`,
        });
        scores.push(1.0);
      } else {
        breakdown.push({
          criterion: label,
          direction: "forward",
          score: 0.0,
          reason: `${label} does not match preference (has: ${attrValue}, wants: ${prefValue})`,
        });
        scores.push(0.0);
      }
    }
  }

  // Shine factor preference
  if (preferences.shineFactor !== undefined) {
    const result = scoreShinePreference(attributes.shineFactor, preferences.shineFactor);
    breakdown.push(result);
    scores.push(result.score);
  }

  // If no preferences specified, everything is acceptable
  if (scores.length === 0) {
    return { score: 1.0, breakdown: [] };
  }

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score: avgScore, breakdown };
}

/**
 * Score a numeric attribute against a range preference
 */
function scoreNumericRange(
  value: number | null,
  range: NumberRange,
  criterion: string
): CriterionScore {
  if (value === null) {
    return {
      criterion,
      direction: "forward",
      score: 0.5,
      reason: `${criterion} unknown`,
    };
  }

  const { min, max } = range;

  // Check if in range
  if ((min === undefined || value >= min) && (max === undefined || value <= max)) {
    return {
      criterion,
      direction: "forward",
      score: 1.0,
      reason: `${criterion} ${value} is within preferred range [${min ?? "-inf"}, ${max ?? "+inf"}]`,
    };
  }

  // Out of range - calculate decay based on distance
  let distance = 0;
  let rangeSize = 1;

  if (min !== undefined && value < min) {
    distance = min - value;
    rangeSize = min;
  } else if (max !== undefined && value > max) {
    distance = value - max;
    rangeSize = max;
  }

  // Exponential decay: score = e^(-distance/scale)
  const scale = rangeSize * 0.3; // 30% of range boundary as scale
  const score = Math.max(0, Math.exp(-distance / Math.max(scale, 1)));

  return {
    criterion,
    direction: "forward",
    score: Math.round(score * 100) / 100,
    reason: `${criterion} ${value} is outside preferred range [${min ?? "-inf"}, ${max ?? "+inf"}] (distance: ${distance.toFixed(1)})`,
  };
}

/**
 * Score shine factor preference
 */
function scoreShinePreference(
  value: ShineFactor | null,
  preference: ShineFactor | ShineFactor[]
): CriterionScore {
  if (value === null) {
    return {
      criterion: "shineFactor",
      direction: "forward",
      score: 0.5,
      reason: "shine factor unknown",
    };
  }

  const acceptable = Array.isArray(preference) ? preference : [preference];

  if (acceptable.includes(value)) {
    return {
      criterion: "shineFactor",
      direction: "forward",
      score: 1.0,
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
    direction: "forward",
    score: Math.round(score * 100) / 100,
    reason: `shine factor "${value}" not in preferred [${acceptable.join(", ")}] (distance: ${closestDist})`,
  };
}

/**
 * Calculate match scores between an incoming fruit and all candidates
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

      const breakdown = [
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
