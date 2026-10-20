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

export const INTENTS = ["read", "watch", "buy", "try", "reference"] as const;
export type Intent = (typeof INTENTS)[number];

export type Link = {
  id: number;
  url: string;
  title: string;
  domain: string;
  topic_tags: string[];
  intent_tag: Intent | null;
  created_at: string;
  done_at: string | null;
};
