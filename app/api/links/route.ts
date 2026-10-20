// POST /api/links  → save one or many links (used by the iOS Shortcut).
//                    Needs the header  x-links-secret: <LINKS_SECRET>  (only that:
//                    the login cookie is not accepted here).
// GET  /api/links  → list the 50 newest links (for testing). Needs the secret
//                    header or the login cookie.
//
// Every error reply has a "message" the iOS Shortcut can show in its
// notification, plus an "error" with more detail.
import { after, NextResponse } from "next/server";
import { hasValidSecret, isAuthorized } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { enrichLinks } from "@/lib/enrich.ts";
import { extractUrls, saveUrls, summarize } from "@/lib/save.ts";

// Give background title-fetching + tagging up to 60 seconds. Anything not
// finished by then stays untagged and can be fixed with /api/links/retag.
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!hasValidSecret(req)) {
    return NextResponse.json(
      { error: "Wrong or missing x-links-secret header", message: "Error: wrong secret" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Body must be JSON like {"urls": ["https://…"]}', message: "Error: couldn't read the request" },
      { status: 400 },
    );
  }
  const { urls, invalid } = extractUrls((body as { urls?: unknown } | null)?.urls);
  if (urls.length === 0) {
    return NextResponse.json(
      { error: "No valid http(s) URLs found in body.urls", invalid, message: "Error: no valid link to save" },
      { status: 400 },
    );
  }

  try {
    const result = await saveUrls(urls);
    result.invalid = invalid;

    // After the response is sent: fetch real titles + tag new links, and tag
    // any restored links that were never tagged.
    const toEnrich = result.new;
    const toTagOnly = result.reactivated.filter((r) => r.untagged);
    if (toEnrich.length || toTagOnly.length) {
      after(async () => {
        await enrichLinks(toEnrich, { fetchTitles: true });
        await enrichLinks(toTagOnly, { fetchTitles: false });
      });
    }

    return NextResponse.json({ message: summarize(result), ...result });
  } catch (err) {
    // Most likely the database is unreachable. The details go to the server
    // log; the Shortcut just gets a short message.
    console.error("Saving links failed:", err);
    return NextResponse.json(
      { error: "Saving failed on the server", message: "Error: couldn't save (server problem)" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json(
      { error: "Not logged in, and wrong or missing x-links-secret header", message: "Error: not logged in" },
      { status: 401 },
    );
  }
  const links = await sql`
    select * from links order by created_at desc limit 50`;
  return NextResponse.json({ links });
}
