// Fetches a page's <title>, its short meta description, and an excerpt of
// its text (so Claude can summarize what's actually on the page).
// Never throws: on any problem it returns a readable title built from the URL
// instead, so saving a link never fails because a site was slow or blocked us.
import { domainOf, searchQueryOf, titleFromUrl } from "./url.ts";

const TIMEOUT_MS = 5000;
// Enough to reach the start of the article on most pages, without
// downloading huge ones.
const MAX_BYTES = 1024 * 1024;
// How much page text Claude reads (about 1,000 tokens).
const MAX_TEXT_CHARS = 4000;

export type PageInfo = {
  title: string;
  /** The page's own meta description, if it has one. */
  description: string | null;
  /** The start of the page's readable text, if we could fetch it. */
  text: string | null;
  /** For web searches: what was searched for. */
  searchQuery: string | null;
};

export async function fetchTitle(url: string): Promise<string> {
  return (await fetchPageInfo(url)).title;
}

export async function fetchPageInfo(url: string): Promise<PageInfo> {
  const fallback = (): PageInfo => ({ title: titleFromUrl(url), description: null, text: null, searchQuery: null });

  // Searches: Google and friends block servers, and the query says it all.
  const searchQuery = searchQueryOf(url);
  if (searchQuery) return { title: searchQuery, description: null, text: null, searchQuery };

  // YouTube shows servers a generic page titled just "YouTube", so ask its
  // official oEmbed service for the real video title instead.
  const videoTitle = await fetchYouTubeTitle(url);
  if (videoTitle) return { title: videoTitle, description: null, text: null, searchQuery: null };

  const html = await fetchHtml(url, MAX_BYTES, TIMEOUT_MS);
  if (html === null) return fallback();
  const title = extractTitle(html);
  return {
    title: title && isUsefulTitle(title, url) ? title : titleFromUrl(url),
    description: extractDescription(html),
    text: extractPageText(html),
    searchQuery: null,
  };
}

/**
 * Downloads a web page's HTML (at most `maxBytes` of it), looking like a phone
 * browser. Null if it isn't an HTML page or can't be loaded (timeout, DNS
 * failure, TLS error, …).
 */
export async function fetchHtml(url: string, maxBytes: number, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        // Some sites refuse requests that don't look like a browser.
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !res.body || !type.includes("html")) return null;
    return await readStart(res.body, maxBytes);
  } catch {
    return null;
  }
}

/**
 * Reads at most `maxBytes` of a response body as text. If the connection is
 * cut off (e.g. the 5 second timeout), keeps whatever arrived so far.
 */
async function readStart(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    // Timed out or dropped mid-page: the part we have is still useful.
  }
  reader.cancel().catch(() => {});
  return text;
}

/**
 * The readable text of a page: the <article> (or <main>, or <body>) with
 * scripts, styles, menus, headers and footers removed and tags stripped.
 * Returns the first few thousand characters, or null if there's nothing useful.
 */
export function extractPageText(html: string): string | null {
  // (A page cut off at the size limit may be missing its closing tags, so
  // "up to the closing tag, or the end" is used throughout.)
  const pick = (tag: string) => html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)(?:</${tag}>|$)`, "i"))?.[1];
  let part = pick("article") ?? pick("main") ?? pick("body") ?? html;
  // Drop whole blocks whose text is never the content.
  for (const tag of ["script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form", "template"]) {
    part = part.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(?:</${tag}>|$)`, "gi"), " ");
  }
  const text = decodeEntities(
    part
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
  // A few words is just leftover buttons or a login prompt, not content.
  return text.split(" ").length >= 15 ? text.slice(0, MAX_TEXT_CHARS) : null;
}

/** The page's own summary: og:description, else <meta name="description">. */
export function extractDescription(html: string): string | null {
  const pick = (attr: string) =>
    html.match(new RegExp(`<meta[^>]+${attr}["'][^>]*content=["']([^"']+)["']`, "i")) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*${attr}["']`, "i"));
  const raw = pick(`property=["']og:description`)?.[1] ?? pick(`name=["']description`)?.[1];
  if (!raw) return null;
  const clean = decodeEntities(raw).replace(/\s+/g, " ").trim();
  return clean.length > 0 ? clean.slice(0, 500) : null;
}

/** Prefers og:title (often cleaner), then <title>. */
export function extractTitle(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const tag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const raw = og?.[1] ?? tag?.[1];
  if (!raw) return null;
  const clean = decodeEntities(raw).replace(/\s+/g, " ").trim();
  return clean.length > 0 ? clean.slice(0, 300) : null;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

/** Returns the video title for YouTube links, or null for anything else / on failure. */
export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  if (!YOUTUBE_HOSTS.has(domainOf(url))) return null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 300) : null;
  } catch {
    return null;
  }
}

/**
 * Rejects titles that don't describe the page: bot-check pages ("Just a
 * moment…") and titles that are only the site's name ("YouTube" on youtube.com).
 */
export function isUsefulTitle(title: string, url: string): boolean {
  if (/^(just a moment|attention required|access denied|403 forbidden|robot check|are you a robot)/i.test(title)) {
    return false;
  }
  // Search pages titled just "Google Search" say nothing about the search.
  if (/^(google|bing|duckduckgo|yahoo) search$/i.test(title.trim())) return false;
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const host = domainOf(url); // "youtube.com"
  const siteName = host.split(".").slice(-2)[0]; // "youtube"
  const t = squash(title);
  return t !== squash(siteName) && t !== squash(host);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}
