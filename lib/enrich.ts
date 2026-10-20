// "Enriching" a link = fetching its real page title and tagging it with Claude.
// This runs after the save response is sent, so the Shortcut gets an instant
// answer. If tagging fails, the link simply stays untagged and can be retagged.
import { sql } from "./db.ts";
import { fetchTitle } from "./title.ts";
import { tagLink } from "./tagger.ts";

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
      if (opts.fetchTitles) {
        link.title = await fetchTitle(link.url); // never throws
        await sql`update links set title = ${link.title} where id = ${link.id}`;
      }
      const result = await tagLink(link, tags);
      await sql`
        update links
        set topic_tags = ${result.topic_tags}, intent_tag = ${result.intent_tag}
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
