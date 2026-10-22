// Asks Claude to pick topic tags + one intent tag for a link.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { INTENTS, type Intent } from "./types.ts";
import { cleanTags } from "./tags.ts";
import type { PageInfo } from "./title.ts";

// cleanTags lives in tags.ts so the browser can use it without loading the
// Claude SDK. It's re-exported here so existing imports keep working.
export { cleanTags };

// Reads ANTHROPIC_API_KEY from the environment automatically.
// Retries twice on rate limits / server errors; gives up after 30s per try.
const client = new Anthropic({ timeout: 30_000, maxRetries: 2 });

// The exact JSON shape we want back. Structured outputs guarantee Claude's
// reply matches this, so we never have to guess-parse free text.
const TagsSchema = z.object({
  topic_tags: z.array(z.string()),
  intent_tag: z.enum(INTENTS),
  description: z.string(),
});

export type Tags = { topic_tags: string[]; intent_tag: Intent; description: string };

const SYSTEM = `You tag saved web links for a personal reading inbox.

Return:
- topic_tags: 1 or 2 broad topics, e.g. "travel", "cooking", "product management", "personal finance".
  Strongly prefer reusing a tag from the existing list when one fits, even loosely. Only invent a new tag when nothing existing fits.
  Tags are lowercase, singular ("recipe" not "recipes"), 1–3 words, no "#".
- intent_tag: exactly one of:
  read (articles, essays, threads), watch (videos, talks, films), buy (products, shopping),
  try (recipes, tools, apps, places to visit, things to do), reference (docs, guides, cheat sheets to look things up in later).
- description: a summary of 1 or 2 short sentences (at most 40 words) of what's actually in the link, so the person
  remembers what it is without opening it.
  - If you get page text, summarize what the page says or offers: the main point, key facts, or what's for sale.
  - If it's a web search, say what was searched for and the likely goal (e.g. finding a part, comparing products, checking news).
  - If you only have the title and URL, say what kind of page it is, using details the URL shows (e.g. an order or return page,
    an account page) and nothing more.
  Never invent specifics the inputs don't support. Don't repeat the title word for word, and don't start with
  "This page", "This article" or "A link".

Sometimes you also get examples of how this person tagged links themselves. Their choices win over the guidance above:
match their intents and topic tags for similar links (same website, same kind of page), and avoid repeating guesses they corrected.`;

export async function tagLink(
  link: { title: string; url: string; domain: string },
  existingTags: string[],
  /** Past edits from formatExamples() in learning.ts; "" if there are none yet. */
  examples = "",
  /** What we could read from the page (fetchPageInfo in title.ts); null if nothing. */
  page: Pick<PageInfo, "description" | "text" | "searchQuery"> | null = null,
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
          ...(examples ? [examples, ""] : []),
          "Tag this link:",
          `Title: ${link.title}`,
          `URL: ${link.url}`,
          `Domain: ${link.domain}`,
          ...(page?.searchQuery ? [`This is a web search for: ${page.searchQuery}`] : []),
          ...(page?.description ? [`Page description: ${page.description}`] : []),
          ...(page?.text ? ["Page text (excerpt):", page.text] : []),
        ].join("\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Claude returned no tags (stop_reason: ${response.stop_reason})`);
  }
  const { topic_tags, intent_tag, description } = response.parsed_output;
  return {
    topic_tags: cleanTags(topic_tags, existingTags),
    intent_tag,
    // Keep it to a couple of lines even if Claude runs long.
    description: description.replace(/\s+/g, " ").trim().slice(0, 320),
  };
}
