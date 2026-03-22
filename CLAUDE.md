# Project Rules

## Database Migrations

NEVER write migration SQL files manually. Always use `drizzle-kit generate`:

```bash
cd packages/api && DATABASE_URL=postgresql://usftt:usftt@localhost:5433/usftt npx drizzle-kit generate
```

If the command requires interactive prompts (TTY), ask the user to run it in their terminal:
```
! cd packages/api && DATABASE_URL=postgresql://usftt:usftt@localhost:5433/usftt npx drizzle-kit generate
```

After generating, verify the migration file AND the `meta/_journal.json` entry were created.

After generating, apply locally:
```bash
DATABASE_URL=postgresql://usftt:usftt@localhost:5433/usftt node packages/api/scripts/migrate.mjs
```

The docker-entrypoint.sh runs migrations automatically on deploy. If a migration is missing from the journal, the production DB will be out of sync.

## Local Development

- Start: `./scripts/dev.sh`
- Frontend: http://localhost:5180
- API: http://localhost:3010
- DB: PostgreSQL on port 5433 (docker container `usftt-pg`)

## Sync Scripts

- Full sync: `npx tsx packages/api/scripts/test-sync.mts [equipes|joueurs|historique|parties|criterium]`
- Sync match details: `npx tsx packages/api/scripts/sync-details.mts`
- Run from project root with env vars from `.env.development`

## FFTT API

- Encoding: ISO-8859-1 (handled in client.ts)
- Rate limiting: 200ms between calls
- Club: FONTENAYSIENNE Union Sportive TT (ID 08940073)
- Club matching string: "FONTENAYSIENNE" (not "FONTENAY" to avoid Fontenay-Tresigny)
- FFTT API can invert equipe sides between xml_result_equ and xml_chp_renc - store detail_equa/equb
- Domicile: determined from equipe_a position (equipe_a = home team), NOT from is_domicile field

## Deployment

- VPS: deploy@bercail.cloud
- Frontend: usftt-results.bercail.cloud
- API: api.usftt-results.bercail.cloud
- Deploy: automatic on push to main via GitHub Actions
