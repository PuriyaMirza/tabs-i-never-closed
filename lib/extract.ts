// Pulls the readable text out of a saved link, for "Save TXT".
//  - Reddit threads: Reddit's own JSON version of the thread (the post plus
//    the top comments). Free.
//  - Other pages: Mozilla Readability, the engine behind Firefox's Reader
//    View. Free.
//  - If Readability finds nothing, Claude (Haiku) cleans up the page text
//    instead. That costs about a tenth of a cent per page.
// Server-only: it downloads pages and talks to Claude.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { z } from "zod";
import { fetchHtml } from "./title.ts";
import {
  measure,
  plainText,
  type Block,
  type RedditComment,
  type SavedArticle,
  type SavedText,
  type SavedThread,
} from "./savedtext.ts";

// Long reads can be big pages; this is still a quick download.
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
// Fewer words than this means we found a teaser or a cookie notice, not the article.
const MIN_WORDS = 80;
// Reddit: the top 50 comments, at most 3 replies under each, at most 3 levels deep.
const MAX_COMMENTS = 50;
const MAX_REPLIES = 3;
const MAX_DEPTH = 3;
// How much page text Claude reads when cleaning up (about 10,000 tokens).
const MAX_CLAUDE_CHARS = 40_000;
// Reddit asks apps to say who they are.
const REDDIT_UA = "web:tabs-i-never-closed:v1.0 (personal reading app)";

/** A failure with a message that's fine to show on screen. */
export class ExtractError extends Error {}

/** The readable text of a link. Throws ExtractError if there isn't any. */
export async function extractText(url: string, title: string): Promise<SavedText> {
  // Links shared from the Reddit app (reddit.com/r/…/s/…) point at the thread by redirect.
  const target = isRedditShareLink(url) ? ((await resolveRedirect(url)) ?? url) : url;
  const jsonUrl = redditJsonUrl(target);
  if (jsonUrl) return fetchRedditThread(jsonUrl);

  const html = await fetchHtml(url, MAX_PAGE_BYTES, TIMEOUT_MS);
  if (html === null) throw new ExtractError("Couldn't load the page. It may be down, or blocking the app.");

  const article = extractArticle(html);
  if (article) return article;

  let cleaned: SavedArticle | null = null;
  try {
    cleaned = await cleanWithClaude(html, title);
  } catch (err) {
    console.error("Claude couldn't clean up the page:", err);
  }
  if (cleaned) return cleaned;
  throw new ExtractError("Couldn't find readable text on this page.");
}

// ---------- Articles ----------

/** The article on a page, via Readability. Null if it found nothing worth keeping. */
export function extractArticle(html: string): SavedArticle | null {
  const { document } = parseHTML(html);
  // The serializer hands back the article as elements instead of an HTML string.
  const parsed = new Readability<Element>(document as unknown as Document, {
    serializer: (node) => node as Element,
  }).parse();
  if (!parsed?.content) return null;
  let blocks = blocksIn(parsed.content);
  if (blocks.length === 0) {
    blocks = (parsed.textContent ?? "")
      .split(/\n\s*\n/)
      .map((text) => text.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .map((text) => ({ kind: "p", text }));
  }
  return toArticle(blocks, parsed.byline, "reader");
}

/** Paragraphs, subheadings, list items and quotes, in reading order. */
export function blocksIn(root: Element): Block[] {
  const blocks: Block[] = [];
  for (const el of Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre"))) {
    // A <p> inside a list item or quote is already part of that block.
    if (el.parentElement?.closest("p,li,blockquote,pre")) continue;
    const tag = el.tagName.toUpperCase();
    const raw = el.textContent ?? "";
    const text = tag === "PRE" ? raw.trim() : raw.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const kind = /^H[1-6]$/.test(tag) ? "h" : tag === "LI" ? "li" : tag === "BLOCKQUOTE" ? "quote" : "p";
    blocks.push({ kind, text });
  }
  return blocks;
}

function toArticle(blocks: Block[], byline: string | null | undefined, method: SavedArticle["method"]): SavedArticle | null {
  const base = { kind: "article" as const, byline: byline?.trim() || null, blocks, method };
  const size = measure(plainText(base));
  return size.words >= MIN_WORDS ? { ...base, ...size } : null;
}

// ---------- Claude as a backup ----------

let claude: Anthropic | null = null;

const CleanSchema = z.object({
  found: z.boolean(),
  byline: z.string(),
  blocks: z.array(z.object({ kind: z.enum(["p", "h", "li", "quote"]), text: z.string() })),
});

const CLEAN_SYSTEM = `You turn the text of a saved web page into a clean copy for reading later.
- Keep the main article or post in its own words and order. Don't summarize, shorten or rephrase it.
- Leave out everything else: menus, ads, cookie and sign-up prompts, share buttons, "related articles", comment sections, footers.
- Return it as blocks: "p" for a paragraph, "h" for a subheading, "li" for a list item, "quote" for a quotation.
- byline: the author's name if the page gives one, otherwise an empty string.
- If the page has no article or post (a login wall, an error page, a list of links, a shop page), set found to false and return no blocks.`;

async function cleanWithClaude(html: string, title: string): Promise<SavedArticle | null> {
  const text = pageText(html);
  if (!text) return null;
  // Created on first use, so this file can be loaded (e.g. by tests) without an API key.
  claude ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const response = await claude.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(CleanSchema) },
    system: CLEAN_SYSTEM,
    messages: [{ role: "user", content: `Title: ${title}\n\nPage text:\n${text}` }],
  });
  const out = response.parsed_output;
  if (response.stop_reason !== "end_turn" || !out?.found) return null;
  const blocks = out.blocks.map((b) => ({ kind: b.kind, text: b.text.trim() })).filter((b) => b.text);
  return toArticle(blocks, out.byline, "claude");
}

/** The page's visible text with blocks on separate lines, for Claude to read. */
function pageText(html: string): string {
  const { document } = parseHTML(html);
  for (const el of Array.from(document.querySelectorAll("script,style,noscript,svg,template,iframe,nav,header,footer,aside,form"))) {
    el.remove();
  }
  const body = (document.body ?? document.documentElement) as unknown as Element;
  const fromBlocks = blocksIn(body).map((b) => b.text).join("\n\n");
  // Some pages keep their text in plain <div>s; then take all of it.
  const text = measure(fromBlocks).words >= MIN_WORDS ? fromBlocks : (body.textContent ?? "").replace(/\s+/g, " ").trim();
  return text.slice(0, MAX_CLAUDE_CHARS);
}

// ---------- Reddit ----------

const REDDIT_HOST = /^(?:www\.|old\.|new\.|np\.|m\.)?reddit\.com$/;

/** Reddit's JSON address for a thread link (top comments first), or null if it isn't one. */
export function redditJsonUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let id: string | undefined;
  if (host === "redd.it") id = u.pathname.split("/")[1];
  else if (REDDIT_HOST.test(host)) id = u.pathname.match(/\/comments\/([a-z0-9]+)/i)?.[1];
  if (!id || !/^[a-z0-9]+$/i.test(id)) return null;
  return `https://www.reddit.com/comments/${id}.json?raw_json=1&sort=top&limit=${MAX_COMMENTS}`;
}

/** reddit.com/r/<sub>/s/<code>: the links the Reddit app shares. */
export function isRedditShareLink(url: string): boolean {
  try {
    const u = new URL(url);
    return REDDIT_HOST.test(u.hostname.toLowerCase()) && /^\/r\/[^/]+\/s\/[^/]+/.test(u.pathname);
  } catch {
    return false;
  }
}

async function resolveRedirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": REDDIT_UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    return location ? new URL(location, url).href : null;
  } catch {
    return null;
  }
}

async function fetchRedditThread(jsonUrl: string): Promise<SavedThread> {
  let res: Response;
  try {
    res = await fetch(jsonUrl, {
      headers: { "user-agent": REDDIT_UA, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ExtractError("Couldn't reach Reddit. Try again in a bit.");
  }
  if (!res.ok) throw new ExtractError(`Reddit didn't let the app read this thread (error ${res.status}).`);
  const thread = parseRedditThread(await res.json().catch(() => null));
  if (!thread) throw new ExtractError("Couldn't find the post or comments in this thread.");
  return thread;
}

type Thing = { kind?: unknown; data?: Record<string, unknown> };
const childrenOf = (listing: unknown): Thing[] => {
  const children = (listing as { data?: { children?: unknown } } | null)?.data?.children;
  return Array.isArray(children) ? (children as Thing[]) : [];
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : null);

/** Reads Reddit's thread JSON ([post listing, comment listing]). Null if it isn't one. */
export function parseRedditThread(json: unknown): SavedThread | null {
  if (!Array.isArray(json) || json.length < 2) return null;
  const post = childrenOf(json[0])[0]?.data;
  if (!post) return null;
  const comments: RedditComment[] = [];
  collectComments(childrenOf(json[1]), 0, comments);
  const linkUrl = str(post.url);
  const base = {
    kind: "reddit" as const,
    subreddit: str(post.subreddit),
    author: str(post.author) || "[deleted]",
    score: num(post.score),
    post: markdownParagraphs(str(post.selftext)),
    link: post.is_self !== true && linkUrl ? linkUrl : null,
    comments,
  };
  if (base.post.length === 0 && !base.link && comments.length === 0) return null;
  return { ...base, ...measure(plainText(base)) };
}

// Top comments in Reddit's order, each followed by its best few replies.
function collectComments(things: Thing[], depth: number, out: RedditComment[]) {
  let kept = 0;
  for (const thing of things) {
    if (out.length >= MAX_COMMENTS || (depth > 0 && kept >= MAX_REPLIES)) return;
    if (thing.kind !== "t1" || !thing.data) continue; // "more" = "load more comments" stubs
    const body = str(thing.data.body);
    if (body === "[deleted]" || body === "[removed]") continue;
    const paragraphs = markdownParagraphs(body);
    if (paragraphs.length === 0) continue;
    out.push({ author: str(thing.data.author) || "[deleted]", score: num(thing.data.score), depth, paragraphs });
    kept++;
    if (depth + 1 < MAX_DEPTH) collectComments(childrenOf(thing.data.replies), depth + 1, out);
  }
}

/** Reddit's Markdown as plain paragraphs: "[text](url)" → "text (url)", no ** or # marks, "– " for list items. */
export function markdownParagraphs(md: string): string[] {
  return md
    .replace(/&#x200B;|&nbsp;/g, " ")
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .replace(/\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, text: string, href: string) =>
          text && text !== href ? `${text} (${href})` : href,
        )
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "– ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .filter((p) => p.length > 0);
}
