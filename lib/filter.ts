// Filtering the link list on the phone. Everything here is a plain function
// (no React, no database) so it is easy to test.
//
// Each tag chip has three states: neutral -> include -> exclude -> neutral.
//   - If ANY chip is "include", a link must have at least one included tag.
//   - A link with ANY "exclude" tag is hidden (even if it also has an included one).
//   - The search text must match the title, URL or domain.
import { INTENTS, type Intent } from "./types.ts";

export type TagMode = "include" | "exclude";

// Keys have a prefix so a topic tag called "read" is not confused with the
// intent "read": "topic:read" vs "intent:read".
export type Filters = {
  tags: Record<string, TagMode>;
  query: string;
};

export const emptyFilters: Filters = { tags: {}, query: "" };

type Filterable = {
  title: string;
  url: string;
  domain: string;
  topic_tags: string[];
  intent_tag: Intent | null;
};

export const topicKey = (tag: string) => `topic:${tag}`;
export const intentKey = (intent: string) => `intent:${intent}`;

/** Every chip key a link answers to: its topic tags plus its intent tag. */
export function linkKeys(link: Pick<Filterable, "topic_tags" | "intent_tag">): string[] {
  const keys = link.topic_tags.map(topicKey);
  if (link.intent_tag) keys.push(intentKey(link.intent_tag));
  return keys;
}

/** What one tap on a chip does: neutral -> include -> exclude -> neutral. */
export function nextMode(mode: TagMode | undefined): TagMode | undefined {
  if (mode === undefined) return "include";
  if (mode === "include") return "exclude";
  return undefined;
}

/** Returns a new tag map with one chip tapped. */
export function cycleTag(tags: Filters["tags"], key: string): Filters["tags"] {
  const next = nextMode(tags[key]);
  const copy = { ...tags };
  if (next === undefined) delete copy[key];
  else copy[key] = next;
  return copy;
}

/** Every topic tag used by these links, alphabetically. */
export function topicTagsIn(links: Pick<Filterable, "topic_tags">[]): string[] {
  const all = new Set<string>();
  for (const link of links) for (const tag of link.topic_tags) all.add(tag);
  return [...all].sort((a, b) => a.localeCompare(b));
}

/**
 * Forgets filter choices for chips that no longer exist (for example after
 * you remove the last link's "travel" tag). Otherwise an invisible "include"
 * would hide everything and you couldn't see why.
 */
export function pruneTags(tags: Filters["tags"], validKeys: Iterable<string>): Filters["tags"] {
  const valid = new Set(validKeys);
  const out: Filters["tags"] = {};
  for (const [key, mode] of Object.entries(tags)) if (valid.has(key)) out[key] = mode;
  return out;
}

/** All the chip keys that should be shown for these links (the 5 intents + each topic in use). */
export function chipKeysFor(links: Pick<Filterable, "topic_tags">[]): string[] {
  return [...INTENTS.map(intentKey), ...topicTagsIn(links).map(topicKey)];
}

export function hasActiveFilters(filters: Filters): boolean {
  return filters.query.trim() !== "" || Object.keys(filters.tags).length > 0;
}

/** Case-insensitive search. Every word you type must appear in the title, URL or domain. */
export function matchesQuery(link: Pick<Filterable, "title" | "url" | "domain">, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${link.title}\n${link.url}\n${link.domain}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

export function filterLinks<T extends Filterable>(links: T[], filters: Filters): T[] {
  const included: string[] = [];
  const excluded = new Set<string>();
  for (const [key, mode] of Object.entries(filters.tags)) {
    if (mode === "include") included.push(key);
    else excluded.add(key);
  }

  return links.filter((link) => {
    const keys = linkKeys(link);
    if (keys.some((k) => excluded.has(k))) return false;
    if (included.length > 0 && !keys.some((k) => included.includes(k))) return false;
    return matchesQuery(link, filters.query);
  });
}

/** Picks one item at random (undefined for an empty list). `random` is only swapped out in tests. */
export function pickRandom<T>(items: T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}
