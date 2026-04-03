"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useMatchmakingStore,
  selectActiveConversation,
  conversationToChatMessages,
} from "@/lib/store";
import type { ChatMessage } from "@/lib/store";
import { FruitProfileCard } from "./FruitProfileCard";

export function ChatVisualization() {
  const activeConversation = useMatchmakingStore(selectActiveConversation);
  const conversations = useMatchmakingStore((s) => s.conversations);
  const isLoading = useMatchmakingStore((s) => s.isLoading);
  const startConversation = useMatchmakingStore((s) => s.startConversation);
  const setActive = useMatchmakingStore((s) => s.setActiveConversation);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const animatedRef = useRef<Set<string>>(new Set());

  const allMessages = useMemo(
    () =>
      activeConversation
        ? conversationToChatMessages(activeConversation)
        : [],
    [activeConversation?.id, activeConversation?.status, activeConversation?.response]
  );

  useEffect(() => {
    if (allMessages.length === 0) {
      setVisibleCount(0);
      return;
    }
    const convId = activeConversation?.id;
    if (!convId) return;

    if (animatedRef.current.has(convId)) {
      setVisibleCount(allMessages.length);
      return;
    }

    setVisibleCount(0);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= allMessages.length) {
        clearInterval(timer);
        animatedRef.current.add(convId);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [activeConversation?.id, activeConversation?.status, allMessages.length]);

  const visibleMessages = allMessages.slice(0, visibleCount);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount]);

  return (
    <div className="flex h-[650px] flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Conversation sidebar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2 overflow-x-auto">
        {conversations.slice(0, 12).map((conv, idx) => {
          const score =
            conv.response?.matches?.[0]?.mutualScore;
          return (
            <button
              key={conv.id}
              onClick={() => setActive(conv.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                conv.id === activeConversation?.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-card-hover)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <span>{conv.type === "apple" ? "🍎" : "🍊"}</span>
              {conv.status === "loading" ? (
                <span>...</span>
              ) : conv.status === "error" ? (
                <span>err</span>
              ) : (
                <span>
                  #{idx + 1}
                  {score !== undefined && (
                    <span className="ml-1 opacity-75">
                      {Math.round(score * 100)}%
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {!activeConversation && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md">
              <p className="text-5xl mb-4">🍎 ❤️ 🍊</p>
              <p className="text-lg font-bold">Ready to Match</p>
              <p className="text-sm text-[var(--color-muted)] mt-2">
                Click <strong>&quot;New Apple&quot;</strong> or <strong>&quot;New Orange&quot;</strong> below to generate a fruit with random attributes and preferences. The system will search the pool, score every candidate, and find the best match.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-[10px] text-[var(--color-muted)]">
                <div className="rounded-lg bg-[var(--color-card-hover)] p-2">
                  <p className="font-bold text-xs mb-0.5">Step 1</p>
                  <p>Fruit introduces itself with its attributes</p>
                </div>
                <div className="rounded-lg bg-[var(--color-card-hover)] p-2">
                  <p className="font-bold text-xs mb-0.5">Step 2</p>
                  <p>System searches pool and scores candidates</p>
                </div>
                <div className="rounded-lg bg-[var(--color-card-hover)] p-2">
                  <p className="font-bold text-xs mb-0.5">Step 3</p>
                  <p>Best match revealed with compatibility details</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeConversation?.status === "loading" && (
          <div className="flex items-center gap-2 text-[var(--color-muted)]">
            <div className="flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
            </div>
            <span className="text-sm">
              A new {activeConversation.type} is arriving...
            </span>
          </div>
        )}

        {activeConversation?.status === "error" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            <p className="font-medium">Connection Error</p>
            <p className="mt-1">{activeConversation.error}</p>
            <p className="mt-2 text-xs">
              Make sure SurrealDB and the backend server are running.
            </p>
          </div>
        )}

        <AnimatePresence>
          {visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <RichMessageBubble message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Action Bar */}
      <div className="border-t border-[var(--color-border)] p-3 flex gap-2">
        <button
          onClick={() => startConversation("apple")}
          disabled={isLoading}
          className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
        >
          🍎 New Apple
        </button>
        <button
          onClick={() => startConversation("orange")}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: "var(--color-orange)" }}
        >
          🍊 New Orange
        </button>
      </div>
    </div>
  );
}

function RichMessageBubble({ message }: { message: ChatMessage }) {
  // System messages: centered pill
  if (message.type === "system") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-[var(--color-card-hover)] px-4 py-1.5 text-xs text-[var(--color-muted)]">
          {message.content}
        </span>
      </div>
    );
  }

  // Fruit profile card: inline visual card
  if (message.type === "fruit-card" && message.data?.fruitAttributes) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <FruitProfileCard
            type={message.fruitType || "apple"}
            attributes={message.data.fruitAttributes}
          />
        </div>
      </div>
    );
  }

  // Match candidates: horizontal row of compact cards
  if (message.type === "match-candidates" && message.data?.matches) {
    const matches = message.data.matches;
    const otherType = message.fruitType === "apple" ? "orange" : "apple";
    return (
      <div className="space-y-2">
        <div className="flex justify-center">
          <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-4 py-1.5 text-xs font-medium text-green-700 dark:text-green-400">
            {message.content}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {matches.map((m, i) => {
            const attrs =
              (m.orangeAttributes || m.appleAttributes) as Record<string, unknown> | undefined;
            return (
              <div key={i} className="shrink-0">
                <FruitProfileCard
                  type={otherType === "apple" ? "apple" : "orange"}
                  attributes={attrs || {}}
                  compact
                  score={m.mutualScore}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Match result: visual comparison
  if (message.type === "match-result" && message.data?.bestMatch) {
    const best = message.data.bestMatch;
    const score = message.data.mutualScore ?? best.mutualScore;
    const scorePercent = Math.round(score * 100);
    const matchAttrs =
      (best.orangeAttributes || best.appleAttributes) as Record<string, unknown> | undefined;

    const qualityLabel =
      scorePercent >= 90
        ? "Excellent match — nearly perfect alignment on both sides"
        : scorePercent >= 75
        ? "Strong match — good compatibility with minor gaps"
        : scorePercent >= 60
        ? "Decent match — some preferences met, room for improvement"
        : scorePercent >= 40
        ? "Weak match — significant preference mismatches"
        : "Poor match — most preferences not satisfied";

    return (
      <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-100 dark:bg-green-950/20 p-4">
        <div className="text-center mb-2">
          <span className="text-3xl font-bold text-green-600 dark:text-green-400 tabular-nums">
            {scorePercent}%
          </span>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Mutual Compatibility
          </p>
          <p className="text-[10px] text-[var(--color-muted)] mt-0.5 italic">
            {qualityLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] mb-2">
          <div className="flex-1 text-center">
            <div className="font-medium">
              {Math.round(best.forwardScore * 100)}%
            </div>
            <div>Match fits our preferences</div>
          </div>
          <div className="text-lg">⇄</div>
          <div className="flex-1 text-center">
            <div className="font-medium">
              {Math.round(best.reverseScore * 100)}%
            </div>
            <div>We fit match&apos;s preferences</div>
          </div>
        </div>
        <p className="text-[10px] text-center text-[var(--color-muted)] opacity-60 mb-2">
          Mutual = √(Forward × Reverse) — geometric mean ensures both sides must be happy
        </p>
        {matchAttrs && Object.keys(matchAttrs).length > 0 && (
          <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-900">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-2">
              Best Match Profile
            </p>
            <FruitProfileCard
              type={best.orangeAttributes ? "orange" : "apple"}
              attributes={matchAttrs}
              compact
            />
          </div>
        )}
      </div>
    );
  }

  // Narrative: special matchmaker styling
  if (message.type === "narrative") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-xl border border-green-200 dark:border-green-900 bg-green-100 dark:bg-green-950/30 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">🍐</span>
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">
              Perfect Pear Matchmaker
            </span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Default text bubbles (fruit-text)
  const isFruit = message.role === "fruit";
  const isApple = message.fruitType === "apple";
  const align = isFruit ? "justify-end" : "justify-start";
  const bgColor = isFruit
    ? isApple
      ? "bg-red-100 dark:bg-red-950/40 border-red-200 dark:border-red-900"
      : "bg-orange-100 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900"
    : "bg-green-100 dark:bg-green-950/30 border-green-200 dark:border-green-900";
  const emoji = isFruit ? (isApple ? "🍎" : "🍊") : "🍐";
  const label = isFruit ? (isApple ? "Apple" : "Orange") : "Matchmaker";

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[80%] rounded-xl border px-4 py-3 ${bgColor}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm">{emoji}</span>
          <span className="text-xs font-semibold text-[var(--color-muted)]">
            {label}
          </span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}
