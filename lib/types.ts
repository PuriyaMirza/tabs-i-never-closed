// Shared types and constants. Kept free of server-only imports (no database,
// no Claude SDK) so the browser code can use them too.

export const INTENTS = ["read", "watch", "buy", "try", "reference"] as const;
export type Intent = (typeof INTENTS)[number];

export type Link = {
  id: number;
  url: string;
  title: string;
  domain: string;
  topic_tags: string[];
  intent_tag: Intent | null;
  // ISO date strings, e.g. "2026-10-20T08:15:00.000Z"
  created_at: string;
  done_at: string | null;
};
