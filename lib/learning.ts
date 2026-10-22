// Learning from your edits. Every time you change a link's tags or intent,
// a row goes into the tag_feedback table (see updateLink in links.ts). When a
// new link is tagged, we show Claude how you tagged similar links before:
// same website first, then your most recent edits.
import { sql } from "./db.ts";
import type { Intent } from "./types.ts";

export type TaggingExample = {
  title: string;
  domain: string;
  topic_tags: string[];
  intent_tag: Intent | null;
  /** What Claude had guessed, if we know it. */
  ai_topic_tags: string[] | null;
  ai_intent_tag: Intent | null;
};

const MAX_EXAMPLES = 25;

/** Links you have edited, as they look now (your final say), best matches first. */
export async function getTaggingExamples(domain: string, excludeId: number): Promise<TaggingExample[]> {
  const rows = await sql`
    select l.title, l.domain, l.topic_tags, l.intent_tag, l.ai_topic_tags, l.ai_intent_tag
    from links l
    join (
      select link_id, max(created_at) as last_edit from tag_feedback group by link_id
    ) f on f.link_id = l.id
    where l.id <> ${excludeId} and l.intent_tag is not null
    order by (l.domain = ${domain}) desc, f.last_edit desc
    limit ${MAX_EXAMPLES}`;
  return rows as TaggingExample[];
}

/**
 * Turns examples into the text Claude reads. Where your choice differs from
 * Claude's first guess, the guess is shown too, so Claude sees what to avoid.
 * Returns "" when there is nothing to learn from yet.
 */
export function formatExamples(examples: TaggingExample[]): string {
  if (examples.length === 0) return "";
  const lines = examples.map((e) => {
    const mine = `${e.intent_tag}; ${e.topic_tags.join(", ") || "no topics"}`;
    let line = `- "${e.title}" (${e.domain}) → ${mine}`;
    const guessed =
      e.ai_intent_tag !== null && e.ai_topic_tags !== null
        ? `${e.ai_intent_tag}; ${e.ai_topic_tags.join(", ") || "no topics"}`
        : null;
    if (guessed && guessed !== mine) line += `   [you first guessed: ${guessed}]`;
    return line;
  });
  return [
    "How this person tagged links they corrected or tagged by hand (intent; topics). Copy their habits for similar links:",
    ...lines,
  ].join("\n");
}
