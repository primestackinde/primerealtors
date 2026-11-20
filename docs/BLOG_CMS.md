# Blog & Article CMS

One content model, one data layer, one set of rules — used by the admin UI, the
public pages, the SEO layer and the Netlify edge functions.

```
src/config/blogRules.js        rules & limits (statuses, transitions, validation, helpers)
src/config/sitePages.js        every indexable static route (sitemap + meta resolver)
src/config/siteFaqs.js         the site's FAQ answers (page copy + FAQPage schema)
src/config/supabase.js         public Supabase URL + publishable key (single source)
src/data/articleMapper.js      DB row → UI shape (pure, shared with the edge)
src/data/blogService.js        the only data layer: list/get/save/status/delete/upload/auth
src/seo/articleSeo.js          article head + JSON-LD builders (pure)
src/seo/pageSeo.js             static/admin/404 head builders (pure)
netlify/edge-functions/site.js edge: SEO injection, 301s, sitemap, real 404s
supabase/migrations/           schema + Row Level Security + image bucket
tests/                         vitest suite (rules, mapper, head injection, guards)
```

## 1. One-time setup (manual steps)

These cannot be done from the repository:

1. ✅ **Run the migrations** — *(done 2026-11-19 against project
   `wzwmjgttodgnwjuuuavn`; `supabase/migrations/RUN_ALL.sql` is the combined
   paste-ready copy of both + verification SELECTs)*:
   - `supabase/migrations/0001_blog_cms.sql` (status column, SEO columns,
     `published_at`/`updated_at`, RLS, drops `date`/`read_time`/`secondary_image`)
   - `supabase/migrations/0002_blog_storage.sql` (`blog-images` public bucket
     + storage policies for uploads)

   Verified by API probe: new columns present, old columns dropped, anon
   `UPDATE`/`DELETE` affect 0 rows, anon storage upload → 403, bucket exists
   with the 5 MB / MIME limits.

2. ✅ **Create the editor account** — an editor user exists in Authentication →
   Users (created 2026-11-19). Sign in at `/admin` with it.

3. ⬜ **Disable public sign-ups** — Authentication → Providers → Email:
   turn *Enable sign ups* off, so only invited editors can authenticate.
   *(Not done yet — do this once the editor login is confirmed working.)*

4. **Deploy** — Netlify runs `npm run build` and deploys
   `netlify/edge-functions/site.js` automatically (registered in
   `netlify.toml`). Optional environment overrides:
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (defaults come from
   `src/config/supabase.js`).

## 2. Daily workflow

Open `/admin` and sign in.

| Action | Where | What happens |
| --- | --- | --- |
| **New** | Articles → *New Article* | Editor opens on a fresh draft; the slug follows the title until you edit it. |
| **Edit / update** | Articles → *Edit* | Loads the row; *Save Changes* writes immediately (`updated_at` maintained by the database). |
| **Publish** | *Publish* button | `draft → published`: the URL works, it enters the sitemap and the home/news listings. |
| **Hide / disable** | *Hide* button | `published → hidden`: the public URL returns **404** and the article leaves the sitemap; nothing is deleted. |
| **Restore** | *Restore* button | `hidden → published`. |
| **Preview** | *Preview* (list or editor) | Opens `/news-update/<slug>?preview=1` — works for drafts/hidden articles **only while signed in**. |
| **Delete** | Articles → *Delete* | Requires confirmation; the row is removed permanently. |

Editor sections: details → summary & search appearance (with a Google-style
snippet preview) → hero image (upload or URL, plus required alt text) → body
(Tiptap; images upload to Storage, never base64) → optional comparison table →
FAQs → publish bar. Unsaved changes are flagged and block the Preview button
until saved.

## 3. Content model

Table `blogs` (RLS-protected):

| Column | Notes |
| --- | --- |
| `id`, `slug` (unique) | `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$`. |
| `title`, `subtitle`, `author`, `category` | Category is a datalist of `CATEGORY_OPTIONS` in `blogRules.js`. |
| `summary` | Required; shown on cards, used as the default meta description. |
| `meta_description` | Optional override for the search snippet (160 chars). |
| `hero_image`, `hero_image_alt` | Absolute or `/…` path; alt required. |
| `content_html` | **The body — single source of truth.** `h2`/`h3` only (the page owns the `h1`). |
| `faqs`, `comparison_table` | JSON: `{question, answer}[]` and `{heading, intro, headers[], rows[][]}`. |
| `status` | `draft \| published \| hidden` (check constraint in the DB). |
| `published_at` | Set when first published; drives display dates and the sitemap. |
| `updated_at` | Maintained by a DB trigger on every update. |

Deliberately derived, never stored: **reading time** (body word count) and
**display dates** (from `published_at`). The legacy `date`, `read_time`,
`secondary_image` columns are dropped by the migration; the legacy
`src/data/blogs.js` localStorage/seed module is deleted.

Status transitions are defined once in `ALLOWED_TRANSITIONS`:
`draft→published`, `published→hidden|draft`, `hidden→published|draft`.

## 4. SEO

**Rule: metadata is derived from the article, never hand-maintained.**

- Title: `<article title> | Prime Realtors`
- Description: `meta_description` → else `summary` → else a body excerpt,
  truncated to 160 chars (`defaultMetaDescription`).
- `og:image`: the article's hero image made absolute; falls back to
  `/og-image.jpg`. `datePublished`/`dateModified` come from the row.
- JSON-LD: `BlogPosting`, `BreadcrumbList`, `FAQPage` (only when the article
  actually has FAQs — schema must match visible content).
- Drafts, hidden articles, `?preview=1` and `/admin` are `noindex`; pages that
  are not `noindex` get a canonical URL, everything else gets none.

Two writers, one brain:

1. **Edge (for crawlers)** — `netlify/edge-functions/site.js`, mounted on
   `/*`:
   - `/news-update/:slug` → injects the article's real `<head>` into the SPA
     document (so WhatsApp/Facebook/X previews show the article, not the
     homepage) and returns **404** for unknown/hidden slugs;
   - `/blog/:slug` → **301** to `/news-update/:slug`;
   - every static route → its own meta from `sitePages.js` (replacing the
     homepage defaults baked into `index.html`);
   - `/sitemap.xml` → dynamic: static pages + published articles with real
     `<lastmod>`; falls back to `public/sitemap.xml` if Supabase is down;
   - unknown paths → **404** with `noindex` (no more soft-404 `200`s);
   - `/admin` → `noindex, nofollow`.
2. **React `SEO` component** — same builders (`src/seo/*`), applied after each
   client-side navigation and while previewing drafts.

Landing page: `Home` shows a *Latest insights* section (3 newest published
articles) and `NewsUpdate` is the published-only index with category filters —
both read `listArticleCards`, so they always match what is live.

## 5. Access & safety checklist

Route × role matrix (enforced by RLS in `0001_blog_cms.sql`, asserted by
`tests/adminSecurity.guard.test.js`):

| Operation | anon (public key) | authenticated (editor) |
| --- | --- | --- |
| `SELECT` where `status='published'` | ✅ | ✅ |
| `SELECT` draft/hidden | ❌ | ✅ |
| `INSERT` / `UPDATE` / `DELETE` | ❌ | ✅ |
| Storage upload to `blog-images` | ❌ (public read) | ✅ |

- **No credentials in the bundle**: admin auth is Supabase Auth
  (`supabase.auth.signInWithPassword`); the guard test fails the build if a
  password/hash sneaks into `src/`.
- **No soft-404s**: unknown, hidden and draft slugs answer `404` at the edge
  (with `noindex`) instead of a `200`.
- **Timeouts**: 5 s on every edge fetch (`AbortSignal.timeout`), 15 s on
  browser service calls.
- **Server details in errors**: the service maps Supabase codes to friendly
  messages (`readableError`); raw errors are not rendered.
- **Limits shared**: `ARTICLE_LIMITS` is enforced by `validateArticle` in the
  editor and exported to any other caller — no duplicated magic numbers.
- **Known limitation**: field-length limits are enforced in JS, not by DB
  check constraints (editors are trusted accounts; RLS is the boundary).

## 6. Tests

```
npm test          # vitest
npm run lint      # oxlint
npm run build     # vite build
```

Covered: rules/transitions/validation, row mapping, `<head>` injection
(replacement, idempotence, escaping, `noindex`, JSON-LD safety), sitemap
output, shared SEO builders, and the guard tests above.

**Verified against the live project (2026-11-19)**: both migrations applied —
columns/backfill confirmed, old columns dropped, anon `UPDATE`/`DELETE` affect 0
rows, anon storage upload denied (403), `blog-images` bucket present with the
5 MB / MIME limits; the public site lists and renders the published article.

**Not verified from this repository** (state plainly): the edge functions have
not run on Netlify's Deno runtime (they are unit-tested under Node only), the
editor sign-in → save → publish → upload flow has not been exercised end-to-end
against the live project, and public sign-ups are still enabled until step 3
above is done.

## 7. Adding things later

- **A new public route** → add it to `src/config/sitePages.js` *and*
  `App.jsx`; the sitemap, meta resolver and edge 404 detection all read the
  registry (an entry missing there is treated as a 404).
- **A new rule/limit** → `src/config/blogRules.js` only.
- **A new field** → migration + `articleMapper.js` + `blogRules.js`
  (`validateArticle`) + editor; nothing else reads the table directly.
