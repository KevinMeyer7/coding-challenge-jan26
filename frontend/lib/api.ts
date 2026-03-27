/**
 * API client for communicating with Supabase Edge Functions
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

// Only add auth header if we have a key
if (SUPABASE_ANON_KEY) {
  headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
  headers["apikey"] = SUPABASE_ANON_KEY;
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

export async function startAppleConversation(): Promise<ConversationResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-incoming-apple`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to start apple conversation: ${err}`);
  }
  return res.json();
}

export async function startOrangeConversation(): Promise<ConversationResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-incoming-orange`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to start orange conversation: ${err}`);
  }
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-stats`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch stats: ${err}`);
  }
  return res.json();
}
