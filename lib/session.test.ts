// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  constantTimeEqual,
  createSessionToken,
  isCorrectPassword,
  isValidSessionToken,
  readCookie,
} from "./session.ts";

test("token is the hex HMAC-SHA256 of the fixed string, keyed by the password", async () => {
  const expected = createHmac("sha256", "hunter2").update("tinc-session-v1").digest("hex");
  assert.equal(await createSessionToken("hunter2"), expected);
  assert.match(expected, /^[0-9a-f]{64}$/);
});

test("same password gives the same token, different passwords differ", async () => {
  assert.equal(await createSessionToken("a"), await createSessionToken("a"));
  assert.notEqual(await createSessionToken("a"), await createSessionToken("b"));
});

test("creating a token without a password throws", async () => {
  await assert.rejects(createSessionToken(""));
});

test("a token is valid for its own password only", async () => {
  const token = await createSessionToken("secret");
  assert.equal(await isValidSessionToken(token, "secret"), true);
  // Changing the password logs everyone out.
  assert.equal(await isValidSessionToken(token, "changed"), false);
});

test("missing, empty, tampered or wrong-length tokens are rejected", async () => {
  const token = await createSessionToken("secret");
  assert.equal(await isValidSessionToken(undefined, "secret"), false);
  assert.equal(await isValidSessionToken(null, "secret"), false);
  assert.equal(await isValidSessionToken("", "secret"), false);
  assert.equal(await isValidSessionToken(token.slice(0, -1), "secret"), false);
  assert.equal(await isValidSessionToken(token + "0", "secret"), false);
  assert.equal(await isValidSessionToken(token.replace(/.$/, token.endsWith("0") ? "1" : "0"), "secret"), false);
});

test("nothing is valid when no password is configured", async () => {
  // A token made with an empty key must not let anyone in.
  const forged = createHmac("sha256", "").update("tinc-session-v1").digest("hex");
  assert.equal(await isValidSessionToken(forged, ""), false);
  assert.equal(await isValidSessionToken(forged, undefined), false);
  assert.equal(await isValidSessionToken("anything", undefined), false);
});

test("isCorrectPassword", async () => {
  assert.equal(await isCorrectPassword("secret", "secret"), true);
  assert.equal(await isCorrectPassword("Secret", "secret"), false);
  assert.equal(await isCorrectPassword("", "secret"), false);
  assert.equal(await isCorrectPassword("secret", ""), false);
  assert.equal(await isCorrectPassword("secret", undefined), false);
  assert.equal(await isCorrectPassword("", ""), false);
});

test("constantTimeEqual", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false);
  assert.equal(constantTimeEqual("", ""), true);
});

test("readCookie finds the right cookie in a header", () => {
  const header = "a=1; tinc_session=abc123; other=x=y";
  assert.equal(readCookie(header, "tinc_session"), "abc123");
  assert.equal(readCookie(header, "other"), "x=y");
  assert.equal(readCookie(header, "missing"), undefined);
  assert.equal(readCookie(header, "tinc"), undefined);
  assert.equal(readCookie(null, "a"), undefined);
});
