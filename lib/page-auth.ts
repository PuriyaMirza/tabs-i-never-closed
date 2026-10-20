// A second lock for pages that show your links. proxy.ts already sends
// logged-out visitors to /login; this re-checks inside the page itself, so a
// mistake in the proxy's path list could never expose the data.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSessionToken, SESSION_COOKIE } from "./session.ts";

export async function requireLogin(): Promise<void> {
  const jar = await cookies();
  if (!(await isValidSessionToken(jar.get(SESSION_COOKIE)?.value, process.env.APP_PASSWORD))) {
    redirect("/login");
  }
}
