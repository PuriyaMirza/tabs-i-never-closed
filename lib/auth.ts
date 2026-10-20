// Checks the shared secret the iOS Shortcut sends in the x-links-secret header.
import { timingSafeEqual } from "node:crypto";

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
