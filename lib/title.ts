// Fetches a page's <title>. Never throws: on any problem it returns a
// readable title built from the URL instead, so saving a link never fails
// because a site was slow or blocked us.
import { titleFromUrl } from "./url.ts";

const TIMEOUT_MS = 5000;
// Titles live near the top of the HTML; no need to download whole pages.
const MAX_BYTES = 512 * 1024;

export async function fetchTitle(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Some sites refuse requests that don't look like a browser.
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !res.body || !type.includes("html")) return titleFromUrl(url);

    const html = await readStart(res.body, MAX_BYTES);
    const title = extractTitle(html);
    return title && !looksBlocked(title) ? title : titleFromUrl(url);
  } catch {
    // Timeout, DNS failure, TLS error, … → fall back quietly.
    return titleFromUrl(url);
  }
}

/** Reads at most `maxBytes` of a response body as text, then stops. */
async function readStart(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
    // Stop early once we've seen the end of <head>.
    if (/<\/head>/i.test(text)) break;
  }
  reader.cancel().catch(() => {});
  return text;
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

/** Bot-check pages have useless titles; treat them as "no title". */
function looksBlocked(title: string): boolean {
  return /^(just a moment|attention required|access denied|403 forbidden|robot check|are you a robot)/i.test(title);
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
