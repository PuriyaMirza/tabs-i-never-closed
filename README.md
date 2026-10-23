# Tabs I Never Closed

A single-user, mobile-first inbox for links. Share tabs from your phone, and
they get saved, titled, and auto-tagged by Claude.

Stack: Next.js (App Router, TypeScript) · Neon Postgres · Vercel · Claude API.

## Setup

1. **Database:** in Neon → SQL Editor, paste and run [`db/schema.sql`](db/schema.sql).
2. **Vercel:** import this GitHub repo (Add New → Project), then in
   Project → Settings → Environment Variables add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string (pooled) |
   | `ANTHROPIC_API_KEY` | from console.anthropic.com |
   | `LINKS_SECRET` | any long random string (used by the iOS Shortcut) |
   | `APP_PASSWORD` | password for the web UI |

   Redeploy after adding or changing variables.

## API

Calls need the header `x-links-secret: <LINKS_SECRET>`. Except for `POST /api/links`
(secret header only), the web app's login cookie (`tinc_session`) works too.
Every error reply from `POST /api/links` has a short `message` (e.g. `Error: wrong secret`)
that the iOS Shortcut can show.

| Route | What it does |
|---|---|
| `POST /api/links` body `{"urls": ["https://…"]}` | Save one or many links. Replies with `message` (e.g. "Saved 3 (1 duplicate)") plus `new`, `duplicates`, `reactivated`, `invalid`. Titles and tags are added a few seconds later. |
| `GET /api/links` | 50 newest links (for testing). |
| `GET /api/links/[id]` | One link, as `{"link": {...}}`. |
| `PATCH /api/links/[id]` body `{"done": true, "topic_tags": ["a"], "intent_tag": "read"}` | Edit a link (every field optional). Replies with the updated `link`, or 404. |
| `POST /api/links/retag` | Tag up to 20 untagged links. Optional body `{"ids": [1,2]}` retags specific links. |
| `POST /api/links/[id]/text` | "Save TXT": pull the page's readable text out and keep it for offline reading. Replies with the updated `link` (its `text_bytes` is set), or 422 with a `message` if the page has no readable text. |
| `DELETE /api/links/[id]/text` | Remove a link's saved text. Replies with the updated `link`. |

## Web app

Open the site and log in with `APP_PASSWORD`. `/` is the inbox (filters, search, Done + Undo,
tag editing, "Surprise me") and `/done` lists finished links with a Restore button.
Changing `APP_PASSWORD` logs every device out.

**Save TXT:** open a link's actions and tap Save TXT to keep its text in the app. A "Read offline"
pill then opens `/read/[id]`, a clean reader that works without a connection. Articles are pulled
out with Mozilla Readability (free); Reddit threads come from Reddit's JSON (the post and its top
50 comments, free); when Readability finds nothing, Claude Haiku cleans up the page instead
(about a tenth of a cent per page). The text is about 10 KB per article.

`/test` is a small page for calling these from a phone browser.

To save links from the iPhone share sheet, follow [`docs/ios-shortcut.md`](docs/ios-shortcut.md).

## Development

```
npm install
cp .env.example .env.local   # fill in values
npm run dev
npm test                     # unit tests for URL cleanup, titles, tags
```
