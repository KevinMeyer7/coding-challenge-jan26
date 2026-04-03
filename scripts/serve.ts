#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Standalone development server for edge functions.
 *
 * This serves the edge functions directly via Deno without needing
 * the full Supabase Docker stack. Routes requests to the correct
 * function handler based on the URL path.
 *
 * Usage:
 *   deno run --allow-net --allow-read --allow-env scripts/serve.ts
 *
 * Or with env file:
 *   deno run --allow-net --allow-read --allow-env scripts/serve.ts
 *
 * The server listens on port 54321 (same as Supabase) so the
 * frontend works without any configuration changes.
 */

const PORT = parseInt(Deno.env.get("PORT") || "54321");

// Import the handler logic directly
import { generateApple, generateOrange, communicateAttributes, communicatePreferences } from "../supabase/functions/_shared/generateFruit.ts";
import type { FruitAttributes, FruitPreferences } from "../supabase/functions/_shared/generateFruit.ts";
import { storeFruit, getFruits, storeMatch, getMatches } from "../supabase/functions/_shared/surrealdb.ts";
import { calculateMatches } from "../supabase/functions/_shared/matching.ts";
import type { MatchCandidate } from "../supabase/functions/_shared/matching.ts";
import { generateNarrative, truncateNarrative } from "../supabase/functions/_shared/narrative.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleIncomingFruit(type: "apple" | "orange"): Promise<Response> {
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
  const candidates_raw = await getFruits(oppositeType);
  const candidates: MatchCandidate[] = candidates_raw.map((c) => ({
    id: c.id,
    attributes: c.attributes as unknown as FruitAttributes,
    preferences: c.preferences as unknown as FruitPreferences,
  }));

  const matchResults = calculateMatches(
    { attributes: fruit.attributes, preferences: fruit.preferences },
    candidates
  );
  const topMatches = matchResults.slice(0, 3);

  const { narrative, llmUsed } = await generateNarrative({
    fruitType: type,
    attrDescription: attrDescription,
    prefDescription: prefDescription,
    topMatches,
    candidates: candidates_raw,
  });

  if (topMatches.length > 0) {
    const best = topMatches[0];
    const appleId = type === "apple" ? stored.id : best.candidateId;
    const orangeId = type === "orange" ? stored.id : best.candidateId;
    const a2o = type === "apple" ? best.forwardScore : best.reverseScore;
    const o2a = type === "orange" ? best.forwardScore : best.reverseScore;

    await storeMatch({
      appleId, orangeId,
      appleToOrangeScore: a2o,
      orangeToAppleScore: o2a,
      mutualScore: best.mutualScore,
      explanation: truncateNarrative(narrative, 500),
    });
  }

  const searchKey = type === "apple" ? "totalOrangesSearched" : "totalApplesSearched";

  return jsonResponse({
    fruit: { id: stored.id, type, attributes: fruit.attributes, preferences: fruit.preferences },
    communication: { attributes: attrDescription, preferences: prefDescription },
    matches: topMatches.map((m) => {
      const c = candidates_raw.find((c) => c.id === m.candidateId);
      const key = type === "apple" ? "orangeId" : "appleId";
      const attrKey = type === "apple" ? "orangeAttributes" : "appleAttributes";
      const descKey = type === "apple" ? "orangeAttributeDescription" : "appleAttributeDescription";
      return {
        [key]: m.candidateId,
        forwardScore: m.forwardScore,
        reverseScore: m.reverseScore,
        mutualScore: m.mutualScore,
        [attrKey]: c?.attributes,
        [descKey]: c?.attributeDescription,
        breakdown: m.breakdown.slice(0, 10),
      };
    }),
    narrative,
    meta: { [searchKey]: candidates_raw.length, llmUsed, timestamp: new Date().toISOString() },
  });
}

async function handleStats(): Promise<Response> {
  const [matches, apples, oranges] = await Promise.all([
    getMatches(200),
    getFruits("apple"),
    getFruits("orange"),
  ]);

  const scoreBuckets = [
    { label: "0-20%", min: 0, max: 0.2, count: 0 },
    { label: "20-40%", min: 0.2, max: 0.4, count: 0 },
    { label: "40-60%", min: 0.4, max: 0.6, count: 0 },
    { label: "60-80%", min: 0.6, max: 0.8, count: 0 },
    { label: "80-100%", min: 0.8, max: 1.01, count: 0 },
  ];
  for (const m of matches) {
    for (const b of scoreBuckets) {
      if (m.mutualScore >= b.min && m.mutualScore < b.max) { b.count++; break; }
    }
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const matchedAppleIds = new Set(matches.map((m) => m.appleId));
  const matchedOrangeIds = new Set(matches.map((m) => m.orangeId));

  return jsonResponse({
    metrics: {
      totalApples: apples.length,
      totalOranges: oranges.length,
      totalMatches: matches.length,
      avgMutualScore: Math.round(avg(matches.map((m) => m.mutualScore)) * 100),
      avgForwardScore: Math.round(avg(matches.map((m) => m.appleToOrangeScore)) * 100),
      avgReverseScore: Math.round(avg(matches.map((m) => m.orangeToAppleScore)) * 100),
      unmatchedApples: apples.filter((a) => !matchedAppleIds.has(a.id)).length,
      unmatchedOranges: oranges.filter((o) => !matchedOrangeIds.has(o.id)).length,
      matchRate: Math.min(100, Math.round((matches.length / Math.max(apples.length, oranges.length, 1)) * 100)),
    },
    scoreDistribution: scoreBuckets.map((b) => ({ label: b.label, count: b.count })),
    recentMatches: matches.slice(0, 20).map((m) => {
      const apple = apples.find((a) => a.id === m.appleId);
      const orange = oranges.find((o) => o.id === m.orangeId);
      return { ...m, appleAttributes: apple?.attributes, orangeAttributes: orange?.attributes,
        appleDescription: apple?.attributeDescription, orangeDescription: orange?.attributeDescription };
    }),
    fruitPool: {
      apples: apples.map((a) => ({
        id: a.id, attributes: a.attributes, preferences: a.preferences,
        attributeDescription: a.attributeDescription, matched: matchedAppleIds.has(a.id),
      })),
      oranges: oranges.map((o) => ({
        id: o.id, attributes: o.attributes, preferences: o.preferences,
        attributeDescription: o.attributeDescription, matched: matchedOrangeIds.has(o.id),
      })),
    },
    timestamp: new Date().toISOString(),
  });
}

console.log(`\n🍎 Perfect Pear — Development Server`);
console.log(`   Listening on http://localhost:${PORT}`);
console.log(`   Routes:`);
console.log(`     POST /functions/v1/get-incoming-apple`);
console.log(`     POST /functions/v1/get-incoming-orange`);
console.log(`     POST /functions/v1/get-stats\n`);

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (url.pathname === "/functions/v1/get-incoming-apple") {
      return await handleIncomingFruit("apple");
    }
    if (url.pathname === "/functions/v1/get-incoming-orange") {
      return await handleIncomingFruit("orange");
    }
    if (url.pathname === "/functions/v1/get-stats") {
      return await handleStats();
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  } catch (err) {
    console.error("Request error:", err);
    return jsonResponse({ error: "Internal error", details: err instanceof Error ? err.message : "Unknown" }, 500);
  }
});
