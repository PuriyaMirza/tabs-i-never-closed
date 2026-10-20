// Asks Claude to pick topic tags + one intent tag for a link.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { INTENTS, type Intent } from "./db.ts";

// Reads ANTHROPIC_API_KEY from the environment automatically.
// Retries twice on rate limits / server errors; gives up after 30s per try.
const client = new Anthropic({ timeout: 30_000, maxRetries: 2 });

// The exact JSON shape we want back. Structured outputs guarantee Claude's
// reply matches this, so we never have to guess-parse free text.
const TagsSchema = z.object({
  topic_tags: z.array(z.string()),
  intent_tag: z.enum(INTENTS),
});

export type Tags = { topic_tags: string[]; intent_tag: Intent };

const SYSTEM = `You tag saved web links for a personal reading inbox.

Return:
- topic_tags: 1 or 2 broad topics, e.g. "travel", "cooking", "product management", "personal finance".
  Strongly prefer reusing a tag from the existing list when one fits, even loosely. Only invent a new tag when nothing existing fits.
  Tags are lowercase, singular ("recipe" not "recipes"), 1–3 words, no "#".
- intent_tag: exactly one of:
  read (articles, essays, threads), watch (videos, talks, films), buy (products, shopping),
  try (recipes, tools, apps, places to visit, things to do), reference (docs, guides, cheat sheets to look things up in later).`;

export async function tagLink(
  link: { title: string; url: string; domain: string },
  existingTags: string[],
): Promise<Tags> {
  const response = await client.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 2048,
    // Tagging is a simple job: low effort keeps it fast and cheap.
    output_config: { effort: "low", format: zodOutputFormat(TagsSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Existing topic tags: ${existingTags.length ? existingTags.join(", ") : "(none yet)"}`,
          "",
          `Title: ${link.title}`,
          `URL: ${link.url}`,
          `Domain: ${link.domain}`,
        ].join("\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Claude returned no tags (stop_reason: ${response.stop_reason})`);
  }
  const { topic_tags, intent_tag } = response.parsed_output;
  return { topic_tags: cleanTags(topic_tags, existingTags), intent_tag };
}

/**
 * Tidies tags: lowercase, trimmed, max 2, no duplicates. If Claude returns
 * a plural like "recipes" while "recipe" already exists, use the existing one.
 */
export function cleanTags(tags: string[], existingTags: string[]): string[] {
  const existing = new Set(existingTags);
  const out: string[] = [];
  for (const raw of tags) {
    let tag = raw.toLowerCase().replace(/^#/, "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!tag) continue;
    if (!existing.has(tag) && tag.endsWith("s") && existing.has(tag.slice(0, -1))) {
      tag = tag.slice(0, -1);
    }
    if (!out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 2);
}
