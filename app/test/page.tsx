"use client";
// Phase 1 test page: lets you call the API from your phone's browser.
// Your secret is only kept in this browser (localStorage), never in the code.
import { useEffect, useState } from "react";

const SECRET_KEY = "links-secret";

export default function TestPage() {
  const [secret, setSecret] = useState("");
  const [urls, setUrls] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  // Load the saved secret once, when the page opens.
  useEffect(() => {
    setSecret(localStorage.getItem(SECRET_KEY) ?? "");
  }, []);

  function rememberSecret(value: string) {
    setSecret(value);
    localStorage.setItem(SECRET_KEY, value);
  }

  // Calls an API route and shows the status + JSON reply below the buttons.
  async function call(method: "GET" | "POST", path: string, body?: unknown) {
    setBusy(true);
    setOutput("Working…");
    try {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json", "x-links-secret": secret },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Not JSON (e.g. a server error page); show it as-is.
      }
      setOutput(`HTTP ${res.status}\n\n${pretty}`);
    } catch (err) {
      setOutput(`Request failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // One URL per line → ["url1", "url2"]
  const urlList = urls.split(/\s+/).filter(Boolean);

  return (
    <main>
      <header className="masthead">
        <h1 className="app-title">API test page</h1>
      </header>

      <label htmlFor="secret">Secret (LINKS_SECRET)</label>
      <input
        id="secret"
        type="password"
        value={secret}
        onChange={(e) => rememberSecret(e.target.value)}
        autoComplete="off"
      />

      <label htmlFor="urls">URLs (one per line)</label>
      <textarea
        id="urls"
        rows={5}
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder={"https://example.com/article?utm_source=x\nhttps://youtube.com/watch?v=…"}
        autoCapitalize="off"
        autoCorrect="off"
      />

      <div className="row-buttons">
        <button
          className="primary"
          disabled={busy || urlList.length === 0}
          onClick={() => call("POST", "/api/links", { urls: urlList })}
        >
          Save {urlList.length || ""} link{urlList.length === 1 ? "" : "s"}
        </button>
        <button className="text-link" disabled={busy} onClick={() => call("GET", "/api/links")}>
          Show recent
        </button>
        <button className="text-link" disabled={busy} onClick={() => call("POST", "/api/links/retag")}>
          Retag untagged
        </button>
      </div>
      <p className="muted">
        Titles and tags are added a few seconds after saving. Tap “Show recent” after ~10s to see them.
      </p>

      {output && <pre>{output}</pre>}
    </main>
  );
}
