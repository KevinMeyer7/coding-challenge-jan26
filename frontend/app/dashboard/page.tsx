"use client";

import { ChatVisualization } from "@/components/ChatVisualization";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ScoreDistribution } from "@/components/ScoreDistribution";
import { RecentMatches } from "@/components/RecentMatches";
import { CompatibilityBreakdown } from "@/components/CompatibilityBreakdown";
import { ForwardReverseScatter } from "@/components/ForwardReverseScatter";
import { FruitPoolExplorer } from "@/components/FruitPoolExplorer";
import { BootstrapOverlay } from "@/components/BootstrapOverlay";
import { useMatchmakingStore } from "@/lib/store";
import { RefreshCw, Info, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

export default function DashboardPage() {
  const refreshStats = useMatchmakingStore((s) => s.refreshStats);
  const statsLoading = useMatchmakingStore((s) => s.statsLoading);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark") || "system";
    }
    return "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    } else {
      root.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <BootstrapOverlay />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                🍎 Perfect Pear 🍊
              </h1>
              <p className="text-xs text-[var(--color-muted)] sm:text-sm">
                Fruit matchmaking — connecting apples to oranges based on
                compatibility
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHowItWorks((v) => !v)}
                className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 font-medium transition-colors ${
                  showHowItWorks
                    ? "bg-blue-500 text-white"
                    : "btn-secondary"
                }`}
              >
                <Info className="h-4 w-4" />
                How It Works
              </button>
              <FruitPoolExplorer />
              <button
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="btn-secondary flex items-center gap-2"
                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              <button
                onClick={() => refreshStats()}
                disabled={statsLoading}
                className="btn-secondary flex items-center gap-2"
                title="Refresh stats from database"
              >
                <RefreshCw
                  className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* How It Works explainer */}
        {showHowItWorks && <HowItWorks onClose={() => setShowHowItWorks(false)} />}

        {/* Metrics */}
        <section>
          <MetricsPanel />
        </section>

        {/* Chat + Breakdown */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionHeader
              title="Matchmaking Conversation"
              description="Click 'New Apple' or 'New Orange' to generate a fruit with random attributes. The system finds its best match from the opposite pool and explains why."
            />
            <ChatVisualization />
          </div>
          <div className="space-y-6">
            <div>
              <SectionHeader
                title="Match Analysis"
                description="Why did the match score what it did? Each criterion shows what the fruit wanted vs. what the match actually has."
              />
              <CompatibilityBreakdown />
            </div>
            <RecentMatches />
          </div>
        </section>

        {/* Analytics */}
        <section>
          <SectionHeader
            title="Analytics"
            description="How well is the matchmaking system performing across all matches? These charts show quality distribution and bidirectional balance."
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ScoreDistribution />
            <ForwardReverseScatter />
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wide">
        {title}
      </h2>
      <p className="text-xs text-[var(--color-muted)] mt-0.5 opacity-70">
        {description}
      </p>
    </div>
  );
}

function HowItWorks({ onClose }: { onClose: () => void }) {
  return (
    <div className="card border-blue-200 dark:border-blue-900 bg-blue-100/50 dark:bg-blue-950/20 space-y-5">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-bold">How the Matchmaking System Works</h3>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)] px-2 py-1 rounded"
        >
          Close
        </button>
      </div>

      {/* Flow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="rounded-lg bg-white/60 dark:bg-zinc-900/40 p-3">
          <div className="text-xl mb-1">1. 🍎 Fruit Arrives</div>
          <p className="text-[var(--color-muted)]">
            A new fruit is generated with random attributes and preferences
            using a Box-Muller normal distribution. Each fruit is unique.
          </p>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-zinc-900/40 p-3">
          <div className="text-xl mb-1">2. 🔍 Pool Search</div>
          <p className="text-[var(--color-muted)]">
            SurrealDB is queried for all fruits of the opposite type.
            Every candidate is scored individually against the incoming
            fruit&apos;s preferences.
          </p>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-zinc-900/40 p-3">
          <div className="text-xl mb-1">3. 📊 Bidirectional Scoring</div>
          <p className="text-[var(--color-muted)]">
            Two scores computed: <strong>Forward</strong> (do they fit our prefs?)
            and <strong>Reverse</strong> (do we fit theirs?).
            Mutual = √(F × R) — geometric mean ensures both sides are happy.
          </p>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-zinc-900/40 p-3">
          <div className="text-xl mb-1">4. 🍐 LLM Narrative</div>
          <p className="text-[var(--color-muted)]">
            GPT-4o-mini (via AI SDK) generates a unique narrative explaining
            the match. The result is stored in SurrealDB and displayed
            in the conversation.
          </p>
        </div>
      </div>

      {/* Attributes */}
      <div>
        <h4 className="text-xs font-bold mb-2">Fruit Attributes</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          {[
            { attr: "Size", type: "Numeric (2-14)", desc: "Physical size in arbitrary units" },
            { attr: "Weight", type: "Numeric (50-350g)", desc: "Weight in grams" },
            { attr: "Shine Factor", type: "Ordinal scale", desc: "dull → neutral → shiny → extraShiny" },
            { attr: "Has Stem", type: "Boolean", desc: "Whether the fruit has a stem" },
            { attr: "Has Leaf", type: "Boolean", desc: "Whether a leaf is attached" },
            { attr: "Has Worm", type: "Boolean", desc: "Whether a worm is present (dealbreaker!)" },
            { attr: "Has Chemicals", type: "Boolean", desc: "Whether treated with pesticides" },
          ].map((a) => (
            <div key={a.attr} className="rounded bg-white/50 dark:bg-zinc-800/50 p-2">
              <span className="font-semibold">{a.attr}</span>
              <span className="text-[var(--color-muted)] ml-1">({a.type})</span>
              <p className="text-[var(--color-muted)] mt-0.5">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring weights */}
      <div>
        <h4 className="text-xs font-bold mb-2">Criterion Weights (Dealbreakers vs. Cosmetics)</h4>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {[
            { name: "Worm", weight: "3.0x", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", label: "Dealbreaker" },
            { name: "Chemicals", weight: "2.5x", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", label: "Strong" },
            { name: "Size", weight: "1.0x", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400", label: "Standard" },
            { name: "Weight", weight: "1.0x", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400", label: "Standard" },
            { name: "Stem", weight: "0.8x", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", label: "Cosmetic" },
            { name: "Leaf", weight: "0.7x", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", label: "Cosmetic" },
            { name: "Shine", weight: "0.7x", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", label: "Cosmetic" },
          ].map((w) => (
            <span key={w.name} className={`rounded-full px-2.5 py-1 font-medium ${w.color}`}>
              {w.name}: {w.weight} <span className="opacity-60">({w.label})</span>
            </span>
          ))}
        </div>
        <p className="text-[10px] text-[var(--color-muted)] mt-2">
          A worm mismatch tanks the score 3x harder than a shine mismatch.
          Weighted average ensures dealbreakers dominate the final score.
        </p>
      </div>

      {/* Tech stack */}
      <div>
        <h4 className="text-xs font-bold mb-2">Tech Stack</h4>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {[
            "Next.js 16", "React 19", "Tailwind CSS 4", "Zustand", "Effect",
            "Supabase Edge Functions", "SurrealDB", "AI SDK (Vercel)",
            "GPT-4o-mini", "Recharts", "Framer Motion",
          ].map((t) => (
            <span key={t} className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[var(--color-muted)]">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
