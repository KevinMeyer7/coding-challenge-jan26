# Interview Preparation Guide
## Clera Coding Challenge — Fruit Matchmaking System

---

## 1. Architecture Overview

### System Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   Next.js 16    │────▶│  Supabase Edge Fns   │────▶│  SurrealDB  │
│   (Frontend)    │◀────│  (Deno Runtime)       │◀────│  (Data)     │
│                 │     │                        │     │             │
│ • Dashboard     │     │ • get-incoming-apple   │     │ • apple     │
│ • Chat UI       │     │ • get-incoming-orange  │     │ • orange    │
│ • Analytics     │     │ • get-stats            │     │ • match     │
│ • Zustand Store │     │ • Matching Algorithm   │     │             │
└─────────────────┘     │ • LLM Integration      │     └─────────────┘
                        └──────────────────────┘
                                  │
                                  ▼ (optional)
                        ┌──────────────────┐
                        │   OpenAI API     │
                        │   (gpt-4o-mini)  │
                        └──────────────────┘
```

### Key Design Decisions

1. **SurrealDB as the primary data store** (hard requirement). Using SCHEMALESS tables for flexibility — the fruit data has optional/nullable fields that map well to a schema-flexible document store. SurrealDB's HTTP API used directly from Deno (no SDK dependency).

2. **Three separate tables**: `apple`, `orange`, `match`. Separate tables vs. a single `fruit` table because:
   - Type-safe queries (no WHERE type = X filtering)
   - Different tables can have different indexes optimized for their access patterns
   - Matches reference both sides clearly with `appleId` / `orangeId`

3. **Edge Functions as the backend** (required tech). Each function follows the prescribed 5-step flow. Functions are stateless — all state lives in SurrealDB.

4. **Client-side rendering** for the dashboard. The dashboard is fully interactive (chat UI, real-time updates), which fits better as a client component than server-rendered pages.

---

## 2. Matching Algorithm — The Heart of the System

### Design Philosophy

The matching algorithm uses a **bidirectional compatibility scoring** approach:

- **Forward score**: How well does the candidate satisfy the incoming fruit's preferences?
- **Reverse score**: How well does the incoming fruit satisfy the candidate's preferences?
- **Mutual score**: Geometric mean of forward and reverse scores

### Why Geometric Mean?

I chose geometric mean (√(forward × reverse)) over arithmetic mean because:

- It **penalizes imbalance**: A 100% + 0% pair scores 0% (geometric) vs 50% (arithmetic)
- It **rewards mutual compatibility**: Both sides need to be satisfied for a high score
- This mirrors real-world matchmaking — a one-sided "perfect match" isn't actually a match

### Scoring Rules

| Preference Type | Scoring Method |
|----------------|----------------|
| Boolean (hasStem, hasWorm, etc.) | Exact match = 1.0, mismatch = 0.0 |
| Numeric range (size, weight) | In range = 1.0, out of range = exponential decay based on distance |
| Shine factor | Exact match = 1.0, partial credit based on proximity on scale (dull→neutral→shiny→extraShiny) |
| Null/unknown attribute | 0.5 (neutral — we don't know) |
| Omitted preference | Not counted (any value acceptable) |

### Why Exponential Decay for Numeric Ranges?

A fruit that's size 8.1 when the preference is max 8.0 shouldn't score 0. The exponential decay function `e^(-distance/scale)` provides:
- Graceful degradation near boundaries
- Rapid falloff for large deviations
- Scale-appropriate sensitivity (30% of range boundary as the decay constant)

### Edge Cases Handled

- **Null attributes**: Scored 0.5 — neutral, doesn't hurt or help
- **No preferences**: Score is 1.0 — fruit with no preferences accepts anyone
- **Empty candidate pool**: Returns empty results with a helpful narrative
- **Both scores are 0**: Mutual score is 0 (geometric mean's zero product rule)

---

## 3. LLM Integration

### Architecture

The LLM integration is **optional and gracefully degradable**:

1. If `OPENAI_API_KEY` is set → calls the OpenAI chat completions API
2. If the API call fails → falls back to a template-based narrative generator
3. If no key is set → uses the template-based generator directly

### Why This Approach?

- **Reliability**: The system works without any external API dependency
- **Cost control**: LLM calls cost money; template narratives are free
- **Configurability**: Can point to any OpenAI-compatible API (local LLMs, etc.) via `LLM_BASE_URL`

### Prompt Design

The LLM prompt creates a "Perfect Pear" matchmaking show host persona. It:
- Provides the apple/orange's self-description as context
- Includes top 3 match scores with breakdown
- Asks for a fun, engaging narrative with fruit puns
- Caps output at 200 words for conciseness

---

## 4. Frontend Design

### Component Architecture

```
DashboardPage
├── MetricsPanel          — 6 KPI cards (apples, oranges, matches, avg score, match rate, unmatched)
├── ChatVisualization     — Interactive chat showing matchmaking conversations
├── CompatibilityBreakdown — Per-criterion score bars for active conversation's best match
├── ScoreDistribution     — Recharts bar chart of score bucket distribution
├── RecentMatches         — Scrollable list of recent match results
└── SystemPerformance     — Performance metrics table
```

### State Management: Zustand

The Zustand store manages:
- **Conversations**: Array of conversation entries (each = one fruit arrival + matching)
- **Stats**: Server-fetched aggregate metrics (refreshed after each conversation)
- **UI state**: Loading, errors, active conversation

### Visualization Choice: Chat UI

I chose a **chat/conversation interface** as the primary visualization because:

1. **Natural mapping**: The system generates natural language descriptions — a chat UI is the most intuitive way to display conversational content
2. **Sequential flow**: The matchmaking process is inherently sequential (arrive → introduce → search → match → narrative), which maps perfectly to a message timeline
3. **Engaging**: Users can "start conversations" and watch them unfold with message-by-message animation
4. **Familiar**: Chat interfaces are universally understood

### Animation

Using Framer Motion for:
- Message entrance animations (fade + slide up)
- Sequential message appearance (600ms intervals) to simulate the matching "process"
- This creates a narrative feel — not just dumping results

---

## 5. Data Flow: End-to-End

### When the user clicks "New Apple":

1. Frontend calls `POST /functions/v1/get-incoming-apple`
2. Edge function generates a random apple (Box-Muller distribution)
3. Natural language descriptions generated from templates
4. Apple stored in SurrealDB with descriptions
5. All oranges fetched from SurrealDB
6. Matching algorithm scores each orange (forward + reverse + mutual)
7. Top 3 matches selected
8. LLM generates narrative about the matches (or falls back to template)
9. Best match stored in SurrealDB `match` table
10. Full response returned to frontend
11. Zustand store updates, chat messages animated in
12. Stats auto-refreshed in background

---

## 6. Metrics & Analytics — "How Do I Know It's Working?"

### Key Metrics

| Metric | What It Tells Us | Target |
|--------|-----------------|--------|
| **Avg Mutual Score** | Overall match quality | >60% = good system |
| **Match Rate** | % of fruits that found a match | 100% (every fruit gets matched) |
| **Score Distribution** | Are we getting mostly good matches? | Bell curve peaking at 60-80% |
| **Forward vs Reverse Avg** | Is matching balanced? | Should be similar values |
| **Unmatched Count** | Fruits waiting in the pool | Should decrease over time |

### Why These Metrics?

- **Mutual score** is the single best indicator of system quality — it captures bidirectional compatibility
- **Distribution** tells us if we have a healthy spread or if everything clusters at one extreme
- **Forward vs Reverse balance** ensures the algorithm isn't biased toward one direction
- **Unmatched count** shows pool health — if it grows, we have a supply/demand problem

---

## 7. Trade-offs & What I'd Do Differently

### With More Time

1. **Trigger.dev integration**: Would implement background jobs for batch matching (process all unmatched fruits periodically)
2. **Effect library deeper integration**: Would use Effect for the edge function error handling pipeline, not just the frontend utilities
3. **Network graph visualization**: D3.js force-directed graph showing apple-orange connections with edge thickness = score
4. **Real-time updates**: Supabase Realtime subscriptions so the dashboard updates across tabs
5. **A/B testing matching algorithms**: Compare geometric mean vs harmonic mean vs weighted scoring

### Conscious Trade-offs

1. **SCHEMALESS tables**: Faster to develop, less strict. Production would want schema validation.
2. **Template-based fallback narratives**: Not as engaging as LLM output, but guarantees the system always works.
3. **In-memory SurrealDB**: Using memory mode for local dev. Production would need persistent storage.
4. **No authentication**: Skipped auth since it's a local demo. Production needs JWT verification.

---

## 8. Code Quality Notes

### Testing Strategy

- The existing `generateFruit.test.ts` has 25+ tests covering attribute generation and communication
- The matching algorithm was verified with live data (20 apples × 20 oranges = 400 scoring pairs)
- Edge functions were tested via direct Deno execution against live SurrealDB

### Error Handling

- Every edge function has try/catch with structured error responses
- SurrealDB client has connection error handling with clear messages
- Frontend displays errors inline (not just console.log)
- LLM integration gracefully degrades to template-based output

### Performance

- SurrealDB queries are efficient (indexed on mutualScore and createdAt)
- Matching is O(n) per incoming fruit where n = size of candidate pool
- Frontend uses Zustand's selector pattern to avoid unnecessary re-renders

---

## 9. Running the System

```bash
# 1. Start SurrealDB
surreal start --user root --pass root --bind 0.0.0.0:8001 memory

# 2. Seed the database
SURREAL_URL=http://localhost:8001 deno run --allow-net --allow-read --allow-env scripts/seed-surrealdb.ts

# 3. Serve edge functions
npx supabase functions serve --no-verify-jwt --env-file supabase/.env.local

# 4. Start frontend
cd frontend && pnpm dev
```

---

## 10. Questions I'd Ask the Interviewer

1. "How would you want the matching quality to be measured in production? Is there a human feedback loop?"
2. "Would you want the matching to be synchronous (immediate) or queued (batch processed)?"
3. "How do you envision the LLM integration scaling — dedicated model, or API calls per match?"
4. "What's the expected data volume — hundreds of fruits? Millions?"
5. "Would you want to explore graph database features of SurrealDB (RELATE) for modeling match relationships?"

---

*Created for the Clera coding challenge technical review.*
*Kevin Meyer — March 2026*
