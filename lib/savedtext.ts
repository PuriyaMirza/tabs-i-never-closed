// "Save TXT": the readable text of a link, kept in the database so it can be
// read inside the app, offline too. These are the shapes we store plus small
// helpers. Kept free of server-only imports so the browser can use them.
import { searchQueryOf } from "./url.ts";

/** One block of an article: a paragraph, a subheading, a list item or a quote. */
export type Block = { kind: "p" | "h" | "li" | "quote"; text: string };

export type SavedArticle = {
  kind: "article";
  byline: string | null;
  blocks: Block[];
  /** Size of the plain text in bytes, and its word count (for "about 5 min"). */
  bytes: number;
  words: number;
  /** "reader" = pulled out for free; "claude" = Claude cleaned up the page. */
  method: "reader" | "claude";
};

export type RedditComment = {
  author: string;
  score: number | null;
  /** 0 = top-level comment, 1 = a reply to it, … */
  depth: number;
  paragraphs: string[];
};

export type SavedThread = {
  kind: "reddit";
  subreddit: string;
  author: string;
  score: number | null;
  /** The post's own text (empty for a link post). */
  post: string[];
  /** For link posts: where the post points. */
  link: string | null;
  comments: RedditComment[];
  bytes: number;
  words: number;
};

export type SavedText = SavedArticle | SavedThread;

// Pages that are videos, music or apps rather than something to read.
const NO_TEXT_HOSTS = [
  "youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "instagram.com", "twitch.tv",
  "spotify.com", "music.apple.com", "podcasts.apple.com", "apps.apple.com",
  "maps.google.com", "maps.apple.com",
];

/** Whether to offer "Save TXT" for a link: any web page except searches, videos and apps. */
export function canSaveText(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (searchQueryOf(url)) return false;
  const host = u.hostname.replace(/^www\./, "");
  return !NO_TEXT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** All the text of a saved page, as one plain string (what "the TXT" is). */
export function plainText(saved: Omit<SavedArticle, "bytes" | "words"> | Omit<SavedThread, "bytes" | "words">): string {
  if (saved.kind === "article") return saved.blocks.map((b) => b.text).join("\n\n");
  return [
    ...saved.post,
    ...(saved.link ? [saved.link] : []),
    ...saved.comments.flatMap((c) => [c.author, ...c.paragraphs]),
  ].join("\n\n");
}

/** Size in bytes (UTF-8) and word count of some text. */
export function measure(text: string): { bytes: number; words: number } {
  const words = text.split(/\s+/).filter(Boolean).length;
  return { bytes: new TextEncoder().encode(text).length, words };
}

/** 9216 → "9 KB", 2_200_000 → "2.1 MB". Never "0 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Reading time at about 230 words a minute, at least 1. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}
