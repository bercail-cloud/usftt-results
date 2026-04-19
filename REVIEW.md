# Full Review — usftt-results

Reviewer: Claude (Opus 4.7). Branch: `claude/ecstatic-pasteur-FDWcR`.

This branch includes a full audit of the codebase (security, code, quality,
tests) plus a small set of low-risk fixes that exercise the most critical
recommendations. The fixes are additive and all 199 tests pass
(171 API + 28 web). Everything else is intentionally left as recommendations
so you can triage at your own pace.

Severity legend: `P0` block-ship, `P1` fix soon, `P2` nice to have.

---

## 1. Security Review

### P0 — Real FFTT credentials committed to git
`.env.development:1-7` contains live FFTT API credentials
(`FFTT_APP_ID=SX014`, `FFTT_PASSWORD=h62F6JzYtA`, `FFTT_SERIE=…`).
These are in the public GitHub history and must be treated as compromised.

Recommended action (in order):
1. Rotate the FFTT API password at `fftt.com` (contact them if no self-serve
   rotation exists).
2. `git rm --cached .env.development` and rewrite git history if the repo is
   public (`git filter-repo` or `bfg`). At a minimum, stop tracking the file.
3. Keep `.env.example` as the template. This branch has already added
   `.env.*` to `.gitignore` (with `!.env.example` exception) so a rotated
   `.env.development` will not be re-committed.
4. Scan the rest of git history for other leaked secrets (e.g. `gitleaks
   detect`).

I did **not** delete `.env.development` in this PR because local dev scripts
(`./scripts/dev.sh`, `packages/api` `dev` script) reference it; please do
that together with the rotation.

### P0 — Sync trigger endpoint can be unauthenticated
`packages/api/src/index.ts` falls back to no-auth if `SYNC_TRIGGER_TOKEN` is
unset. With wide-open CORS (`*`), this means any origin can POST
`/api/sync/trigger/:module` and keep the DB busy for ~15 minutes.

**Fixed in this PR:** `index.ts:41-45` now throws on startup when
`NODE_ENV=production` without a token, so a misconfigured prod deploy fails
loudly instead of silently exposing the endpoint. Dev keeps the warning for
convenience.

Follow-up to consider: also add a per-IP rate limit on `/api/sync/trigger/*`
(e.g. `hono-rate-limiter`) because token brute-force is trivial without one.

### P1 — Wide-open CORS by default
`packages/api/src/index.ts:25-34` defaults to `origin: "*"` when
`ALLOWED_ORIGINS` is not set. Everything except the sync trigger is public
read-only, so blast radius is limited, but the trigger endpoint above is the
real concern. Recommendation: require `ALLOWED_ORIGINS` in prod (same
pattern as the sync token) or narrow to a sane default list.

### P1 — No nginx security headers
`nginx.conf` shipped only gzip + cache headers. **Fixed in this PR:** added
`Content-Security-Policy`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
and `server_tokens off`.

CSP is `default-src 'self'` with `connect-src` allow-listing the production
API host. If you host the API elsewhere, update `connect-src` (or parameterise
via a Docker build-arg like `VITE_API_URL`). I kept `'unsafe-inline'` on
styles because Vite / Tailwind can emit inline `<style>` in production
builds; you can tighten to hashed inline-style allowances later.

HSTS is intentionally **not** set here — Traefik terminates TLS in your
setup, so add `Strict-Transport-Security` at the Traefik middleware layer
instead of duplicating it on nginx.

### P1 — Sync status exposes internal error messages
`/api/sync/status` is unauthenticated and returns `error_message` directly
from DB. Previously the scheduler wrote `String(error)` which includes stack
traces, absolute paths, and occasionally DB error details.

**Fixed in this PR:** `packages/api/src/sync/scheduler.ts` now sanitises
before writing (first line only, capped at 500 chars).

### P1 — Container runs as root
`Dockerfile` stage 4 did not drop privileges. **Fixed in this PR:** runs as
the stock `node` user. Verify on deploy that the mounted volumes (if any)
are readable by uid 1000 — the entrypoint only reads, so it should be fine.

### P2 — Parameter validation gaps
`parseInt` without NaN-check returns `NaN` to Drizzle, producing empty
results and ultimately a 404. Not exploitable, but it hides malformed input
from monitoring. **Fixed in this PR** for:
- `GET /api/equipes/:id`
- `GET /api/equipes/:id/rencontres/:rencId`
- `GET /api/criterium/tours/:tour`

Still open (fix in follow-up): `GET /api/joueurs/:licence*` family — add a
shape check like `/^[A-Z0-9-]{1,20}$/` to reject weird licence strings at
the edge. Today they flow into Drizzle `eq()` so they are SQL-safe, but
early rejection keeps the route honest.

### P2 — No rate limiting anywhere
Even read-only endpoints can be abused to spike DB load (see the N+1 query
fan-out below). Traefik has a `RateLimit` middleware — consider enabling it
on the `api.*` router.

### P2 — Docker entrypoint uses `nc` for readiness
`docker-entrypoint.sh` adds `netcat-openbsd`. Minor attack surface plus a
second binary to patch. Postgres' own `pg_isready` (via the postgres image
health check in compose) is already running; the API container's wait loop
could poll `DATABASE_URL` via `node -e` + `postgres` instead, or simply
rely on Compose's `depends_on: condition: service_healthy` and drop the
loop. Leaving as-is since it's not a real vulnerability.

### Not vulnerable (verified)
- **SQL injection**: every query uses Drizzle typed builders or
  parameterised `sql\`…\`` with bound vars. No string concatenation into
  SQL, no `sql.raw` on user input.
- **Auth comparison**: `packages/api/src/routes/system.ts:45-53` uses
  `timingSafeEqual` with a length pre-check. Correct.
- **FFTT auth signature**: `packages/api/src/fftt/auth.ts` uses
  md5(password) → hmac-sha1(timestamp). This is the shape FFTT requires.
  The md5-of-password step is FFTT's protocol, not our choice.

---

## 2. Code Quality Review

### Routes: N+1 fan-out in hot paths
`packages/api/src/routes/equipes.ts:45-110` runs **2 queries per equipe**
(classements + rencontres). With 30 equipes that's 60 round-trips on the
landing page.

Fix sketch (single query, grouped in memory):
```ts
const equipeIds = equipesRows.map((e) => e.id);
const [classements, rencs] = await Promise.all([
  db.select().from(classements_poule).where(inArray(classements_poule.equipe_id, equipeIds)),
  db.select().from(rencontres).where(inArray(rencontres.equipe_id, equipeIds)),
]);
const byEquipe = groupBy(classements, "equipe_id");
// …
```
Similar pattern in `criterium.ts:173-242` (one `criterium_parties` query per
player), and in `joueurs.ts:71-159` which loads the **entire** `equipes`,
`rencontres`, and `parties_rencontre` tables into memory to compute one
player's V/D counts by name matching. That last one will stop scaling once
you have multiple seasons of history.

Longer-term: move the V/D computation to a materialised view or a SQL
aggregate with `joueur_id` — the string-prefix matching is genuinely
brittle ("NOM Prenom" prefix + classement fallback) and has already spawned
special cases (Phase 2 vs Phase 1 sort, doubles filter via ` et `, etc.).

### `SyncDb = any`
`packages/api/src/sync/sync-equipes.ts:12-13` is explicit but loses every
type guarantee in the sync layer. Drizzle now exports
`PostgresJsDatabase<typeof schema>` which you can use:
```ts
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";
export type SyncDb = PostgresJsDatabase<typeof schema>;
```
This also lets the test mocks type-check against real call-shapes and
would catch bugs where a mock returns `{ where: … }` but the real route
calls `.orderBy` directly.

### Hard-coded club identity
`USFTT_CLUB = "FONTENAYSIENNE"` and `USFTT_CLUB_NUMERO = "08940073"` appear
in `routes/criterium.ts:12-13` and `CLAUDE.md`. Same values live in
env (`CLUB_NOM`, `CLUB_NUMERO`). The route ignores env and duplicates.
Consolidate: inject both via the same `ffttConfig` used by sync, or at
least read from env.

### Logging
`console.log`/`console.error` only. For production you'll want structured
JSON logs (`pino` is the canonical Hono/Node choice — 1.7 MB, zero deps).
With the current setup you can't filter by job, correlate a request to its
errors, or ship to anything.

### Large handlers that should split
- `packages/api/src/routes/criterium.ts` (550 lines). The
  `/criterium/tours/:tour/joueurs/:licence` handler alone is ~230 lines with
  three distinct responsibilities: load-or-fallback player, build pool/elim
  match list, de-duplicate pool-vs-elim. Pull those into pure functions so
  they become unit-testable without the DB mock scaffolding.
- `packages/api/src/sync/sync-criterium.ts` (450 lines) — same concern.
  The FFTT-endpoint loop + player matching + persistence can split.

### Small cleanups
- `routes/joueurs.ts:85-96` `isPlayerMatch` closes over `joueurNom` and
  `joueurClt` — make it a pure helper taking those explicitly.
- `routes/joueurs.ts:142` shadows the import `eq` with `const eq = …`. Not
  actually buggy because `eq` isn't used in that scope, but confusing.
- `routes/equipes.ts:49-53` `typeFilter!` non-null assertion when the branch
  already tested it — drop the `!`.
- `packages/api/src/sync/scheduler.ts:142` cron expression
  `0 6 1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31 1,9 *` is "every two days
  in Jan/Sep" — add a comment or build it programmatically
  (`Array.from({length:16}, (_,i)=>i*2+1).join(',')`).

---

## 3. Tests Audit

### What's good
- **168 API tests + 28 web tests, all green in 10s.** That's a strong
  signal for a side-project codebase.
- `packages/api/src/__tests__/fftt/xml-parser.test.ts` (855 lines) is the
  crown jewel — the XML parser is the riskiest component and it's tested
  against real FFTT response shapes.
- `packages/api/src/__tests__/routes/system.test.ts:37-75` covers the auth
  branches on sync-trigger (401 missing, 401 wrong, 200 correct, open-mode).

### Gaps
1. **Tests lie with the DB mock.** Every route test re-implements a chained
   `.from().where().orderBy()` mock. If a route changes from `.where` to
   `.innerJoin` the test still passes while the real DB call fails. A
   `pg-mem` or `testcontainers` integration harness would catch it; start
   with *one* smoke test per route hitting a real schema.
2. **No contract tests vs `@usftt/shared` types.** Route tests check
   `body.data` is an array but never assert full shape against the shared
   `ApiResponse<T>` type. A tiny `expectType<…>(body)` would do it.
3. **Web coverage is shallow.** `packages/web/src/lib/api.ts` has zero
   tests; `hooks/*` are indirectly exercised via page tests only. Add at
   least: api.ts error-path test, one hook test with MSW for the loading /
   success / error states.
4. **Sync tests are whole-module mocks.** `sync-criterium.test.ts` mocks
   every FFTT endpoint with `vi.mock` and asserts DB writes through the
   same mock surface. A small "golden XML" test per sync (load a fixture
   XML, run the parser+sync against an in-memory DB, snapshot the resulting
   rows) would be far more robust.
5. **No regression test for the 400-validation paths** before this PR.
   Added three in `equipes.test.ts`; still missing for `criterium` and
   `joueurs`.
6. **Scheduler tests never run the scheduled function.** They only check
   that `cron.schedule` was called with the right strings. A test that
   invokes the registered callback with a mocked `Date.now` would catch
   the historique / mysql-parties branches that otherwise trigger only in
   Jan/Sep.

---

## 4. Design Improvements

### 4.1 Add a validation middleware
`@hono/zod-validator` plus the zod schemas you already have for env would
cut all the hand-rolled `parseInt` + NaN checks. Example:
```ts
import { zValidator } from "@hono/zod-validator";
const idParam = z.object({ id: z.coerce.number().int().positive() });
app.get("/equipes/:id", zValidator("param", idParam), async (c) => {
  const { id } = c.req.valid("param");
  // …
});
```
You can then reuse the same schemas from the web package (add to
`packages/shared`) for client-side form validation.

### 4.2 Service / repository layer
Routes currently mix HTTP concerns, DB queries, and business logic (name
matching, phase sorting, deduplication). Extract a thin repository:
```
packages/api/src/
  routes/      # HTTP boundary only: parse, validate, call service, serialise
  services/    # Business rules: dedup pool-vs-elim, V/D aggregation
  repositories/# Drizzle queries
```
This also makes the N+1 fixes easier — repositories become the natural home
for batched loaders.

### 4.3 Pull FFTT config from env once
`index.ts` already builds `ffttConfig` from env. Pass it to routes through a
Hono context variable or a DI container instead of hard-coding
`USFTT_CLUB_NUMERO` in `routes/criterium.ts`. One source of truth.

### 4.4 Fail fast on env
`env.ts` is good, but `hasFfttConfig` silently downgrades to "no scheduler,
no sync-trigger". In production that's probably a bug worth throwing for
(same pattern we just added for `SYNC_TRIGGER_TOKEN`). At minimum: log
loud.

### 4.5 Shared API-response types, actually used end-to-end
`@usftt/shared` has `ApiResponse<T>` but the API returns bare objects
(`{ data, lastSync }`, `{ groups, lastSync }`, just an array). Pick one
shape and have both the API route and the web hook reference the same
shared type. Today, drifting the API silently breaks the web client.

### 4.6 Single `parties_individuelles` sort of truth
`sync-parties-spid` and `sync-parties-mysql` both write to this table.
There are two `runJob` entries and a separate cron. The routes then attempt
to dedup results (elim vs pool) in JS (`elimMatchBag` in criterium.ts).
Consider moving the dedupe into the sync layer (or a view) so the routes
can stay dumb.

### 4.7 Trim `any[]` casts
`packages/web/src/pages/CriteriumDetail.tsx:56-60` casts the query result
with `as { data: CriteriumDetailResponse | undefined; … }`. Promote the
response type to `@usftt/shared` and type the hook generically
(`useQuery<CriteriumDetailResponse>`) so the cast disappears.

---

## 5. Simplifications

These can each become a tiny follow-up PR:

1. **`routes/equipes.ts:48-58`** — flatten the `if (typeFilter) { … } else
   { … }` into `db.select().from(equipes).where(typeFilter ? eq(equipes.type_epreuve, typeFilter) : undefined)`
   (Drizzle accepts undefined `.where`). Removes the `!` assertion too.
2. **`index.ts:13-21`** — inline the `hasFfttConfig` ternary into a single
   `const ffttConfig = env.FFTT_APP_ID && env.FFTT_PASSWORD && env.FFTT_SERIE ? { … } : null`.
3. **`routes/joueurs.ts:151-156`** — the Phase 2 / Phase 1 sort is
   `Number(b.lib_equipe.includes("Phase 2")) - Number(a.lib_equipe.includes("Phase 2"))`;
   the current ternary branch + comment is harder to read.
4. **`sync/scheduler.ts:104-110`** `todayAsDDMMYYYY` is two lines with
   `Intl.DateTimeFormat("fr-FR").format(new Date())` (same output).
5. **`routes/criterium.ts:93-115`** — the `tourMap` loop can be
   `Object.values(groupBy(rows, "tour"))`. Add a tiny `groupBy` helper in
   `shared` and reuse across routes.
6. **`web/src/lib/api.ts`** — `request` and `post` differ only in `method`;
   collapse into one function taking an optional `init`.

---

## 6. What this PR changed

All changes are safe-by-construction (validation + headers + non-root
container + error-string truncation + startup-fail in prod). All 199 tests
pass.

| File | Change |
|---|---|
| `packages/api/src/routes/equipes.ts` | 400 on invalid `:id`, `:rencId` |
| `packages/api/src/routes/criterium.ts` | 400 on invalid `:tour` (tightened) |
| `packages/api/src/sync/scheduler.ts` | sanitise error messages written to `sync_status` |
| `packages/api/src/index.ts` | throw in prod without `SYNC_TRIGGER_TOKEN` |
| `packages/api/src/__tests__/routes/equipes.test.ts` | +3 tests for the new 400 paths |
| `nginx.conf` | CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, `server_tokens off` |
| `Dockerfile` | API stage runs as `node` (non-root) |
| `.gitignore` | `.env.*` except `.env.example` |

## 7. Recommended next PRs (in order)

1. **Rotate FFTT credentials + purge from git history.** (P0, you / ops.)
2. **Batch the N+1 fan-out in `/api/equipes` and `/api/criterium/tours/:tour`.** Biggest perf win, self-contained.
3. **Add `@hono/zod-validator` + migrate routes.** Paves the way for
   removing manual parseInt checks.
4. **Replace `SyncDb = any` with the real Drizzle type + fix any fallout.**
5. **Add one `pg-mem` integration test per route** to harden against mock
   drift.
6. **Extract services/repositories layer.** Biggest refactor; do last.

