"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useMatchmakingStore } from "@/lib/store";
import { FruitProfileCard } from "./FruitProfileCard";

export function FruitPoolExplorer() {
  const [open, setOpen] = useState(false);
  const stats = useMatchmakingStore((s) => s.stats);
  const pool = stats?.fruitPool;

  const apples = pool?.apples ?? [];
  const oranges = pool?.oranges ?? [];

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary text-sm">
        Explore Pool ({apples.length + oranges.length})
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-[var(--color-background)] border-l border-[var(--color-border)] shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 z-10 bg-[var(--color-background)]/90 backdrop-blur-sm border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Fruit Pool</h2>
                  <p className="text-xs text-[var(--color-muted)]">
                    {apples.length} apples, {oranges.length} oranges in the
                    database
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 hover:bg-[var(--color-card-hover)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Apples column */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span>🍎</span> Apples ({apples.length})
                    </h3>
                    <div className="space-y-3">
                      {apples.map((fruit) => (
                        <div key={fruit.id} className="relative">
                          <FruitProfileCard
                            type="apple"
                            attributes={fruit.attributes}
                          />
                          <MatchBadge matched={fruit.matched} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Oranges column */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span>🍊</span> Oranges ({oranges.length})
                    </h3>
                    <div className="space-y-3">
                      {oranges.map((fruit) => (
                        <div key={fruit.id} className="relative">
                          <FruitProfileCard
                            type="orange"
                            attributes={fruit.attributes}
                          />
                          <MatchBadge matched={fruit.matched} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MatchBadge({ matched }: { matched: boolean }) {
  return (
    <span
      className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        matched
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {matched ? "Matched" : "Waiting"}
    </span>
  );
}
