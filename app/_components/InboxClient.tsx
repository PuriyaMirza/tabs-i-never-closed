"use client";
// The interactive inbox: filters, search, "Surprise me", Done + Undo, and the
// per-card tag editing. The links themselves arrive as props, already loaded
// by the server (see app/page.tsx).
import { useMemo, useState } from "react";
import type { Link } from "@/lib/types.ts";
import { INTENTS } from "@/lib/types.ts";
import {
  chipKeysFor,
  cycleTag,
  emptyFilters,
  filterLinks,
  hasActiveFilters,
  intentKey,
  pickRandom,
  pruneTags,
  topicKey,
  topicTagsIn,
  type Filters,
  type TagMode,
} from "@/lib/filter.ts";
import { insertNewestFirst } from "@/lib/order.ts";
import { patchLink } from "./api.ts";
import LinkCard from "./LinkCard.tsx";
import Toast, { useToast } from "./Toast.tsx";
import { useNow } from "./useNow.ts";

type Props = {
  initialLinks: Link[];
  /** All topic tags in the database (also from done links), for autocomplete. */
  allTags: string[];
  serverNow: string;
};

const SUGGESTIONS_ID = "topic-suggestions";

export default function InboxClient({ initialLinks, allTags, serverNow }: Props) {
  const [links, setLinks] = useState(initialLinks);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const now = useNow(serverNow);
  const { toast, show, hide } = useToast();

  // Chips: the 5 intents, then every topic tag that some active link uses.
  const topics = useMemo(() => topicTagsIn(links), [links]);
  const chipKeys = useMemo(() => chipKeysFor(links), [links]);
  // If a tag disappears from every link, its chip goes away, and so must its filter.
  const activeFilters: Filters = useMemo(
    () => ({ ...filters, tags: pruneTags(filters.tags, chipKeys) }),
    [filters, chipKeys],
  );
  const visible = useMemo(() => filterLinks(links, activeFilters), [links, activeFilters]);
  const suggestions = useMemo(() => [...new Set([...allTags, ...topics])].sort(), [allTags, topics]);
  const filtering = hasActiveFilters(activeFilters);
  const activeChipCount = Object.keys(activeFilters.tags).length;

  function replaceLink(updated: Link) {
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  // Done: the card disappears right away. If the server says no, it comes back.
  async function markDone(link: Link) {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    try {
      await patchLink(link.id, { done: true });
      show("Marked done", { label: "Undo", run: () => undoDone(link) });
    } catch (err) {
      setLinks((prev) => insertNewestFirst(prev, link, (l) => l.created_at));
      show(err instanceof Error ? `Couldn't mark done: ${err.message}` : "Couldn't mark done");
    }
  }

  async function undoDone(link: Link) {
    try {
      const restored = await patchLink(link.id, { done: false });
      setLinks((prev) => insertNewestFirst(prev, restored, (l) => l.created_at));
    } catch (err) {
      show(err instanceof Error ? `Couldn't undo: ${err.message}` : "Couldn't undo");
    }
  }

  // "Surprise me" opens the link in a new tab. window.open must be called
  // directly inside the tap handler (no await before it), or iPhone Safari
  // treats it as a pop-up and blocks it.
  function surpriseMe() {
    const pick = pickRandom(visible);
    if (pick) window.open(pick.url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          aria-label="Search title, link or website"
          placeholder="Search title, link or site"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <details className="filters">
          <summary>
            Filters{activeChipCount > 0 ? ` (${activeChipCount} on)` : ""}
          </summary>
          <p className="muted filter-help">
            Tap a tag once to show only links with it (+), again to hide links with it (−), a third time to turn it off.
          </p>
          <div className="chips" role="group" aria-label="Intent filters">
            {INTENTS.map((intent) => (
              <Chip
                key={intent}
                label={intent}
                kind="intent"
                mode={activeFilters.tags[intentKey(intent)]}
                onTap={() => setFilters((f) => ({ ...f, tags: cycleTag(f.tags, intentKey(intent)) }))}
              />
            ))}
          </div>
          {topics.length > 0 && (
            <div className="chips" role="group" aria-label="Topic filters">
              {topics.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  kind="topic"
                  mode={activeFilters.tags[topicKey(tag)]}
                  onTap={() => setFilters((f) => ({ ...f, tags: cycleTag(f.tags, topicKey(tag)) }))}
                />
              ))}
            </div>
          )}
        </details>

        <div className="summary-row">
          <p className="count" aria-live="polite">
            {visible.length} {visible.length === 1 ? "link" : "links"}
            {filtering && links.length !== visible.length && (
              <span className="muted"> of {links.length}</span>
            )}
          </p>
          {filtering && (
            <button type="button" onClick={() => setFilters(emptyFilters)}>
              Clear
            </button>
          )}
          <button type="button" className="primary" disabled={visible.length === 0} onClick={surpriseMe}>
            Surprise me
          </button>
        </div>
      </div>

      {/* One shared list of suggestions for every card's "Add tag" box. */}
      <datalist id={SUGGESTIONS_ID}>
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>

      {links.length === 0 ? (
        <p className="empty">Nothing in your inbox. Share a link from your phone to save it here.</p>
      ) : visible.length === 0 ? (
        <p className="empty">No links match these filters.</p>
      ) : (
        <ul className="cards">
          {visible.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              mode="active"
              now={now}
              knownTags={suggestions}
              suggestionsId={SUGGESTIONS_ID}
              onChange={replaceLink}
              onMove={markDone}
            />
          ))}
        </ul>
      )}

      <Toast toast={toast} onClose={hide} />
    </>
  );
}

// One filter chip. The state is shown with a symbol, not just colour:
// "+travel" (only these), "−travel" (hide these), "travel" (off).
function Chip({
  label,
  kind,
  mode,
  onTap,
}: {
  label: string;
  kind: "intent" | "topic";
  mode: TagMode | undefined;
  onTap: () => void;
}) {
  const symbol = mode === "include" ? "+" : mode === "exclude" ? "−" : "";
  const stateText = mode === "include" ? "showing only" : mode === "exclude" ? "hidden" : "off";
  return (
    <button
      type="button"
      className={`chip chip-${kind} ${mode ? `chip-${mode}` : ""}`}
      aria-label={`${kind} ${label}: ${stateText}`}
      onClick={onTap}
    >
      {symbol}
      {label}
    </button>
  );
}
