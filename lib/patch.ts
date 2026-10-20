// Checking the body of PATCH /api/links/[id]. Pure functions, so they're easy
// to test. Anything the browser sends is untrusted, so nothing is passed to
// the database before it has been through here.
import { INTENTS, type Intent } from "./types.ts";
import { cleanTags, MAX_TOPIC_TAGS } from "./tags.ts";

export type LinkPatch = {
  done?: boolean;
  topic_tags?: string[];
  intent_tag?: Intent;
};

export type PatchResult = { ok: true; patch: LinkPatch } | { ok: false; error: string };

export function parsePatch(body: unknown): PatchResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const input = body as Record<string, unknown>;
  const patch: LinkPatch = {};

  if ("done" in input) {
    if (typeof input.done !== "boolean") return { ok: false, error: "done must be true or false" };
    patch.done = input.done;
  }

  if ("topic_tags" in input) {
    const tags = input.topic_tags;
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
      return { ok: false, error: "topic_tags must be a list of strings" };
    }
    if (tags.length > 50) return { ok: false, error: "Too many topic_tags" };
    // Tidy first with no limit, then complain (rather than silently drop
    // tags) if there are too many.
    const cleaned = cleanTags(tags, [], Infinity);
    if (cleaned.length > MAX_TOPIC_TAGS) {
      return { ok: false, error: `A link can have at most ${MAX_TOPIC_TAGS} topic tags` };
    }
    patch.topic_tags = cleaned;
  }

  if ("intent_tag" in input) {
    if (typeof input.intent_tag !== "string" || !(INTENTS as readonly string[]).includes(input.intent_tag)) {
      return { ok: false, error: `intent_tag must be one of: ${INTENTS.join(", ")}` };
    }
    patch.intent_tag = input.intent_tag as Intent;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to change: send done, topic_tags and/or intent_tag" };
  }
  return { ok: true, patch };
}

/** Turns the id from the URL into a number, or null if it isn't a normal positive id. */
export function parseId(raw: string): number | null {
  if (!/^[0-9]{1,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}
