"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ConversationResponse, StatsResponse } from "./api";
import {
  startAppleConversation,
  startOrangeConversation,
  fetchStats,
} from "./api";

/**
 * A single conversation represents one "fruit arrival" -
 * the full lifecycle of generating a fruit, finding matches, and getting a narrative.
 */
export interface ConversationEntry {
  id: string;
  type: "apple" | "orange";
  response: ConversationResponse | null;
  timestamp: string;
  status: "loading" | "complete" | "error";
  error?: string;
}

/**
 * Chat message for the visualization
 */
export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "system" | "fruit" | "matchmaker";
  content: string;
  timestamp: string;
  fruitType?: "apple" | "orange";
}

interface MatchmakingState {
  conversations: ConversationEntry[];
  activeConversationId: string | null;
  stats: StatsResponse | null;
  statsLoading: boolean;
  isLoading: boolean;
  error: string | null;

  startConversation: (type: "apple" | "orange") => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  refreshStats: () => Promise<void>;
  clearError: () => void;
}

let conversationCounter = 0;

export const useMatchmakingStore = create<MatchmakingState>()(
  devtools(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      stats: null,
      statsLoading: false,
      isLoading: false,
      error: null,

      startConversation: async (type) => {
        const id = `conv-${Date.now()}-${++conversationCounter}`;
        const placeholder: ConversationEntry = {
          id,
          type,
          response: null,
          timestamp: new Date().toISOString(),
          status: "loading",
        };

        set((state) => ({
          conversations: [placeholder, ...state.conversations],
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

          // Refresh stats in background (fire-and-forget is intentional here)
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
        if (get().statsLoading) return; // Debounce concurrent calls
        set({ statsLoading: true });
        try {
          const stats = await fetchStats();
          set({ stats, statsLoading: false });
        } catch (err) {
          console.error("Failed to refresh stats:", err);
          set({ statsLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: "MatchmakingStore" }
  )
);

/**
 * Convert a completed conversation into a sequence of chat messages for visualization.
 */
export function conversationToChatMessages(
  entry: ConversationEntry
): ChatMessage[] {
  if (!entry.response || entry.status !== "complete") return [];

  const messages: ChatMessage[] = [];
  const { response } = entry;

  // System introduction
  messages.push({
    id: `${entry.id}-sys-1`,
    conversationId: entry.id,
    role: "system",
    content: `A new ${response.fruit.type} has arrived at the matchmaking booth!`,
    timestamp: entry.timestamp,
  });

  // Fruit introduces itself
  messages.push({
    id: `${entry.id}-fruit-attrs`,
    conversationId: entry.id,
    role: "fruit",
    content: response.communication.attributes,
    timestamp: entry.timestamp,
    fruitType: response.fruit.type,
  });

  // Fruit shares preferences
  messages.push({
    id: `${entry.id}-fruit-prefs`,
    conversationId: entry.id,
    role: "fruit",
    content: response.communication.preferences,
    timestamp: entry.timestamp,
    fruitType: response.fruit.type,
  });

  // System searching
  const searchCount =
    response.meta.totalOrangesSearched ?? response.meta.totalApplesSearched ?? 0;
  const targetType = response.fruit.type === "apple" ? "oranges" : "apples";
  messages.push({
    id: `${entry.id}-sys-search`,
    conversationId: entry.id,
    role: "system",
    content: `Searching through ${searchCount} ${targetType} in the database...`,
    timestamp: entry.timestamp,
  });

  // Matchmaker announces results
  if (response.matches.length > 0) {
    const best = response.matches[0];
    const scorePercent = (best.mutualScore * 100).toFixed(0);
    messages.push({
      id: `${entry.id}-match-score`,
      conversationId: entry.id,
      role: "matchmaker",
      content: `Found ${response.matches.length} potential match${response.matches.length > 1 ? "es" : ""}! Top match: **${scorePercent}% compatibility** (forward: ${(best.forwardScore * 100).toFixed(0)}%, reverse: ${(best.reverseScore * 100).toFixed(0)}%)`,
      timestamp: entry.timestamp,
    });
  }

  // Narrative
  messages.push({
    id: `${entry.id}-narrative`,
    conversationId: entry.id,
    role: "matchmaker",
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
