"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ConversationResponse, StatsResponse, MatchData } from "./api";
import {
  startAppleConversation,
  startOrangeConversation,
  fetchStats,
} from "./api";

export interface ConversationEntry {
  id: string;
  type: "apple" | "orange";
  response: ConversationResponse | null;
  timestamp: string;
  status: "loading" | "complete" | "error";
  error?: string;
}

export type ChatMessageType =
  | "system"
  | "fruit-text"
  | "fruit-card"
  | "match-candidates"
  | "match-result"
  | "narrative";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "system" | "fruit" | "matchmaker";
  type: ChatMessageType;
  content: string;
  timestamp: string;
  fruitType?: "apple" | "orange";
  /** Structured data for rich message types */
  data?: {
    fruitAttributes?: Record<string, unknown>;
    fruitPreferences?: Record<string, unknown>;
    matches?: MatchData[];
    bestMatch?: MatchData;
    mutualScore?: number;
  };
}

interface MatchmakingState {
  conversations: ConversationEntry[];
  activeConversationId: string | null;
  stats: StatsResponse | null;
  statsLoading: boolean;
  isLoading: boolean;
  error: string | null;
  bootstrapState: "idle" | "running" | "done";
  bootstrapProgress: number;

  startConversation: (type: "apple" | "orange") => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  refreshStats: () => Promise<void>;
  runBootstrap: () => Promise<void>;
  clearError: () => void;
}

let conversationCounter = 0;

const BOOTSTRAP_SEQUENCE: Array<"apple" | "orange"> = [
  "apple",
  "orange",
  "apple",
  "orange",
  "apple",
];

export const useMatchmakingStore = create<MatchmakingState>()(
  devtools(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      stats: null,
      statsLoading: false,
      isLoading: false,
      error: null,
      bootstrapState: "idle",
      bootstrapProgress: 0,

      startConversation: async (type) => {
        const id = `conv-${Date.now()}-${++conversationCounter}`;
        const entry: ConversationEntry = {
          id,
          type,
          response: null,
          timestamp: new Date().toISOString(),
          status: "loading",
        };

        set((state) => ({
          conversations: [entry, ...state.conversations],
          activeConversationId: id,
          isLoading: true,
          error: null,
        }));

        try {
          const response =
            type === "apple"
              ? await startAppleConversation()
              : await startOrangeConversation();

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, response, status: "complete" as const } : c
            ),
            isLoading: false,
          }));

          get().refreshStats();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown error";
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id
                ? { ...c, status: "error" as const, error: message }
                : c
            ),
            isLoading: false,
            error: message,
          }));
        }
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      refreshStats: async () => {
        if (get().statsLoading) return;
        set({ statsLoading: true });
        try {
          const stats = await fetchStats();
          set({ stats, statsLoading: false });
        } catch (err) {
          console.error("Failed to refresh stats:", err);
          set({ statsLoading: false });
        }
      },

      runBootstrap: async () => {
        set({ bootstrapState: "running", bootstrapProgress: 0 });
        for (let i = 0; i < BOOTSTRAP_SEQUENCE.length; i++) {
          set({ bootstrapProgress: i });
          try {
            await get().startConversation(BOOTSTRAP_SEQUENCE[i]);
            // Small delay between conversations for visual effect
            await new Promise((r) => setTimeout(r, 300));
          } catch {
            // Continue even if one fails
          }
        }
        set({ bootstrapState: "done", bootstrapProgress: BOOTSTRAP_SEQUENCE.length });
        get().refreshStats();
      },

      clearError: () => set({ error: null }),
    }),
    { name: "MatchmakingStore" }
  )
);

/**
 * Convert a completed conversation into a sequence of rich chat messages.
 */
export function conversationToChatMessages(
  entry: ConversationEntry
): ChatMessage[] {
  if (!entry.response || entry.status !== "complete") return [];

  const messages: ChatMessage[] = [];
  const { response } = entry;
  const otherType = response.fruit.type === "apple" ? "oranges" : "apples";

  // System: arrival
  messages.push({
    id: `${entry.id}-sys-1`,
    conversationId: entry.id,
    role: "system",
    type: "system",
    content: `A new ${response.fruit.type} has arrived at the matchmaking booth!`,
    timestamp: entry.timestamp,
  });

  // Fruit: introduces itself (text)
  messages.push({
    id: `${entry.id}-fruit-attrs`,
    conversationId: entry.id,
    role: "fruit",
    type: "fruit-text",
    content: response.communication.attributes,
    timestamp: entry.timestamp,
    fruitType: response.fruit.type,
  });

  // Fruit: profile card (structured data)
  messages.push({
    id: `${entry.id}-fruit-card`,
    conversationId: entry.id,
    role: "fruit",
    type: "fruit-card",
    content: "",
    timestamp: entry.timestamp,
    fruitType: response.fruit.type,
    data: {
      fruitAttributes: response.fruit.attributes as unknown as Record<string, unknown>,
      fruitPreferences: response.fruit.preferences,
    },
  });

  // Fruit: preferences (text)
  messages.push({
    id: `${entry.id}-fruit-prefs`,
    conversationId: entry.id,
    role: "fruit",
    type: "fruit-text",
    content: response.communication.preferences,
    timestamp: entry.timestamp,
    fruitType: response.fruit.type,
  });

  // System: searching
  const searchCount =
    response.meta.totalOrangesSearched ?? response.meta.totalApplesSearched ?? 0;
  messages.push({
    id: `${entry.id}-sys-search`,
    conversationId: entry.id,
    role: "system",
    type: "system",
    content: `Searching through ${searchCount} ${otherType} for compatible matches...`,
    timestamp: entry.timestamp,
  });

  // Matchmaker: top candidates
  if (response.matches.length > 0) {
    messages.push({
      id: `${entry.id}-candidates`,
      conversationId: entry.id,
      role: "matchmaker",
      type: "match-candidates",
      content: `Found ${response.matches.length} potential match${response.matches.length > 1 ? "es" : ""}!`,
      timestamp: entry.timestamp,
      data: { matches: response.matches },
    });

    // Matchmaker: best match result
    const best = response.matches[0];
    messages.push({
      id: `${entry.id}-result`,
      conversationId: entry.id,
      role: "matchmaker",
      type: "match-result",
      content: "",
      timestamp: entry.timestamp,
      data: {
        bestMatch: best,
        fruitAttributes: response.fruit.attributes as unknown as Record<string, unknown>,
        mutualScore: best.mutualScore,
      },
    });
  }

  // Matchmaker: narrative
  messages.push({
    id: `${entry.id}-narrative`,
    conversationId: entry.id,
    role: "matchmaker",
    type: "narrative",
    content: response.narrative,
    timestamp: entry.timestamp,
  });

  return messages;
}

// Selectors
export const selectActiveConversation = (state: MatchmakingState) =>
  state.conversations.find((c) => c.id === state.activeConversationId);

export const selectCompletedConversations = (state: MatchmakingState) =>
  state.conversations.filter((c) => c.status === "complete");
