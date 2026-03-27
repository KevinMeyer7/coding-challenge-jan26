// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import {
  generateApple,
  communicateAttributes,
  communicatePreferences,
} from "../_shared/generateFruit.ts";
import { storeFruit, getFruits, storeMatch } from "../_shared/surrealdb.ts";
import { calculateMatches } from "../_shared/matching.ts";
import type { MatchCandidate } from "../_shared/matching.ts";

/**
 * Get Incoming Apple Edge Function
 *
 * Complete task flow:
 * 1. Generate a new apple instance with random attributes
 * 2. Capture the apple's natural language descriptions
 * 3. Store the apple in SurrealDB
 * 4. Query existing oranges and calculate match scores
 * 5. Use an LLM to generate a matchmaking narrative
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Step 1: Generate a new apple
    const apple = generateApple();

    // Step 2: Capture communication
    const attrDescription = communicateAttributes(apple);
    const prefDescription = communicatePreferences(apple);

    // Step 3: Store in SurrealDB
    const stored = await storeFruit({
      type: "apple",
      attributes: apple.attributes as unknown as Record<string, unknown>,
      preferences: apple.preferences as unknown as Record<string, unknown>,
      attributeDescription: attrDescription,
      preferenceDescription: prefDescription,
    });

    // Step 4: Match against existing oranges
    const oranges = await getFruits("orange");
    const candidates: MatchCandidate[] = oranges.map((o) => ({
      id: o.id,
      attributes: o.attributes as any,
      preferences: o.preferences as any,
    }));

    const matchResults = calculateMatches(
      { attributes: apple.attributes, preferences: apple.preferences },
      candidates
    );

    // Take top 3 matches
    const topMatches = matchResults.slice(0, 3);

    // Step 5: Generate LLM narrative
    let matchNarrative = "";
    let llmUsed = false;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey && topMatches.length > 0) {
      try {
        matchNarrative = await generateMatchNarrative(
          openaiKey,
          attrDescription,
          prefDescription,
          topMatches,
          oranges
        );
        llmUsed = true;
      } catch (err) {
        console.error("LLM narrative generation failed, using fallback:", err);
        matchNarrative = generateFallbackNarrative(topMatches, oranges);
      }
    } else {
      matchNarrative = generateFallbackNarrative(topMatches, oranges);
    }

    // Store the best match
    if (topMatches.length > 0) {
      const best = topMatches[0];
      await storeMatch({
        appleId: stored.id || "unknown",
        orangeId: best.candidateId,
        appleToOrangeScore: best.forwardScore,
        orangeToAppleScore: best.reverseScore,
        mutualScore: best.mutualScore,
        explanation: matchNarrative.slice(0, 500),
      });
    }

    // Build response
    const response = {
      fruit: {
        id: stored.id,
        type: "apple",
        attributes: apple.attributes,
        preferences: apple.preferences,
      },
      communication: {
        attributes: attrDescription,
        preferences: prefDescription,
      },
      matches: topMatches.map((m) => {
        const orange = oranges.find((o) => o.id === m.candidateId);
        return {
          orangeId: m.candidateId,
          forwardScore: m.forwardScore,
          reverseScore: m.reverseScore,
          mutualScore: m.mutualScore,
          orangeAttributes: orange?.attributes,
          orangeAttributeDescription: orange?.attributeDescription,
          breakdown: m.breakdown.slice(0, 10),
        };
      }),
      narrative: matchNarrative,
      meta: {
        totalOrangesSearched: oranges.length,
        llmUsed,
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing incoming apple:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process incoming apple",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

/**
 * Generate match narrative using OpenAI-compatible API (AI SDK pattern)
 */
async function generateMatchNarrative(
  apiKey: string,
  attrDesc: string,
  prefDesc: string,
  topMatches: Array<{ candidateId: string; forwardScore: number; reverseScore: number; mutualScore: number }>,
  oranges: Array<{ id: string; attributeDescription?: string; preferenceDescription?: string; attributes: Record<string, unknown> }>
): Promise<string> {
  const matchDetails = topMatches
    .map((m, i) => {
      const orange = oranges.find((o) => o.id === m.candidateId);
      return `Match #${i + 1} (score: ${(m.mutualScore * 100).toFixed(0)}%):
  Orange ID: ${m.candidateId}
  Orange description: ${orange?.attributeDescription || JSON.stringify(orange?.attributes)}
  Forward compatibility: ${(m.forwardScore * 100).toFixed(0)}% | Reverse: ${(m.reverseScore * 100).toFixed(0)}%`;
    })
    .join("\n\n");

  const prompt = `You are a charming matchmaking host for a fruit dating show called "Perfect Pear".
An apple has just arrived and you need to announce their matches with oranges.

THE APPLE:
${attrDesc}
${prefDesc}

TOP MATCHES:
${matchDetails}

Write a fun, engaging 2-3 paragraph matchmaking announcement. Be witty and use fruit puns.
Explain WHY the top match is a good fit based on their compatibility.
If the scores are low, be encouraging but honest. Keep it under 200 words.`;

  const baseUrl = Deno.env.get("LLM_BASE_URL") || "https://api.openai.com/v1";
  const model = Deno.env.get("LLM_MODEL") || "gpt-4o-mini";

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
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No narrative generated.";
}

/**
 * Fallback narrative without LLM
 */
function generateFallbackNarrative(
  topMatches: Array<{ candidateId: string; forwardScore: number; reverseScore: number; mutualScore: number }>,
  oranges: Array<{ id: string; attributes: Record<string, unknown> }>
): string {
  if (topMatches.length === 0) {
    return "No oranges found in the system yet. This apple is the first to arrive - check back once some oranges join the pool!";
  }

  const best = topMatches[0];
  const scorePercent = (best.mutualScore * 100).toFixed(0);
  const orange = oranges.find((o) => o.id === best.candidateId);

  let narrative = `Great news! We found a match with a ${scorePercent}% mutual compatibility score. `;

  if (best.mutualScore >= 0.8) {
    narrative += `This is an excellent pairing - a truly perfect pear! `;
  } else if (best.mutualScore >= 0.6) {
    narrative += `This is a solid match with good potential. `;
  } else if (best.mutualScore >= 0.4) {
    narrative += `While not a perfect match, there's definitely some common ground here. `;
  } else {
    narrative += `The compatibility is modest, but sometimes opposites attract! `;
  }

  if (orange?.attributes) {
    const attrs = orange.attributes as Record<string, unknown>;
    if (attrs.shineFactor) {
      narrative += `The matched orange has a ${attrs.shineFactor} appearance. `;
    }
    if (attrs.size) {
      narrative += `It measures ${attrs.size} units in size. `;
    }
  }

  if (topMatches.length > 1) {
    narrative += `We also found ${topMatches.length - 1} other potential match${topMatches.length > 2 ? "es" : ""} worth considering.`;
  }

  return narrative;
}
