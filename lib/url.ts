// Helpers for cleaning up URLs so the same page is only ever saved once.

// Query params that only exist for tracking/analytics. Removing them means
// "example.com/post?utm_source=twitter" and "example.com/post" count as the
// same link.
const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "msclkid",
  "yclid", "twclid", "ttclid", "li_fat_id", "igshid", "igsh",
  "mc_cid", "mc_eid", "_hsenc", "_hsmi", "mkt_tok", "oly_anon_id",
  "oly_enc_id", "vero_id", "ref_src", "ref_url", "si", "spm",
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  // utm_source, utm_medium, utm_campaign, … plus any others listed above.
  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
}

/**
 * Turns a raw URL into its canonical form, or returns null if it isn't a
 * valid http(s) URL.
 *  - lowercases the host, drops default ports (the URL class does this)
 *  - removes tracking params (utm_*, fbclid, …)
 *  - removes trailing slashes from the path
 *  - removes "#section" fragments, except "#/" or "#!" app routes
 */
export function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParam(name)) url.searchParams.delete(name);
  }
  const search = url.searchParams.size > 0 ? `?${url.searchParams.toString()}` : "";

  // "/blog/post///" → "/blog/post", and the bare "/" root → ""
  const path = url.pathname.replace(/\/+$/, "");

  const keepHash = url.hash.startsWith("#/") || url.hash.startsWith("#!");
  const hash = keepHash ? url.hash.replace(/\/+$/, "") : "";

  return `${url.protocol}//${url.host}${path}${search}${hash}`;
}

/** "https://www.nytimes.com/x" → "nytimes.com" */
export function domainOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

/**
 * If the link is a web search (Google, Bing, DuckDuckGo, YouTube search),
 * returns what was searched for; otherwise null.
 * "https://www.google.com/search?q=stove+knob+replacement&…" → "stove knob replacement"
 */
export function searchQueryOf(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  let q: string | null = null;
  if (/^google\.[a-z.]+$/.test(host) && path === "/search") q = u.searchParams.get("q");
  else if (host === "bing.com" && path === "/search") q = u.searchParams.get("q");
  else if (host === "duckduckgo.com") q = u.searchParams.get("q");
  else if ((host === "youtube.com" || host === "m.youtube.com") && path === "/results") q = u.searchParams.get("search_query");
  const clean = q?.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 200) : null;
}

// Path parts that say nothing about the page ("youtube.com/watch?v=…").
const GENERIC_SEGMENTS = new Set([
  "index", "watch", "video", "videos", "status", "p", "post", "posts", "item",
  "product", "dp", "article", "story", "comments", "s", "search", "amp",
]);

/**
 * Builds a readable fallback title from the URL when the page's <title>
 * can't be fetched. "…/2024/10/best-ramen-in-tokyo.html" → "Best ramen in tokyo".
 * Falls back to the domain when the path has nothing useful.
 */
export function titleFromUrl(url: string): string {
  // A search is best described by what was searched for.
  const query = searchQueryOf(url);
  if (query) return query;

  const { pathname } = new URL(url);
  const segments = pathname.split("/").filter(Boolean);

  // Walk backwards to find the last segment that contains letters
  // (skip things like "2024", "10", "index.html").
  for (let i = segments.length - 1; i >= 0; i--) {
    let seg: string;
    try {
      seg = decodeURIComponent(segments[i]);
    } catch {
      seg = segments[i];
    }
    seg = seg.replace(/\.(html?|php|aspx?)$/i, "");
    if (GENERIC_SEGMENTS.has(seg.toLowerCase())) continue;
    // Skip ID-looking parts like "B00006JSUA" or "a1b2c3" (digits, no word breaks).
    if (/\d/.test(seg) && !/[-_+\s]/.test(seg)) continue;
    const words = seg.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
    if (/[a-z]/i.test(words) && words.length > 1) {
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
  }
  return domainOf(url);
}
