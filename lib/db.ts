// Database connection. Neon's driver talks to Postgres over HTTPS, which
// works well in serverless functions (no connection pool to manage).
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

// Usage: await sql`select * from links where id = ${id}`
// Values in ${} are sent as parameters, never pasted into the SQL text,
// so this is safe from SQL injection.
// The connection is created on first use (not at import), so the app can
// still be built on Vercel before DATABASE_URL is set.
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    client = neon(process.env.DATABASE_URL);
  }
  return client(strings, ...values);
}

// These live in types.ts so browser code can use them without pulling in the
// database driver. Re-exported here so server code can keep importing from db.ts.
export { INTENTS } from "./types.ts";
export type { Intent, Link } from "./types.ts";
