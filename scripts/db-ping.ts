// Is the database reachable AT DATABASE_URL — the way the app connects?
// A healthy postgres container is not the same fact: the container can be perfectly
// healthy while the app's connection string points at a closed port, the wrong host,
// or a database that does not exist. dev-up.sh checks both, because only this one
// predicts whether the API will work.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}
const sql = postgres(url, { connect_timeout: 3, max: 1, onnotice: () => {} });
try {
  await sql`select 1`;
  await sql.end({ timeout: 1 });
  process.exit(0);
} catch (err) {
  console.error(`unreachable: ${(err as Error).message}`);
  process.exit(1);
}
