# USFTT Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive website displaying USFTT table tennis club results (team championships, criterium federal, individual progression) with data sourced from the FFTT Smartping 2.0 API.

**Architecture:** Turbo monorepo with React/Vite/TailwindCSS frontend, Hono API backend with node-cron sync jobs, PostgreSQL/Drizzle database. Deployed via Docker Compose + Traefik on Scaleway VPS. Follows the exact same patterns as the coach-sante project.

**Tech Stack:** React 19, Vite 6, TailwindCSS, React Router 7, TanStack Query, Recharts, Hono 4, Drizzle ORM, PostgreSQL 17, node-cron, Turbo, Docker, GitHub Actions, Stitch (MCP) for UI screen generation.

**Spec:** `docs/superpowers/specs/2026-03-21-usftt-results-design.md`

**Reference project:** `~/Code/github.com/dcuenot/coach-sante/` (same monorepo structure, deployment, CI/CD)

---

## File Map

### Root
- `package.json` — Monorepo root, npm workspaces, turbo scripts
- `turbo.json` — Turbo task config (build, dev, lint, test, typecheck)
- `tsconfig.base.json` — Shared TS compiler options
- `eslint.config.js` — Shared ESLint flat config
- `.gitignore`
- `.env.example` — Template for required env vars
- `docker-compose.yml` — Production services (api, web, postgres)
- `Dockerfile` — Multi-stage build (base → deps → builder → api → web)
- `docker-entrypoint.sh` — Wait for DB + run migrations + start API
- `nginx.conf` — SPA fallback + gzip + cache headers

### packages/shared/
- `package.json` — @usftt/shared package config
- `tsconfig.json` — Extends base tsconfig
- `src/index.ts` — Re-exports all types and schemas
- `src/types/joueur.ts` — Joueur type + Zod schema
- `src/types/equipe.ts` — Equipe, ClassementPoule, Rencontre, PartieRencontre types
- `src/types/criterium.ts` — CriteriumClassement type
- `src/types/progression.ts` — HistoriqueClassement, PartieIndividuelle types
- `src/types/sync.ts` — SyncStatus type
- `src/types/api-responses.ts` — API response envelope types

### packages/api/
- `package.json` — @usftt/api package config
- `tsconfig.json` — Extends base tsconfig
- `vitest.config.ts` — Vitest config (test setup, path aliases)
- `drizzle.config.ts` — Drizzle Kit config for migrations
- `src/index.ts` — Hono app entry point, mount routes, start cron
- `src/env.ts` — Environment variable validation (Zod)
- `src/fftt/auth.ts` — HMAC-SHA1 auth (timestamp, key generation)
- `src/fftt/client.ts` — HTTP client for FFTT API (fetch + auth params)
- `src/fftt/xml-parser.ts` — XML to typed object parsing
- `src/fftt/endpoints.ts` — Typed wrappers per FFTT endpoint
- `src/db/connection.ts` — Drizzle + postgres connection
- `src/db/schema.ts` — All Drizzle table definitions
- `src/db/migrations/` — Generated SQL migrations
- `src/sync/sync-equipes.ts` — Team sync logic
- `src/sync/sync-joueurs.ts` — Player sync logic
- `src/sync/sync-rencontres.ts` — Match sync logic
- `src/sync/sync-criterium.ts` — Criterium sync logic
- `src/sync/sync-historique.ts` — Ranking history sync logic
- `src/sync/sync-parties.ts` — Individual matches sync logic
- `src/sync/scheduler.ts` — node-cron schedule definitions
- `src/routes/equipes.ts` — /api/equipes routes
- `src/routes/criterium.ts` — /api/criterium routes
- `src/routes/joueurs.ts` — /api/joueurs routes
- `src/routes/system.ts` — /api/health + /api/sync/status
- `src/__tests__/fftt/auth.test.ts`
- `src/__tests__/fftt/xml-parser.test.ts`
- `src/__tests__/fftt/endpoints.test.ts`
- `src/__tests__/sync/sync-equipes.test.ts`
- `src/__tests__/sync/sync-joueurs.test.ts`
- `src/__tests__/sync/sync-rencontres.test.ts`
- `src/__tests__/sync/sync-criterium.test.ts`
- `src/__tests__/sync/sync-historique.test.ts`
- `src/__tests__/sync/sync-parties.test.ts`
- `src/__tests__/routes/equipes.test.ts`
- `src/__tests__/routes/criterium.test.ts`
- `src/__tests__/routes/joueurs.test.ts`
- `src/__tests__/routes/system.test.ts`
- `src/__tests__/fixtures/` — Test fixtures (XML samples, DB seed data)
- `scripts/migrate.mjs` — Migration runner for Docker entrypoint

### packages/web/
- `package.json` — @usftt/web package config
- `tsconfig.json` — Extends base tsconfig
- `vite.config.ts` — Vite config with React plugin
- `vitest.config.ts` — Vitest config for component tests
- `tailwind.config.ts` — TailwindCSS config with design system colors
- `index.html` — SPA entry
- `src/index.css` — TailwindCSS imports
- `src/main.tsx` — React root with Router + QueryClient
- `src/App.tsx` — Route definitions
- `src/lib/api.ts` — Fetch wrapper for API calls
- `src/hooks/use-equipes.ts` — TanStack Query hooks for equipes
- `src/hooks/use-criterium.ts` — TanStack Query hooks for criterium
- `src/hooks/use-joueurs.ts` — TanStack Query hooks for progression
- `src/components/NavBar.tsx` — Top navigation (responsive)
- `src/components/ScoreBadge.tsx` — Score display with V/D color
- `src/components/DivisionBadge.tsx` — Colored division badge
- `src/components/RankCircle.tsx` — Colored rank indicator
- `src/components/LoadingSkeleton.tsx` — Loading state placeholder
- `src/components/EmptyState.tsx` — Empty/error state component
- `src/pages/EquipesOverview.tsx` — Consolidated team results
- `src/pages/EquipeDetail.tsx` — Team detail with pool + matches
- `src/pages/CriteriumOverview.tsx` — Criterium tour overview
- `src/pages/CriteriumDetail.tsx` — Player criterium detail
- `src/pages/Progression.tsx` — Individual progression chart + matches
- `src/__tests__/components/NavBar.test.tsx` — NavBar component tests
- `src/__tests__/components/ScoreBadge.test.tsx` — ScoreBadge tests
- `src/__tests__/pages/EquipesOverview.test.tsx` — Equipes page tests
- `src/__tests__/pages/CriteriumOverview.test.tsx` — Criterium page tests
- `src/__tests__/pages/Progression.test.tsx` — Progression page tests

### CI/CD
- `.github/workflows/ci.yml` — PR checks (typecheck, lint, test, build)
- `.github/workflows/deploy.yml` — Build images + deploy to VPS

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.gitignore`, `.env.example`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`, `packages/api/vitest.config.ts`
- Create: `packages/web/package.json`, `packages/web/tsconfig.json`, `packages/web/vitest.config.ts`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/dcuenot/Code/github.com/dcuenot/usftt-results
git init
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "usftt-results",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  },
  "engines": { "node": ">=22" },
  "packageManager": "npm@10.9.2"
}
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: Create tsconfig.base.json**

Copy from coach-sante (ES2022, bundler module resolution, strict mode).

- [ ] **Step 4b: Create eslint.config.js**

ESLint flat config with `@eslint/js` recommended + `typescript-eslint` plugin. Add `eslint` and `typescript-eslint` to root devDependencies.

- [ ] **Step 5: Create .gitignore**

Standard Node.js gitignore + `dist/`, `node_modules/`, `.env`, `.superpowers/`.

- [ ] **Step 6: Create .env.example**

```env
FFTT_APP_ID=
FFTT_PASSWORD=
FFTT_SERIE=
CLUB_NUMERO=08940073
DATABASE_URL=postgresql://usftt:usftt@localhost:5432/usftt
ACME_EMAIL=
```

- [ ] **Step 7: Create packages/shared/ scaffold**

`package.json` as `@usftt/shared` with zod dependency, `tsconfig.json` extending base, empty `src/index.ts`.

- [ ] **Step 8: Create packages/api/ scaffold**

`package.json` as `@usftt/api` with dependencies: `@usftt/shared`, `hono`, `@hono/node-server`, `drizzle-orm`, `postgres`, `node-cron`, `zod`, `fast-xml-parser`. Dev deps: `drizzle-kit`, `tsx`, `vitest`, `@types/node`, `@types/node-cron`. `tsconfig.json` extending base. `vitest.config.ts` with test setup. Empty `src/index.ts`.

- [ ] **Step 9: Create packages/web/ scaffold**

`package.json` as `@usftt/web` with dependencies: `@usftt/shared`, `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `recharts`, `lucide-react`. Dev deps: `@vitejs/plugin-react`, `vite`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@types/react`, `@types/react-dom`. `tsconfig.json` extending base. `vitest.config.ts` with jsdom environment for component tests.

- [ ] **Step 10: Install dependencies and verify**

```bash
npm install
npx turbo run build
```

Expected: All 3 packages build successfully (empty builds).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold turbo monorepo with shared, api, web packages"
```

---

## Task 2: Shared Types and Schemas

**Files:**
- Create: `packages/shared/src/types/joueur.ts`
- Create: `packages/shared/src/types/equipe.ts`
- Create: `packages/shared/src/types/criterium.ts`
- Create: `packages/shared/src/types/progression.ts`
- Create: `packages/shared/src/types/sync.ts`
- Create: `packages/shared/src/types/api-responses.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create joueur types**

File `packages/shared/src/types/joueur.ts`:

```typescript
import { z } from "zod";

export const joueurSchema = z.object({
  licence: z.string(),
  nom: z.string(),
  prenom: z.string(),
  clubNumero: z.string(),
  pointsOfficiels: z.number().nullable(),
  pointsMensuels: z.number().nullable(),
  categorie: z.string().nullable(),
  rangDepartemental: z.number().nullable(),
  rangRegional: z.number().nullable(),
  sexe: z.string(),
});

export type Joueur = z.infer<typeof joueurSchema>;
```

- [ ] **Step 2: Create equipe types**

File `packages/shared/src/types/equipe.ts` with: `Equipe`, `ClassementPoule`, `Rencontre`, `PartieRencontre` types and Zod schemas.

- [ ] **Step 3: Create criterium types**

File `packages/shared/src/types/criterium.ts` with: `CriteriumClassement`, `CriteriumTourSummary` types.

- [ ] **Step 4: Create progression types**

File `packages/shared/src/types/progression.ts` with: `HistoriqueClassement`, `PartieIndividuelle` types.

- [ ] **Step 5: Create sync and API response types**

File `packages/shared/src/types/sync.ts` with `SyncStatus`.
File `packages/shared/src/types/api-responses.ts` with `ApiResponse<T>` envelope.

- [ ] **Step 6: Export all from index.ts**

```typescript
export * from "./types/joueur.js";
export * from "./types/equipe.js";
export * from "./types/criterium.js";
export * from "./types/progression.js";
export * from "./types/sync.js";
export * from "./types/api-responses.js";
```

- [ ] **Step 7: Build and verify**

```bash
npx turbo run build --filter=@usftt/shared
```

Expected: Compiles with no errors, `dist/` output generated.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types and Zod schemas for all domain entities"
```

---

## Task 3: FFTT API Client - Authentication

**Files:**
- Create: `packages/api/src/env.ts`
- Create: `packages/api/src/fftt/auth.ts`
- Test: `packages/api/src/__tests__/fftt/auth.test.ts`

- [ ] **Step 1: Create env validation**

File `packages/api/src/env.ts`:

```typescript
import { z } from "zod";

const envSchema = z.object({
  FFTT_APP_ID: z.string().min(1),
  FFTT_PASSWORD: z.string().min(1),
  FFTT_SERIE: z.string().length(15),
  CLUB_NUMERO: z.string().default("08940073"),
  DATABASE_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 2: Write failing auth tests**

File `packages/api/src/__tests__/fftt/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateTimestamp, generateTmc } from "../../fftt/auth.js";

describe("FFTT Auth", () => {
  it("generates timestamp in YYYYMMDDHHMMSSmmm format", () => {
    const ts = generateTimestamp();
    expect(ts).toMatch(/^\d{17}$/);
  });

  it("generates correct tmc using FFTT spec example", () => {
    // From spec: timestamp=20150611140022081, password=FFTT
    // Expected tmc=517b27013dd619db47f2bf4c50ae504acbb33980
    const tmc = generateTmc("20150611140022081", "FFTT");
    expect(tmc).toBe("517b27013dd619db47f2bf4c50ae504acbb33980");
  });

  it("generates auth params with all required fields", () => {
    // Test that buildAuthParams returns serie, tm, tmc, id
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/api && npx vitest run src/__tests__/fftt/auth.test.ts
```

Expected: FAIL - module not found.

- [ ] **Step 4: Implement auth module**

File `packages/api/src/fftt/auth.ts`:

```typescript
import { createHash, createHmac } from "node:crypto";

export function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len: number) => String(n).padStart(len, "0");
  return (
    pad(now.getFullYear(), 4) +
    pad(now.getMonth() + 1, 2) +
    pad(now.getDate(), 2) +
    pad(now.getHours(), 2) +
    pad(now.getMinutes(), 2) +
    pad(now.getSeconds(), 2) +
    pad(now.getMilliseconds(), 3)
  );
}

export function generateTmc(timestamp: string, password: string): string {
  const key = createHash("md5").update(password).digest("hex");
  return createHmac("sha1", key).update(timestamp).digest("hex");
}

export function buildAuthParams(appId: string, serie: string, password: string) {
  const tm = generateTimestamp();
  const tmc = generateTmc(tm, password);
  return { id: appId, serie, tm, tmc };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/api && npx vitest run src/__tests__/fftt/auth.test.ts
```

Expected: All tests PASS. The spec example (timestamp=20150611140022081, password=FFTT, expected=517b27...) must match exactly.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/env.ts packages/api/src/fftt/auth.ts packages/api/src/__tests__/fftt/auth.test.ts
git commit -m "feat: implement FFTT API HMAC-SHA1 authentication"
```

---

## Task 4: FFTT API Client - XML Parser + HTTP Client

**Files:**
- Create: `packages/api/src/fftt/xml-parser.ts`
- Create: `packages/api/src/fftt/client.ts`
- Create: `packages/api/src/fftt/endpoints.ts`
- Test: `packages/api/src/__tests__/fftt/xml-parser.test.ts`
- Test: `packages/api/src/__tests__/fftt/endpoints.test.ts`

- [ ] **Step 1: Write failing XML parser tests**

Test parsing of real FFTT XML responses for each endpoint type: `<club>`, `<equipe>`, `<tour>`, `<classement>`, `<joueur>`, `<partie>`, `<histo>`. Use inline XML strings as fixtures.

```typescript
describe("XML Parser", () => {
  it("parses equipe list XML", () => {
    const xml = `<?xml version="1.0"?><liste><equipe><libequipe>USFTT 1</libequipe><libdivision>Dept 3</libdivision><liendivision>cx_poule=123&amp;D1=456</liendivision><idepr>789</idepr><libepr>Chp Dept</libepr></equipe></liste>`;
    const result = parseEquipes(xml);
    expect(result).toEqual([{
      libEquipe: "USFTT 1",
      libDivision: "Dept 3",
      lienDivision: "cx_poule=123&D1=456",
      idEpreuve: "789",
      libEpreuve: "Chp Dept",
    }]);
  });
  // ... tests for each XML response type
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement team-related XML parsers**

Use `fast-xml-parser`. Implement: `parseEquipes`, `parseResultEqu` (tours/matches), `parseClassement` (pool standings), `parseChpRenc` (match detail with parties).

- [ ] **Step 4: Run team parser tests to verify they pass**

- [ ] **Step 4b: Implement player-related XML parsers**

Implement: `parseJoueurs`, `parseLicenceB`, `parseParties`, `parseHistorique`.

- [ ] **Step 4c: Implement criterium XML parsers**

Implement: `parseEpreuves`, `parseDivisions`, `parseResCla`.

- [ ] **Step 4d: Run all parser tests to verify they pass**

- [ ] **Step 5: Implement HTTP client**

File `packages/api/src/fftt/client.ts`: Generic `fetchFftt(endpoint, params)` function that adds auth params, makes GET request to `https://www.fftt.com/mobile/pxml/{endpoint}.php`, returns raw XML string. Includes 200ms delay between calls for rate limiting.

- [ ] **Step 6: Implement typed endpoint wrappers**

File `packages/api/src/fftt/endpoints.ts`: One function per FFTT endpoint (e.g., `getEquipes(numclu)`, `getResultEqu(D1, cxPoule, action)`, etc.) that calls `fetchFftt` + parser. Write tests with mocked HTTP client.

- [ ] **Step 7: Run all FFTT tests**

```bash
cd packages/api && npx vitest run src/__tests__/fftt/
```

Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/fftt/ packages/api/src/__tests__/fftt/
git commit -m "feat: implement FFTT API client with XML parsing and typed endpoints"
```

---

## Task 5: Database Schema

**Files:**
- Create: `packages/api/src/db/connection.ts`
- Create: `packages/api/src/db/schema.ts`
- Create: `packages/api/drizzle.config.ts`
- Create: `packages/api/scripts/migrate.mjs`

- [ ] **Step 1: Create database connection**

File `packages/api/src/db/connection.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

- [ ] **Step 2: Create Drizzle schema**

File `packages/api/src/db/schema.ts` with all tables from spec: `joueurs`, `equipes`, `classementsPoule`, `rencontres`, `partiesRencontre`, `partiesIndividuelles`, `historiqueClassement` (with unique constraint on licence+saison+phase), `criteriumClassement`, `syncStatus`.

Use `pgTable` from `drizzle-orm/pg-core`. Define proper types, foreign keys, indexes.

- [ ] **Step 3: Create Drizzle config**

File `packages/api/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 4: Generate initial migration**

```bash
cd packages/api && npx drizzle-kit generate
```

Verify the generated SQL migration creates all tables with correct types.

- [ ] **Step 5: Create migration runner script**

File `packages/api/scripts/migrate.mjs` (same pattern as coach-sante):

```javascript
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
await migrate(db, { migrationsFolder: "./packages/api/src/db/migrations" });
await client.end();
console.log("Migrations complete");
```

- [ ] **Step 6: Test migration locally**

Start a local PostgreSQL (docker run), run migration, verify tables created:

```bash
docker run -d --name usftt-pg -e POSTGRES_USER=usftt -e POSTGRES_PASSWORD=usftt -e POSTGRES_DB=usftt -p 5432:5432 postgres:17-alpine
DATABASE_URL=postgresql://usftt:usftt@localhost:5432/usftt node packages/api/scripts/migrate.mjs
```

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/db/ packages/api/drizzle.config.ts packages/api/scripts/
git commit -m "feat: add Drizzle database schema with all tables and initial migration"
```

---

## Task 6: Sync Jobs - Equipes + Rencontres

**Files:**
- Create: `packages/api/src/sync/sync-equipes.ts`
- Create: `packages/api/src/sync/sync-rencontres.ts`
- Test: `packages/api/src/__tests__/sync/sync-equipes.test.ts`
- Test: `packages/api/src/__tests__/sync/sync-rencontres.test.ts`

- [ ] **Step 1: Write failing sync-equipes tests**

Test that `syncEquipes()` calls `getEquipes(clubNumero)`, parses lienDivision to extract `cx_poule` and `D1`, and upserts into equipes table. Mock the FFTT client and database.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement syncEquipes**

1. Call `getEquipes(numclu=CLUB_NUMERO)` to get team list
2. Parse `liendivision` to extract `cx_poule` and `D1` (id_poule and id_division)
3. Upsert each team into `equipes` table
4. Log sync status

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Write failing syncClassementsPoule tests**

Test that for each equipe, `getResultEqu(D1, cxPoule, action="classement")` is called and results upserted into classements_poule.

- [ ] **Step 6: Implement syncClassementsPoule**

For each equipe, `getResultEqu(D1, cxPoule, action="classement")` → upsert classements_poule. The `equipe_id` FK points to which USFTT team's pool this row belongs to.

- [ ] **Step 7: Run tests, verify pass**

- [ ] **Step 8: Write failing syncRencontres tests**

Test that for each equipe, `getResultEqu(D1, cxPoule)` (no action) is called and rencontres upserted with is_domicile determined.

- [ ] **Step 9: Implement syncRencontres**

For each equipe, `getResultEqu(D1, cxPoule)` (no action) → upsert rencontres. Determine `is_domicile` by checking if equipe_a contains USFTT club name.

- [ ] **Step 10: Run tests, verify pass**

- [ ] **Step 11: Write failing syncDetailsRencontres tests**

Test that for rencontres with lien_detail and non-null scores, `getChpRenc` is called and parties_rencontre upserted.

- [ ] **Step 12: Implement syncDetailsRencontres**

For rencontres with lien_detail and non-null scores, parse lien params and call `getChpRenc(params)` → upsert parties_rencontre.

- [ ] **Step 13: Run all sync tests**

```bash
cd packages/api && npx vitest run src/__tests__/sync/sync-equipes.test.ts src/__tests__/sync/sync-rencontres.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/sync/sync-equipes.ts packages/api/src/sync/sync-rencontres.ts packages/api/src/__tests__/sync/
git commit -m "feat: implement team and match sync jobs"
```

---

## Task 7: Sync Jobs - Joueurs + Parties + Historique

**Files:**
- Create: `packages/api/src/sync/sync-joueurs.ts`
- Create: `packages/api/src/sync/sync-parties.ts`
- Create: `packages/api/src/sync/sync-historique.ts`
- Test: `packages/api/src/__tests__/sync/sync-joueurs.test.ts`
- Test: `packages/api/src/__tests__/sync/sync-parties.test.ts`
- Test: `packages/api/src/__tests__/sync/sync-historique.test.ts`

- [ ] **Step 1: Write failing sync-joueurs tests**

- [ ] **Step 2: Implement syncJoueurs**

Call `getLicenceB(club=CLUB_NUMERO)` → upsert joueurs table with all fields (points, categorie, rang, sexe, etc.).

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Write failing sync-parties tests**

- [ ] **Step 5: Implement syncParties**

For each joueur in DB, call `getPartieMysql(licence)` → upsert parties_individuelles. Include adversaire info, V/D, points_resultat, coefficient, epreuve.

- [ ] **Step 6: Run tests, verify pass**

- [ ] **Step 7: Write failing sync-historique tests**

- [ ] **Step 8: Implement syncHistorique**

For each joueur, call `getHistoClassement(numlic)` → upsert (on conflict licence+saison+phase do nothing) historique_classement.

- [ ] **Step 9: Run all tests**

```bash
cd packages/api && npx vitest run src/__tests__/sync/
```

- [ ] **Step 10: Commit**

```bash
git add packages/api/src/sync/ packages/api/src/__tests__/sync/
git commit -m "feat: implement player, match history, and ranking history sync jobs"
```

---

## Task 8: Sync Jobs - Criterium + Scheduler

**Files:**
- Create: `packages/api/src/sync/sync-criterium.ts`
- Create: `packages/api/src/sync/scheduler.ts`
- Test: `packages/api/src/__tests__/sync/sync-criterium.test.ts`

- [ ] **Step 1: Write failing sync-criterium tests**

Test the 5-step chain: find criterium epreuves (typepreuve=C), iterate divisions, get standings, cross-reference with joueurs to populate licence.

- [ ] **Step 2: Implement syncCriterium**

1. `getEpreuves(organisme=deptId, type=I)` → filter where typepreuve === "C"
2. For each criterium epreuve: `getDivisions(organisme, epreuve, type=I)` → get divisions
3. For each division: `getResCla(resDivision)` → get standings
4. Cross-reference `nom` with joueurs table to populate `licence` column for USFTT players
5. Derive tour number from epreuve/division libelle
6. Upsert all rows into criterium_classement

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 3b: Write sync error isolation test**

Test that a failure in one sync function (e.g., syncEquipes throws) does not prevent subsequent sync functions from running. The scheduler's `syncFull` must catch errors per-job and log to sync_status.

- [ ] **Step 4: Implement scheduler**

File `packages/api/src/sync/scheduler.ts`:

```typescript
import cron from "node-cron";

export function startScheduler() {
  // Full sync: 8:00 and 20:00 daily
  cron.schedule("0 8,20 * * *", syncFull);

  // Match day sync: Fri 18-23, Sat 9-20 (hourly)
  cron.schedule("0 18-23 * * 5", syncMatchDay);
  cron.schedule("0 9-20 * * 6", syncMatchDay);

  // Weekly historique: Monday 6:00
  cron.schedule("0 6 * * 1", syncHistoriqueJob);
}
```

Each job function wraps the sync calls in try/catch and logs to sync_status table.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sync/
git commit -m "feat: implement criterium sync and cron scheduler"
```

---

## Task 9a: API Routes - System + Equipes

**Files:**
- Create: `packages/api/src/routes/system.ts`
- Create: `packages/api/src/routes/equipes.ts`
- Create: `packages/api/src/__tests__/fixtures/seed.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/src/__tests__/routes/system.test.ts`
- Test: `packages/api/src/__tests__/routes/equipes.test.ts`

- [ ] **Step 1: Create test fixtures and DB seed helper**

File `packages/api/src/__tests__/fixtures/seed.ts`: Helper functions to insert test data (joueurs, equipes, classements, rencontres, parties) into a test database. Include `seedTestDb()` and `clearTestDb()` functions.

- [ ] **Step 2: Write failing system route tests**

Test `GET /api/health` returns `{ status: "ok" }` and `GET /api/sync/status` returns sync timestamps.

- [ ] **Step 3: Implement system routes**

Health endpoint also calls `xml_initialisation` to verify FFTT API connectivity (optional, graceful degradation if FFTT is down).

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Write failing equipes route tests**

Test:
- `GET /api/equipes` returns teams grouped by level with journee summaries
- `GET /api/equipes?type=M` filters masculine teams only
- `GET /api/equipes/:id` returns pool standings + matches
- `GET /api/equipes/:id/rencontres/:rencId` returns match detail with parties

Use `seedTestDb()` to populate test data.

- [ ] **Step 5: Implement equipes routes**

Queries: join equipes → classements_poule, rencontres, parties_rencontre. Group by division level (parse from lib_division: Nationale/Regionale/Departementale). Support `?type=M|F` filter.

- [ ] **Step 6: Run tests, verify pass**

- [ ] **Step 7: Write failing criterium route tests**

Test:
- `GET /api/criterium/tours` returns tour summaries with stats
- `GET /api/criterium/tours/:tour` returns USFTT player results
- `GET /api/criterium/tours/:tour/joueurs/:licence` returns player detail + division standings

- [ ] **Step 8: Implement criterium routes**

Query criterium_classement filtered by tour and USFTT players (licence IS NOT NULL or club contains USFTT). Compute W/L from parties_individuelles filtered by criterium epreuve.

- [ ] **Step 9: Run tests, verify pass**

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/routes/system.ts packages/api/src/routes/equipes.ts packages/api/src/routes/criterium.ts packages/api/src/__tests__/
git commit -m "feat: implement system, equipes, and criterium API routes"
```

---

## Task 9b: API Routes - Joueurs + App Wiring

**Files:**
- Create: `packages/api/src/routes/joueurs.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/src/__tests__/routes/joueurs.test.ts`

- [ ] **Step 1: Write failing joueurs route tests**

Test:
- `GET /api/joueurs` returns player list with current points
- `GET /api/joueurs/:licence` returns player detail (current ranking info)
- `GET /api/joueurs/:licence/progression` returns historique sorted by saison+phase
- `GET /api/joueurs/:licence/parties` returns individual matches with V/D and points

- [ ] **Step 2: Implement joueurs routes**

Include `GET /api/joueurs/:licence` for individual player detail (points, rang, categorie).

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Wire up Hono app entry point**

File `packages/api/src/index.ts`: Create Hono app, mount all route groups, add CORS middleware, start server on port 3000, start scheduler.

- [ ] **Step 5: Run all API tests**

```bash
cd packages/api && npx vitest run
```

Expected: All PASS with 80%+ coverage.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/joueurs.ts packages/api/src/index.ts packages/api/src/__tests__/routes/joueurs.test.ts
git commit -m "feat: implement joueurs API routes and wire up Hono app"
```

---

## Task 10: Frontend Scaffold + Design System

**Files:**
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/tailwind.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/index.css`
- Create: `packages/web/src/lib/api.ts`

- [ ] **Step 1: Create Vite config**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://localhost:3000" } },
});
```

- [ ] **Step 2: Create TailwindCSS config with design system**

Extend theme with USFTT colors: primary (#2563eb), success (#16a34a), error (#dc2626), backgrounds, text shades.

- [ ] **Step 3: Create index.html + main.tsx + App.tsx**

Set up React root with `BrowserRouter`, `QueryClientProvider`, and route definitions:
- `/` and `/equipes` → EquipesOverview
- `/equipes/:id` → EquipeDetail
- `/criterium` → CriteriumOverview
- `/criterium/tours/:tour/joueurs/:licence` → CriteriumDetail
- `/progression` → Progression
- `*` → redirect to `/equipes`

- [ ] **Step 4: Create API client**

File `packages/web/src/lib/api.ts`: typed fetch wrapper that hits `/api/*` endpoints and returns typed responses.

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev --filter=@usftt/web
```

Expected: Vite starts, blank page loads at localhost:5173.

- [ ] **Step 6: Commit**

```bash
git add packages/web/
git commit -m "feat: scaffold React frontend with Vite, TailwindCSS, routing"
```

---

## Task 11: Frontend - Shared Components

**Files:**
- Create: `packages/web/src/components/NavBar.tsx`
- Create: `packages/web/src/components/ScoreBadge.tsx`
- Create: `packages/web/src/components/DivisionBadge.tsx`
- Create: `packages/web/src/components/RankCircle.tsx`
- Create: `packages/web/src/components/LoadingSkeleton.tsx`
- Create: `packages/web/src/components/EmptyState.tsx`

- [ ] **Step 1: Generate screens via Stitch**

Use Stitch MCP to create a project and generate the shared components:
- NavBar (responsive, 3 tabs, hamburger mobile)
- ScoreBadge (green for victory, red for defeat)
- DivisionBadge (colored by level)
- RankCircle (colored rank indicator)
- LoadingSkeleton
- EmptyState

```
mcp__stitch__create_project → project for USFTT Results
mcp__stitch__generate_screen_from_text → each component
```

- [ ] **Step 2: Integrate Stitch output into components**

Adapt generated code to use TailwindCSS classes and the design system colors. Wire NavBar to React Router `NavLink`.

- [ ] **Step 3: Write component tests**

File `packages/web/src/__tests__/components/NavBar.test.tsx`: Test NavBar renders 3 navigation links, highlights active route. Use `@testing-library/react` with `MemoryRouter`.

File `packages/web/src/__tests__/components/ScoreBadge.test.tsx`: Test ScoreBadge renders green for victory, red for defeat, displays correct score.

- [ ] **Step 4: Run tests, verify pass**

```bash
cd packages/web && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/ packages/web/src/__tests__/
git commit -m "feat: add shared UI components (NavBar, ScoreBadge, DivisionBadge, etc.)"
```

---

## Task 12: Frontend - Equipes Pages

**Files:**
- Create: `packages/web/src/hooks/use-equipes.ts`
- Create: `packages/web/src/pages/EquipesOverview.tsx`
- Create: `packages/web/src/pages/EquipeDetail.tsx`

- [ ] **Step 1: Create TanStack Query hooks**

File `packages/web/src/hooks/use-equipes.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useEquipes(type?: string) {
  return useQuery({
    queryKey: ["equipes", type],
    queryFn: () => api.get(`/api/equipes${type ? `?type=${type}` : ""}`),
  });
}

export function useEquipeDetail(id: string) {
  return useQuery({
    queryKey: ["equipes", id],
    queryFn: () => api.get(`/api/equipes/${id}`),
  });
}

export function useRencontreDetail(equipeId: string, rencId: string) {
  return useQuery({
    queryKey: ["rencontre", equipeId, rencId],
    queryFn: () => api.get(`/api/equipes/${equipeId}/rencontres/${rencId}`),
  });
}
```

- [ ] **Step 2: Generate EquipesOverview via Stitch**

Use `mcp__stitch__generate_screen_from_text` with description: "Table tennis team results overview page. Light minimal style (#f8fafc background). Title 'Resultats par equipes' with last update timestamp. Filter tabs (Toutes/Masculines/Feminines). Phase indicator. Teams grouped by level (Departementale, Regionale, Nationale) in white cards. Each card has a table with columns: division badge + team name, rank circle, points, then journee columns showing scores (green check + score for victory, red X + score for defeat) with opponent name below. Rows are clickable."

- [ ] **Step 3: Implement EquipesOverview**

Integrate Stitch output with hooks. Handle loading/empty states. Wire click to navigate to `/equipes/:id`.

- [ ] **Step 4: Generate EquipeDetail via Stitch**

Description: "Team detail page. Breadcrumb back. Team name + division. Pool standings table with USFTT row highlighted in blue (#eff6ff). List of matches with expandable detail showing individual games: player names with rankings, set scores (3-1), set detail (11-8 9-11...)."

- [ ] **Step 5: Implement EquipeDetail**

Integrate with hooks. Handle match detail expand/collapse.

- [ ] **Step 6: Write page tests**

File `packages/web/src/__tests__/pages/EquipesOverview.test.tsx`: Test that overview renders team groups, filter tabs work, loading state shows skeleton. Mock API responses with `msw` or TanStack Query test utils.

- [ ] **Step 7: Run tests, verify pass**

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/hooks/use-equipes.ts packages/web/src/pages/Equipes* packages/web/src/__tests__/pages/
git commit -m "feat: implement Equipes overview and detail pages"
```

---

## Task 13: Frontend - Criterium Pages

**Files:**
- Create: `packages/web/src/hooks/use-criterium.ts`
- Create: `packages/web/src/pages/CriteriumOverview.tsx`
- Create: `packages/web/src/pages/CriteriumDetail.tsx`

- [ ] **Step 1: Create TanStack Query hooks**

- [ ] **Step 2: Generate CriteriumOverview via Stitch**

Description: "Criterium Federal overview. Tour tabs (1-4). 3 summary stat cards (players engaged, global W/L, best performer). Results table: joueur name, division badge (colored), classement, bilan (green V / red D), rang (x/n), points with +/- delta colored. Rows clickable."

- [ ] **Step 3: Implement CriteriumOverview**

- [ ] **Step 4: Generate CriteriumDetail via Stitch**

Description: "Player criterium detail. Breadcrumb back. Player header with name, division, ranking, large W/L record, rank. Division standings table with player highlighted. Individual matches list: opponent, ranking, V/D colored, points +/- colored. Tour points summary at bottom."

- [ ] **Step 5: Implement CriteriumDetail**

- [ ] **Step 6: Write page tests**

File `packages/web/src/__tests__/pages/CriteriumOverview.test.tsx`: Test tour tabs switch, summary cards render, player table renders with correct V/D colors.

- [ ] **Step 7: Run tests, verify pass**

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/hooks/use-criterium.ts packages/web/src/pages/Criterium* packages/web/src/__tests__/pages/
git commit -m "feat: implement Criterium overview and detail pages"
```

---

## Task 14: Frontend - Progression Page

**Files:**
- Create: `packages/web/src/hooks/use-joueurs.ts`
- Create: `packages/web/src/pages/Progression.tsx`

- [ ] **Step 1: Create TanStack Query hooks**

Hooks for `useJoueurs()`, `useJoueurProgression(licence)`, `useJoueurParties(licence)`.

- [ ] **Step 2: Generate Progression page via Stitch**

Description: "Individual progression page. Player selector dropdown. Recharts line chart showing ranking points evolution (x: season+phase, y: points). Below: matches table with columns date, adversaire, classement, result (V green / D red), points (+green / -red)."

- [ ] **Step 3: Implement Progression page**

Integrate Recharts `LineChart` with historique data. Wire player selector to update chart + table.

- [ ] **Step 4: Write page tests**

File `packages/web/src/__tests__/pages/Progression.test.tsx`: Test player selector renders, chart renders with mock historique data, matches table shows V/D with correct colors.

- [ ] **Step 5: Run tests, verify pass**

- [ ] **Step 6: Full-stack dev verification**

Run both API and web dev servers together:

```bash
npx turbo run dev
```

Navigate through all pages in browser: equipes overview → click team → see detail → criterium → click player → progression → select player → verify chart. Confirm proxy config works (frontend calls `/api/*` correctly).

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/hooks/use-joueurs.ts packages/web/src/pages/Progression.tsx packages/web/src/__tests__/pages/
git commit -m "feat: implement Progression page with ranking chart and match history"
```

---

## Task 15: Docker + Deployment

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `docker-entrypoint.sh`
- Create: `nginx.conf`

- [ ] **Step 1: Create Dockerfile**

Multi-stage build matching coach-sante pattern:
1. `base` — node:22-alpine
2. `deps` — production npm ci
3. `builder` — full npm ci + turbo build (with `VITE_API_URL` build arg)
4. `api` — production node_modules + built output + migrations + entrypoint
5. `web` — nginx:alpine + built SPA

- [ ] **Step 2: Create docker-entrypoint.sh**

Wait for PostgreSQL (netcat loop), run migrations, start API server.

- [ ] **Step 3: Create nginx.conf**

SPA fallback, gzip, cache headers for hashed assets (same as coach-sante).

- [ ] **Step 4: Create docker-compose.yml**

Services: api, web, postgres. Use external `web` network for Traefik. Traefik labels for `usftt-results.bercail.cloud` (api) and `resultats.usftt.org` (web). Internal network for postgres.

- [ ] **Step 5: Test Docker build locally**

```bash
docker build --target api -t usftt-api .
docker build --target web -t usftt-web --build-arg VITE_API_URL=http://localhost:3000 .
docker compose up -d
```

Verify: API responds at localhost:3000/api/health, Web serves at localhost:80.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml docker-entrypoint.sh nginx.conf
git commit -m "feat: add Docker multi-stage build and Compose for production deployment"
```

---

## Task 16: CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create CI workflow**

Triggers on PR. Steps: checkout, setup node 22, npm ci, turbo typecheck, lint, test, build.

- [ ] **Step 2: Create deploy workflow**

Triggers on main push. Jobs:
1. CI (same steps)
2. Build & push images to ghcr.io (api + web targets)
3. Deploy: SCP docker-compose.yml to VPS, SSH pull + up -d + migrate + prune

Follow exact same pattern as coach-sante `deploy.yml`.

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add CI and deploy workflows for GitHub Actions"
```

---

## Task 17: Integration Test + Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```

Expected: All tests pass, 80%+ coverage.

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Expected: All packages build successfully.

- [ ] **Step 3: Run Docker build**

```bash
docker build --target api -t usftt-api .
docker build --target web -t usftt-web --build-arg VITE_API_URL=http://localhost:3000 .
```

Expected: Both images build successfully.

- [ ] **Step 4: End-to-end smoke test**

Start docker-compose locally, seed database with a manual sync, navigate through all pages in browser.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "test: add integration tests and verify full build pipeline"
git push -u origin main
```

---

## Dependency Graph

```
Task 1 (Scaffold + ESLint + Vitest configs)
  ├── Task 2 (Shared Types)
  │     ├── Task 3 (FFTT Auth)
  │     │     └── Task 4 (FFTT Client + Parser)
  │     │           ├── Task 6 (Sync Equipes/Rencontres) ← also depends on Task 5
  │     │           ├── Task 7 (Sync Joueurs/Parties/Historique) ← also depends on Task 5
  │     │           └── Task 8 (Sync Criterium + Scheduler) ← also depends on Task 5
  │     └── Task 5 (DB Schema)
  │
  ├── Task 9a (API Routes - System + Equipes) ← depends on Tasks 5-8
  │     └── Task 9b (API Routes - Joueurs + Wiring)
  │
  └── Task 10 (Frontend Scaffold)
        └── Task 11 (Shared Components + Tests)
              ├── Task 12 (Equipes Pages + Tests) ← depends on Task 9a for API contract
              ├── Task 13 (Criterium Pages + Tests) ← depends on Task 9a for API contract
              └── Task 14 (Progression Page + Tests + Full-stack verify) ← depends on Task 9b

Task 15 (Docker) ← depends on Tasks 9b, 14
  └── Task 16 (CI/CD)
        └── Task 17 (Final Verification)
```

**Parallelizable groups:**
- After Task 2: Tasks 3-4 (backend) can run in parallel with Task 10 (frontend scaffold)
- After Task 4+5: Tasks 6, 7, 8 can run in parallel
- After Task 11 + Task 9a: Tasks 12, 13, 14 can run in parallel
- Tasks 10-11 can start as soon as Task 1 is done (independent of backend tasks)
