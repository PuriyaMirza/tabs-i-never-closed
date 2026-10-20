// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseId, parsePatch } from "./patch.ts";

test("accepts done, topic_tags and intent_tag", () => {
  assert.deepEqual(parsePatch({ done: true }), { ok: true, patch: { done: true } });
  assert.deepEqual(parsePatch({ done: false }), { ok: true, patch: { done: false } });
  assert.deepEqual(parsePatch({ intent_tag: "buy" }), { ok: true, patch: { intent_tag: "buy" } });
  assert.deepEqual(parsePatch({ topic_tags: ["a"], intent_tag: "read", done: false }), {
    ok: true,
    patch: { done: false, topic_tags: ["a"], intent_tag: "read" },
  });
});

test("an empty topic_tags list is allowed (removing the last tag)", () => {
  assert.deepEqual(parsePatch({ topic_tags: [] }), { ok: true, patch: { topic_tags: [] } });
});

test("tags are lowercased, trimmed and de-duplicated", () => {
  const r = parsePatch({ topic_tags: ["  Travel ", "travel", "#Food", "", "   "] });
  assert.deepEqual(r, { ok: true, patch: { topic_tags: ["travel", "food"] } });
});

test("ignores unknown fields", () => {
  assert.deepEqual(parsePatch({ done: true, id: 5, url: "https://evil.example" }), {
    ok: true,
    patch: { done: true },
  });
});

test("rejects bad bodies", () => {
  for (const body of [null, "x", 5, [], undefined]) assert.equal(parsePatch(body).ok, false);
});

test("rejects an empty patch", () => {
  assert.equal(parsePatch({}).ok, false);
  assert.equal(parsePatch({ unknown: 1 }).ok, false);
});

test("rejects bad done values", () => {
  for (const done of ["true", 1, null, undefined]) assert.equal(parsePatch({ done }).ok, false);
});

test("rejects bad topic_tags", () => {
  for (const topic_tags of ["travel", [1], [null], [["a"]], null, {}]) {
    assert.equal(parsePatch({ topic_tags }).ok, false);
  }
  assert.equal(parsePatch({ topic_tags: Array(51).fill("x") }).ok, false);
  const tooMany = parsePatch({ topic_tags: ["a", "b", "c", "d", "e", "f", "g"] });
  assert.equal(tooMany.ok, false);
});

test("rejects bad intent_tag values", () => {
  for (const intent_tag of ["", "READ", "other", null, 1, ["read"]]) {
    assert.equal(parsePatch({ intent_tag }).ok, false);
  }
});

test("all five intents are accepted", () => {
  for (const intent_tag of ["read", "watch", "buy", "try", "reference"]) {
    assert.equal(parsePatch({ intent_tag }).ok, true);
  }
});

test("parseId", () => {
  assert.equal(parseId("42"), 42);
  assert.equal(parseId("0"), null);
  assert.equal(parseId("-1"), null);
  assert.equal(parseId("1.5"), null);
  assert.equal(parseId("abc"), null);
  assert.equal(parseId(""), null);
  assert.equal(parseId("1; drop table links"), null);
  assert.equal(parseId("99999999999999"), null);
});
