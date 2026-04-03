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
    llmUsed: boolean;
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
 * API calls use Effect for typed error handling with retry and timeout.
 * Uses Effect for typed error handling with automatic retry on failure.
 */
import { fetchJsonWithRetry, FetchError, ApiError, runEffectOr } from "./utils";
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
  return callEdgeFunction<ConversationResponse>("get-incoming-apple");
}

export async function startOrangeConversation(): Promise<ConversationResponse> {
  return callEdgeFunction<ConversationResponse>("get-incoming-orange");
}

export async function fetchStats(): Promise<StatsResponse> {
  return callEdgeFunction<StatsResponse>("get-stats");
}
