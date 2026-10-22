// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSummary } from "./summary.ts";

test("drops sentences about what Claude could see (real examples)", () => {
  const cases: [string, string][] = [
    [
      "A Reddit thread from r/theydidthemath asking whether all the world's mosquitoes could fit inside an unspecified container. Only the title and URL were available, so the details are inferred.",
      "A Reddit thread from r/theydidthemath asking whether all the world's mosquitoes could fit inside an unspecified container.",
    ],
    [
      "A Reddit thread in the OpenAI community about roughly $15,000 in expiring OpenAI API credits. The post itself is the only detail available from the title and URL.",
      "A Reddit thread in the OpenAI community about roughly $15,000 in expiring OpenAI API credits.",
    ],
    [
      "An account page on AMC Theatres' website, likely for managing a membership, rewards, or tickets. Only the title and URL were available, so the exact contents are unknown.",
      "An account page on AMC Theatres' website, likely for managing a membership, rewards, or tickets.",
    ],
    [
      "A Reddit life-hack post suggesting you set up email folders and filter rules. Only the title and URL were available, so the details are unconfirmed.",
      "A Reddit life-hack post suggesting you set up email folders and filter rules.",
    ],
    [
      "A Reddit thread in r/simpleliving about how quiet Japanese daily-life videos changed someone's outlook. Only the title and URL are available, so the specific videos and details are unknown.",
      "A Reddit thread in r/simpleliving about how quiet Japanese daily-life videos changed someone's outlook.",
    ],
  ];
  for (const [input, expected] of cases) assert.equal(cleanSummary(input), expected);
});

test("leaves a clean two-sentence summary alone", () => {
  const s =
    "Product page selling a ResMed AirSense 11 CPAP machine, starting at $1,004. It highlights quiet operation and U.S. warranty support.";
  assert.equal(cleanSummary(s), s);
});

test("never returns empty, even if the only sentence is a hedge", () => {
  const s = "Only the title and URL were available.";
  assert.equal(cleanSummary(s), s);
});

test("collapses whitespace and caps the length", () => {
  assert.equal(cleanSummary("  A   short\n summary. "), "A short summary.");
  assert.equal(cleanSummary("word ".repeat(200)).length, 320);
});
