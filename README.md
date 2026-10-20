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

## Web app

Open the site and log in with `APP_PASSWORD`. `/` is the inbox (filters, search, Done + Undo,
tag editing, "Surprise me") and `/done` lists finished links with a Restore button.
Changing `APP_PASSWORD` logs every device out.

`/test` is a small page for calling these from a phone browser.

## Development

```
npm install
cp .env.example .env.local   # fill in values
npm run dev
npm test                     # unit tests for URL cleanup, titles, tags
```
