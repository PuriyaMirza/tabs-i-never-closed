"use client";
// The interactive inbox: filters, search, "Surprise me" (+ its "Done with
// it?" prompt), Done + Undo, and the per-card tag editing. The links
// themselves arrive as props, already loaded by the server (see app/page.tsx).
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
import { deleteLink, patchLink } from "./api.ts";
import LinkCard from "./LinkCard.tsx";
import Footer from "./Footer.tsx";
import Toast, { useToast } from "./Toast.tsx";
import { useNow } from "./useNow.ts";

type Props = {
  initialLinks: Link[];
  /** How many links were already done when the page loaded (for the footer). */
  initialDoneCount: number;
  /** All topic tags in the database (also from done links), for autocomplete. */
  allTags: string[];
  serverNow: string;
};

const SUGGESTIONS_ID = "topic-suggestions";

export default function InboxClient({ initialLinks, initialDoneCount, allTags, serverNow }: Props) {
  const [links, setLinks] = useState(initialLinks);
  const [doneCount, setDoneCount] = useState(initialDoneCount);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  // Search box and filter panel stay tucked away until their word is tapped.
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The link "Surprise me" last opened, until you answer "Done with it?".
  const [surprisedId, setSurprisedId] = useState<number | null>(null);
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
  // Looked up in the list, so the prompt goes away by itself if the link is
  // marked done or deleted some other way.
  const surprised = links.find((l) => l.id === surprisedId);

  function replaceLink(updated: Link) {
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  // Done: the card disappears right away. If the server says no, it comes back.
  async function markDone(link: Link) {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    try {
      await patchLink(link.id, { done: true });
      setDoneCount((n) => n + 1);
      show("Marked done", { label: "Undo", run: () => undoDone(link) });
    } catch (err) {
      setLinks((prev) => insertNewestFirst(prev, link, (l) => l.created_at));
      show(err instanceof Error ? `Couldn't mark done: ${err.message}` : "Couldn't mark done");
    }
  }

  async function undoDone(link: Link) {
    try {
      const restored = await patchLink(link.id, { done: false });
      setDoneCount((n) => n - 1);
      setLinks((prev) => insertNewestFirst(prev, restored, (l) => l.created_at));
    } catch (err) {
      show(err instanceof Error ? `Couldn't undo: ${err.message}` : "Couldn't undo");
    }
  }

  // Delete: gone right away. If the server says no, it comes back.
  async function remove(link: Link) {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    try {
      await deleteLink(link.id);
      show("Deleted");
    } catch (err) {
      setLinks((prev) => insertNewestFirst(prev, link, (l) => l.created_at));
      show(err instanceof Error ? `Couldn't delete: ${err.message}` : "Couldn't delete");
    }
  }

  // "Surprise me" opens the link in a new tab. window.open must be called
  // directly inside the tap handler (no await before it), or iPhone Safari
  // treats it as a pop-up and blocks it.
  // Then "Done with it?" waits mid-screen for when you come back.
  function surpriseMe() {
    const pick = pickRandom(visible);
    if (!pick) return;
    window.open(pick.url, "_blank", "noopener,noreferrer");
    setSurprisedId(pick.id);
  }

  const showSearch = searchOpen || filters.query !== "";

  return (
    <>
      <section className="toolbar" aria-label="Search and filters">
        <p className="count" aria-live="polite">
          ({filtering ? `${visible.length} of ${links.length}` : links.length} open)
        </p>
        <p className="controls">
          <button
            type="button"
            className="text-link"
            aria-expanded={showSearch}
            onClick={() => {
              // Closing the search box also clears what was typed.
              if (showSearch) setFilters((f) => ({ ...f, query: "" }));
              setSearchOpen(!showSearch);
            }}
          >
            Search
          </button>
          <span className="sep" aria-hidden="true">·</span>
          <button
            type="button"
            className="text-link"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            Filters{activeChipCount > 0 ? ` (${activeChipCount})` : ""}
          </button>
          <span className="sep" aria-hidden="true">·</span>
          <button type="button" className="text-link" disabled={visible.length === 0} onClick={surpriseMe}>
            Surprise me
          </button>
          {filtering && (
            <>
              <span className="sep" aria-hidden="true">·</span>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setFilters(emptyFilters);
                  setSearchOpen(false);
                }}
              >
                Clear
              </button>
            </>
          )}
        </p>

        {showSearch && (
          <input
            type="search"
            className="search"
            aria-label="Search title, link or website"
            placeholder="Title, link or site"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
          />
        )}

        {filtersOpen && (
          <div className="filter-panel">
            <p className="filter-help">
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
          </div>
        )}
      </section>

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
        <ul className="rows">
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
              onDelete={remove}
            />
          ))}
        </ul>
      )}

      <Footer open={links.length} done={doneCount} />
      {surprised && (
        <SurprisePrompt
          link={surprised}
          onDone={() => {
            setSurprisedId(null);
            markDone(surprised);
          }}
          onDismiss={() => setSurprisedId(null)}
        />
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
      className={`chip chip-filter${kind === "intent" ? " chip-filter-intent" : ""}${mode ? ` is-${mode}` : ""}`}
      aria-label={`${kind} ${label}: ${stateText}`}
      onClick={onTap}
    >
      {symbol}
      {label}
    </button>
  );
}

// Asks about the link "Surprise me" opened, so it can be marked done without
// scrolling to find it. Unlike a toast it doesn't go away by itself: it has
// to still be there when you come back from reading. Tapping the dimmed page
// around it is the same as "Not yet".
function SurprisePrompt({ link, onDone, onDismiss }: { link: Link; onDone: () => void; onDismiss: () => void }) {
  return (
    <>
      <div className="surprise-overlay" aria-hidden="true" onClick={onDismiss} />
      <div className="toast surprise-prompt" role="status" aria-live="polite">
        <p>Done with “{link.title}”?</p>
        <span className="surprise-buttons">
          <button type="button" className="toast-action" onClick={onDone}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.25" />
              <path
                d="M5.5 9.25L7.9 11.5L12.5 6.75"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Mark done
          </button>
          <button type="button" className="toast-action" onClick={onDismiss}>
            Not yet
          </button>
        </span>
      </div>
    </>
  );
}
