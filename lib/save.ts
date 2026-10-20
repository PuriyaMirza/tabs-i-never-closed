// Saving links: clean up the URLs, skip ones already saved, bring back ones
// that were marked done, and insert the rest.
import { sql } from "./db.ts";
import { normalizeUrl, domainOf, titleFromUrl } from "./url.ts";

const MAX_URLS_PER_REQUEST = 100;

export type SaveResult = {
  new: { id: number; url: string; title: string; domain: string }[];
  duplicates: string[];
  reactivated: { id: number; url: string; title: string; domain: string; untagged: boolean }[];
  invalid: string[];
};

/**
 * Pulls every http(s) URL out of whatever the client sent. Accepts a list of
 * URLs, a single string, or text with URLs mixed in (iOS Shortcuts can send
 * any of these depending on how many tabs were shared).
 */
export function extractUrls(input: unknown): { urls: string[]; invalid: string[] } {
  const strings: string[] = [];
  const collect = (v: unknown) => {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
  };
  collect(input);

  const urls: string[] = [];
  const invalid: string[] = [];
  for (const s of strings) {
    const found = s.match(/https?:\/\/[^\s<>"']+/gi);
    if (!found) {
      if (s.trim()) invalid.push(s.trim());
      continue;
    }
    for (const raw of found) {
      // Drop punctuation that often sticks to URLs in text ("see https://x.com).")
      const trimmed = raw.replace(/[),.;!?]+$/, "");
      const normalized = normalizeUrl(trimmed);
      if (normalized) urls.push(normalized);
      else invalid.push(trimmed);
    }
  }
  // Remove duplicates within this one request.
  return { urls: [...new Set(urls)], invalid };
}

export async function saveUrls(urls: string[]): Promise<SaveResult> {
  urls = urls.slice(0, MAX_URLS_PER_REQUEST);
  const result: SaveResult = { new: [], duplicates: [], reactivated: [], invalid: [] };
  if (urls.length === 0) return result;

  // 1. Which of these do we already have?
  const existing = await sql`
    select id, url, title, domain, done_at, intent_tag
    from links where url = any(${urls})`;
  const byUrl = new Map(existing.map((row) => [row.url as string, row]));

  // 2. Already saved and still active → duplicate. Saved but done → reactivate.
  const toReactivate: number[] = [];
  for (const row of existing) {
    if (row.done_at === null) {
      result.duplicates.push(row.url);
    } else {
      toReactivate.push(row.id);
      result.reactivated.push({
        id: row.id, url: row.url, title: row.title, domain: row.domain,
        untagged: row.intent_tag === null,
      });
    }
  }
  if (toReactivate.length > 0) {
    await sql`update links set done_at = null where id = any(${toReactivate})`;
  }

  // 3. Brand new → insert with a placeholder title from the URL. The real
  //    page title is fetched right after the response is sent.
  const fresh = urls.filter((u) => !byUrl.has(u));
  if (fresh.length > 0) {
    const titles = fresh.map(titleFromUrl);
    const domains = fresh.map(domainOf);
    const inserted = await sql`
      insert into links (url, title, domain)
      select * from unnest(${fresh}::text[], ${titles}::text[], ${domains}::text[])
      on conflict (url) do nothing
      returning id, url, title, domain`;
    for (const row of inserted) {
      result.new.push({ id: row.id, url: row.url, title: row.title, domain: row.domain });
    }
    // A link saved by a parallel request between step 1 and now counts as a duplicate.
    const insertedUrls = new Set(inserted.map((r) => r.url as string));
    for (const u of fresh) if (!insertedUrls.has(u)) result.duplicates.push(u);
  }

  return result;
}

/** Short text for the iOS notification, e.g. "Saved 3 (1 duplicate)". */
export function summarize(r: SaveResult): string {
  const saved = r.new.length + r.reactivated.length;
  const extras: string[] = [];
  if (r.duplicates.length) extras.push(`${r.duplicates.length} duplicate${r.duplicates.length > 1 ? "s" : ""}`);
  if (r.reactivated.length) extras.push(`${r.reactivated.length} restored from Done`);
  if (r.invalid.length) extras.push(`${r.invalid.length} not a link`);
  return `Saved ${saved}${extras.length ? ` (${extras.join(", ")})` : ""}`;
}
