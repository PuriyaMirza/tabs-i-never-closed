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

All calls need the header `x-links-secret: <LINKS_SECRET>`.

| Route | What it does |
|---|---|
| `POST /api/links` body `{"urls": ["https://…"]}` | Save one or many links. Replies with `message` (e.g. "Saved 3 (1 duplicate)") plus `new`, `duplicates`, `reactivated`, `invalid`. Titles and tags are added a few seconds later. |
| `GET /api/links` | 50 newest links (for testing). |
| `POST /api/links/retag` | Tag up to 20 untagged links. Optional body `{"ids": [1,2]}` retags specific links. |

`/test` is a small page for calling these from a phone browser.

## Development

```
npm install
cp .env.example .env.local   # fill in values
npm run dev
npm test                     # unit tests for URL cleanup, titles, tags
```
