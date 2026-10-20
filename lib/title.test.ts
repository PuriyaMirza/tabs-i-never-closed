// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTitle, fetchTitle, fetchYouTubeTitle, isUsefulTitle } from "./title.ts";

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
