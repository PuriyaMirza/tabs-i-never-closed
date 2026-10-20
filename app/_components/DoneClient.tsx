"use client";
// The Done view: finished links with a Restore button. The links arrive as
// props, already loaded by the server (see app/done/page.tsx).
import { useState } from "react";
import type { Link } from "@/lib/types.ts";
import { insertNewestFirst } from "@/lib/order.ts";
import { patchLink } from "./api.ts";
import LinkCard from "./LinkCard.tsx";
import Toast, { useToast } from "./Toast.tsx";
import { useNow } from "./useNow.ts";

export default function DoneClient({ initialLinks, serverNow }: { initialLinks: Link[]; serverNow: string }) {
  const [links, setLinks] = useState(initialLinks);
  const now = useNow(serverNow);
  const { toast, show, hide } = useToast();

  const byDoneTime = (l: Link) => l.done_at;

  // Restore: the card leaves this list right away; Undo puts it back.
  async function restore(link: Link) {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    try {
      await patchLink(link.id, { done: false });
      show("Restored to your inbox", { label: "Undo", run: () => undoRestore(link) });
    } catch (err) {
      setLinks((prev) => insertNewestFirst(prev, link, byDoneTime));
      show(err instanceof Error ? `Couldn't restore: ${err.message}` : "Couldn't restore");
    }
  }

  async function undoRestore(link: Link) {
    try {
      const done = await patchLink(link.id, { done: true });
      setLinks((prev) => insertNewestFirst(prev, done, byDoneTime));
    } catch (err) {
      show(err instanceof Error ? `Couldn't undo: ${err.message}` : "Couldn't undo");
    }
  }

  return (
    <>
      <p className="count">
        {links.length} {links.length === 1 ? "link" : "links"} done
      </p>
      {links.length === 0 ? (
        <p className="empty">Nothing here yet. Links you mark Done show up here.</p>
      ) : (
        <ul className="cards">
          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              mode="done"
              now={now}
              knownTags={[]}
              suggestionsId=""
              onChange={() => {}}
              onMove={restore}
            />
          ))}
        </ul>
      )}
      <Toast toast={toast} onClose={hide} />
    </>
  );
}
