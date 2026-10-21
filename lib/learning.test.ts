// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatExamples, type TaggingExample } from "./learning.ts";

const ex = (o: Partial<TaggingExample>): TaggingExample => ({
  title: "T", domain: "d.com", topic_tags: [], intent_tag: "read", ai_topic_tags: null, ai_intent_tag: null, ...o,
});

test("no examples → empty string (prompt unchanged)", () => {
  assert.equal(formatExamples([]), "");
});

test("shows your tags, and Claude's guess only when it differs", () => {
  const text = formatExamples([
    ex({ title: "Cookie recipe", domain: "seriouseats.com", topic_tags: ["cooking"], intent_tag: "try",
         ai_topic_tags: ["cooking", "dessert"], ai_intent_tag: "try" }),
    ex({ title: "Ramen", domain: "wikipedia.org", topic_tags: ["cooking"], intent_tag: "reference",
         ai_topic_tags: ["cooking"], ai_intent_tag: "reference" }),
  ]);
  assert.match(text, /"Cookie recipe" \(seriouseats\.com\) → try; cooking   \[you first guessed: try; cooking, dessert\]/);
  assert.match(text, /"Ramen" \(wikipedia\.org\) → reference; cooking$/m);
});

test("unknown first guess is simply left out", () => {
  const text = formatExamples([ex({ title: "Old link", topic_tags: ["ai"], intent_tag: "watch" })]);
  assert.match(text, /"Old link" \(d\.com\) → watch; ai$/m);
  assert.doesNotMatch(text, /first guessed/);
});
