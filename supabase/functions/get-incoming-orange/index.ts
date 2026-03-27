// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import {
  generateOrange,
  communicateAttributes,
  communicatePreferences,
} from "../_shared/generateFruit.ts";
import { storeFruit, getFruits, storeMatch } from "../_shared/surrealdb.ts";
import { calculateMatches } from "../_shared/matching.ts";
import type { MatchCandidate } from "../_shared/matching.ts";

/**
 * Get Incoming Orange Edge Function
 *
 * Mirror of get-incoming-apple but for oranges matched against apples.
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
    // Step 1: Generate a new orange
    const orange = generateOrange();

    // Step 2: Capture communication
    const attrDescription = communicateAttributes(orange);
    const prefDescription = communicatePreferences(orange);

    // Step 3: Store in SurrealDB
    const stored = await storeFruit({
      type: "orange",
      attributes: orange.attributes as unknown as Record<string, unknown>,
      preferences: orange.preferences as unknown as Record<string, unknown>,
      attributeDescription: attrDescription,
      preferenceDescription: prefDescription,
    });

    // Step 4: Match against existing apples
    const apples = await getFruits("apple");
    const candidates: MatchCandidate[] = apples.map((a) => ({
      id: a.id,
      attributes: a.attributes as any,
      preferences: a.preferences as any,
    }));

    const matchResults = calculateMatches(
      { attributes: orange.attributes, preferences: orange.preferences },
      candidates
    );

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
          apples
        );
        llmUsed = true;
      } catch (err) {
        console.error("LLM narrative generation failed, using fallback:", err);
        matchNarrative = generateFallbackNarrative(topMatches, apples);
      }
    } else {
      matchNarrative = generateFallbackNarrative(topMatches, apples);
    }

    // Store the best match
    if (topMatches.length > 0) {
      const best = topMatches[0];
      await storeMatch({
        appleId: best.candidateId,
        orangeId: stored.id || "unknown",
        appleToOrangeScore: best.reverseScore,
        orangeToAppleScore: best.forwardScore,
        mutualScore: best.mutualScore,
        explanation: matchNarrative.slice(0, 500),
      });
    }

    const response = {
      fruit: {
        id: stored.id,
        type: "orange",
        attributes: orange.attributes,
        preferences: orange.preferences,
      },
      communication: {
        attributes: attrDescription,
        preferences: prefDescription,
      },
      matches: topMatches.map((m) => {
        const apple = apples.find((a) => a.id === m.candidateId);
        return {
          appleId: m.candidateId,
          forwardScore: m.forwardScore,
          reverseScore: m.reverseScore,
          mutualScore: m.mutualScore,
          appleAttributes: apple?.attributes,
          appleAttributeDescription: apple?.attributeDescription,
          breakdown: m.breakdown.slice(0, 10),
        };
      }),
      narrative: matchNarrative,
      meta: {
        totalApplesSearched: apples.length,
        llmUsed,
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing incoming orange:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process incoming orange",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function generateMatchNarrative(
  apiKey: string,
  attrDesc: string,
  prefDesc: string,
  topMatches: Array<{ candidateId: string; forwardScore: number; reverseScore: number; mutualScore: number }>,
  apples: Array<{ id: string; attributeDescription?: string; preferenceDescription?: string; attributes: Record<string, unknown> }>
): Promise<string> {
  const matchDetails = topMatches
    .map((m, i) => {
      const apple = apples.find((a) => a.id === m.candidateId);
      return `Match #${i + 1} (score: ${(m.mutualScore * 100).toFixed(0)}%):
  Apple ID: ${m.candidateId}
  Apple description: ${apple?.attributeDescription || JSON.stringify(apple?.attributes)}
  Forward compatibility: ${(m.forwardScore * 100).toFixed(0)}% | Reverse: ${(m.reverseScore * 100).toFixed(0)}%`;
    })
    .join("\n\n");

  const prompt = `You are a charming matchmaking host for a fruit dating show called "Perfect Pear".
An orange has just arrived and you need to announce their matches with apples.

THE ORANGE:
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

function generateFallbackNarrative(
  topMatches: Array<{ candidateId: string; forwardScore: number; reverseScore: number; mutualScore: number }>,
  apples: Array<{ id: string; attributes: Record<string, unknown> }>
): string {
  if (topMatches.length === 0) {
    return "No apples found in the system yet. This orange is among the first - check back once some apples join the pool!";
  }

  const best = topMatches[0];
  const scorePercent = (best.mutualScore * 100).toFixed(0);
  const apple = apples.find((a) => a.id === best.candidateId);

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

  if (apple?.attributes) {
    const attrs = apple.attributes as Record<string, unknown>;
    if (attrs.shineFactor) {
      narrative += `The matched apple has a ${attrs.shineFactor} appearance. `;
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
