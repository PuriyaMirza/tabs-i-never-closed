-- Tag learning. Paste into Neon → SQL Editor → Run. Safe to run more than once.

-- What Claude first suggested for each link, kept separately from the tags
-- you end up with, so the app can see where you disagreed.
alter table links add column if not exists ai_topic_tags text[];
alter table links add column if not exists ai_intent_tag text;

-- Links tagged before this existed: their current tags are Claude's guess
-- (close enough; a few may already include your edits).
update links
set ai_topic_tags = topic_tags, ai_intent_tag = intent_tag
where ai_intent_tag is null and intent_tag is not null;

-- One row every time you change a link's tags or intent in the app.
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
