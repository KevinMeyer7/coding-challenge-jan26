import "@supabase/functions-js/edge-runtime.d.ts";
import { generateOrange, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts";
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
      attributes: a.attributes as unknown as FruitAttributes,
      preferences: a.preferences as unknown as FruitPreferences,
    }));

    const matchResults = calculateMatches(
      { attributes: orange.attributes, preferences: orange.preferences },
      candidates
    );
    const topMatches = matchResults.slice(0, 3);

    // Step 5: Generate narrative
    const { narrative: matchNarrative, llmUsed } = await generateNarrative({
      fruitType: "orange",
      attrDescription,
      prefDescription,
      topMatches,
      candidates: apples,
    });

    // Store the best match (note: apple is the candidate here, orange is incoming)
    if (topMatches.length > 0) {
      const best = topMatches[0];
      await storeMatch({
        appleId: best.candidateId,
        orangeId: stored.id,
        appleToOrangeScore: best.reverseScore,
        orangeToAppleScore: best.forwardScore,
        mutualScore: best.mutualScore,
        explanation: truncateNarrative(matchNarrative, 500),
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
