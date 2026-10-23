// POST   /api/links/123/text → "Save TXT": pull the readable text out of the
//                             link's page and keep it for offline reading.
//                             Replies { "link": {...} } (its text_bytes is now set),
//                             or 422 with a message if the page has no readable text.
// DELETE /api/links/123/text → remove the saved text. Replies { "link": {...} }.
// Needs the login cookie or the x-links-secret header.
import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth.ts";
import { ExtractError, extractText } from "@/lib/extract.ts";
import { getLink, setSavedText } from "@/lib/links.ts";
import { parseId } from "@/lib/patch.ts";

// Downloading a page, and maybe asking Claude to clean it up, can take a while.
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

const error = (status: number, text: string) =>
  NextResponse.json({ error: text, message: `Error: ${text}` }, { status });

export async function POST(req: Request, { params }: Context) {
  if (!(await isAuthorized(req))) return error(401, "Not logged in");
  const id = parseId((await params).id);
  const link = id === null ? null : await getLink(id);
  if (!link) return error(404, "Link not found");

  try {
    const text = await extractText(link.url, link.title);
    const updated = await setSavedText(link.id, text);
    return updated ? NextResponse.json({ link: updated }) : error(404, "Link not found");
  } catch (err) {
    if (err instanceof ExtractError) return error(422, err.message);
    throw err;
  }
}

export async function DELETE(req: Request, { params }: Context) {
  if (!(await isAuthorized(req))) return error(401, "Not logged in");
  const id = parseId((await params).id);
  const link = id === null ? null : await setSavedText(id, null);
  return link ? NextResponse.json({ link }) : error(404, "Link not found");
}
