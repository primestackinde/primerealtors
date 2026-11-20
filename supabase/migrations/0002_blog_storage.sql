-- ============================================================================
-- Prime Realtors blog CMS — article image storage
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
