"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMatchmakingStore } from "@/lib/store";

const BOOTSTRAP_SEQUENCE: Array<"apple" | "orange"> = [
  "apple",
  "orange",
  "apple",
  "orange",
  "apple",
];

/**
 * On first load, if no matches exist, auto-runs a sequence of matchmaking
 * conversations so the dashboard starts populated with real data.
 */
export function BootstrapOverlay() {
  const bootstrapState = useMatchmakingStore((s) => s.bootstrapState);
  const bootstrapProgress = useMatchmakingStore((s) => s.bootstrapProgress);
  const runBootstrap = useMatchmakingStore((s) => s.runBootstrap);
  const stats = useMatchmakingStore((s) => s.stats);
  const refreshStats = useMatchmakingStore((s) => s.refreshStats);

  useEffect(() => {
    // On mount, fetch stats first to check if bootstrap is needed
    refreshStats().then(() => {
      const currentStats = useMatchmakingStore.getState().stats;
      if (
        currentStats &&
        currentStats.metrics.totalMatches === 0 &&
        useMatchmakingStore.getState().bootstrapState === "idle"
      ) {
        runBootstrap();
      }
    });
  }, []);

  if (bootstrapState !== "running") return null;

  const currentStep = bootstrapProgress;
  const total = BOOTSTRAP_SEQUENCE.length;
  const currentType = BOOTSTRAP_SEQUENCE[Math.min(currentStep, total - 1)];
  const emoji = currentType === "apple" ? "🍎" : "🍊";
  const pct = total > 0 ? Math.round((currentStep / total) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-background)]/90 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-6xl mb-6"
          >
            {emoji}
          </motion.div>
          <h2 className="text-xl font-bold mb-2">Initializing Matchmaking</h2>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            Running {total} conversations to warm up the system...
          </p>

          {/* Progress bar */}
          <div className="w-64 mx-auto">
            <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--color-primary)]"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-2 tabular-nums">
              Matching {currentType} {currentStep + 1} of {total}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
