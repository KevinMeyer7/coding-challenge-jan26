/**
 * Match narrative generation — shared between apple and orange edge functions.
 *
 * Supports LLM-powered narratives (OpenAI-compatible API) with graceful
 * fallback to template-based generation when no API key is available.
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

/**
 * Generate a match narrative, trying LLM first then falling back to templates.
 */
export async function generateNarrative(opts: {
  fruitType: FruitType;
  attrDescription: string;
  prefDescription: string;
  topMatches: NarrativeMatch[];
  candidates: NarrativeCandidate[];
}): Promise<{ narrative: string; llmUsed: boolean }> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (openaiKey && opts.topMatches.length > 0) {
    try {
      const narrative = await generateLLMNarrative(openaiKey, opts);
      return { narrative, llmUsed: true };
    } catch (err) {
      console.error("LLM narrative generation failed, using fallback:", err);
    }
  }

  return {
    narrative: generateFallbackNarrative(opts),
    llmUsed: false,
  };
}

async function generateLLMNarrative(
  apiKey: string,
  opts: {
    fruitType: FruitType;
    attrDescription: string;
    prefDescription: string;
    topMatches: NarrativeMatch[];
    candidates: NarrativeCandidate[];
  }
): Promise<string> {
  const otherType = opts.fruitType === "apple" ? "oranges" : "apples";
  const matchDetails = opts.topMatches
    .map((m, i) => {
      const c = opts.candidates.find((c) => c.id === m.candidateId);
      return `Match #${i + 1} (score: ${(m.mutualScore * 100).toFixed(0)}%):
  ID: ${m.candidateId}
  Description: ${c?.attributeDescription || JSON.stringify(c?.attributes)}
  Forward: ${(m.forwardScore * 100).toFixed(0)}% | Reverse: ${(m.reverseScore * 100).toFixed(0)}%`;
    })
    .join("\n\n");

  const prompt = `You are a charming matchmaking host for a fruit dating show called "Perfect Pear".
A new ${opts.fruitType} has arrived and you need to announce their matches with ${otherType}.

THE ${opts.fruitType.toUpperCase()}:
${opts.attrDescription}
${opts.prefDescription}

TOP MATCHES:
${matchDetails}

Write a fun, engaging 2-3 paragraph matchmaking announcement. Be witty and use fruit puns.
Explain WHY the top match is a good fit based on their compatibility.
If the scores are low, be encouraging but honest. Keep it under 200 words.`;

  const baseUrl = Deno.env.get("LLM_BASE_URL") || "https://api.openai.com/v1";
  const model = Deno.env.get("LLM_MODEL") || "gpt-4o-mini";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No narrative generated.";
  } finally {
    clearTimeout(timeoutId);
  }
}

function generateFallbackNarrative(opts: {
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

  let narrative = `Great news! We found a match with a ${scorePercent}% mutual compatibility score. `;

  if (best.mutualScore >= 0.8) {
    narrative += `This is an excellent pairing — a truly perfect pear! `;
  } else if (best.mutualScore >= 0.6) {
    narrative += `This is a solid match with good potential. `;
  } else if (best.mutualScore >= 0.4) {
    narrative += `While not a perfect match, there's definitely common ground here. `;
  } else {
    narrative += `The compatibility is modest, but sometimes opposites attract! `;
  }

  if (candidate?.attributes) {
    const attrs = candidate.attributes;
    if (attrs.shineFactor) {
      narrative += `The matched ${otherType.slice(0, -1)} has a ${attrs.shineFactor} appearance. `;
    }
    if (attrs.size) {
      narrative += `It measures ${attrs.size} units in size. `;
    }
  }

  if (opts.topMatches.length > 1) {
    narrative += `We also found ${opts.topMatches.length - 1} other potential match${opts.topMatches.length > 2 ? "es" : ""} worth considering.`;
  }

  return narrative;
}

/**
 * Truncate narrative at a sentence boundary.
 */
export function truncateNarrative(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSentence = truncated.lastIndexOf(". ");
  if (lastSentence > maxLen * 0.5) {
    return truncated.slice(0, lastSentence + 1);
  }
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}
