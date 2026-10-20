// POST /api/login  ← the form on /login (a normal HTML form post, so it also
// works without JavaScript).
// Right password → set the login cookie and go to the inbox.
// Wrong password → back to /login with an error shown.
import { NextResponse } from "next/server";
import { isCorrectPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session.ts";

// 303 = "now GET this other page", so the browser doesn't re-send the password.
const goTo = (req: Request, path: string) => NextResponse.redirect(new URL(path, req.url), 303);

export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return goTo(req, "/login?error=setup");

  const form = await req.formData().catch(() => null);
  const given = form?.get("password");
  if (typeof given !== "string" || !(await isCorrectPassword(given, expected))) {
    return goTo(req, "/login?error=wrong");
  }

  const res = goTo(req, "/");
  res.cookies.set(SESSION_COOKIE, await createSessionToken(expected), {
    httpOnly: true, // page scripts can't read it
    secure: process.env.NODE_ENV === "production", // https only when live
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
