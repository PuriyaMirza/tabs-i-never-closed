"use client";
// The end of a saved text: "Done with …?", so finishing a read and clearing it
// out of the inbox is one tap (like the Surprise me prompt).
import { useState } from "react";
import { patchLink } from "./api.ts";

type Props = { id: number; title: string; done: boolean; back: { href: string; label: string } };

export default function ReaderEnd({ id, title, done, back }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <section className="reader-end">
        <a className="text-link" href={back.href}>
          Back to {back.label}
        </a>
      </section>
    );
  }

  async function markDone() {
    setBusy(true);
    setError(null);
    try {
      await patchLink(id, { done: true });
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark done");
      setBusy(false);
    }
  }

  return (
    <section className="reader-end" aria-label="Finished?">
      <p className="reader-end-question">Done with “{title}”?</p>
      <div className="reader-end-actions">
        <button type="button" className="done-button" disabled={busy} onClick={markDone}>
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
          {busy ? "Marking done…" : "Mark done"}
        </button>
        <a className="text-link" href={back.href}>
          Not yet
        </a>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
