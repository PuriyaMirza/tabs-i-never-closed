// How the browser talks to our own API. The login cookie goes along
// automatically, so no secret is needed here.
import type { Intent, Link } from "@/lib/types.ts";

export type LinkChanges = { done?: boolean; topic_tags?: string[]; intent_tag?: Intent };

// Sends a request and returns the parsed JSON, or throws an Error with a
// message that is fine to show on screen.
async function call(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
    });
  } catch {
    throw new Error("No connection. Check your internet and try again.");
  }
  if (res.status === 401) {
    // Login expired (or the password was changed): go log in again.
    window.location.href = "/login";
    throw new Error("Please log in again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error : "Something went wrong";
    throw new Error(message);
  }
  return data;
}

/** Edit a link (mark done, change tags, ...). Returns the updated link. */
export async function patchLink(id: number, changes: LinkChanges): Promise<Link> {
  const data = await call(`/api/links/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
  return data.link as Link;
}

/** Asks Claude to tag one link, then loads the result. */
export async function tagWithAi(id: number): Promise<Link> {
  const result = await call("/api/links/retag", { method: "POST", body: JSON.stringify({ ids: [id] }) });
  const tagged = Array.isArray(result.tagged) ? result.tagged : [];
  if (!tagged.includes(id)) throw new Error("Claude couldn't tag this one. Try again in a bit.");
  const data = await call(`/api/links/${id}`);
  return data.link as Link;
}
