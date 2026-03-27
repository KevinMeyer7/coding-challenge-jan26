# Fruit Matchmaking System

A fullstack application that connects apples to oranges based on their preferences, using bidirectional compatibility scoring and LLM-powered match narratives.

## Quick Start

### Prerequisites

- [Node.js 18+](https://nodejs.org) and [pnpm](https://pnpm.io)
- [Deno 2+](https://deno.land) (`brew install deno`)
- [SurrealDB 3+](https://surrealdb.com) (`brew install surrealdb/tap/surreal`)

### 1. Install dependencies

```bash
pnpm install
cd frontend && pnpm install && cd ..
```

### 2. Start SurrealDB

```bash
surreal start --user root --pass root --bind 0.0.0.0:8001 memory
```

### 3. Seed the database

```bash
deno run --allow-net --allow-read --allow-env scripts/seed-surrealdb.ts
```

This loads the 40 fruits (20 apples + 20 oranges) from `data/raw_apples_and_oranges.json`.

### 4. Start the backend

**Option A — Standalone Deno server (recommended, no Docker needed):**

```bash
deno run --allow-net --allow-read --allow-env scripts/serve.ts
```

**Option B — Supabase CLI (requires Docker Desktop running):**

```bash
# First time only: start the Supabase local stack
npx supabase start

# Then serve edge functions (edge functions run inside Docker,
# so supabase/.env.local uses host.docker.internal to reach SurrealDB)
npx supabase functions serve --no-verify-jwt --env-file supabase/.env.local
```

Both options serve on `http://localhost:54321`.

### 5. Start the frontend

```bash
cd frontend
pnpm dev
```

Open **http://localhost:3000** — click "New Apple" or "New Orange" to start a matchmaking conversation.

### Optional: LLM narratives

To enable AI-generated match narratives, add an OpenAI API key:

```bash
# In supabase/.env.local (for Option B) or as an env var (for Option A):
export OPENAI_API_KEY=sk-...
```

Without a key, the system uses template-based narratives (fully functional).

---

## Architecture

```
Frontend (Next.js 16)  →  Edge Functions (Deno)  →  SurrealDB
                                    ↓ (optional)
                              OpenAI API (LLM)
```

### Matching Algorithm

Bidirectional scoring: each fruit is scored against every candidate of the opposite type.

- **Forward score**: How well does the candidate satisfy the incoming fruit's preferences?
- **Reverse score**: How well does the incoming fruit satisfy the candidate's preferences?
- **Mutual score**: `√(forward × reverse)` — geometric mean, penalizes one-sided matches

| Preference Type | Scoring |
|----------------|---------|
| Boolean (hasStem, hasWorm, etc.) | Exact match = 1.0, mismatch = 0.0 |
| Numeric range (size, weight) | In range = 1.0, exponential decay outside |
| Shine factor | Exact = 1.0, partial credit by proximity on scale |
| Null/unknown attribute | 0.5 (neutral) |
| Omitted preference | Not counted |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `get-incoming-apple` | Generate apple → store → match against oranges → narrative |
| `get-incoming-orange` | Generate orange → store → match against apples → narrative |
| `get-stats` | Aggregated metrics for the dashboard |

### Frontend Dashboard

- **Chat visualization** — animated message flow showing fruit introductions and match results
- **Metrics panel** — 6 KPIs (pool sizes, match count, avg score, match rate, unmatched)
- **Score distribution** — bar chart of match quality buckets
- **Compatibility breakdown** — per-criterion scores for the active conversation
- **Recent matches** — scrollable list with fruit details

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Zustand, Effect, Recharts, Framer Motion |
| Backend | Supabase Edge Functions (Deno), SurrealDB 3.x |
| LLM | OpenAI-compatible API (optional, with template fallback) |

## File Structure

```
├── frontend/
│   ├── app/dashboard/page.tsx          # Main dashboard (client component)
│   ├── components/
│   │   ├── ChatVisualization.tsx        # Animated chat conversation
│   │   ├── MetricsPanel.tsx             # KPI metric cards
│   │   ├── ScoreDistribution.tsx        # Recharts bar chart
│   │   ├── CompatibilityBreakdown.tsx   # Per-criterion score bars
│   │   └── RecentMatches.tsx            # Match history list
│   └── lib/
│       ├── api.ts                       # Edge function API client
│       ├── store.ts                     # Zustand state management
│       └── utils.ts                     # Utilities + Effect helpers
│
├── supabase/functions/
│   ├── _shared/
│   │   ├── generateFruit.ts             # Fruit generation (provided)
│   │   ├── matching.ts                  # Bidirectional scoring algorithm
│   │   ├── surrealdb.ts                 # SurrealDB HTTP client
│   │   └── narrative.ts                 # LLM + template narrative generation
│   ├── get-incoming-apple/index.ts
│   ├── get-incoming-orange/index.ts
│   └── get-stats/index.ts
│
├── scripts/
│   ├── seed-surrealdb.ts               # Database seeder
│   └── serve.ts                        # Standalone dev server (no Docker)
│
├── data/
│   └── raw_apples_and_oranges.json     # 40 seed fruits
│
├── INTERVIEW_PREP.md                   # Design decisions & architecture notes
└── INTERVIEW_PREP.html                 # Same, as printable HTML
```
