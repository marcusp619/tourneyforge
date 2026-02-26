/**
 * Bun test preload — runs before every test file in packages/api.
 *
 * Setting DATABASE_URL here ensures the @tourneyforge/db module can be
 * loaded for Bun's named-export validation without throwing. The actual
 * `db` instance is replaced at runtime by mock.module() in each test file,
 * so no real database connection is ever made during tests.
 */
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test_db";
