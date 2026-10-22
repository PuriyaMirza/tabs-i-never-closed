-- Paste this whole file into Neon → SQL Editor → Run.
-- Safe to run more than once ("if not exists").

create table if not exists links (
  id          integer generated always as identity primary key,
  -- Normalized URL (tracking params + trailing slash removed). Unique = no duplicates.
  url         text not null unique,
  title       text not null,
  -- Hostname without "www.", e.g. "nytimes.com"
  domain      text not null,
  -- 1–2 topics like {travel, cooking}. Empty = not tagged yet.
  topic_tags  text[] not null default '{}',
  -- One of read/watch/buy/try/reference. NULL = not tagged yet.
  intent_tag  text check (intent_tag in ('read', 'watch', 'buy', 'try', 'reference')),
  -- One short sentence about the page, written by Claude.
  description text,
  -- What Claude first suggested (kept so the app can learn from your edits).
  ai_topic_tags text[],
  ai_intent_tag text,
  created_at  timestamptz not null default now(),
  -- NULL = still active. A timestamp = marked done at that time.
  done_at     timestamptz
);

-- Speeds up "active links, newest first" (the main list).
create index if not exists links_active_created_idx
  on links (created_at desc) where done_at is null;

-- Speeds up tag filters.
create index if not exists links_topic_tags_idx
  on links using gin (topic_tags);

-- One row every time you change a link's tags or intent in the app.
-- The tagger reads these to copy your habits (see lib/learning.ts).
create table if not exists tag_feedback (
  id                 integer generated always as identity primary key,
  link_id            integer not null references links(id) on delete cascade,
  before_topic_tags  text[] not null,
  before_intent_tag  text,
  after_topic_tags   text[] not null,
  after_intent_tag   text,
  created_at         timestamptz not null default now()
);
create index if not exists tag_feedback_link_idx on tag_feedback (link_id, created_at desc);
