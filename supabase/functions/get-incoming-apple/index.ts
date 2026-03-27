import "@supabase/functions-js/edge-runtime.d.ts";
import { generateApple, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts";
import type { FruitAttributes, FruitPreferences } from "../_shared/generateFruit.ts";
import { storeFruit, getFruits, storeMatch } from "../_shared/surrealdb.ts";
import { calculateMatches } from "../_shared/matching.ts";
import type { MatchCandidate } from "../_shared/matching.ts";
import { generateNarrative, truncateNarrative } from "../_shared/narrative.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:3000";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
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
      attributes: o.attributes as unknown as FruitAttributes,
      preferences: o.preferences as unknown as FruitPreferences,
    }));

    const matchResults = calculateMatches(
      { attributes: apple.attributes, preferences: apple.preferences },
      candidates
    );
    const topMatches = matchResults.slice(0, 3);

    // Step 5: Generate narrative
    const { narrative: matchNarrative, llmUsed } = await generateNarrative({
      fruitType: "apple",
      attrDescription,
      prefDescription,
      topMatches,
      candidates: oranges,
    });

    // Store the best match
    if (topMatches.length > 0) {
      const best = topMatches[0];
      await storeMatch({
        appleId: stored.id,
        orangeId: best.candidateId,
        appleToOrangeScore: best.forwardScore,
        orangeToAppleScore: best.reverseScore,
        mutualScore: best.mutualScore,
        explanation: truncateNarrative(matchNarrative, 500),
      });
    }

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
