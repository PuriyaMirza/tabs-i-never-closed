// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTitle } from "./title.ts";

test("extractTitle prefers og:title and decodes entities", () => {
  assert.equal(
    extractTitle('<head><title>Site | Page</title><meta property="og:title" content="Tom &amp; Jerry&#39;s &#x2014; Story"></head>'),
    "Tom & Jerry's — Story",
  );
  assert.equal(extractTitle("<title>\n  Hello   world \n</title>"), "Hello world");
  assert.equal(extractTitle("<p>no title</p>"), null);
});
