-- ============================================================================
-- Prime Realtors blog CMS â€” publish state, SEO fields and row level security
-- ============================================================================
-- Run once in the Supabase SQL editor (Dashboard â†’ SQL Editor â†’ New query),
-- or with `supabase db push` if the CLI is linked to this project.
--
-- What this changes:
--   1. Adds the publish state (draft | published | hidden) that the article
--      list's Publish / Hide / Restore actions write to.
--   2. Adds the SEO columns the admin editor collects but that were never
--      persisted (the save path was failing because they did not exist).
--   3. Adds published_at / updated_at so dates and the sitemap are real.
--   4. Turns on Row Level Security: the public may only read published
--      articles; only a signed-in editor may write anything.
--   5. Repoints an in-body image at its stable /blog/ path (the old value
--      pointed at a Vite content-hashed asset that changes on rebuild).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.blogs
  add column if not exists status          text,
  add column if not exists meta_description text,
  add column if not exists hero_image_alt  text,
  add column if not exists published_at    timestamptz,
  add column if not exists updated_at      timestamptz;

-- Everything currently in the table is live on the site today.
update public.blogs
   set status       = 'published',
       published_at = coalesce(published_at, created_at),
       updated_at   = coalesce(updated_at, created_at)
 where status is null;

alter table public.blogs
  alter column status set not null,
  alter column status set default 'draft',
  alter column updated_at set default (timezone('utc', now()));

alter table public.blogs
  drop constraint if exists blogs_status_check;

alter table public.blogs
  add constraint blogs_status_check
  check (status in ('draft', 'published', 'hidden'));

-- ---------------------------------------------------------------------------
-- 2. Drop display-only columns the application no longer reads.
--    `date` was free text ("November 18, 2026") and `read_time` was typed by
--    hand; both are now derived from published_at and the article body, so
--    keeping them would give two answers to one question.
-- ---------------------------------------------------------------------------
alter table public.blogs drop column if exists date;
alter table public.blogs drop column if exists read_time;
alter table public.blogs drop column if exists secondary_image;
alter table public.blogs drop column if exists secondary_image_alt;

-- ---------------------------------------------------------------------------
-- 3. updated_at is maintained by the database, not by the client.
-- ---------------------------------------------------------------------------
create or replace function public.blogs_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists blogs_touch_updated_at on public.blogs;

create trigger blogs_touch_updated_at
  before update on public.blogs
  for each row
  execute function public.blogs_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Repoint the in-body master-plan image at its stable public path.
--    The stored value referenced a build-hashed /assets/ file.
-- ---------------------------------------------------------------------------
update public.blogs
   set content_html = replace(
         content_html,
         '/assets/layout-DRtMLyHd.webp',
         '/blog/dream-city-layout-ibrahimpatnam.webp'
       )
 where content_html like '%/assets/layout-%';

-- ---------------------------------------------------------------------------
-- 5. Row Level Security â€” the server decides who may read or write.
--    The anon key ships in the browser bundle, so "public" must mean
--    published articles only, and writes must require a signed-in editor.
-- ---------------------------------------------------------------------------
alter table public.blogs enable row level security;

do $$
declare
  existing record;
begin
  for existing in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'blogs'
  loop
    execute format('drop policy %I on public.blogs', existing.policyname);
  end loop;
end $$;

create policy "Published articles are public"
  on public.blogs
  for select
  to anon, authenticated
  using (status = 'published');

create policy "Signed-in editors manage articles"
  on public.blogs
  for all
  to authenticated
  using (true)
  with check (true);

commit;


-- ============================================================================
-- Prime Realtors blog CMS â€” article image storage
-- ============================================================================
-- Run after 0001_blog_cms.sql. Creates the public bucket the admin editor
-- uploads to (or re-points an existing one at the same settings), so article
-- images are stored as real files instead of base64 blobs inside the database
-- row (a base64 row eventually exceeds Postgres' 8 MB per-row limit and the
-- save fails).
--
-- file_size_limit and allowed_mime_types mirror ARTICLE_IMAGE_MAX_BYTES and
-- ARTICLE_IMAGE_TYPES in src/config/blogRules.js (5 MB; jpeg/png/webp/avif).
-- ============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  existing record;
begin
  for existing in
    select policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename  = 'objects'
       and policyname in (
         'Public read of article images',
         'Editors upload article images',
         'Editors update article images',
         'Editors delete article images'
       )
  loop
    execute format('drop policy %I on storage.objects', existing.policyname);
  end loop;
end $$;

create policy "Public read of article images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'blog-images');

create policy "Editors upload article images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'blog-images');

create policy "Editors update article images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'blog-images');

create policy "Editors delete article images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'blog-images');

commit;


-- ============================================================================
-- PROOF (last statements on purpose â€” you must see THREE result tables, never
-- "No rows returned"):
--   1. blogs columns: must contain status/meta_description/published_at and
--      must NOT contain date/read_time/secondary_image
--   2. exactly 2 policies on blogs
--   3. one row: blog-images / t (public bucket)
-- If table 1 shows date/read_time instead -> wrong project.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'blogs'
order by column_name;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'blogs'
order by policyname;

select id, public, file_size_limit
from storage.buckets
where id = 'blog-images';

