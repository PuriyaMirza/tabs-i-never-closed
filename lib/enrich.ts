// "Enriching" a link = fetching its real page title and tagging it with Claude.
// This runs after the save response is sent, so the Shortcut gets an instant
// answer. If tagging fails, the link simply stays untagged and can be retagged.
import { sql } from "./db.ts";
import { fetchPageInfo } from "./title.ts";
import { tagLink } from "./tagger.ts";
import { formatExamples, getTaggingExamples } from "./learning.ts";

type Target = { id: number; url: string; title: string; domain: string };

/** All topic tags currently used, alphabetically. */
export async function getExistingTags(): Promise<string[]> {
  const rows = await sql`
    select distinct unnest(topic_tags) as tag from links order by tag`;
  return rows.map((r) => r.tag as string);
}

export async function enrichLinks(
  targets: Target[],
  opts: { fetchTitles: boolean },
): Promise<{ tagged: number[]; failed: { id: number; error: string }[] }> {
  // One shared tag list, so tags invented for one link in this batch can be
  // reused by the next ones.
  const tags = await getExistingTags();
  const tagged: number[] = [];
  const failed: { id: number; error: string }[] = [];

  await runWithLimit(targets, 5, async (link) => {
    try {
      // Read the page so Claude can summarize what's actually on it.
      const page = await fetchPageInfo(link.url); // never throws
      // New links get the real page title. Searches always show their query
      // (instead of "Google Search").
      if (opts.fetchTitles || page.searchQuery) {
        link.title = page.title;
        await sql`update links set title = ${link.title} where id = ${link.id}`;
      }
      // Show Claude how you tagged similar links (learning from your edits).
      const examples = formatExamples(await getTaggingExamples(link.domain, link.id));
      const result = await tagLink(link, tags, examples, page);
      // Also remember Claude's guess, so later edits can be compared with it.
      await sql`
        update links
        set topic_tags = ${result.topic_tags}, intent_tag = ${result.intent_tag},
            ai_topic_tags = ${result.topic_tags}, ai_intent_tag = ${result.intent_tag},
            description = ${result.description}
        where id = ${link.id}`;
      for (const t of result.topic_tags) if (!tags.includes(t)) tags.push(t);
      tagged.push(link.id);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`Tagging failed for link ${link.id} (${link.url}):`, error);
      failed.push({ id: link.id, error });
    }
  });

  return { tagged, failed };
}

/**
 * Writes the short summary for links that don't have one yet (e.g. saved
 * before summaries existed). Only the summary is saved, plus the query as the
 * title for searches; your tags are never touched. Runs in the background
 * when the inbox opens.
 */
export async function describeMissing(limit: number): Promise<number> {
  const rows = await sql`
    select id, url, title, domain from links
    where description is null and done_at is null
    order by created_at desc limit ${limit}`;
  if (rows.length === 0) return 0;
  const tags = await getExistingTags();
  let written = 0;
  await runWithLimit(rows as Target[], 4, async (link) => {
    try {
      const page = await fetchPageInfo(link.url); // never throws
      const { description } = await tagLink(link, tags, "", page);
      await sql`
        update links
        set description = ${description},
            title = case when ${page.searchQuery !== null}::boolean then ${page.title} else title end
        where id = ${link.id} and description is null`;
      written++;
    } catch (err) {
      console.error(`Describing link ${link.id} failed:`, err instanceof Error ? err.message : err);
    }
  });
  return written;
}

/** Runs `fn` over `items`, at most `limit` at a time. */
async function runWithLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}
