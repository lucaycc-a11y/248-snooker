-- Link blog posts that are translations of each other.
--
-- blog_posts has UNIQUE(slug, locale) — a translation into another locale
-- must be a separate row (own id, own slug/locale), not a field flip on the
-- same row. Until now there was no way to associate those sibling rows, so
-- the admin editor's locale tabs only relabeled the current post's locale
-- column instead of switching to/creating a real translation. This column
-- groups siblings without touching the existing uniqueness constraint.
alter table public.blog_posts
  add column if not exists translation_group_id uuid;

-- Existing rows: each currently-standalone post starts as its own group of one.
update public.blog_posts
  set translation_group_id = id
  where translation_group_id is null;

alter table public.blog_posts
  alter column translation_group_id set default gen_random_uuid();

create index if not exists blog_posts_translation_group_idx
  on public.blog_posts (translation_group_id);
