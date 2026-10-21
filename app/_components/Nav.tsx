// The page header: the app name, then the Inbox · Done switcher under it.
// Plain links (not client-side navigation) so each page is a full HTML page
// that can be saved for offline reading.
export default function Nav({ current }: { current: "inbox" | "done" }) {
  return (
    <header className="masthead">
      <h1 className="app-title">Tabs I Never Closed</h1>
      <nav aria-label="Views" className="views">
        <a href="/" aria-current={current === "inbox" ? "page" : undefined}>
          Inbox
        </a>
        <span className="sep" aria-hidden="true">·</span>
        <a href="/done" aria-current={current === "done" ? "page" : undefined}>
          Done
        </a>
      </nav>
    </header>
  );
}
