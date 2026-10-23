import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractArticle,
  isRedditShareLink,
  markdownParagraphs,
  parseRedditThread,
  redditJsonUrl,
} from "./extract.ts";

const para = (n: number) =>
  `Paragraph ${n} talks about walking through fields and woods for a long afternoon, noticing the light, the birds and the way the path bends toward the river.`;

const ARTICLE_HTML = `<!doctype html><html><head><title>Walking | Example</title>
<meta name="author" content="Henry David Thoreau"></head><body>
<nav><a href="/">Home</a> <a href="/about">About</a></nav>
<header><p>Subscribe to our newsletter!</p></header>
<article>
  <h1>Walking</h1>
  <p>${para(1)}</p>
  <h2>The art of sauntering</h2>
  <p>${para(2)}</p>
  <ul><li>First thing to bring</li><li>Second thing to bring</li></ul>
  <blockquote><p>A quotation worth keeping.</p></blockquote>
  <p>${para(3)}</p>
  <p>${para(4)}</p>
</article>
<footer><p>© Example Media. All rights reserved.</p></footer>
<script>trackEverything()</script>
</body></html>`;

test("extractArticle keeps the article's paragraphs, headings, list items and quotes, and drops the rest", () => {
  const article = extractArticle(ARTICLE_HTML);
  assert.ok(article);
  assert.equal(article.kind, "article");
  assert.equal(article.method, "reader");
  const texts = article.blocks.map((b) => b.text);
  assert.ok(texts.includes(para(1)));
  assert.ok(texts.includes(para(4)));
  assert.deepEqual(article.blocks.find((b) => b.text === "The art of sauntering")?.kind, "h");
  assert.deepEqual(article.blocks.find((b) => b.text === "First thing to bring")?.kind, "li");
  assert.deepEqual(article.blocks.find((b) => b.text === "A quotation worth keeping.")?.kind, "quote");
  // The quote's inner <p> isn't repeated as its own paragraph.
  assert.equal(texts.filter((t) => t === "A quotation worth keeping.").length, 1);
  for (const junk of ["Home", "Subscribe to our newsletter!", "trackEverything()"]) {
    assert.ok(!texts.some((t) => t.includes(junk)), `should drop "${junk}"`);
  }
  assert.ok(article.words > 80);
  assert.equal(article.bytes, new TextEncoder().encode(texts.join("\n\n")).length);
});

test("extractArticle gives up on a page with hardly any text", () => {
  assert.equal(extractArticle("<html><body><p>Please log in to continue.</p></body></html>"), null);
});

test("redditJsonUrl turns thread links into Reddit's JSON address", () => {
  const json = "https://www.reddit.com/comments/1abc23.json?raw_json=1&sort=top&limit=50";
  assert.equal(redditJsonUrl("https://www.reddit.com/r/ClaudeAI/comments/1abc23/some_title"), json);
  assert.equal(redditJsonUrl("https://old.reddit.com/r/ClaudeAI/comments/1abc23/some_title/abc999"), json);
  assert.equal(redditJsonUrl("https://redd.it/1abc23"), json);
  assert.equal(redditJsonUrl("https://www.reddit.com/r/ClaudeAI"), null);
  assert.equal(redditJsonUrl("https://example.com/comments/1abc23"), null);
});

test("isRedditShareLink spots links shared from the Reddit app", () => {
  assert.equal(isRedditShareLink("https://www.reddit.com/r/ClaudeAI/s/AbC123xyz"), true);
  assert.equal(isRedditShareLink("https://www.reddit.com/r/ClaudeAI/comments/1abc23/x"), false);
});

test("markdownParagraphs strips Reddit Markdown down to plain paragraphs", () => {
  assert.deepEqual(
    markdownParagraphs("# Heading\n\nSee **this** [guide](https://example.com/g) now.\n\n&#x200B;\n\n> quoted\n- one\n- two"),
    ["Heading", "See this guide (https://example.com/g) now.", "quoted\n– one\n– two"],
  );
});

const comment = (author: string, body: string, score: number, replies: unknown[] = []) => ({
  kind: "t1",
  data: { author, body, score, replies: replies.length ? { kind: "Listing", data: { children: replies } } : "" },
});

test("parseRedditThread reads the post and comments, with replies indented under their parent", () => {
  const json = [
    {
      kind: "Listing",
      data: {
        children: [
          {
            kind: "t3",
            data: { subreddit: "ClaudeAI", author: "poster", score: 120, is_self: true, selftext: "First paragraph.\n\nSecond one.", url: "https://www.reddit.com/r/ClaudeAI/comments/1abc23/x/" },
          },
        ],
      },
    },
    {
      kind: "Listing",
      data: {
        children: [
          comment("alice", "Top comment.", 50, [comment("bob", "A reply.", 10, [comment("carol", "Reply to the reply.", 3)])]),
          comment("dave", "[deleted]", 5),
          comment("erin", "Second top comment.", 20),
          { kind: "more", data: { count: 12 } },
        ],
      },
    },
  ];
  const thread = parseRedditThread(json);
  assert.ok(thread);
  assert.equal(thread.subreddit, "ClaudeAI");
  assert.equal(thread.author, "poster");
  assert.deepEqual(thread.post, ["First paragraph.", "Second one."]);
  assert.equal(thread.link, null);
  assert.deepEqual(
    thread.comments.map((c) => [c.author, c.depth, c.paragraphs[0]]),
    [
      ["alice", 0, "Top comment."],
      ["bob", 1, "A reply."],
      ["carol", 2, "Reply to the reply."],
      ["erin", 0, "Second top comment."],
    ],
  );
  assert.ok(thread.bytes > 0 && thread.words > 0);
});

test("parseRedditThread keeps the address of a link post", () => {
  const json = [
    { data: { children: [{ kind: "t3", data: { subreddit: "x", author: "a", is_self: false, selftext: "", url: "https://example.com/story" } }] } },
    { data: { children: [] } },
  ];
  assert.equal(parseRedditThread(json)?.link, "https://example.com/story");
  assert.equal(parseRedditThread({ error: 403 }), null);
});
