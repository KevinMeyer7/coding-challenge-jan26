import { generateApple, generateOrange, communicateAttributes, communicatePreferences } from "./generateFruit.ts";
import type { FruitType, FruitAttributes, FruitPreferences } from "./generateFruit.ts";
import { storeFruit, getFruits, storeMatch } from "./surrealdb.ts";
import { calculateMatches } from "./matching.ts";
import type { MatchCandidate } from "./matching.ts";
import { generateNarrative, truncateNarrative } from "./narrative.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Shared handler for both get-incoming-apple and get-incoming-orange.
 * Only the fruit type differs — all logic is identical.
 */
export function createFruitHandler(type: FruitType) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const fruit = type === "apple" ? generateApple() : generateOrange();
      const attrDescription = communicateAttributes(fruit);
      const prefDescription = communicatePreferences(fruit);

      const stored = await storeFruit({
        type,
        attributes: fruit.attributes as unknown as Record<string, unknown>,
        preferences: fruit.preferences as unknown as Record<string, unknown>,
        attributeDescription: attrDescription,
        preferenceDescription: prefDescription,
      });

      const oppositeType = type === "apple" ? "orange" : "apple";
      const pool = await getFruits(oppositeType);
      const candidates: MatchCandidate[] = pool.map((f) => ({
        id: f.id,
        attributes: f.attributes as unknown as FruitAttributes,
        preferences: f.preferences as unknown as FruitPreferences,
      }));

      const matchResults = calculateMatches(
        { attributes: fruit.attributes, preferences: fruit.preferences },
        candidates
      );
      const topMatches = matchResults.slice(0, 3);

      const { narrative, llmUsed } = await generateNarrative({
        fruitType: type,
        attrDescription,
        prefDescription,
        topMatches,
        candidates: pool,
      });

      if (topMatches.length > 0) {
        const best = topMatches[0];
        const appleId = type === "apple" ? stored.id : best.candidateId;
        const orangeId = type === "orange" ? stored.id : best.candidateId;
        await storeMatch({
          appleId,
          orangeId,
          appleToOrangeScore: type === "apple" ? best.forwardScore : best.reverseScore,
          orangeToAppleScore: type === "orange" ? best.forwardScore : best.reverseScore,
          mutualScore: best.mutualScore,
          explanation: truncateNarrative(narrative, 500),
        });
      }

      const searchKey = type === "apple" ? "totalOrangesSearched" : "totalApplesSearched";
      const matchKey = type === "apple" ? "orangeId" : "appleId";
      const attrKey = type === "apple" ? "orangeAttributes" : "appleAttributes";
      const descKey = type === "apple" ? "orangeAttributeDescription" : "appleAttributeDescription";

      return new Response(
        JSON.stringify({
          fruit: { id: stored.id, type, attributes: fruit.attributes, preferences: fruit.preferences },
          communication: { attributes: attrDescription, preferences: prefDescription },
          matches: topMatches.map((m) => {
            const c = pool.find((f) => f.id === m.candidateId);
            return {
              [matchKey]: m.candidateId,
              forwardScore: m.forwardScore,
              reverseScore: m.reverseScore,
              mutualScore: m.mutualScore,
              [attrKey]: c?.attributes,
              [descKey]: c?.attributeDescription,
              breakdown: m.breakdown.slice(0, 10),
            };
          }),
          narrative,
          meta: { [searchKey]: pool.length, llmUsed, timestamp: new Date().toISOString() },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (error) {
      console.error(`Error processing incoming ${type}:`, error);
      return new Response(
        JSON.stringify({
          error: `Failed to process incoming ${type}`,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
  };
}
