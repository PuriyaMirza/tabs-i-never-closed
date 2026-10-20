// POST /api/links  → save one or many links (used by the iOS Shortcut)
// GET  /api/links  → list the 50 newest links (for testing in Phase 1)
// Both require the header  x-links-secret: <LINKS_SECRET>
import { after, NextResponse } from "next/server";
import { hasValidSecret } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { enrichLinks } from "@/lib/enrich.ts";
import { extractUrls, saveUrls, summarize } from "@/lib/save.ts";

// Give background title-fetching + tagging up to 60 seconds. Anything not
// finished by then stays untagged and can be fixed with /api/links/retag.
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!hasValidSecret(req)) {
    return NextResponse.json({ error: "Wrong or missing x-links-secret header" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON like {"urls": ["https://…"]}' }, { status: 400 });
  }
  const { urls, invalid } = extractUrls((body as { urls?: unknown } | null)?.urls);
  if (urls.length === 0) {
    return NextResponse.json(
      { error: "No valid http(s) URLs found in body.urls", invalid, message: "Nothing to save" },
      { status: 400 },
    );
  }

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
}

export async function GET(req: Request) {
  if (!hasValidSecret(req)) {
    return NextResponse.json({ error: "Wrong or missing x-links-secret header" }, { status: 401 });
  }
  const links = await sql`
    select * from links order by created_at desc limit 50`;
  return NextResponse.json({ links });
}
