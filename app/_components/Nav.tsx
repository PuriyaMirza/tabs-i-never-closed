// The Inbox / Done switcher at the top of both list pages.
// Plain links (not client-side navigation) so each page is a full HTML page
// that can be saved for offline reading.
export default function Nav({ current }: { current: "inbox" | "done" }) {
  return (
    <header className="topbar">
      <h1>Tabs I Never Closed</h1>
      <nav aria-label="Views" className="nav">
        <a href="/" aria-current={current === "inbox" ? "page" : undefined}>
          Inbox
        </a>
        <a href="/done" aria-current={current === "done" ? "page" : undefined}>
          Done
        </a>
      </nav>
    </header>
  );
}
