# AURA BRIEFING — What STOCKVAULT (Motion Scanner v3.0) Actually Is

> Read this **before** editing anything. Two recent branches
> (`2025-04-06-...nvidia-ai-update`, `2025-04-07-alex-screener-mistral-update`)
> tried to "improve" the app but instead **deleted core functionality**,
> **leaked an API key into the browser bundle**, and **broke the build**.
> This document exists so that does not happen again. The rules at the bottom
> are not optional.

---

## 1. One-sentence summary

STOCKVAULT (internally "Motion Scanner v3.0") is a **full-stack, multi-tenant,
SOC 2-aligned stock-scanning platform** that qualifies tickers into a tri-state
verdict — **GO / HOLD / ABORT** — using real technical indicators, with live
market data, an AI market-analysis agent, Alpaca paper/broker trading, and
AES-256-GCM-encrypted per-tenant secrets.

It is **NOT** a single React page with mock data. It is a **pnpm monorepo** with
a real Express API, a PostgreSQL database, a contract-first OpenAPI codegen
pipeline, and four separate applications.

---

## 2. Tech stack (do not change these foundations)

| Layer | Technology |
|-------|-----------|
| Monorepo | **pnpm workspaces** (`pnpm@10.33.0`), Node.js 22, TypeScript 5.9 |
| Frontend | React 19 + **Vite** + **wouter** (routing) + **TanStack Query** + **shadcn/ui** + **Tailwind CSS v4** |
| Backend | **Express 5** mounted at `/api` |
| Database | **PostgreSQL** + **Drizzle ORM** (`drizzle-kit push`) |
| Validation | **Zod** (`zod/v4`) + `drizzle-zod` |
| API contract | **OpenAPI** (`lib/api-spec/openapi.yaml`) → **Orval** codegen → typed hooks + Zod schemas |
| Auth | **Clerk** (conditional — only mounts when `CLERK_SECRET_KEY` / publishable key is present) |
| Encryption | **AES-256-GCM** via `ENCRYPTION_SECRET` (32-byte hex) |
| AI engine | **OpenAI-compatible** client pointed at **NVIDIA NIM** (Nemotron) by default, per-tenant overridable |
| Deploy | **Render** Blueprint (`render.yaml`): API Web Service + Static Site + managed Postgres |

**This is a TypeScript/Node project. There is NO Python in it.** Do not add
`.py` files. The `nvidia_ai.py` and `tenant_context.py` files added on the
`04-06` branch are wrong-ecosystem dead code — they do nothing and will never be
imported.

---

## 3. Repository layout

```
STOCKVAULT/
├── artifacts/                  # deployable applications
│   ├── api-server/             # Express 5 API (the backend)
│   ├── motion-scanner/         # the main React web app  ← the product
│   ├── motion-scanner-mobile/  # mobile variant
│   └── mockup-sandbox/         # scratch/mockups
├── lib/                        # shared workspace packages (@workspace/*)
│   ├── api-spec/               # openapi.yaml = SOURCE OF TRUTH for API shapes
│   ├── api-client-react/       # GENERATED TanStack Query hooks (do not hand-edit)
│   ├── api-zod/                # GENERATED Zod schemas (do not hand-edit)
│   ├── db/                     # Drizzle schema + client (@workspace/db)
│   ├── integrations-openai-ai-server/   # server-side OpenAI-compatible client
│   ├── integrations-openai-ai-react/    # client-side AI hooks
│   └── integrations/openai_ai_integrations/
├── render.yaml                 # Render Blueprint (API + web + Postgres)
├── pnpm-workspace.yaml         # workspace + supply-chain safety config
└── pnpm-lock.yaml              # LOCKFILE — never delete this
```

### Frontend pages (`artifacts/motion-scanner/src/pages/`)
`dashboard`, `scanner`, `sector`, `watchlists`, `broker`, `broker-onboarding`,
`history`, `audit`, `settings`, `news`, `notes`, `charts`, `agent`,
`not-found`. **All of these are wired into `App.tsx` routing. Do not delete
routes or gut `App.tsx`.**

### API routes (`artifacts/api-server/src/routes/`)
`apikeys`, `audit`, `broker-accounts`, `broker`, `chart`, `config`, `health`,
`news`, `notes`, `openai/` (AI agent), `scan`, `screener`, `sector`,
`watchlists`.

### DB schema (`lib/db/src/schema/`)
`tenants`, `api-keys`, `watchlists`, `scan-configs`, `scan-results`,
`audit-logs`, `conversations`, `messages`, `notes`, `alpaca-accounts`.

---

## 4. How data actually flows (this is the architecture you must respect)

There are exactly **two** real third-party API integrations that use stored keys:

1. **AI** — an OpenAI-compatible endpoint (default: NVIDIA NIM serving Nemotron).
   Powers the Market Analysis Agent (`/pages/agent.tsx` → `/routes/openai/`).
2. **Alpaca** — paper trading + Broker API (per-user brokerage accounts).

**Everything else is "live search"** — the server fetches directly from public
sources (Yahoo Finance) at request time. The screener, sector rotation, and
charts do **not** need a database or an API key. That is why the tenant
middleware falls back to a demo tenant when the DB is unreachable: so live
search keeps working.

### The contract-first loop (critical — breaking this breaks everything)
```
edit lib/api-spec/openapi.yaml
      ↓  pnpm --filter @workspace/api-spec run codegen   (Orval)
generates → lib/api-client-react/src/generated/   (TanStack Query hooks)
generates → lib/api-zod/src/generated/            (Zod schemas)
      ↓
frontend imports the generated hooks; API validates with the generated Zod
```
**Never hand-write API types. Never hand-edit files under `generated/`.** Change
the OpenAPI spec, then run codegen.

---

## 5. The scanning engine (the actual product value)

`artifacts/api-server/src/lib/scanner.ts` is the real engine. It computes
**RSI, EMA, ADX, volume ratio, Monte Carlo**, and a **composite score**, then
maps the result to **GO / HOLD / ABORT**. The screener route
(`routes/screener.ts`) runs this engine across real ticker universes
(S&P 100, NASDAQ 100, Dow 30, GICS sectors — hundreds of real symbols) using
live Yahoo Finance data.

**"Alex's Screener"** is a preset: *2× Range · $1–$10 · ≥20% MoM · ≤10% from
High*. It is a real momentum screen over live data — **not** a hardcoded list of
AAPL/NVDA/TSLA with a `setTimeout`. Any "screener" that returns canned data is a
mockup, not the product, and must not replace the real one.

---

## 6. Multi-tenancy & security (do not weaken these)

- **Tenant isolation**: `middlewares/tenant.ts` resolves a tenant per request
  from the Clerk org/user id (header fallback, demo-tenant fallback when no DB).
  Every DB query is scoped by `tenantId`.
- **Encryption at rest**: all secrets (Alpaca, AI, Gemini, Discord, etc.) are
  **AES-256-GCM encrypted** with `ENCRYPTION_SECRET` before hitting the DB.
  Columns are suffixed `_enc`. Never store plaintext secrets.
- **SOC 2 audit trail**: every mutation is logged to `audit_logs`.
- **Supply-chain guard**: `pnpm-workspace.yaml` enforces a 1-day
  `minimumReleaseAge`. Do not disable it.

### 🔴 SECRETS RULE — THIS IS WHY THE LAST TWO BRANCHES WERE REJECTED
- **Never hardcode an API key in source.** Both AURA branches embedded a live
  NVIDIA key (`nvapi-...`) directly in code. The `04-07` branch put it in
  `artifacts/motion-scanner/src/lib/ai.ts` — a **frontend** file. Frontend code
  is shipped to every visitor's browser, so that key was exposed to the entire
  internet. That key is now burned and must be rotated.
- Secrets live **server-side only**: in env vars
  (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`,
  `AI_MODEL`) or in the encrypted per-tenant `api_keys` table. The browser never
  sees a key — it calls our API, and our API calls NVIDIA/Alpaca.

---

## 7. What the last two branches did wrong (learn from this)

**`2025-04-06-motion-scanner-multitenant-apple-ui-nvidia-ai-update`**
- Gutted `App.tsx` from 386 lines to 18 — **deleted all routing, Clerk auth, and
  all 12+ pages.** App becomes a single mock screener.
- **Deleted `pnpm-lock.yaml`** (−12,568 lines) — breaks reproducible installs.
- Added Python files to a TypeScript repo.
- Hardcoded a live NVIDIA key in `nvidia_ai.py`.

**`2025-04-07-alex-screener-mistral-update`** (better, still rejected)
- Hardcoded the NVIDIA key in a **frontend** file (browser-exposed).
- Passed `<Layout className="...">` but `Layout` only accepts `{ children }` →
  **TypeScript build error**, deploy fails.
- Screener returns hardcoded mock data instead of the live engine.
- Dead code (`callMistralAI` never called; unused import in `App.tsx`).

**The correct way to add an Apple-style screener UI**: build the component, wire
it to the **existing real screener API hooks** (TanStack Query), route AI through
the **server-side** OpenAI-compatible client (no browser key), and make sure
`pnpm run typecheck` passes. Additive, not destructive.

---

## 8. Commands

```bash
pnpm install                                            # install (keep the lockfile!)
pnpm --filter @workspace/api-server run dev             # API on :8080
pnpm --filter @workspace/motion-scanner run dev         # web on :23523
pnpm run typecheck                                      # MUST pass before any push
pnpm run build                                          # typecheck + build all
pnpm --filter @workspace/api-spec run codegen           # regen hooks/Zod after openapi edits
pnpm --filter @workspace/db run push                    # push schema (dev)
```

---

## 9. NON-NEGOTIABLE RULES FOR ANYONE EDITING THIS REPO

1. **Additive, not destructive.** Never delete `App.tsx` routing, pages, the
   lockfile, or working features to ship a new screen.
2. **No secrets in source — ever.** Especially not in frontend files. Use env
   vars + the encrypted `api_keys` table. The browser calls our API; our API
   holds the keys.
3. **No Python.** This is a TypeScript/Node/pnpm monorepo.
4. **Respect the contract-first loop.** Edit `openapi.yaml`, run codegen; never
   hand-edit `generated/`.
5. **`pnpm run typecheck` MUST pass before any commit/push.** The `04-07` branch
   would not have shipped if this rule were followed (`Layout className`).
6. **Use real data.** The screener/sector/charts hit live sources through the
   API. Mock arrays are for throwaway mockups only, never the product path.
7. **Keep the lockfile.** Do not delete `pnpm-lock.yaml`.
8. **One always-current integration branch**, named with a date + what changed,
   that is the merge of the latest project with **no loss of function**.

The canonical, fully-working project is `main` @ `a6edb3f` (mirrored on
`claude/awesome-shannon-TrsXQ`). Branch from there. Do not merge the two
rejected branches above.
