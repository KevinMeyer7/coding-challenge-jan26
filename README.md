# Fruit Matchmaking System

A fullstack application that connects apples to oranges based on their preferences, using bidirectional weighted compatibility scoring and LLM-powered match narratives.

**Live Demo:** [https://frontend-kevins-projects-d1556d1c.vercel.app](https://frontend-kevins-projects-d1556d1c.vercel.app)

## Architecture

```
Next.js 16 (Vercel)  →  Supabase Edge Functions (Cloud)  →  SurrealDB (Cloud)
     │                            │
     ├── Zustand (state)          ├── Matching Algorithm
     ├── Effect (error handling)  ├── LLM Narrative (AI SDK / GPT-4o-mini)
     ├── Recharts (analytics)     └── SurrealDB HTTP Client
     └── Framer Motion (UI)
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | Dashboard + visualization |
| State | Zustand | Client state management |
| Error handling | Effect | Typed error pipeline with retry + timeout |
| Backend | Supabase Edge Functions (Deno) | 3 serverless functions |
| Database | SurrealDB 3.x (Cloud) | Fruit pool + match storage |
| LLM | AI SDK + GPT-4o-mini | Match narrative generation |
| Analytics | Recharts | Score distribution + bidirectional scatter |
| Animation | Framer Motion | Chat message reveals + transitions |

## Matching Algorithm

Bidirectional weighted compatibility scoring — the core of the system.

### How It Works

1. **Forward score**: How well does the candidate satisfy the incoming fruit's preferences?
2. **Reverse score**: How well does the incoming fruit satisfy the candidate's preferences?
3. **Mutual score**: `√(Forward × Reverse)` — geometric mean penalizes one-sided matches

### Why Geometric Mean?

Arithmetic mean: 100% + 0% = 50% (looks OK but one side is miserable)
Geometric mean: 100% + 0% = **0%** (correctly identifies a one-sided mismatch)

Same principle as F1 score in information retrieval.

### Criterion Weights

Not all preferences are equal. Dealbreakers count more than cosmetics:

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| Has Worm | 3.0x | Dealbreaker — nobody wants a worm |
| Has Chemicals | 2.5x | Strong health preference |
| Size | 1.0x | Standard physical preference |
| Weight | 1.0x | Standard physical preference |
| Has Stem | 0.8x | Mild preference |
| Has Leaf | 0.7x | Cosmetic preference |
| Shine Factor | 0.7x | Cosmetic preference |

### Scoring Methods by Type

- **Boolean** (stem, leaf, worm, chemicals): Exact match = 1.0, mismatch = 0.0
- **Numeric range** (size, weight): In range = 1.0, out of range = exponential decay `e^(-d/scale)`
- **Ordinal** (shine factor): Partial credit by proximity on the dull→neutral→shiny→extraShiny scale
- **Null/unknown**: 0.5 (information-theoretic neutral point)
- **Omitted preference**: Not scored (any value acceptable)

## Edge Functions

| Function | Purpose |
|----------|---------|
| `get-incoming-apple` | Generate apple → store in SurrealDB → match against oranges → LLM narrative |
| `get-incoming-orange` | Generate orange → store in SurrealDB → match against apples → LLM narrative |
| `get-stats` | Aggregated metrics, score distribution, fruit pool, recent matches |

## Frontend Dashboard

- **Chat visualization** — 3-phase animated conversation: fruit arrival with profile card, candidate scoring strip, result panel with LLM narrative
- **Compatibility breakdown** — side-by-side preference-vs-actual comparison with want/has labels
- **Metrics panel** — 6 insight-driven KPIs: pool sizes, best match, pool health, bidirectional balance
- **Score distribution** — bar chart of match quality buckets
- **Bidirectional scatter** — forward vs reverse scores showing geometric mean balance
- **Fruit pool explorer** — browse all fruits in the database with match status
- **How It Works** — expandable explainer showing attributes, weights, and tech stack
- **Light/dark mode** — manual toggle with system preference fallback
- **Auto-bootstrap** — first load automatically runs 5 conversations to populate analytics

## Quick Start (Local Development)

### Prerequisites

- [Node.js 18+](https://nodejs.org) and [pnpm](https://pnpm.io)
- [Deno 2+](https://deno.land) (`brew install deno`)
- [SurrealDB 3+](https://surrealdb.com) (`brew install surrealdb/tap/surreal`)

### Setup

```bash
# Install dependencies
pnpm install
cd frontend && pnpm install && cd ..

# Start SurrealDB
surreal start --user root --pass root --bind 0.0.0.0:8001 memory

# Seed the database (40 fruits from raw_apples_and_oranges.json)
deno run --allow-net --allow-read --allow-env scripts/seed-surrealdb.ts

# Start backend (Option A: standalone Deno server, no Docker needed)
deno run --allow-net --allow-read --allow-env scripts/serve.ts

# Start backend (Option B: Supabase CLI, requires Docker)
npx supabase start
npx supabase functions serve --no-verify-jwt --env-file supabase/.env.local

# Start frontend
cd frontend && pnpm dev
```

### Environment Variables

Copy `.env.example` and set:
- `SURREAL_URL` — SurrealDB endpoint
- `OPENAI_API_KEY` — for LLM narratives (optional, falls back to templates)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL

## File Structure

```
├── frontend/
│   ├── app/
│   │   ├── api/chat/route.ts           # AI SDK endpoint (Vercel AI SDK)
│   │   └── dashboard/page.tsx          # Main dashboard
│   ├── components/
│   │   ├── ChatVisualization.tsx        # 3-phase animated conversation
│   │   ├── CompatibilityBreakdown.tsx   # Side-by-side preference comparison
│   │   ├── FruitProfileCard.tsx         # Visual attribute card
│   │   ├── FruitPoolExplorer.tsx        # Browse all fruits
│   │   ├── ForwardReverseScatter.tsx    # Bidirectional scoring chart
│   │   ├── ScoreDistribution.tsx        # Quality bucket histogram
│   │   ├── MetricsPanel.tsx             # 6 KPI cards
│   │   ├── RecentMatches.tsx            # Match history list
│   │   └── BootstrapOverlay.tsx         # Auto-initialization
│   └── lib/
│       ├── api.ts                       # Edge function client (uses Effect)
│       ├── store.ts                     # Zustand state management
│       └── utils.ts                     # Effect utilities + helpers
│
├── supabase/functions/
│   ├── _shared/
│   │   ├── generateFruit.ts             # Fruit generation (Box-Muller)
│   │   ├── matching.ts                  # Weighted bidirectional scoring
│   │   ├── surrealdb.ts                 # SurrealDB HTTP client
│   │   └── narrative.ts                 # LLM + template narrative
│   ├── get-incoming-apple/index.ts
│   ├── get-incoming-orange/index.ts
│   └── get-stats/index.ts
│
├── scripts/
│   ├── seed-surrealdb.ts               # Database seeder
│   └── serve.ts                        # Standalone dev server
│
└── data/
    └── raw_apples_and_oranges.json     # 40 seed fruits (20 apples + 20 oranges)
```
