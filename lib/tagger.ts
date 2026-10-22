// Asks Claude to pick topic tags + one intent tag for a link.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { INTENTS, type Intent } from "./types.ts";
import { cleanTags } from "./tags.ts";

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
});

export type Tags = { topic_tags: string[]; intent_tag: Intent };

const SYSTEM = `You tag saved web links for a personal reading inbox.

Return:
- topic_tags: 1 or 2 broad topics, e.g. "travel", "cooking", "product management", "personal finance".
  Strongly prefer reusing a tag from the existing list when one fits, even loosely. Only invent a new tag when nothing existing fits.
  Tags are lowercase, singular ("recipe" not "recipes"), 1–3 words, no "#".
- intent_tag: exactly one of:
  read (articles, essays, threads), watch (videos, talks, films), buy (products, shopping),
  try (recipes, tools, apps, places to visit, things to do), reference (docs, guides, cheat sheets to look things up in later).

Sometimes you also get examples of how this person tagged links themselves. Their choices win over the guidance above:
match their intents and topic tags for similar links (same website, same kind of page), and avoid repeating guesses they corrected.`;

export async function tagLink(
  link: { title: string; url: string; domain: string },
  existingTags: string[],
  /** Past edits from formatExamples() in learning.ts; "" if there are none yet. */
  examples = "",
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
