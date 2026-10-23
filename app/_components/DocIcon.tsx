// A small page-of-text icon, for "Read offline" and the reader's "Saved for offline".
export default function DocIcon() {
  return (
    <svg className="doc-icon" width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
      <path d="M1.5 1.5h6l3 3v8h-9z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M3.5 7h5M3.5 9.5h5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
