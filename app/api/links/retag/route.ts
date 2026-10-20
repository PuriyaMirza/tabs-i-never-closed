// POST /api/links/retag  → tag links that have no tags yet (e.g. because the
// Claude call failed when they were saved). Handles up to 20 per call; call
// again if "remaining" is above 0.
// Optional body {"ids": [1, 2]} retags those specific links instead.
// Requires the header  x-links-secret: <LINKS_SECRET>
import { NextResponse } from "next/server";
import { hasValidSecret } from "@/lib/auth.ts";
import { sql } from "@/lib/db.ts";
import { enrichLinks } from "@/lib/enrich.ts";

export const maxDuration = 60;
const BATCH = 20;

export async function POST(req: Request) {
  if (!hasValidSecret(req)) {
    return NextResponse.json({ error: "Wrong or missing x-links-secret header" }, { status: 401 });
  }

  // Body is optional, so ignore parse errors.
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : null;

  const targets = ids
    ? await sql`select id, url, title, domain from links where id = any(${ids})`
    : await sql`
        select id, url, title, domain from links
        where intent_tag is null order by created_at desc limit ${BATCH}`;

  const { tagged, failed } = await enrichLinks(
    targets.map((t) => ({ id: t.id, url: t.url, title: t.title, domain: t.domain })),
    { fetchTitles: false },
  );
  const [{ count }] = await sql`select count(*)::int as count from links where intent_tag is null`;

  return NextResponse.json({
    message: `Tagged ${tagged.length}${failed.length ? `, ${failed.length} failed` : ""}. ${count} still untagged.`,
    tagged,
    failed,
    remaining: count,
  });
}
