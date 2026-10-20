// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chipKeysFor,
  cycleTag,
  emptyFilters,
  filterLinks,
  hasActiveFilters,
  intentKey,
  linkKeys,
  matchesQuery,
  nextMode,
  pickRandom,
  pruneTags,
  topicKey,
  topicTagsIn,
  type Filters,
} from "./filter.ts";
import type { Intent } from "./types.ts";

function link(id: number, topic_tags: string[], intent_tag: Intent | null, extra: Partial<{ title: string; url: string; domain: string }> = {}) {
  return {
    id,
    title: extra.title ?? `Title ${id}`,
    url: extra.url ?? `https://site${id}.com/page`,
    domain: extra.domain ?? `site${id}.com`,
    topic_tags,
    intent_tag,
  };
}

const links = [
  link(1, ["travel", "food"], "read"),
  link(2, ["travel"], "watch"),
  link(3, ["cooking"], "try"),
  link(4, [], null),
  link(5, ["food"], "buy"),
];
const ids = (list: { id: number }[]) => list.map((l) => l.id);
const withTags = (tags: Filters["tags"], query = ""): Filters => ({ tags, query });

test("no filters returns everything, in the same order", () => {
  assert.deepEqual(ids(filterLinks(links, emptyFilters)), [1, 2, 3, 4, 5]);
});

test("one included topic keeps only links that have it", () => {
  assert.deepEqual(ids(filterLinks(links, withTags({ [topicKey("travel")]: "include" }))), [1, 2]);
});

test("several included tags mean at least one of them (OR)", () => {
  const f = withTags({ [topicKey("travel")]: "include", [topicKey("cooking")]: "include" });
  assert.deepEqual(ids(filterLinks(links, f)), [1, 2, 3]);
});

test("included topic and intent also mean OR", () => {
  const f = withTags({ [topicKey("cooking")]: "include", [intentKey("buy")]: "include" });
  assert.deepEqual(ids(filterLinks(links, f)), [3, 5]);
});

test("an excluded tag hides any link that has it", () => {
  assert.deepEqual(ids(filterLinks(links, withTags({ [topicKey("travel")]: "exclude" }))), [3, 4, 5]);
});

test("several excluded tags hide links with any of them", () => {
  const f = withTags({ [topicKey("travel")]: "exclude", [intentKey("buy")]: "exclude" });
  assert.deepEqual(ids(filterLinks(links, f)), [3, 4]);
});

test("exclude beats include when a link has both", () => {
  const f = withTags({ [topicKey("travel")]: "include", [topicKey("food")]: "exclude" });
  // 1 has travel and food (hidden), 2 has travel only (kept)
  assert.deepEqual(ids(filterLinks(links, f)), [2]);
});

test("only excludes leaves untagged links visible", () => {
  assert.ok(ids(filterLinks(links, withTags({ [topicKey("food")]: "exclude" }))).includes(4));
});

test("an include hides untagged links", () => {
  assert.ok(!ids(filterLinks(links, withTags({ [intentKey("read")]: "include" }))).includes(4));
});

test("intent filters work", () => {
  assert.deepEqual(ids(filterLinks(links, withTags({ [intentKey("watch")]: "include" }))), [2]);
  assert.deepEqual(ids(filterLinks(links, withTags({ [intentKey("watch")]: "exclude" }))), [1, 3, 4, 5]);
});

test("a topic tag named like an intent is not confused with the intent", () => {
  const odd = [link(1, ["read"], "watch"), link(2, [], "read")];
  assert.deepEqual(ids(filterLinks(odd, withTags({ [topicKey("read")]: "include" }))), [1]);
  assert.deepEqual(ids(filterLinks(odd, withTags({ [intentKey("read")]: "include" }))), [2]);
});

test("including and excluding everything possible can leave no links", () => {
  const f = withTags({ [topicKey("travel")]: "include", [intentKey("read")]: "exclude", [intentKey("watch")]: "exclude" });
  assert.deepEqual(filterLinks(links, f), []);
});

test("search matches title, url and domain, ignoring case", () => {
  const list = [
    link(1, [], null, { title: "Best Ramen in Tokyo", url: "https://a.com/x", domain: "a.com" }),
    link(2, [], null, { title: "Other", url: "https://b.com/Pizza-Guide", domain: "b.com" }),
    link(3, [], null, { title: "Other", url: "https://c.com/z", domain: "Nytimes.com" }),
  ];
  assert.deepEqual(ids(filterLinks(list, withTags({}, "RAMEN"))), [1]);
  assert.deepEqual(ids(filterLinks(list, withTags({}, "pizza"))), [2]);
  assert.deepEqual(ids(filterLinks(list, withTags({}, "nytimes"))), [3]);
  assert.deepEqual(ids(filterLinks(list, withTags({}, "zzz"))), []);
});

test("search: blank means no search, every word must match, extra spaces are fine", () => {
  const l = link(1, [], null, { title: "Best Ramen in Tokyo", url: "https://a.com/x", domain: "a.com" });
  assert.equal(matchesQuery(l, ""), true);
  assert.equal(matchesQuery(l, "   "), true);
  assert.equal(matchesQuery(l, "  ramen   tokyo "), true);
  assert.equal(matchesQuery(l, "ramen paris"), false);
});

test("search treats special characters literally", () => {
  const l = link(1, [], null, { title: "C++ (2nd ed.)", url: "https://a.com/x?y=1", domain: "a.com" });
  assert.equal(matchesQuery(l, "c++"), true);
  assert.equal(matchesQuery(l, "(2nd"), true);
  assert.equal(matchesQuery(l, ".*"), false);
});

test("search and tag filters combine (AND)", () => {
  const list = [
    link(1, ["food"], "read", { title: "Ramen" }),
    link(2, ["food"], "read", { title: "Pizza" }),
    link(3, ["travel"], "read", { title: "Ramen trip" }),
  ];
  const f = withTags({ [topicKey("food")]: "include" }, "ramen");
  assert.deepEqual(ids(filterLinks(list, f)), [1]);
});

test("filterLinks does not change its input", () => {
  const copy = JSON.parse(JSON.stringify(links));
  filterLinks(links, withTags({ [topicKey("travel")]: "exclude" }, "x"));
  assert.deepEqual(links, copy);
});

test("tapping a chip cycles neutral -> include -> exclude -> neutral", () => {
  assert.equal(nextMode(undefined), "include");
  assert.equal(nextMode("include"), "exclude");
  assert.equal(nextMode("exclude"), undefined);

  let tags: Filters["tags"] = {};
  const key = topicKey("travel");
  tags = cycleTag(tags, key);
  assert.deepEqual(tags, { [key]: "include" });
  tags = cycleTag(tags, key);
  assert.deepEqual(tags, { [key]: "exclude" });
  tags = cycleTag(tags, key);
  assert.deepEqual(tags, {});
});

test("cycleTag does not change the old object or other chips", () => {
  const before: Filters["tags"] = { a: "include", b: "exclude" };
  const after = cycleTag(before, "a");
  assert.deepEqual(before, { a: "include", b: "exclude" });
  assert.deepEqual(after, { a: "exclude", b: "exclude" });
});

test("linkKeys lists topics plus the intent", () => {
  assert.deepEqual(linkKeys({ topic_tags: ["a", "b"], intent_tag: "buy" }), ["topic:a", "topic:b", "intent:buy"]);
  assert.deepEqual(linkKeys({ topic_tags: [], intent_tag: null }), []);
});

test("topicTagsIn is unique and sorted", () => {
  assert.deepEqual(topicTagsIn(links), ["cooking", "food", "travel"]);
  assert.deepEqual(topicTagsIn([]), []);
});

test("chipKeysFor gives the 5 intents plus each topic in use", () => {
  assert.deepEqual(chipKeysFor(links), [
    "intent:read", "intent:watch", "intent:buy", "intent:try", "intent:reference",
    "topic:cooking", "topic:food", "topic:travel",
  ]);
});

test("pruneTags forgets chips that no longer exist", () => {
  const tags: Filters["tags"] = { "topic:gone": "include", "topic:food": "exclude", "intent:read": "include" };
  assert.deepEqual(pruneTags(tags, chipKeysFor(links)), { "topic:food": "exclude", "intent:read": "include" });
});

test("hasActiveFilters", () => {
  assert.equal(hasActiveFilters(emptyFilters), false);
  assert.equal(hasActiveFilters({ tags: {}, query: "  " }), false);
  assert.equal(hasActiveFilters({ tags: {}, query: "x" }), true);
  assert.equal(hasActiveFilters({ tags: { a: "include" }, query: "" }), true);
});

test("pickRandom", () => {
  assert.equal(pickRandom([]), undefined);
  assert.equal(pickRandom(["a"]), "a");
  assert.equal(pickRandom(["a", "b", "c"], () => 0), "a");
  assert.equal(pickRandom(["a", "b", "c"], () => 0.5), "b");
  assert.equal(pickRandom(["a", "b", "c"], () => 0.999999), "c");
  // Never goes out of range, even if random() returned exactly 1.
  assert.equal(pickRandom(["a", "b", "c"], () => 1), "c");
});
