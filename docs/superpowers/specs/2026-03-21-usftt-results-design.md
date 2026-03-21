# USFTT Results - Design Specification

## Overview

A responsive web application to display table tennis results for the USFTT club (US Fontenaysienne Tennis de Table, ID `08940073`). Data is sourced from the FFTT Smartping 2.0 API and cached locally in PostgreSQL.

**Target URL**: Deployed on Scaleway VPS alongside existing infrastructure (same pattern as coach-sante).

## Goals

- Display team championship results with consolidated overview and match detail
- Display Criterium Federal results per tour with player detail
- Track individual player progression (ranking history + match results)
- Fully responsive (mobile-first, desktop optimized)
- Automated data sync via cron jobs

## Non-Goals

- User authentication / login
- Data entry or editing
- Results for clubs other than USFTT
- Real-time live scoring
- Historical season browsing (current season only)

## Domain Glossary

- **Phase**: The FFTT season is split into 2 phases (roughly Sept-Dec and Jan-June). Rankings are recalculated at the end of each phase.
- **Tour** (Criterium): The Criterium Federal has 4 tours per season (roughly one per quarter). Each tour is a standalone round-robin competition within a division.
- **Division** (Criterium): Players are grouped by ranking range (Div. 1 = highest, Div. 5+ = lowest). Each division has its own standings per tour.
- **Journee** (Equipes): A round of team matches in the championship calendar. Each phase has typically 7 journees.
- **Poule**: A pool/group of teams competing against each other within a division.

---

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TailwindCSS + React Router + TanStack Query + Recharts |
| UI Generation | Stitch (MCP) for screen generation and design iteration |
| Backend | Node.js + Hono + node-cron |
| Database | PostgreSQL 17 + Drizzle ORM |
| Shared | TypeScript types + Zod schemas |
| Monorepo | Turbo with npm workspaces |
| Deployment | Docker Compose + Traefik (SSL via Let's Encrypt) |
| CI/CD | GitHub Actions (CI on PR, deploy on main push) |

### Project Structure

```
usftt-results/
├── packages/
│   ├── shared/              # Shared types + Zod schemas
│   │   ├── src/
│   │   │   ├── types/       # Joueur, Equipe, Rencontre, Partie, etc.
│   │   │   └── schemas/     # Zod validation schemas
│   │   └── package.json
│   ├── api/                 # Hono backend
│   │   ├── src/
│   │   │   ├── fftt/        # FFTT API client (auth, XML parsing)
│   │   │   ├── db/          # Drizzle schema + migrations
│   │   │   ├── routes/      # REST endpoints
│   │   │   ├── cron/        # Scheduled sync jobs
│   │   │   └── index.ts     # Entry point
│   │   └── package.json
│   └── web/                 # React SPA
│       ├── src/
│       │   ├── pages/       # Equipes, Criterium, Progression
│       │   ├── components/  # Shared UI components
│       │   ├── hooks/       # TanStack Query hooks
│       │   └── lib/         # API client, utils
│       └── package.json
├── docker-compose.yml
├── Dockerfile               # Multi-stage (api + web/nginx targets)
├── nginx.conf
├── turbo.json
└── .github/workflows/
    ├── ci.yml
    └── deploy.yml
```

---

## FFTT API Client

### Authentication

Each request to the Smartping API requires:
- `id`: Application ID (env: `FFTT_APP_ID`)
- `serie`: Unique 15-char user serial (env: `FFTT_SERIE`)
- `tm`: Timestamp in format `YYYYMMDDHHMMSSmmm`
- `tmc`: HMAC-SHA1 of timestamp using MD5 of password as key

```
key = md5(FFTT_PASSWORD)
tmc = hmac_sha1(timestamp, key)  // hex string
```

### API Endpoints Used

| Endpoint | Purpose | Parameters |
|----------|---------|-----------|
| `xml_initialisation` | Verify API access | serie, tm, tmc, id |
| `xml_equipe` | List club teams | numclu=08940073, type |
| `xml_result_equ` | Pool results/standings | D1, cx_poule, action |
| `xml_chp_renc` | Match detail (players, sets) | lien params |
| `xml_liste_joueur` | List club players | club=08940073 |
| `xml_joueur` | Player ranking detail | licence |
| `xml_licence_b` | Player license + ranking | licence or club |
| `xml_partie_mysql` | Player match history | licence |
| `xml_histo_classement` | Ranking history | numlic |
| `xml_epreuve` | List competitions | organisme, type |
| `xml_division` | List divisions | organisme, epreuve, type |
| `xml_res_cla` | Criterium division standings | res_division |

All responses are XML. The client parses XML to typed objects.

---

## Database Schema (PostgreSQL + Drizzle)

### joueurs
| Column | Type | Description |
|--------|------|-------------|
| licence | varchar PK | FFTT license number |
| nom | varchar | Last name |
| prenom | varchar | First name |
| club_numero | varchar | Club ID (08940073) |
| points_officiels | integer | Official ranking points |
| points_mensuels | integer | Monthly ranking points |
| categorie | varchar | Age category |
| rang_departemental | integer | Department rank |
| rang_regional | integer | Regional rank |
| sexe | varchar | M or F |
| updated_at | timestamp | Last sync |

### equipes
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Internal ID |
| lib_equipe | varchar | Team label (USFTT 1, etc.) |
| lib_division | varchar | Division label |
| id_poule | varchar | Pool ID for API calls |
| id_division | varchar | Division ID for API calls |
| id_epreuve | varchar | Competition ID |
| lib_epreuve | varchar | Competition label |
| type_epreuve | varchar | M, F, or other |
| updated_at | timestamp | Last sync |

### classements_poule
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Internal ID |
| equipe_id | integer FK | Which USFTT team's pool this row belongs to (FK to equipes) |
| club_numero | varchar | Club number of this row's team |
| nom_equipe | varchar | Team name in standings |
| position | integer | Rank in pool |
| points | integer | Match points |
| joue | integer | Matches played |
| victoires | integer | Wins |
| defaites | integer | Losses |
| nuls | integer | Draws |
| parties_gagnees | integer | Sets won |
| parties_perdues | integer | Sets lost |
| updated_at | timestamp | Last sync |

### rencontres
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Internal ID |
| equipe_id | integer FK | Reference to equipes |
| libelle | varchar | Round label (Tour, date) |
| equipe_a | varchar | Team A name |
| equipe_b | varchar | Team B name |
| score_a | integer | Team A score (nullable, not yet played) |
| score_b | integer | Team B score (nullable) |
| date_prevue | varchar | Scheduled date |
| date_reelle | varchar | Actual date |
| lien_detail | varchar | Params for xml_chp_renc |
| is_domicile | boolean | Home match for USFTT |
| updated_at | timestamp | Last sync |

### parties_rencontre
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Internal ID |
| rencontre_id | integer FK | Reference to rencontres |
| joueur_a | varchar | Player A name |
| classement_a | varchar | Player A ranking |
| joueur_b | varchar | Player B name |
| classement_b | varchar | Player B ranking |
| score_a | integer | Player A score |
| score_b | integer | Player B score |
| detail_sets | varchar | Set-by-set detail |
| updated_at | timestamp | Last sync |

### parties_individuelles
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Internal ID |
| licence | varchar FK | Player license |
| adversaire_licence | varchar | Opponent license |
| adversaire_nom | varchar | Opponent name |
| adversaire_classement | integer | Opponent ranking |
| victoire | boolean | Win or loss |
| points_resultat | real | Points gained/lost |
| coefficient | real | Competition coefficient |
| date_partie | varchar | Match date |
| epreuve | varchar | Competition name |
| journee | integer | Round number |

### historique_classement
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Internal ID |
| licence | varchar FK | Player license |
| saison | varchar | Season label (2025-2026) |
| phase | integer | Phase (1 or 2) |
| points | integer | Ranking points |

Unique constraint on `(licence, saison, phase)` to prevent duplicates on re-sync.

### criterium_classement
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Internal ID |
| division_id | varchar | Division ID |
| division_libelle | varchar | Division label |
| rang | integer | Rank in division |
| licence | varchar FK | Player license (FK to joueurs, nullable for non-USFTT players) |
| nom | varchar | Player name |
| club | varchar | Club name |
| classement | integer | Player ranking |
| points | integer | Criterium points |
| tour | integer | Tour number (1-4) |
| updated_at | timestamp | Last sync |

### sync_status
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Internal ID |
| job_name | varchar | Sync job identifier |
| last_run | timestamp | Last execution time |
| status | varchar | success, error |
| error_message | text | Error details if failed |

---

## API Routes (Hono)

### Equipes

```
GET /api/equipes
  → All USFTT teams with division, pool standings, and match summaries
  → Response grouped by competition level (Nationale, Regionale, Departementale)
  → Includes journee columns with scores and opponents

GET /api/equipes/:id
  → Team detail: full pool standings + all matches

GET /api/equipes/:id/rencontres/:rencId
  → Match detail: individual games with set scores

```

### Criterium

```
GET /api/criterium/tours
  → List of tours with summary stats (players, global W/L, best performer)

GET /api/criterium/tours/:tour
  → All USFTT players' results for a given tour
  → Includes: division, ranking, W/L record, rank in division, points delta

GET /api/criterium/tours/:tour/joueurs/:licence
  → Player detail for a tour: division standings + individual matches
```

### Progression

```
GET /api/joueurs
  → List of USFTT players with current points

GET /api/joueurs/:licence
  → Player detail: current ranking info

GET /api/joueurs/:licence/progression
  → Ranking history by season/phase (for chart)

GET /api/joueurs/:licence/parties
  → All individual matches with V/D and points
```

### System

```
GET /api/sync/status
  → Last sync timestamps and status per job

GET /api/health
  → Liveness probe for Docker/Traefik health checks
  → Returns 200 with { status: "ok" }
```

---

## Frontend Pages

### Screen Generation with Stitch

All frontend screens are generated using Stitch (MCP tool). The workflow:
1. Create a Stitch project for the USFTT Results app
2. Generate each screen from the design descriptions below using `generate_screen_from_text`
3. Iterate on designs using `generate_variants` until validated
4. Export the validated screens as React/TailwindCSS components to integrate into the `packages/web` codebase

Screens to generate via Stitch:
- Equipes Overview (consolidated table with journees)
- Equipes Detail (pool standings + match detail with sets)
- Criterium Overview (tour tabs + player results table)
- Criterium Detail (division standings + player matches)
- Progression (player selector + chart + matches table)
- Navigation bar (responsive, 3 tabs + hamburger mobile)
- Error/empty/loading states

### Navigation

Top bar with 3 tabs: Equipes | Criterium | Progression. Responsive: hamburger menu on mobile.

### 1. Equipes - Overview (`/equipes`)

- Title "Resultats par equipes" + last sync timestamp
- Filter tabs: Toutes / Masculines / Feminines
- Phase indicator with team count
- Teams grouped by level (Departementale, Regionale, Nationale)
- Table per group:
  - Columns: Equipe (division badge + name), Clt (rank circle, colored), Pts, then one column per journee
  - Journee column: score with V/D indicator + opponent name if played, or home/away icon + opponent if upcoming
- Click row → detail page

### 2. Equipes - Detail (`/equipes/:id`)

- Breadcrumb back to overview
- Team name + division
- Full pool standings table (USFTT row highlighted in blue)
- List of all matches:
  - Score with V/D color
  - Expandable/click to show individual games: player names, rankings, set scores (3-1, etc.), set detail (11-8, 9-11...)

### 3. Criterium - Overview (`/criterium`)

- Title "Criterium Federal" + season + last sync
- Tour tabs (1-4), current/latest tour selected by default
- Summary cards: players engaged, global W/L, best performer
- Results table:
  - Columns: Joueur, Division (colored badge), Classement, Bilan (V/D), Rang (x/n), Points (+/- delta)
- Click row → player detail

### 4. Criterium - Detail (`/criterium/tours/:tour/joueurs/:licence`)

- Breadcrumb back to tour overview
- Player header: name, division, ranking, W/L record, rank
- Division standings table (player highlighted)
- Individual matches list: opponent, ranking, V/D, points gained/lost
- Tour points summary

### 5. Progression (`/progression`)

- Title "Progression individuelle"
- Player selector dropdown (all USFTT players)
- Ranking evolution chart (Recharts line chart):
  - X axis: season + phase
  - Y axis: points
  - Data from historique_classement
- Matches table below:
  - Columns: Date, Adversaire, Classement, Res. (V/D colored), Points (+/- colored)
  - Filterable by competition type

### Design System

- **Style**: Light Minimal (white cards, #f8fafc background, clean typography)
- **Primary color**: #2563eb (blue)
- **Success**: #16a34a (green) for victories
- **Error**: #dc2626 (red) for defeats
- **Text**: #0f172a primary, #64748b secondary, #94a3b8 muted
- **Cards**: white background, 1px #e2e8f0 border, 8-10px border-radius
- **USFTT highlight**: #eff6ff background, #2563eb text
- **Division badges**: color-coded per level (blue, yellow, purple, pink...)
- **Responsive**: mobile-first, single column on small screens, full tables on desktop with horizontal scroll if needed

### Error / Empty States

- **Loading**: Skeleton placeholders matching card layouts
- **No data yet** (first deploy): "Synchronisation en cours, les donnees seront disponibles prochainement"
- **API error**: "Impossible de charger les donnees. Derniere mise a jour: [date]" with cached data if available
- **Empty player history**: "Aucune partie enregistree pour ce joueur"
- **404 / unknown route**: Redirect to /equipes (home page)

---

## Cron Jobs

### Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| sync-full | Daily 8:00, 20:00 | Full sync: teams, matches, players, criterium |
| sync-match-days | Fri 18-23h, Sat 9-20h (hourly) | Teams + matches + match details |
| sync-historique | Monday 6:00 | Player ranking history snapshots |

### Sync Logic

1. **syncEquipes()**: `xml_equipe(numclu=08940073)` → upsert equipes table
2. **syncClassementsPoule()**: For each equipe, `xml_result_equ(action=classement)` → upsert classements_poule
3. **syncRencontres()**: For each equipe, `xml_result_equ` (no action param = returns matches) → upsert rencontres
4. **syncDetailsRencontres()**: For rencontres with lien_detail and score, `xml_chp_renc` → upsert parties_rencontre
5. **syncJoueurs()**: `xml_licence_b(club=08940073)` → upsert joueurs
6. **syncParties()**: For each joueur, `xml_partie_mysql(licence)` → upsert parties_individuelles
7. **syncCriterium()**:
   1. `xml_epreuve(organisme=<dept_id>, type=I)` → find epreuves where `typepreuve=C` (Criterium type)
   2. For each criterium epreuve: `xml_division(organisme, epreuve, type=I)` → get all divisions
   3. For each division: `xml_res_cla(res_division)` → get standings
   4. Store all rows in criterium_classement. Match USFTT players by cross-referencing `nom` with joueurs table to populate `licence` column.
   5. Tour number is derived from the division libelle or epreuve context (e.g., "Criterium Federal Tour 3")
8. **syncHistorique()**: For each joueur, `xml_histo_classement(numlic)` → insert historique_classement (append-only)

### Error Handling

- Each sync job logs status to sync_status table
- On failure: log error, continue with next job (don't block other syncs)
- API rate limiting: sequential calls with 200ms delay between requests

---

## Deployment

### Docker Compose Services

| Service | Image | Port | Network |
|---------|-------|------|---------|
| api | usftt-results-api | 3000 | web, internal |
| web | usftt-results-web (nginx) | 80 | web |
| db | postgres:17-alpine | 5432 | internal |


Note: Traefik is assumed to be already running on the VPS as a shared reverse proxy (same as coach-sante). The docker-compose.yml attaches to the existing external `web` network and uses Traefik labels for routing. No Traefik service in this project's compose file.

### Domain

- `usftt-results.bercail.cloud` (or similar, configured via Traefik labels)
- Automatic HTTPS via Let's Encrypt

### Environment Variables

```
# FFTT API
FFTT_APP_ID=        # Application ID from FFTT convention
FFTT_PASSWORD=      # Password from FFTT convention
FFTT_SERIE=         # 15-char serial

# Club
CLUB_NUMERO=08940073

# Database
DATABASE_URL=postgresql://user:pass@db:5432/usftt

# Deployment
ACME_EMAIL=         # For Let's Encrypt
```

### CI/CD (GitHub Actions)

**CI** (on PR):
- TypeScript typecheck
- ESLint
- Vitest tests
- Build all packages

**Deploy** (on main push):
- Build Docker images (api + web targets)
- Push to GitHub Container Registry
- SSH to VPS: pull, up -d, run migrations, prune

---

## Testing Strategy

- **Unit tests**: FFTT client (XML parsing, auth), sync logic, API routes
- **Integration tests**: Database operations via Drizzle, API endpoints with test DB
- **E2E**: Critical user flows (navigate equipes → detail, criterium → detail, progression chart)
- **Target**: 80%+ coverage
