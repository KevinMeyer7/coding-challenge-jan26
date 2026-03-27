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
  timestamp: string;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function startAppleConversation(): Promise<ConversationResponse> {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/functions/v1/get-incoming-apple`,
    { method: "POST", headers: getHeaders(), body: JSON.stringify({}) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to start apple conversation: ${err}`);
  }
  return res.json();
}

export async function startOrangeConversation(): Promise<ConversationResponse> {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/functions/v1/get-incoming-orange`,
    { method: "POST", headers: getHeaders(), body: JSON.stringify({}) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to start orange conversation: ${err}`);
  }
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/functions/v1/get-stats`,
    { method: "POST", headers: getHeaders(), body: JSON.stringify({}) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch stats: ${err}`);
  }
  return res.json();
}
