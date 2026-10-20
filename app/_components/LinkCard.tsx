"use client";
// One link in the list. In the inbox ("active") it has the tag editor and a
// Done button; in the Done view it is read-only with a Restore button.
import { useState } from "react";
import { INTENTS, type Intent, type Link } from "@/lib/types.ts";
import { cleanTags, MAX_TOPIC_TAGS } from "@/lib/tags.ts";
import { timeAgo } from "@/lib/time.ts";
import { patchLink, tagWithAi, type LinkChanges } from "./api.ts";

type Props = {
  link: Link;
  mode: "active" | "done";
  now: number;
  /** Every topic tag that exists, so a typed tag can reuse the spelling of an existing one. */
  knownTags: string[];
  /** id of the <datalist> that offers tag suggestions while typing. */
  suggestionsId: string;
  /** Called with the saved link after a successful edit. */
  onChange: (link: Link) => void;
  /** Done button (inbox) or Restore button (Done view). */
  onMove: (link: Link) => void;
};

export default function LinkCard({ link, mode, now, knownTags, suggestionsId, onChange, onMove }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editable = mode === "active";

  // Runs one server call, disabling the card's controls while it works.
  async function run(job: () => Promise<Link>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await job());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const save = (changes: LinkChanges) => run(() => patchLink(link.id, changes));

  function removeTag(tag: string) {
    save({ topic_tags: link.topic_tags.filter((t) => t !== tag) });
  }

  function addTag(event: React.FormEvent) {
    event.preventDefault();
    // Lowercase + trim + reuse an existing spelling ("recipes" -> "recipe").
    const [tag] = cleanTags([draft], knownTags);
    setDraft("");
    if (!tag || link.topic_tags.includes(tag)) return;
    if (link.topic_tags.length >= MAX_TOPIC_TAGS) {
      setError(`A link can have at most ${MAX_TOPIC_TAGS} topic tags.`);
      return;
    }
    save({ topic_tags: [...link.topic_tags, tag] });
  }

  return (
    <li className="card">
      <a className="card-title" href={link.url} target="_blank" rel="noopener noreferrer">
        {link.title}
      </a>
      <p className="muted card-meta">
        {link.domain} ·{" "}
        {mode === "done" && link.done_at
          ? `done ${timeAgo(link.done_at, now)}, saved ${timeAgo(link.created_at, now)}`
          : `saved ${timeAgo(link.created_at, now)}`}
      </p>

      <ul className="tags" aria-label="Tags">
        {link.intent_tag && (
          <li>
            <span className="tag tag-intent" title="Intent">
              {link.intent_tag}
            </span>
          </li>
        )}
        {link.topic_tags.map((tag) => (
          <li key={tag}>
            <span className="tag tag-topic">
              {tag}
              {editable && (
                <button
                  type="button"
                  className="tag-x"
                  aria-label={`Remove tag ${tag}`}
                  disabled={busy}
                  onClick={() => removeTag(tag)}
                >
                  ×
                </button>
              )}
            </span>
          </li>
        ))}
        {!link.intent_tag && link.topic_tags.length === 0 && <li className="muted">No tags yet</li>}
      </ul>

      {editable && (
        <div className="editor">
          <select
            aria-label="Intent"
            value={link.intent_tag ?? ""}
            disabled={busy}
            onChange={(e) => save({ intent_tag: e.target.value as Intent })}
          >
            {link.intent_tag === null && (
              <option value="" disabled>
                Intent…
              </option>
            )}
            {INTENTS.map((intent) => (
              <option key={intent} value={intent}>
                {intent}
              </option>
            ))}
          </select>

          <form className="add-tag" onSubmit={addTag}>
            <input
              type="text"
              aria-label="Add a topic tag"
              placeholder="Add tag"
              list={suggestionsId}
              value={draft}
              maxLength={40}
              disabled={busy}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" disabled={busy || draft.trim() === ""}>
              Add
            </button>
          </form>

          {link.intent_tag === null && (
            <button type="button" disabled={busy} onClick={() => run(() => tagWithAi(link.id))}>
              {busy ? "Working…" : "Tag with AI"}
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <div className="card-actions">
        <button type="button" className={editable ? "primary" : undefined} disabled={busy} onClick={() => onMove(link)}>
          {editable ? "Done" : "Restore"}
        </button>
      </div>
    </li>
  );
}
