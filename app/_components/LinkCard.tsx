"use client";
// One link in the list. Closed, it shows the title, the AI summary (up to 3
// lines) and "site · saved …".
// Tapping the triangle opens it to show the tags and actions:
//   inbox ("active"): edit tags, change intent, Save TXT, mark done, delete
//   Done view: restore, delete
// Once a link's text is saved, a "Read offline" pill under it opens the reader.
import { useId, useState } from "react";
import { INTENTS, type Intent, type Link } from "@/lib/types.ts";
import { cleanTags, MAX_TOPIC_TAGS } from "@/lib/tags.ts";
import { canSaveText, formatBytes } from "@/lib/savedtext.ts";
import { timeAgo } from "@/lib/time.ts";
import { patchLink, removeText, saveText, tagWithAi, type LinkChanges } from "./api.ts";
import { forgetOffline, keepOffline, readerPath } from "./offline.ts";
import DocIcon from "./DocIcon.tsx";
import Triangle from "./Triangle.tsx";

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
  /** Mark done (inbox) or Restore (Done view). */
  onMove: (link: Link) => void;
  /** Delete for good (asks "Are you sure?" first, inside the row). */
  onDelete: (link: Link) => void;
};

export default function LinkCard({ link, mode, now, knownTags, suggestionsId, onChange, onMove, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Which "Save TXT" job is running, for the button's label.
  const [textJob, setTextJob] = useState<"save" | "remove" | null>(null);
  const detailsId = useId();
  const editable = mode === "active";

  // Runs one server call, disabling the row's controls while it works.
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

  // Save TXT: the server fetches the page's text; then the service worker
  // keeps a copy of the reader page so it opens offline straight away.
  async function saveTextNow() {
    setTextJob("save");
    await run(async () => {
      const updated = await saveText(link.id);
      keepOffline(readerPath(link.id));
      return updated;
    });
    setTextJob(null);
  }

  async function removeTextNow() {
    setTextJob("remove");
    await run(async () => {
      const updated = await removeText(link.id);
      forgetOffline(readerPath(link.id));
      return updated;
    });
    setTextJob(null);
  }

  const hasText = link.text_bytes != null;

  function removeTag(tag: string) {
    save({ topic_tags: link.topic_tags.filter((t) => t !== tag) });
  }

  function addTag(event: React.FormEvent) {
    event.preventDefault();
    // Lowercase + trim + reuse an existing spelling ("recipes" -> "recipe").
    const [tag] = cleanTags([draft], knownTags);
    setDraft("");
    setAdding(false);
    if (!tag || link.topic_tags.includes(tag)) return;
    if (link.topic_tags.length >= MAX_TOPIC_TAGS) {
      setError(`A link can have at most ${MAX_TOPIC_TAGS} topic tags.`);
      return;
    }
    save({ topic_tags: [...link.topic_tags, tag] });
  }

  const meta =
    mode === "done" && link.done_at
      ? `done ${timeAgo(link.done_at, now)}`
      : `saved ${timeAgo(link.created_at, now)}`;

  return (
    <li className={`row${open ? " is-open" : ""}`}>
      <span className="row-dot" aria-hidden="true" />

      <div className="row-body">
        <a className="row-title" href={link.url} target="_blank" rel="noopener noreferrer">
          {link.title}
        </a>
        {link.description && <p className="row-desc">{link.description}</p>}
        <p className="row-meta">
          {link.domain}
          <span className="sep" aria-hidden="true">·</span>
          {meta}
        </p>
        {hasText && (
          <a className="read-pill" href={readerPath(link.id)}>
            <DocIcon />
            Read offline
            <span className="read-pill-size">· {formatBytes(link.text_bytes ?? 0)}</span>
          </a>
        )}

        {open && (
          <div className="row-details" id={detailsId}>
            <ul className="chips" aria-label="Tags">
              {link.intent_tag && (
                <li>
                  <span className="chip chip-intent" title="Intent">
                    {link.intent_tag}
                  </span>
                </li>
              )}
              {link.topic_tags.map((tag) => (
                <li key={tag}>
                  <span className="chip">
                    {tag}
                    {editable && (
                      <button
                        type="button"
                        className="chip-x"
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
              {editable && !adding && (
                <li>
                  <button type="button" className="chip chip-add" disabled={busy} onClick={() => setAdding(true)}>
                    + Tag
                  </button>
                </li>
              )}
              {!editable && !link.intent_tag && link.topic_tags.length === 0 && (
                <li className="row-meta">No tags</li>
              )}
            </ul>

            {editable && adding && (
              <form className="add-tag" onSubmit={addTag}>
                <input
                  type="text"
                  aria-label="New topic tag"
                  placeholder="New tag"
                  list={suggestionsId}
                  value={draft}
                  maxLength={40}
                  disabled={busy}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  enterKeyHint="done"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => draft.trim() === "" && setAdding(false)}
                />
                <button type="submit" className="text-link" disabled={busy || draft.trim() === ""}>
                  Add
                </button>
              </form>
            )}

            {confirmingDelete ? (
              <p className="actions" role="group" aria-label="Confirm delete">
                <span className="confirm-text">Delete for good?</span>
                <button type="button" className="text-link danger" disabled={busy} onClick={() => onDelete(link)}>
                  Delete
                </button>
                <span className="sep" aria-hidden="true">·</span>
                <button type="button" className="text-link" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
              </p>
            ) : (
            <p className="actions">
              {editable ? (
                <>
                  {/* An invisible <select> sits on top of the words, so tapping
                      "Change intent" opens the phone's own picker. */}
                  <label className="select-link">
                    <span className="text-link">Change intent</span>
                    <select
                      aria-label="Change intent"
                      value={link.intent_tag ?? ""}
                      disabled={busy}
                      onChange={(e) => save({ intent_tag: e.target.value as Intent })}
                    >
                      <option value="" disabled>
                        Choose…
                      </option>
                      {INTENTS.map((intent) => (
                        <option key={intent} value={intent}>
                          {intent}
                        </option>
                      ))}
                    </select>
                  </label>
                  {link.intent_tag === null && (
                    <>
                      <span className="sep" aria-hidden="true">·</span>
                      <button
                        type="button"
                        className="text-link"
                        disabled={busy}
                        onClick={() => run(() => tagWithAi(link.id))}
                      >
                        {busy ? "Tagging…" : "Tag with AI"}
                      </button>
                    </>
                  )}
                  {(hasText || canSaveText(link.url)) && (
                    <>
                      <span className="sep" aria-hidden="true">·</span>
                      {hasText ? (
                        <button type="button" className="text-link" disabled={busy} onClick={removeTextNow}>
                          {textJob === "remove" ? "Removing text…" : "Remove text"}
                        </button>
                      ) : (
                        <button type="button" className="text-link" disabled={busy} onClick={saveTextNow}>
                          {textJob === "save" ? "Saving text…" : "Save TXT"}
                        </button>
                      )}
                    </>
                  )}
                  <span className="sep" aria-hidden="true">·</span>
                  <button type="button" className="text-link" disabled={busy} onClick={() => onMove(link)}>
                    Mark done
                  </button>
                </>
              ) : (
                <button type="button" className="text-link" disabled={busy} onClick={() => onMove(link)}>
                  Restore
                </button>
              )}
              <span className="sep" aria-hidden="true">·</span>
              <button type="button" className="text-link" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            </p>
            )}

            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className="row-toggle"
        aria-expanded={open}
        aria-controls={open ? detailsId : undefined}
        aria-label={open ? `Hide details for ${link.title}` : `Show tags and actions for ${link.title}`}
        onClick={() => {
          setOpen((o) => !o);
          setAdding(false);
          setConfirmingDelete(false);
        }}
      >
        <Triangle open={open} />
      </button>
    </li>
  );
}
