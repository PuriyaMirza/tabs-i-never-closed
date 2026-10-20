// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { timeAgo } from "./time.ts";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test("recent times", () => {
  assert.equal(timeAgo(ago(10_000), NOW), "just now");
  assert.equal(timeAgo(ago(-5_000), NOW), "just now"); // phone clock slightly behind
  assert.equal(timeAgo(ago(5 * MIN), NOW), "5 minutes ago");
  assert.equal(timeAgo(ago(3 * HOUR), NOW), "3 hours ago");
});

test("days, weeks, months, years", () => {
  assert.equal(timeAgo(ago(1 * DAY), NOW), "yesterday");
  assert.equal(timeAgo(ago(4 * DAY), NOW), "4 days ago");
  assert.equal(timeAgo(ago(7 * DAY), NOW), "last week");
  assert.equal(timeAgo(ago(21 * DAY), NOW), "3 weeks ago");
  assert.equal(timeAgo(ago(60 * DAY), NOW), "2 months ago");
  assert.equal(timeAgo(ago(400 * DAY), NOW), "last year");
  assert.equal(timeAgo(ago(800 * DAY), NOW), "2 years ago");
});

test("accepts Dates and numbers, and ignores garbage", () => {
  assert.equal(timeAgo(new Date(NOW - 21 * DAY), NOW), "3 weeks ago");
  assert.equal(timeAgo(NOW - 21 * DAY, NOW), "3 weeks ago");
  assert.equal(timeAgo("not a date", NOW), "");
});
