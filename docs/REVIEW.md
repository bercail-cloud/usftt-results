# Codebase Review — May 2026

A consolidated review of `usftt-results`: security, code quality, design,
tests, and simplification. Findings are grouped by severity with concrete
file:line references and proposed fixes.

This document is intended to be read once, then turned into one issue or
PR per finding. None of the changes proposed here have been applied (with
the single exception of adding `.env.development` to `.gitignore`, which is
included in this PR because it is urgent and safe).

> **Note on a Critical-flagged finding that did not survive verification.**
> An earlier pass flagged `packages/api/src/sync/sync-criterium.ts:435` as a
> SQL injection (`sql\`... LIKE ${"%" + clubNom + "%"}\``). On verification,
> Drizzle's `sql` template tag parameterizes `${...}` interpolations as bound
> parameters — it is **not** vulnerable. It is, however, slightly cleaner to
> use `like()` from `drizzle-orm`; flagged below as a P3 simplification.

---

## 1. Executive summary

| Category | Count | Top item |
|----|---|---|
| Security — High | 4 | Real-looking FFTT credentials committed in `.env.development` |
| Security — Medium | 4 | CORS defaults to `*`, no rate limiting, no security headers |
| Code quality — P0/P1 | 6 | `type SyncDb = any`; N+1 queries in 3 routes; in-memory join in `/joueurs/:licence/equipes` |
| Tests — gaps | 8 | `routes/joueurs.ts` and `routes/criterium.ts` have **zero** tests; `fftt/client.ts` untested |
| Design proposals | 6 | Service layer; batch query helper; structured errors; advisory locks |

**Recommended order of work**

1. Rotate the FFTT credentials that were committed (urgent, external).
2. Make `SYNC_TRIGGER_TOKEN` mandatory and tighten CORS — both 1-line changes.
3. Add tests for the two completely untested route files.
4. Replace `type SyncDb = any` with the inferred Drizzle DB type.
5. Fix the three N+1 query sites.
6. Tackle the larger design proposals (service layer, advisory locks).

---

## 2. Security review

### 2.1 High

**S-H1. Real credentials committed to `.env.development`**
- File: `.env.development` (introduced in commit `10d9d62`, still on `main`)
- Contents: `FFTT_APP_ID=SX014`, `FFTT_PASSWORD=h62F6JzYtA`, `FFTT_SERIE=6Y0N0LGK44BFM7Z`.
- This file is **not** in `.gitignore` (only bare `.env` is).
- Action:
  1. Treat these as compromised. Rotate via FFTT.
  2. Add `.env.development` and `.env.local` to `.gitignore` (this PR does it).
  3. Purge from history if the repo is/was public (`git filter-repo`), then force-push (coordinate with the team — destructive).

**S-H2. `SYNC_TRIGGER_TOKEN` is optional, so sync endpoints can be unauthenticated**
- File: `packages/api/src/routes/system.ts:46-54`
  ```ts
  if (triggerToken) {
    // ...timing-safe check...
  }
  ```
  When `triggerToken` is unset, the entire auth check is skipped and the
  warning at `index.ts:43-47` is the only signal.
- Risk: anyone who can reach the API can trigger expensive 15-minute syncs
  (DoS, cost) and side-effect inserts into the DB.
- Fix: make the token mandatory in production:
  ```ts
  if (!triggerToken) return c.json({ error: "sync trigger disabled" }, 503);
  const header = c.req.header("authorization") ?? "";
  // ...rest unchanged
  ```
  Combined with `env.ts`, you can require it when `NODE_ENV === "production"`.

**S-H3. CORS defaults to `*` when `ALLOWED_ORIGINS` is unset**
- File: `packages/api/src/index.ts:25-34`
  ```ts
  origin: allowedOrigins ?? "*",
  ```
- Risk: opens the API to any origin. Combined with S-H2, this means any
  malicious site visited by an admin could trigger a sync.
- Fix: fail closed. `ALLOWED_ORIGINS` should be required in production
  (move it from `.optional()` to validated-when-prod in `env.ts`).

**S-H4. Public read endpoints have no rate limiting**
- File: `packages/api/src/index.ts` (no rate-limit middleware registered)
- Several read endpoints load whole tables into memory (see Q-P0-1, Q-P0-3).
  A few thousand requests per minute would exhaust DB connections.
- Fix: add `hono-rate-limiter` or equivalent, e.g. 60 req/min/IP for `/api/*`,
  10 req/min/IP for `/api/sync/*`.

### 2.2 Medium

**S-M1. No HTTP security headers on API or web tier**
- API: `packages/api/src/index.ts` registers `cors` only.
- Web: `nginx.conf:1-24` sets cache headers but no `X-Content-Type-Options`,
  `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`,
  or `Content-Security-Policy`.
- Fix (API): one Hono middleware setting `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- Fix (nginx): add `add_header Strict-Transport-Security "max-age=63072000"
  always;` and the same headers in `nginx.conf`.

**S-M2. Sync trigger has TOCTOU + relies only on in-process state**
- File: `packages/api/src/routes/system.ts:78-93`
- The `activeSyncs` Set + `syncStartedAt` Map are **per-process**. If the
  API runs in 2+ replicas, concurrent syncs can run on separate replicas;
  if a replica restarts mid-sync, the next replica starts duplicate work.
  Cron in `scheduler.ts` shares no state with manual triggers.
- Fix: use a Postgres advisory lock — see design proposal D-3.

**S-M3. XML parser has no input size limit**
- File: `packages/api/src/fftt/xml-parser.ts:3-6`
- `fast-xml-parser` defaults are XXE-safe (no entity expansion), so no
  billion-laughs concern. But a malicious upstream could still return a
  multi-GB body and OOM the API. Combined with the 30s `fetch` timeout,
  this is bounded but not capped.
- Fix: cap the response body in `fetchFftt` (e.g., reject if
  `Content-Length > 10 MB`, or stream and cut off at N bytes).

**S-M4. Logs may leak full FFTT URLs (incl. auth token) in error paths**
- File: `packages/api/src/fftt/client.ts:44`
  `throw new Error(\`FFTT API error: ${response.status} ${response.statusText}\`)`
  is fine, but a few `console.error` sites in `sync-*.ts` log the raw error
  object which can include the URL with the time-based token.
- Fix: redact `tm=` query param before logging; or only log endpoint name +
  status in client.ts and let callers add structured context.

### 2.3 Low / informational

- **S-L1.** `parseInt(c.req.param("id"), 10)` returns `NaN` on garbage in
  `routes/equipes.ts:113,140` and `routes/criterium.ts:121,323`. Some
  branches handle it (e.g. `criterium.ts:326`), others silently `eq(...,
  NaN)` and return empty rows. Add a `Number.isNaN` check in each route
  with a 400 response.
- **S-L2.** `routes/joueurs.ts:178` accepts `epreuve` query param and uses
  it as `===` filter only (no SQL). Safe today, but should be validated
  with zod alongside any future query params.
- **S-L3.** Pin GitHub Actions versions. `.github/workflows/*` use
  `actions/checkout@v5` etc. — pin to commit SHAs for supply-chain
  hygiene.

---

## 3. Code quality / architecture

### 3.1 P0 — Correctness & type safety

**Q-P0-1. `export type SyncDb = any` defeats Drizzle's type inference**
- File: `packages/api/src/sync/sync-equipes.ts:13`
- Used everywhere as the DB parameter type in sync code, in routes
  (`system.ts:62`), and in tests. Any column rename will only fail at
  runtime.
- Fix: replace with the inferred type:
  ```ts
  import type { db } from "../db/connection.js";
  export type SyncDb = typeof db;
  ```
  And drop the `as SyncDb` cast on `system.ts:62`.

**Q-P0-2. N+1 in `/equipes`**
- File: `packages/api/src/routes/equipes.ts:61-80`
- `Promise.all(equipesRows.map(async (equipe) => { ... await db.select()
  .from(classements_poule).where(eq(equipe_id, equipe.id)); await
  db.select().from(rencontres).where(...); }))` fires `2 × N` queries
  for `N` equipes.
- Fix:
  ```ts
  const ids = equipesRows.map(e => e.id);
  const [classements, rencs] = await Promise.all([
    db.select().from(classements_poule).where(inArray(classements_poule.equipe_id, ids)),
    db.select().from(rencontres).where(inArray(rencontres.equipe_id, ids)),
  ]);
  const classByEq = groupBy(classements, "equipe_id");
  const rencByEq = groupBy(rencs, "equipe_id");
  ```

**Q-P0-3. N+1 in `/criterium/tours/:tour`**
- File: `packages/api/src/routes/criterium.ts:173-242`
- One `criterium_parties` query and one `parties_individuelles` query
  per player.
- Fix: pre-load both tables once for all relevant `criterium_tour_id`s
  / `licence`s, then group by key. Same pattern as Q-P0-2.

### 3.2 P1 — Hot paths & maintainability

**Q-P1-1. In-memory full-table scan in `/joueurs/:licence/equipes`**
- File: `packages/api/src/routes/joueurs.ts:99-136`
- Loads **all** equipes, **all** rencontres, **all** parties_rencontre
  into memory then filters in JS. Will not scale and disables index use.
- Fix: push the join down to SQL. With proper indexes
  (`parties_rencontre.rencontre_id`, `rencontres.equipe_id`),
  one JOIN replaces the three full scans:
  ```sql
  SELECT pr.*, r.equipe_id
  FROM parties_rencontre pr
  JOIN rencontres r ON r.id = pr.rencontre_id
  WHERE
    (UPPER(pr.joueur_a) LIKE :nom || ' %' OR ...)
    AND pr.joueur_a NOT LIKE '% et %'
    AND pr.joueur_b NOT LIKE '% et %';
  ```

**Q-P1-2. `routes/criterium.ts` is 550 lines and mixes layers**
- File: `packages/api/src/routes/criterium.ts`
- The `/criterium/tours/:tour` handler does query orchestration, name
  matching, deduplication of pool vs elimination matches, and shaping —
  all inline. The `nameMatches`, `buildElimMatchBag`, and
  `isCriteriumEpreuve` helpers are pure but live next to HTTP code.
- Fix: extract `services/criterium.ts` exposing
  `getTourSummaries`, `getTourPlayerResults`, `getPlayerDetail`. Routes
  become thin adapters. See D-1.

**Q-P1-3. Idempotency / partial-failure recovery in syncs**
- File: `packages/api/src/sync/sync-criterium.ts` (450 lines, multi-stage)
- Most writes use `onConflictDoUpdate` (good), but the cleanup step at
  lines 427-446 deletes tours where no club entry exists. If a sync
  fails mid-way, half the tours have data and the cleanup may delete
  legitimately empty new tours.
- Fix: wrap cleanup behind a "fully completed" flag, or only delete
  tours that were not touched in the current run (track touched ids in
  a Set during the sync).

**Q-P1-4. Rate-limiter shared module-level state in `fftt/client.ts`**
- File: `packages/api/src/fftt/client.ts:6` (`let lastCallTime = 0;`)
- Module global → not testable, not concurrent-safe across hypothetical
  workers. Shared between sync runs (which is fine), but breaks tests
  that mock `Date.now`.
- Fix: encapsulate in a small `RateLimiter` class instantiated per
  client (or accept it as DI in `fetchFftt`).

### 3.3 P2 — Smells

- **Q-P2-1.** `key={idx}` in `packages/web/src/pages/CriteriumDetail.tsx`
  (line ~169 and ~222 per review). Use a stable composite key
  (`${match.adversaire}-${match.date}`) so React reconciliation works
  on filter/sort.
- **Q-P2-2.** Hardcoded club constants duplicated:
  `routes/criterium.ts:12-13` and `pages/EquipeDetail.tsx`. Move to
  `packages/shared/src/constants.ts` and import on both sides.
- **Q-P2-3.** `routes/criterium.ts:212-220` mutates `elimMatchBag` inside
  `Array.filter` — works because filter is sequential, but it's a
  subtle pattern. Refactor to an explicit `for` loop, or make a
  copy of the bag at function start.
- **Q-P2-4.** `routes/joueurs.ts:90-97` — `isPlayerMatch` is closed over
  request-scoped state (`joueurNom`, `joueurPrenom`, `joueurClt`).
  Fine, but should be a top-level pure function taking those as args
  for testability.
- **Q-P2-5.** `routes/equipes.ts:14-36` — `parseCompetitionLevel`
  uses regex with `\b` which doesn't behave as expected with accented
  characters. Add tests for `Régionale`, `Départementale 1`, etc.

### 3.4 P3 — Polish

- **Q-P3-1.** Inconsistent error envelope: most routes return
  `{ error: "..." }`, some return `{ message: "..." }`
  (`system.ts:95`). Pick one shape and a `code` field.
- **Q-P3-2.** Dead-ish `as unknown as Record<string, unknown>` casts
  throughout `xml-parser.ts`. A single typed wrapper (or `valibot`
  schema per endpoint) would remove all of them.
- **Q-P3-3.** `routes/criterium.ts:119` — comment "Bug #1 fix",
  "Bug #4 fix" reference issues that aren't visible in the codebase.
  Move context to the PR description and remove the inline labels.

### 3.5 Schema & indexes

Read of `packages/api/src/db/schema.ts` against query patterns:

- `parties_individuelles`: queried by `(licence, date_partie)` and by
  `(licence, epreuve)` — neither indexed. Only the implicit primary key
  exists. **Add** indexes on `(licence, date_partie)` and `epreuve`.
- `parties_rencontre`: queried by `rencontre_id` heavily — no index
  beyond the FK constraint (Postgres does not auto-index FKs). **Add**
  index on `rencontre_id`.
- `rencontres`: queried by `equipe_id` heavily — same. **Add** index
  on `equipe_id`.
- `criterium_classement`: queried by `(criterium_tour_id, club LIKE)` —
  add index on `criterium_tour_id` (FK, so add explicitly).

These are all low-risk additions; ship as a single migration.

---

## 4. Test audit

### 4.1 Coverage gaps

Files with **no** tests at all:

- `packages/api/src/routes/joueurs.ts` (193 lines)
- `packages/api/src/routes/criterium.ts` (550 lines — most complex route)
- `packages/api/src/fftt/client.ts` (timeout, encoding fallback, rate
  limit untested)
- `packages/api/src/db/connection.ts` (1 line — fine to skip)
- `packages/web/src/pages/{Sync,EquipeDetail,CriteriumDetail,ProgressionDetail}.tsx`
- `packages/web/src/hooks/{use-equipes,use-criterium,use-joueurs}.ts`
- `packages/web/src/lib/api.ts`
- `packages/web/src/components/{DivisionBadge,EmptyState,RankCircle,LoadingSkeleton}.tsx`

Files with thin / happy-path-only tests:

- `packages/api/src/sync/sync-parties.ts` — `estimatePoints` is well
  tested (~60 cases) but `syncPartiesMysql/Spid` only cover the happy
  path. No malformed score, no API failure, no FK violation.
- `packages/api/src/sync/sync-criterium.ts` — 450 LOC, ~7 KB of tests.
  Multi-stage: no test for partial failure or idempotent re-run.
- `packages/api/src/routes/equipes.test.ts` over-mocks (see 4.2).
- `packages/api/src/routes/system.ts` — no test for 401, 503, 409
  branches, no concurrency test.

### 4.2 Quality issues

- **T-Q1.** `equipes.test.ts:63-82` — mock chains keyed on a `callCount`
  variable. The test asserts based on the order routes happen to call
  `db.select()` today. Refactor the route's query order and the test
  breaks for non-functional reasons. Replace with a per-table mock
  (a `makeMockDb({ equipes: [...], rencontres: [...] })` helper).
- **T-Q2.** `fftt/client.ts` uses module-level `lastCallTime` and real
  `setTimeout`. Tests can't drive its timing. Use `vi.useFakeTimers()`
  and DI the clock, or refactor as in Q-P1-4.
- **T-Q3.** `scheduler.ts:104-110` (`todayAsDDMMYYYY`) reads `new Date()`
  at call time. `hasMatchToday()` and any test running near a TZ/UTC
  midnight boundary will be flaky. Inject `now` as a parameter.
- **T-Q4.** No coverage thresholds configured in either
  `vitest.config.ts`. CI does not fail on coverage regressions.
- **T-Q5.** Web tests rely heavily on copy (`getByText("Équipe 1")`).
  Brittle to i18n / wording changes. Prefer roles + accessible names,
  fall back to `data-testid` for non-semantic UI.
- **T-Q6.** Several sync tests duplicate the same Drizzle mock chain
  scaffolding (15-50 lines each). Extract a fixture.

### 4.3 Untested edge cases (highest impact)

| # | Where | What to assert |
|---|---|---|
| 1 | `routes/system.ts` | 401 on bad token, 503 on missing config, 409 on already-running, stale-reset on >15 min |
| 2 | `fftt/client.ts` | timeout (AbortError → wrapped error), 5xx response, ISO-8859-1 fallback when UTF-8 decode produces U+FFFD |
| 3 | `sync/sync-parties.ts` | malformed score `"abc"`, FFTT returns empty list, FK violation when licence not in `joueurs` |
| 4 | `sync/sync-criterium.ts` | re-run = no-op (idempotent); partial failure → second run completes |
| 5 | `routes/joueurs.ts:71` (once tests exist) | doubles names (`" et "`) excluded; player matched on points fallback |
| 6 | `routes/criterium.ts:120` (once tests exist) | player in 2 divisions; missing player added from `parties_individuelles`; pool/elim deduplication |

### 4.4 Recommendations (ordered)

1. Add Vitest coverage thresholds in both packages
   (`coverage: { provider: "v8", thresholds: { lines: 70 } }`),
   even if low at first — prevent regressions.
2. Cover `routes/joueurs.ts` and `routes/criterium.ts` (currently 0%).
3. Cover `fftt/client.ts` with `vi.useFakeTimers()` + `fetch` stub.
4. Replace call-count mocks with a `makeMockDb({...})` fixture
   (1 hour, removes ~80 lines of test brittleness).
5. Inject the clock into `scheduler.todayAsDDMMYYYY` and `client.ts`.

---

## 5. Design proposals

Each proposal: motivation, what changes, effort (S ≤ ½ day, M ≤ 3 days,
L ≤ 1+ week).

**D-1. Service layer between routes and Drizzle (M)**

Move read logic out of route handlers into
`packages/api/src/services/{joueurs,equipes,criterium}.ts`. Routes do:
parse params → call service → return JSON. Services are testable
without HTTP.

This unblocks Q-P0-2/3 (batch loading), Q-P1-1 (push joins to SQL),
Q-P1-2 (criterium.ts decomposition), and most of the test gaps in
section 4.

**D-2. `groupBy` / `batchLoad` helper (S)**

A 20-line `packages/api/src/db/batch.ts` that turns
"`inArray(parent_id, ids)` → `Map<id, child[]>`" into one call. Used
everywhere we have parent-child relations.

**D-3. Postgres advisory lock for syncs (M)**

Replace in-memory `activeSyncs`/`syncStartedAt` (`system.ts:12-14`)
with `pg_try_advisory_lock(hash(jobName))`:

```ts
export async function withJobLock<T>(db: SyncDb, name: string, fn: () => Promise<T>) {
  const key = hashString(name); // stable bigint
  const got = await db.execute(sql`SELECT pg_try_advisory_lock(${key}) AS got`);
  if (!got.rows[0].got) throw new ConflictError(`Sync ${name} already running`);
  try { return await fn(); }
  finally { await db.execute(sql`SELECT pg_advisory_unlock(${key})`); }
}
```

Coordinates triggers + cron + multiple replicas; survives restart
(locks are per-session, so an aborted process auto-releases).

**D-4. Structured error class hierarchy + Hono `onError` (S)**

```ts
class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
class NotFound extends HttpError { constructor(m = "not found") { super(404, m); } }
// ...
app.onError((err, c) => err instanceof HttpError
  ? c.json({ error: err.message }, err.status)
  : c.json({ error: "internal" }, 500));
```

Removes scattered `if (rows.length === 0) return c.json(...)` and
unifies the response envelope (Q-P3-1).

**D-5. Zod-validated request schemas (S)**

Wrap each route's params/query in zod (already a dep). Stops S-L1
silent NaNs and gives auto-generated 400 messages.

**D-6. Sync as a job table, not in-memory state (M-L)**

A `sync_jobs` table — `(id, name, status, started_at, finished_at,
error)` — replaces `activeSyncs` and gives the web `/sync` page a
real history. Combine with D-3 for distributed safety.

---

## 6. Code simplification opportunities

Concrete spots where shorter / clearer code is easy:

1. **`fftt/xml-parser.ts`** — every parser repeats
   `toArray(...) → map → getString` boilerplate. A 5-line helper
   `parseList<T>(xml, listKey, itemKey, mapper)` collapses 13 functions
   to 13 one-liners.

2. **`routes/equipes.ts:46-58`** — the `let equipesQuery; if (typeFilter) ... else ...`
   block is `equipesRows = await db.select().from(equipes)
   .where(typeFilter ? eq(...) : undefined)` (Drizzle accepts `undefined`).

3. **`routes/joueurs.ts:34-42`** — the `progression_*` computations
   inline `Math.round(... - ...)` twice. Extract:
   ```ts
   const diff = (a, b) => a != null && b != null ? Math.round(a - b) : null;
   ```

4. **`fftt/client.ts:46-53`** — the UTF-8/ISO-8859-1 dance is OK but
   the `�` heuristic is fragile. Either look at the XML
   declaration, or pass the encoding per endpoint via a small map.

5. **`routes/system.ts:32-37`** — `latestByJob` Map building is one
   `groupBy` call away from being 1 line. Or simply
   `ORDER BY job_name, last_run DESC` + `DISTINCT ON (job_name)` in SQL.

6. **`routes/criterium.ts:30-42`** — `buildElimMatchBag` walks `parties`
   twice (once via `filter`, then via `for...of`). One pass:
   ```ts
   for (const p of parties) {
     const winner = nameMatches(p.vainqueur, playerName);
     const loser = nameMatches(p.perdant, playerName);
     if (!winner && !loser) continue;
     const adv = (winner ? p.perdant : p.vainqueur).toUpperCase();
     const key = `${adv}|${winner ? "V" : "D"}`;
     bag.set(key, (bag.get(key) ?? 0) + 1);
   }
   ```

7. **`sync-criterium.ts:435`** — replace
   `sql\`... LIKE ${"%" + clubNom.toUpperCase() + "%"}\`` with the
   `like()` helper for readability:
   ```ts
   .where(and(
     eq(criterium_classement.criterium_tour_id, tour.id),
     ilike(criterium_classement.club, `%${clubNom}%`),
   ))
   ```
   (Behaviorally equivalent; `ilike` removes the manual `UPPER`.)

---

## 7. Out of scope (not done in this review)

- Frontend bundle / Lighthouse performance audit.
- Accessibility pass beyond a quick scan.
- Postgres `EXPLAIN ANALYZE` on hot queries (would refine 3.5).
- Full dependency CVE audit (`npm audit` should run in CI; not yet).
- License audit of bundled deps.

---

## 8. Changes included in this PR

- `docs/REVIEW.md` — this document.
- `.gitignore` — add `.env.development`, `.env.local`, `.env.*.local` to
  prevent S-H1 from recurring. **Note:** this does not purge the
  already-committed file from history; rotation + history rewrite is
  a separate, coordinated step.

Everything else is left for follow-up issues / PRs so each change can
be reviewed independently.
