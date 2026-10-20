// Tag tidying, shared by the tagger (server) and the tag editor (browser).
// It lives in its own file so the browser doesn't have to load the Claude SDK.

/**
 * Tidies tags: lowercase, trimmed, no duplicates, at most `max` of them.
 * The default of 2 is what Claude may assign; hand-editing allows more.
 * If Claude returns a plural like "recipes" while "recipe" already exists,
 * use the existing one.
 */
export function cleanTags(tags: string[], existingTags: string[], max = 2): string[] {
  const existing = new Set(existingTags);
  const out: string[] = [];
  for (const raw of tags) {
    let tag = raw.toLowerCase().replace(/^#/, "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!tag) continue;
    if (!existing.has(tag) && tag.endsWith("s") && existing.has(tag.slice(0, -1))) {
      tag = tag.slice(0, -1);
    }
    if (!out.includes(tag)) out.push(tag);
  }
  return out.slice(0, max);
}

/** Most topic tags one link may have when you edit them by hand. */
export const MAX_TOPIC_TAGS = 6;
