"use client";
// The Done view: finished links with a Restore button. The links arrive as
// props, already loaded by the server (see app/done/page.tsx).
import { useState } from "react";
import type { Link } from "@/lib/types.ts";
import { insertNewestFirst } from "@/lib/order.ts";
import { deleteLink, patchLink } from "./api.ts";
import LinkCard from "./LinkCard.tsx";
import Footer from "./Footer.tsx";
import Toast, { useToast } from "./Toast.tsx";
import { useNow } from "./useNow.ts";

type Props = {
  initialLinks: Link[];
  /** How many links were still open when the page loaded (for the footer). */
  initialOpenCount: number;
  serverNow: string;
};

export default function DoneClient({ initialLinks, initialOpenCount, serverNow }: Props) {
  const [links, setLinks] = useState(initialLinks);
  const [openCount, setOpenCount] = useState(initialOpenCount);
  const now = useNow(serverNow);
  const { toast, show, hide } = useToast();

  const byDoneTime = (l: Link) => l.done_at;

  // Restore: the card leaves this list right away; Undo puts it back.
  async function restore(link: Link) {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    try {
      await patchLink(link.id, { done: false });
      setOpenCount((n) => n + 1);
      show("Restored to your inbox", { label: "Undo", run: () => undoRestore(link) });
    } catch (err) {
      setLinks((prev) => insertNewestFirst(prev, link, byDoneTime));
      show(err instanceof Error ? `Couldn't restore: ${err.message}` : "Couldn't restore");
    }
  }

  // Delete: gone right away. If the server says no, it comes back.
  async function remove(link: Link) {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    try {
      await deleteLink(link.id);
      show("Deleted");
    } catch (err) {
      setLinks((prev) => insertNewestFirst(prev, link, byDoneTime));
      show(err instanceof Error ? `Couldn't delete: ${err.message}` : "Couldn't delete");
    }
  }

  async function undoRestore(link: Link) {
    try {
      const done = await patchLink(link.id, { done: true });
      setOpenCount((n) => n - 1);
      setLinks((prev) => insertNewestFirst(prev, done, byDoneTime));
    } catch (err) {
      show(err instanceof Error ? `Couldn't undo: ${err.message}` : "Couldn't undo");
    }
  }

  return (
    <>
      <section className="toolbar">
        <p className="count">({links.length} done)</p>
      </section>
      {links.length === 0 ? (
        <p className="empty">Nothing here yet. Links you mark Done show up here.</p>
      ) : (
        <ul className="rows">
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
              onDelete={remove}
            />
          ))}
        </ul>
      )}
      <Footer open={openCount} done={links.length} />
      <Toast toast={toast} onClose={hide} />
    </>
  );
}
