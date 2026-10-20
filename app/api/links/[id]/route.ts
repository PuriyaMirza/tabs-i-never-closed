// GET   /api/links/123  → one link
// PATCH /api/links/123  → edit one link. Body (all optional, at least one):
//   { "done": true|false,
//     "topic_tags": ["travel", "food"],
//     "intent_tag": "read" | "watch" | "buy" | "try" | "reference" }
// Replies { "link": {...} } with the updated link, or 404 if there is no such link.
// Needs the login cookie or the x-links-secret header.
import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth.ts";
import { getLink, updateLink } from "@/lib/links.ts";
import { parseId, parsePatch } from "@/lib/patch.ts";

// In Next.js 16 the route's params arrive as a Promise, so we await them.
type Context = { params: Promise<{ id: string }> };

const unauthorized = () =>
  NextResponse.json({ error: "Not logged in", message: "Error: not logged in" }, { status: 401 });
const notFound = () =>
  NextResponse.json({ error: "Link not found", message: "Error: link not found" }, { status: 404 });

export async function GET(req: Request, { params }: Context) {
  if (!(await isAuthorized(req))) return unauthorized();
  const id = parseId((await params).id);
  if (id === null) return notFound();

  const link = await getLink(id);
  return link ? NextResponse.json({ link }) : notFound();
}

export async function PATCH(req: Request, { params }: Context) {
  if (!(await isAuthorized(req))) return unauthorized();
  const id = parseId((await params).id);
  if (id === null) return notFound();

  const body = await req.json().catch(() => undefined);
  const parsed = parsePatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, message: `Error: ${parsed.error}` }, { status: 400 });
  }

  const link = await updateLink(id, parsed.patch);
  return link ? NextResponse.json({ link }) : notFound();
}
