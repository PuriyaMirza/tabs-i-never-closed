// Run with: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { hasValidSecret, isAuthorized } from "./auth.ts";
import { createSessionToken } from "./session.ts";

beforeEach(() => {
  process.env.LINKS_SECRET = "shortcut-secret";
  process.env.APP_PASSWORD = "web-password";
});

function request(headers: Record<string, string>) {
  return new Request("https://example.com/api/links", { headers });
}

test("accepts the right x-links-secret header", async () => {
  const req = request({ "x-links-secret": "shortcut-secret" });
  assert.equal(hasValidSecret(req), true);
  assert.equal(await isAuthorized(req), true);
});

test("accepts a valid login cookie", async () => {
  const token = await createSessionToken("web-password");
  const req = request({ cookie: `other=1; tinc_session=${token}` });
  assert.equal(hasValidSecret(req), false);
  assert.equal(await isAuthorized(req), true);
});

test("rejects a request with neither", async () => {
  assert.equal(await isAuthorized(request({})), false);
});

test("rejects a wrong secret and a wrong or forged cookie", async () => {
  assert.equal(await isAuthorized(request({ "x-links-secret": "nope" })), false);
  assert.equal(await isAuthorized(request({ cookie: "tinc_session=deadbeef" })), false);
  const oldToken = await createSessionToken("old-password");
  assert.equal(await isAuthorized(request({ cookie: `tinc_session=${oldToken}` })), false);
});

test("rejects everything when the env vars are not set", async () => {
  delete process.env.LINKS_SECRET;
  delete process.env.APP_PASSWORD;
  assert.equal(await isAuthorized(request({ "x-links-secret": "" })), false);
  assert.equal(await isAuthorized(request({ cookie: "tinc_session=" })), false);
  assert.equal(await isAuthorized(request({ cookie: "tinc_session=abc" })), false);
});
