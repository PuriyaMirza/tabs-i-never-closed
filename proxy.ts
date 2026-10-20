// The password gate for pages. (In Next.js 16 this file is called proxy.ts;
// it used to be middleware.ts.) It runs before a page is shown: no valid
// login cookie means you are sent to /login.
//
// It does NOT cover the API: those routes check the cookie or the secret
// header themselves, and reply 401 instead of redirecting.
import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/session.ts";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSessionToken(token, process.env.APP_PASSWORD)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

// Which paths the gate runs on: everything EXCEPT the ones listed here.
// Left open on purpose:
//   login, api/       the login page, and API routes (they check auth themselves)
//   _next/            the app's own scripts and styles
//   favicon.ico, manifest.webmanifest, sw.js, icons/, apple-touch-icon.png
//                     the home-screen app files: the browser fetches these
//                     without cookies, so they must load without logging in
//   test              the Phase 1 test page (it needs the secret to do anything)
// Each name has to match a whole path piece, so "/testing" is still protected.
export const config = {
  matcher: [
    "/((?!(?:login|api|_next|icons|test)(?:/|$)|(?:favicon\\.ico|manifest\\.webmanifest|sw\\.js|apple-touch-icon\\.png)$).*)",
  ],
};
