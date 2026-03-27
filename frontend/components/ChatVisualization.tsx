"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useMatchmakingStore,
  selectActiveConversation,
  conversationToChatMessages,
} from "@/lib/store";
import type { ChatMessage } from "@/lib/store";

/**
 * Chat-style visualization of the matchmaking conversation.
 * Messages appear sequentially with typing animation to simulate
 * the flow: fruit arrives -> introduces itself -> shares preferences -> match found.
 */
export function ChatVisualization() {
  const activeConversation = useMatchmakingStore(selectActiveConversation);
  const conversations = useMatchmakingStore((s) => s.conversations);
  const isLoading = useMatchmakingStore((s) => s.isLoading);
  const startConversation = useMatchmakingStore((s) => s.startConversation);
  const setActive = useMatchmakingStore((s) => s.setActiveConversation);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  // Track which conversations have already been animated
  const animatedRef = useRef<Set<string>>(new Set());

  const allMessages = useMemo(
    () => (activeConversation ? conversationToChatMessages(activeConversation) : []),
    [activeConversation?.id, activeConversation?.status, activeConversation?.response]
  );

  // Animate messages appearing one by one, but only once per conversation
  useEffect(() => {
    if (allMessages.length === 0) {
      setVisibleCount(0);
      return;
    }

    const convId = activeConversation?.id;
    if (!convId) return;

    // If we've already animated this conversation, show all messages immediately
    if (animatedRef.current.has(convId)) {
      setVisibleCount(allMessages.length);
      return;
    }

    // Animate sequentially
    setVisibleCount(0);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= allMessages.length) {
        clearInterval(timer);
        animatedRef.current.add(convId);
      }
    }, 600);

    return () => clearInterval(timer);
  }, [activeConversation?.id, activeConversation?.status, allMessages.length]);

  const visibleMessages = allMessages.slice(0, visibleCount);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount]);

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Conversation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2 overflow-x-auto">
        {conversations.slice(0, 10).map((conv, idx) => (
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
            <span>
              {conv.status === "loading"
                ? "Loading..."
                : conv.status === "error"
                ? "Error"
                : `#${idx + 1}`}
            </span>
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {!activeConversation && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-5xl mb-4">🍎 ❤️ 🍊</p>
              <p className="text-lg font-medium">Perfect Pear Matchmaking</p>
              <p className="text-sm text-[var(--color-muted)] mt-2 max-w-sm">
                Start a new conversation to watch a fruit arrive, introduce
                itself, and get matched with its perfect pear.
              </p>
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
              Make sure SurrealDB and Supabase edge functions are running.
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
              <MessageBubble message={msg} />
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isSystem = message.role === "system";
  const isFruit = message.role === "fruit";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-[var(--color-card-hover)] px-4 py-1.5 text-xs text-[var(--color-muted)]">
          {message.content}
        </span>
      </div>
    );
  }

  const isApple = message.fruitType === "apple";
  const align = isFruit ? "justify-end" : "justify-start";
  const bgColor = isFruit
    ? isApple
      ? "bg-red-100 dark:bg-red-950/40 border-red-200 dark:border-red-900"
      : "bg-orange-100 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900"
    : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900";

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
