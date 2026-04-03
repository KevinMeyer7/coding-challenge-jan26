/**
 * Template-based match narrative generation for edge functions.
 *
 * The edge function generates a quick template narrative. If the frontend
 * has an OpenAI key, it enhances the narrative via the AI SDK route (/api/chat).
 * This separation keeps the edge function fast and the LLM call optional.
 */

import type { FruitType } from "./generateFruit.ts";

interface NarrativeMatch {
  candidateId: string;
  forwardScore: number;
  reverseScore: number;
  mutualScore: number;
}

interface NarrativeCandidate {
  id: string;
  attributeDescription?: string;
  attributes: Record<string, unknown>;
}

export function generateNarrative(opts: {
  fruitType: FruitType;
  topMatches: NarrativeMatch[];
  candidates: NarrativeCandidate[];
}): string {
  const otherType = opts.fruitType === "apple" ? "oranges" : "apples";

  if (opts.topMatches.length === 0) {
    return `No ${otherType} found in the system yet. This ${opts.fruitType} is among the first to arrive — check back once some ${otherType} join the pool!`;
  }

  const best = opts.topMatches[0];
  const scorePercent = (best.mutualScore * 100).toFixed(0);
  const candidate = opts.candidates.find((c) => c.id === best.candidateId);

  let narrative = `Match found with ${scorePercent}% mutual compatibility. `;

  if (best.mutualScore >= 0.8) {
    narrative += `An excellent pairing — both sides align strongly on preferences. `;
  } else if (best.mutualScore >= 0.6) {
    narrative += `A solid match with good potential on most criteria. `;
  } else if (best.mutualScore >= 0.4) {
    narrative += `Not a perfect match, but there's common ground on key attributes. `;
  } else {
    narrative += `Compatibility is low — most preferences don't align. `;
  }

  narrative += `Forward score: ${(best.forwardScore * 100).toFixed(0)}% (how well the match fits preferences). `;
  narrative += `Reverse score: ${(best.reverseScore * 100).toFixed(0)}% (how well preferences fit the match). `;

  if (candidate?.attributes) {
    const attrs = candidate.attributes;
    if (attrs.shineFactor) narrative += `The matched ${otherType.slice(0, -1)} has a ${attrs.shineFactor} appearance. `;
    if (attrs.size) narrative += `Size: ${attrs.size} units. `;
  }

  if (opts.topMatches.length > 1) {
    narrative += `${opts.topMatches.length - 1} other candidate${opts.topMatches.length > 2 ? "s" : ""} also showed potential.`;
  }

  return narrative;
}

/**
 * Truncate at a sentence boundary.
 */
export function truncateNarrative(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastPeriod = truncated.lastIndexOf(". ");
  if (lastPeriod > maxLen * 0.5) return truncated.slice(0, lastPeriod + 1);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}
