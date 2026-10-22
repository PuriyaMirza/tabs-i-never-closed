// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDescription, extractPageText, extractTitle, fetchPageInfo, fetchTitle, fetchYouTubeTitle, isUsefulTitle } from "./title.ts";

test("extractTitle prefers og:title and decodes entities", () => {
  assert.equal(
    extractTitle('<head><title>Site | Page</title><meta property="og:title" content="Tom &amp; Jerry&#39;s &#x2014; Story"></head>'),
    "Tom & Jerry's — Story",
  );
  assert.equal(extractTitle("<title>\n  Hello   world \n</title>"), "Hello world");
  assert.equal(extractTitle("<p>no title</p>"), null);
});

test("isUsefulTitle rejects bot checks and bare site names", () => {
  assert.equal(isUsefulTitle("YouTube", "https://www.youtube.com/watch?v=x"), false);
  assert.equal(isUsefulTitle("Wikipedia", "https://en.wikipedia.org/wiki/X"), false);
  assert.equal(isUsefulTitle("Just a moment...", "https://site.com/a"), false);
  assert.equal(isUsefulTitle("Ramen - Wikipedia", "https://en.wikipedia.org/wiki/Ramen"), true);
});

test("fetchYouTubeTitle uses oEmbed for YouTube only", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    calls.push(input);
    return new Response(JSON.stringify({ title: "Never Gonna Give You Up" }), { status: 200 });
  });
  assert.equal(await fetchYouTubeTitle("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "Never Gonna Give You Up");
  assert.equal(await fetchYouTubeTitle("https://youtu.be/dQw4w9WgXcQ"), "Never Gonna Give You Up");
  assert.equal(await fetchYouTubeTitle("https://example.com/video"), null);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].startsWith("https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com"));
});

test("fetchTitle falls back to the URL when YouTube oEmbed fails", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<title>YouTube</title>", {
    status: 200,
    headers: { "content-type": "text/html" },
  }));
  // oEmbed reply isn't valid JSON → null; page title "YouTube" is rejected → URL fallback.
  assert.equal(await fetchTitle("https://www.youtube.com/watch?v=abc"), "youtube.com");
});

test("extractDescription prefers og:description, then meta description", () => {
  assert.equal(
    extractDescription('<meta name="description" content="Plain one"><meta property="og:description" content="Tom &amp; Jerry, explained.">'),
    "Tom & Jerry, explained.",
  );
  assert.equal(extractDescription('<meta content="Reversed  order" name="description">'), "Reversed order");
  assert.equal(extractDescription("<title>No description</title>"), null);
});

test("extractPageText keeps the article text and drops menus, scripts and footers", () => {
  const words = "Sourdough needs a warm spot around 24 degrees to rise well and develop flavour over a long slow ferment.";
  const html = `<html><head><title>T</title><script>var x = 1;</script></head><body>
    <nav>Home About Shop Login</nav><header>Site header text</header>
    <article><h1>Sourdough basics</h1><p>${words}</p><script>track()</script></article>
    <footer>© 2026 footer text</footer></body></html>`;
  const text = extractPageText(html) ?? "";
  assert.match(text, /^Sourdough basics Sourdough needs a warm spot/);
  assert.doesNotMatch(text, /Home About|header text|footer|track\(\)|var x/);
});

test("extractPageText copes with a page cut off mid-way, and ignores near-empty pages", () => {
  const cut = "<body><main><p>" + "word ".repeat(40) + "</p><script>never closed";
  assert.equal(extractPageText(cut), ("word ".repeat(40)).trim());
  assert.equal(extractPageText("<body><button>Sign in</button></body>"), null);
  assert.equal((extractPageText("<body><p>" + "long ".repeat(2000) + "</p></body>") ?? "").length, 4000);
});

test("isUsefulTitle rejects bare search-page titles", () => {
  assert.equal(isUsefulTitle("Google Search", "https://www.google.com/search?q=x"), false);
  assert.equal(isUsefulTitle("Google Search tips for beginners", "https://blog.example.com/a"), true);
});

test("fetchPageInfo uses the query for searches without fetching", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("should not be called"));
  const info = await fetchPageInfo("https://www.google.com/search?q=stove+knob+replacement&hl=en-US");
  assert.deepEqual(info, { title: "stove knob replacement", description: null, text: null, searchQuery: "stove knob replacement" });
  assert.equal(fetchMock.mock.callCount(), 0);
});
