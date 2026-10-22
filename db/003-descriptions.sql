-- One-sentence descriptions. Paste into Neon → SQL Editor → Run. Safe to run more than once.
-- (Already applied to the live database.)
alter table links add column if not exists description text;
