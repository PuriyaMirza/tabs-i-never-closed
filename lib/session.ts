// Login sessions without a database.
//
// After you enter the right password we give the browser a cookie whose value
// is a "signature" of a fixed sentence, made with APP_PASSWORD as the key.
// To check the cookie later we just redo the signature and compare. So:
//   - nothing is stored on the server (no session table), and
//   - changing APP_PASSWORD changes every signature, which logs everyone out.
//
// Uses Web Crypto (crypto.subtle) rather than node:crypto so it works in any
// runtime, including proxy.ts.

export const SESSION_COOKIE = "tinc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// The "v1" lets us invalidate every old cookie by bumping it, if we ever need to.
const SESSION_MESSAGE = "tinc-session-v1";

/** The cookie value for a given password: a hex HMAC-SHA256 signature. */
export async function createSessionToken(password: string): Promise<string> {
  if (!password) throw new Error("APP_PASSWORD is not set");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(SESSION_MESSAGE));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * True if `token` is the cookie value that `password` would produce.
 * If no password is configured, nothing is valid (so an unset APP_PASSWORD
 * can never let anyone in).
 */
export async function isValidSessionToken(
  token: string | null | undefined,
  password: string | null | undefined,
): Promise<boolean> {
  if (!token || !password) return false;
  return constantTimeEqual(token, await createSessionToken(password));
}

/**
 * True if `given` is the right password. Both sides are turned into
 * signatures first, so they always have the same length and the comparison
 * time reveals nothing about the real password.
 */
export async function isCorrectPassword(
  given: string,
  expected: string | null | undefined,
): Promise<boolean> {
  if (!expected) return false;
  return constantTimeEqual(await createSessionToken(given || "\0"), await createSessionToken(expected));
}

/** Compares two strings without stopping at the first difference, so timing can't leak where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Pulls one cookie's value out of a raw "Cookie:" header. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}
