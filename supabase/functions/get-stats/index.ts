import "@supabase/functions-js/edge-runtime.d.ts";
import { getStats, getMatches, getFruits } from "../_shared/surrealdb.ts";

/**
 * Stats & Dashboard Data Edge Function
 *
 * Returns aggregated metrics, recent matches, and analytics data
 * for the frontend dashboard.
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
    const [stats, matches, apples, oranges] = await Promise.all([
      getStats(),
      getMatches(),
      getFruits("apple"),
      getFruits("orange"),
    ]);

    // Calculate score distribution buckets
    const scoreBuckets = [
      { label: "0-20%", min: 0, max: 0.2, count: 0 },
      { label: "20-40%", min: 0.2, max: 0.4, count: 0 },
      { label: "40-60%", min: 0.4, max: 0.6, count: 0 },
      { label: "60-80%", min: 0.6, max: 0.8, count: 0 },
      { label: "80-100%", min: 0.8, max: 1.01, count: 0 },
    ];

    for (const match of matches) {
      for (const bucket of scoreBuckets) {
        if (match.mutualScore >= bucket.min && match.mutualScore < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    // Calculate average scores
    const avgMutual =
      matches.length > 0
        ? matches.reduce((s, m) => s + m.mutualScore, 0) / matches.length
        : 0;
    const avgForward =
      matches.length > 0
        ? matches.reduce((s, m) => s + m.appleToOrangeScore, 0) / matches.length
        : 0;
    const avgReverse =
      matches.length > 0
        ? matches.reduce((s, m) => s + m.orangeToAppleScore, 0) / matches.length
        : 0;

    // Unmatched counts (fruits without any match)
    const matchedAppleIds = new Set(matches.map((m) => m.appleId));
    const matchedOrangeIds = new Set(matches.map((m) => m.orangeId));
    const unmatchedApples = apples.filter((a) => !matchedAppleIds.has(a.id)).length;
    const unmatchedOranges = oranges.filter((o) => !matchedOrangeIds.has(o.id)).length;

    // Recent matches with fruit details
    const recentMatches = matches.slice(0, 20).map((m) => {
      const apple = apples.find((a) => a.id === m.appleId);
      const orange = oranges.find((o) => o.id === m.orangeId);
      return {
        ...m,
        appleAttributes: apple?.attributes,
        orangeAttributes: orange?.attributes,
        appleDescription: apple?.attributeDescription,
        orangeDescription: orange?.attributeDescription,
      };
    });

    const response = {
      metrics: {
        totalApples: stats.totalApples,
        totalOranges: stats.totalOranges,
        totalMatches: stats.totalMatches,
        avgMutualScore: Math.round(avgMutual * 100),
        avgForwardScore: Math.round(avgForward * 100),
        avgReverseScore: Math.round(avgReverse * 100),
        unmatchedApples,
        unmatchedOranges,
        matchRate:
          stats.totalApples + stats.totalOranges > 0
            ? Math.round(
                (stats.totalMatches /
                  Math.min(stats.totalApples, stats.totalOranges || 1)) *
                  100
              )
            : 0,
      },
      scoreDistribution: scoreBuckets.map((b) => ({
        label: b.label,
        count: b.count,
      })),
      recentMatches,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch stats",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
