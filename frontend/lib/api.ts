/**
 * API client for communicating with Supabase Edge Functions
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** Build request headers fresh per call (avoids stale singleton issues) */
function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (SUPABASE_ANON_KEY) {
    h["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
    h["apikey"] = SUPABASE_ANON_KEY;
  }
  return h;
}

export interface FruitData {
  id: string;
  type: "apple" | "orange";
  attributes: {
    size: number | null;
    weight: number | null;
    hasStem: boolean | null;
    hasLeaf: boolean | null;
    hasWorm: boolean | null;
    shineFactor: string | null;
    hasChemicals: boolean | null;
  };
  preferences: Record<string, unknown>;
}

export interface MatchData {
  orangeId?: string;
  appleId?: string;
  forwardScore: number;
  reverseScore: number;
  mutualScore: number;
  orangeAttributes?: Record<string, unknown>;
  appleAttributes?: Record<string, unknown>;
  orangeAttributeDescription?: string;
  appleAttributeDescription?: string;
  breakdown: Array<{
    criterion: string;
    direction: string;
    score: number;
    reason: string;
  }>;
}

export interface ConversationResponse {
  fruit: FruitData;
  communication: {
    attributes: string;
    preferences: string;
  };
  matches: MatchData[];
  narrative: string;
  meta: {
    totalOrangesSearched?: number;
    totalApplesSearched?: number;
    llmUsed?: boolean;
    timestamp: string;
  };
}

export interface StatsResponse {
  metrics: {
    totalApples: number;
    totalOranges: number;
    totalMatches: number;
    avgMutualScore: number;
    avgForwardScore: number;
    avgReverseScore: number;
    unmatchedApples: number;
    unmatchedOranges: number;
    matchRate: number;
  };
  scoreDistribution: Array<{ label: string; count: number }>;
  recentMatches: Array<{
    id: string;
    appleId: string;
    orangeId: string;
    appleToOrangeScore: number;
    orangeToAppleScore: number;
    mutualScore: number;
    explanation: string;
    createdAt: string;
    appleAttributes?: Record<string, unknown>;
    orangeAttributes?: Record<string, unknown>;
    appleDescription?: string;
    orangeDescription?: string;
  }>;
  fruitPool: {
    apples: PoolFruit[];
    oranges: PoolFruit[];
  };
  timestamp: string;
}

export interface PoolFruit {
  id: string;
  attributes: Record<string, unknown>;
  preferences: Record<string, unknown>;
  attributeDescription?: string;
  matched: boolean;
}

/**
 * Edge function calls wrapped in Effect for retry + typed error handling.
 */
import { fetchJsonWithRetry, FetchError, ApiError } from "./utils";
import { Effect } from "effect";

async function callEdgeFunction<T>(path: string, body: unknown = {}): Promise<T> {
  // Use Effect pipeline: fetch with retry (3 attempts, exponential backoff)
  const effect = fetchJsonWithRetry<T>(
    `${SUPABASE_URL}/functions/v1/${path}`,
    { method: "POST", headers: getHeaders(), body: JSON.stringify(body) },
    2 // max 2 retries
  );

  // Run the Effect and convert errors to thrown exceptions for Zustand compatibility
  return Effect.runPromise(
    effect.pipe(
      Effect.catchAll((err) =>
        Effect.fail(
          new Error(
            err instanceof FetchError
              ? `Network error: ${err.message}`
              : err instanceof ApiError
              ? `API error ${err.status}: ${err.message}`
              : "Unknown error"
          )
        )
      )
    )
  );
}

export async function startAppleConversation(): Promise<ConversationResponse> {
  const result = await callEdgeFunction<ConversationResponse>("get-incoming-apple");
  return enhanceNarrativeWithAISdk(result);
}

export async function startOrangeConversation(): Promise<ConversationResponse> {
  const result = await callEdgeFunction<ConversationResponse>("get-incoming-orange");
  return enhanceNarrativeWithAISdk(result);
}

export async function fetchStats(): Promise<StatsResponse> {
  return callEdgeFunction<StatsResponse>("get-stats");
}

/**
 * Calls the AI SDK route (/api/chat) to generate an enhanced narrative.
 * Falls back to the edge function's narrative if the AI SDK route fails.
 */
async function enhanceNarrativeWithAISdk(
  result: ConversationResponse
): Promise<ConversationResponse> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fruitType: result.fruit.type,
        attrDescription: result.communication.attributes,
        prefDescription: result.communication.preferences,
        topMatches: result.matches,
        candidates: result.matches.map((m) => ({
          id: m.orangeId || m.appleId,
          attributes: m.orangeAttributes || m.appleAttributes,
          attributeDescription: m.orangeAttributeDescription || m.appleAttributeDescription,
        })),
      }),
    });
    if (res.ok) {
      const { narrative } = await res.json();
      if (narrative) return { ...result, narrative };
    }
  } catch {
    // AI SDK enhancement failed — use the edge function's narrative
  }
  return result;
}
