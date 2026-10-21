// Reading and editing saved links (used by the pages and by /api/links/[id]).
// Server-only: it talks to the database.
import { sql } from "./db.ts";
import type { Link } from "./types.ts";
import type { LinkPatch } from "./patch.ts";

// Turns a database row into a plain Link. The database driver may hand back
// dates as Date objects; we always want ISO strings so they can be sent to
// the browser and into JSON.
function toLink(row: Record<string, unknown>): Link {
  const iso = (v: unknown) => new Date(v as string | Date).toISOString();
  return {
    id: row.id as number,
    url: row.url as string,
    title: row.title as string,
    domain: row.domain as string,
    topic_tags: row.topic_tags as string[],
    intent_tag: row.intent_tag as Link["intent_tag"],
    created_at: iso(row.created_at),
    done_at: row.done_at ? iso(row.done_at) : null,
  };
}

/** Links still in the inbox, newest first. */
export async function getActiveLinks(): Promise<Link[]> {
  const rows = await sql`
    select id, url, title, domain, topic_tags, intent_tag, created_at, done_at
    from links where done_at is null
    order by created_at desc, id desc`;
  return rows.map(toLink);
}

const DONE_LIMIT = 300;

/** Links marked done, most recently done first. */
export async function getDoneLinks(): Promise<Link[]> {
  const rows = await sql`
    select id, url, title, domain, topic_tags, intent_tag, created_at, done_at
    from links where done_at is not null
    order by done_at desc, id desc
    limit ${DONE_LIMIT}`;
  return rows.map(toLink);
}

/** Every topic tag used by any link (active or done), for the autocomplete. */
export async function getAllTopicTags(): Promise<string[]> {
  const rows = await sql`
    select distinct unnest(topic_tags) as tag from links order by tag`;
  return rows.map((r) => r.tag as string);
}

export async function getLink(id: number): Promise<Link | null> {
  const rows = await sql`
    select id, url, title, domain, topic_tags, intent_tag, created_at, done_at
    from links where id = ${id}`;
  return rows[0] ? toLink(rows[0]) : null;
}

/**
 * Applies a (already validated) patch and returns the updated link, or null
 * if there is no such link. It is one UPDATE statement; the "set…" flags say
 * which fields to touch, so we never build SQL text from user input.
 */
export async function updateLink(id: number, patch: LinkPatch): Promise<Link | null> {
  const setDone = patch.done !== undefined;
  const setTags = patch.topic_tags !== undefined;
  const setIntent = patch.intent_tag !== undefined;

  // One statement does three things:
  //   1. remember the link as it was ("before"),
  //   2. apply the change ("updated"),
  //   3. if the tags or intent actually changed, log it to tag_feedback, so
  //      future tagging can learn from your edits (see learning.ts).
  // Marking done twice keeps the first time (coalesce), so a double tap changes nothing.
  const rows = await sql`
    with before as (
      select id, topic_tags, intent_tag from links where id = ${id}
    ),
    updated as (
      update links set
        done_at = case
          when ${setDone}::boolean then (case when ${patch.done ?? false}::boolean then coalesce(done_at, now()) else null end)
          else done_at end,
        topic_tags = case when ${setTags}::boolean then ${patch.topic_tags ?? []}::text[] else topic_tags end,
        intent_tag = case when ${setIntent}::boolean then ${patch.intent_tag ?? null}::text else intent_tag end
      where id = ${id}
      returning id, url, title, domain, topic_tags, intent_tag, created_at, done_at
    ),
    logged as (
      insert into tag_feedback (link_id, before_topic_tags, before_intent_tag, after_topic_tags, after_intent_tag)
      select u.id, b.topic_tags, b.intent_tag, u.topic_tags, u.intent_tag
      from updated u join before b on b.id = u.id
      where b.topic_tags is distinct from u.topic_tags or b.intent_tag is distinct from u.intent_tag
    )
    select * from updated`;
  return rows[0] ? toLink(rows[0]) : null;
}

/** How many links are still open and how many are done (for the footer). */
export async function getCounts(): Promise<{ open: number; done: number }> {
  const [row] = await sql`
    select count(*) filter (where done_at is null)::int as open,
           count(*) filter (where done_at is not null)::int as done
    from links`;
  return { open: row.open as number, done: row.done as number };
}
