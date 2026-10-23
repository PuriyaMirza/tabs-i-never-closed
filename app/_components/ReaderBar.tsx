"use client";
// The reader's top bar: back to the list, and the original page. It sticks to
// the top while you scroll, and once the big title has scrolled away it shows
// the title in the middle, so you still know what you're reading.
import { useEffect, useState } from "react";

type Props = { title: string; url: string; back: { href: string; label: string } };

export default function ReaderBar({ title, url, back }: Props) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const heading = document.getElementById("reader-title");
    if (!heading) return;
    // The top 60px are behind this bar, so a title there counts as gone.
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: "-60px 0px 0px 0px",
    });
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <nav className={`reader-bar${stuck ? " is-stuck" : ""}`} aria-label="Reader">
      <a href={back.href} className="reader-back">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
          <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {back.label}
      </a>
      <p className="reader-bar-title" aria-hidden={!stuck}>
        {title}
      </p>
      <a href={url} className="reader-original" target="_blank" rel="noopener noreferrer">
        Original
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
          <path d="M2 9L9 2M3.5 2H9v5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </nav>
  );
}
