// Provides safe defaults for env validation so tests can import modules that
// transitively load src/env.ts. The DATABASE_URL value is never connected to;
// db/connection.ts is mocked in tests that touch the database.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.CLUB_NUMERO ??= "08940073";
process.env.CLUB_NOM ??= "FONTENAYSIENNE";
