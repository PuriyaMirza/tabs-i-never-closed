import { test } from "node:test";
import assert from "node:assert/strict";
import { canSaveText, formatBytes, measure, readingMinutes } from "./savedtext.ts";

test("canSaveText: web pages yes; searches, videos and non-web links no", () => {
  assert.equal(canSaveText("https://www.gutenberg.org/ebooks/1022"), true);
  assert.equal(canSaveText("https://www.reddit.com/r/ClaudeAI/comments/1abc23/x"), true);
  assert.equal(canSaveText("https://www.google.com/search?q=bab+el+mandeb"), false);
  assert.equal(canSaveText("https://www.youtube.com/watch?v=abc"), false);
  assert.equal(canSaveText("https://m.youtube.com/watch?v=abc"), false);
  assert.equal(canSaveText("https://open.spotify.com/track/1"), false);
  assert.equal(canSaveText("mailto:me@example.com"), false);
  assert.equal(canSaveText("not a url"), false);
});

test("formatBytes", () => {
  assert.equal(formatBytes(100), "1 KB");
  assert.equal(formatBytes(9 * 1024 + 100), "9 KB");
  assert.equal(formatBytes(2.2 * 1024 * 1024), "2.2 MB");
});

test("measure counts UTF-8 bytes and words", () => {
  assert.deepEqual(measure("café au lait"), { bytes: 13, words: 3 });
  assert.deepEqual(measure("  "), { bytes: 2, words: 0 });
});

test("readingMinutes is at least 1", () => {
  assert.equal(readingMinutes(10), 1);
  assert.equal(readingMinutes(2300), 10);
});
