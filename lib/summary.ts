// Tidies Claude's short summary of a link before it's saved.
// It lives in its own file so tests can use it without loading the Claude SDK.

const MAX_CHARS = 320;

// Sentences about what Claude could or couldn't see ("Only the title and URL
// were available…") say nothing about the link, so they're dropped.
const HEDGE =
  /\b(title and url|only the title|details are (inferred|unconfirmed|unknown)|(exact )?contents are unknown|based (only|solely) on the (title|url))\b/i;

/** Collapses whitespace, drops "I only had the URL" sentences, caps the length. */
export function cleanSummary(text: string): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=["“A-Z0-9$])/);
  // The first sentence always stays, so there's never an empty summary.
  const kept = sentences.filter((s, i) => i === 0 || !HEDGE.test(s));
  return kept.join(" ").slice(0, MAX_CHARS);
}
