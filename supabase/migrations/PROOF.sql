-- ============================================================================
-- PROOF (last statements on purpose — you must see THREE result tables, never
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
