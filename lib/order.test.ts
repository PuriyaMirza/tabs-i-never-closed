// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { insertNewestFirst } from "./order.ts";

type Item = { id: number; at: string };
const item = (id: number, day: number): Item => ({ id, at: `2026-10-${String(day).padStart(2, "0")}T00:00:00Z` });
const at = (x: Item) => x.at;
const ids = (list: Item[]) => list.map((x) => x.id);

test("inserts in the right place", () => {
  const list = [item(1, 20), item(2, 15), item(3, 10)];
  assert.deepEqual(ids(insertNewestFirst(list, item(4, 18), at)), [1, 4, 2, 3]);
  assert.deepEqual(ids(insertNewestFirst(list, item(5, 25), at)), [5, 1, 2, 3]);
  assert.deepEqual(ids(insertNewestFirst(list, item(6, 1), at)), [1, 2, 3, 6]);
});

test("works on an empty list", () => {
  assert.deepEqual(ids(insertNewestFirst([], item(1, 1), at)), [1]);
});

test("replaces an item that is already there instead of duplicating it", () => {
  const list = [item(1, 20), item(2, 15)];
  assert.deepEqual(ids(insertNewestFirst(list, item(2, 15), at)), [1, 2]);
});

test("does not change the original list", () => {
  const list = [item(1, 20)];
  insertNewestFirst(list, item(2, 10), at);
  assert.deepEqual(ids(list), [1]);
});
