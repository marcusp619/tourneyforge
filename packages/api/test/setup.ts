/**
 * Bun test preload — runs before every test file in packages/api.
 *
 * @tourneyforge/db throws at import time if DATABASE_URL is not set.
 * Bun validates named exports (e.g. `species`) against the real module
 * before applying mock.module() substitutions, so the module must be
 * loadable even though NO real database connection is ever made.
 *
 * The value is intentionally fake — `postgres()` is lazy and never
 * dials a server. The `db` instance is replaced by mock.module() in
 * each test file before any query is attempted.
 *
 * No Docker, no local Postgres, no external services required.
 */
process.env["DATABASE_URL"] = "postgresql://mock:mock@mock.invalid/mock";
