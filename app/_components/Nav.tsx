// The page header: the app name, then the Inbox / Done tabs under it, with
// the number of open links next to Inbox. Plain links (not client-side
// navigation) so each page is a full HTML page that can be saved for offline
// reading.
export default function Nav({ current, inboxCount }: { current: "inbox" | "done"; inboxCount: string }) {
  return (
    <header className="masthead">
      <h1 className="app-title">Tabs I Never Closed</h1>
      <nav aria-label="Views" className="views">
        <a href="/" aria-current={current === "inbox" ? "page" : undefined}>
          Inbox
          <span className="tab-count">({inboxCount})</span>
        </a>
        <a href="/done" aria-current={current === "done" ? "page" : undefined}>
          Done
        </a>
      </nav>
    </header>
  );
}
