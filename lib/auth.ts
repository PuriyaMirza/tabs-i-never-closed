// Who is allowed to call the API?
//  - The iOS Shortcut, by sending the shared secret in the x-links-secret header.
//  - The web app, by carrying the login cookie (see session.ts).
import { timingSafeEqual } from "node:crypto";
import { isValidSessionToken, readCookie, SESSION_COOKIE } from "./session.ts";

/** Compares two strings in constant time, so the secret can't be guessed by timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hasValidSecret(req: Request): boolean {
  const expected = process.env.LINKS_SECRET;
  const given = req.headers.get("x-links-secret");
  if (!expected || !given) return false;
  return safeEqual(given, expected);
}

/** True if the request carries a valid login cookie. */
export async function hasValidSession(req: Request): Promise<boolean> {
  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  return isValidSessionToken(token, process.env.APP_PASSWORD);
}

/**
 * Use this for every API route the web app calls: it accepts the login cookie
 * OR the secret header. (Saving links, POST /api/links, stays secret-only
 * because that is what the iOS Shortcut uses.)
 */
export async function isAuthorized(req: Request): Promise<boolean> {
  return hasValidSecret(req) || (await hasValidSession(req));
}
