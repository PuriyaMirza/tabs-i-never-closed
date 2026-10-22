// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, domainOf, searchQueryOf, titleFromUrl } from "./url.ts";

test("strips tracking params and trailing slashes", () => {
  assert.equal(
    normalizeUrl("https://Example.com/blog/post/?utm_source=x&id=7&fbclid=abc"),
    "https://example.com/blog/post?id=7",
  );
  assert.equal(normalizeUrl("https://example.com/"), "https://example.com");
  assert.equal(normalizeUrl("https://example.com"), "https://example.com");
  assert.equal(normalizeUrl("https://example.com/a#section"), "https://example.com/a");
  assert.equal(normalizeUrl("https://example.com/#/app/page/"), "https://example.com#/app/page");
});

test("rejects non-web URLs", () => {
  assert.equal(normalizeUrl("not a url"), null);
  assert.equal(normalizeUrl("mailto:me@example.com"), null);
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
});

test("domain and fallback title", () => {
  assert.equal(domainOf("https://www.nytimes.com/x"), "nytimes.com");
  assert.equal(titleFromUrl("https://site.com/2024/10/best-ramen-in-tokyo.html"), "Best ramen in tokyo");
  assert.equal(titleFromUrl("https://site.com/recipes/easy_pad_thai/2024"), "Easy pad thai");
  assert.equal(titleFromUrl("https://www.site.com/"), "site.com");
});

test("fallback title skips generic path parts", () => {
  assert.equal(titleFromUrl("https://www.youtube.com/watch?v=abc"), "youtube.com");
  assert.equal(titleFromUrl("https://www.amazon.com/Cast-Iron-Skillet/dp/B00006JSUA"), "Cast Iron Skillet");
});

test("searchQueryOf finds the query in web searches only", () => {
  assert.equal(
    searchQueryOf("https://www.google.com/search?q=stove+knob+replacement&sca_esv=626b&hl=en-US"),
    "stove knob replacement",
  );
  assert.equal(searchQueryOf("https://google.co.uk/search?q=Baloch%20resistance"), "Baloch resistance");
  assert.equal(searchQueryOf("https://www.bing.com/search?q=cable+cover"), "cable cover");
  assert.equal(searchQueryOf("https://duckduckgo.com/?q=sourdough+starter"), "sourdough starter");
  assert.equal(searchQueryOf("https://www.youtube.com/results?search_query=knife+skills"), "knife skills");
  assert.equal(searchQueryOf("https://www.google.com/maps?q=coffee"), null);
  assert.equal(searchQueryOf("https://example.com/search?q=x"), null);
  assert.equal(searchQueryOf("https://www.google.com/search?tbm=nws"), null);
});

test("fallback title for a search is the query", () => {
  assert.equal(titleFromUrl("https://www.google.com/search?q=cable+organizing+covers&rlz=1C"), "cable organizing covers");
});
