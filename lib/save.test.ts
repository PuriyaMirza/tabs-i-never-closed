// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractUrls, summarize } from "./save.ts";
import { cleanTags } from "./tagger.ts";

test("extractUrls handles lists, single strings, mixed text and dupes", () => {
  assert.deepEqual(extractUrls(["https://a.com/x/", "https://a.com/x?utm_source=y"]).urls, ["https://a.com/x"]);
  assert.deepEqual(extractUrls("https://a.com").urls, ["https://a.com"]);
  assert.deepEqual(
    extractUrls(["Check this out (https://b.com/post).\nhttps://c.com"]).urls,
    ["https://b.com/post", "https://c.com"],
  );
  assert.deepEqual(extractUrls(["hello", "https://d.com"]), { urls: ["https://d.com"], invalid: ["hello"] });
  assert.deepEqual(extractUrls(undefined).urls, []);
});

test("summarize builds the notification text", () => {
  const link = { id: 1, url: "u", title: "t", domain: "d" };
  assert.equal(summarize({ new: [link, link, link], duplicates: ["u"], reactivated: [], invalid: [] }), "Saved 3 (1 duplicate)");
  assert.equal(summarize({ new: [link], duplicates: [], reactivated: [], invalid: [] }), "Saved 1");
  assert.equal(
    summarize({ new: [], duplicates: ["a", "b"], reactivated: [{ ...link, untagged: false }], invalid: [] }),
    "Saved 1 (2 duplicates, 1 restored from Done)",
  );
});

test("cleanTags lowercases, dedupes, caps at 2, reuses singular", () => {
  assert.deepEqual(cleanTags(["#Cooking", "cooking", "Travel", "x"], []), ["cooking", "travel"]);
  assert.deepEqual(cleanTags(["recipes"], ["recipe"]), ["recipe"]);
});
