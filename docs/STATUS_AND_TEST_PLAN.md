# Blog CMS — What We Did, What's Verified, What To Test & Implement

> Status snapshot: 2026-11-20 · Commit `e2dc10c` pushed to
> **https://github.com/primestackinde/primerealtors** (`main`)
> Live project: Supabase `wzwmjgttodgnwjuuuavn` · Site: prime-realtors.in

---

## 1. What we did

### 1.1 Problem found (original review)

The old blog implementation was unsafe and partly broken:

| Problem | Evidence found |
| --- | --- |
| `blogs` table world-writable | anon `UPDATE`/`DELETE` returned 204 (no RLS) |
| Admin "protected" by a password hash baked into the JS bundle | extractable by anyone |
| Save path broken | wrote to a non-existent `secondary_image` column → error 42703 |
| No `status` column | drafts could not exist; nothing to publish/hide |
| Unknown slug rendered the first article | silent wrong content instead of 404 |
| SEO was client-only | WhatsApp/Facebook/X previews showed the homepage |
| Static sitemap, soft-404s (200 for missing pages) | crawl quality |
| `src/data/blogs.js` localStorage seeds | duplicate/dead data path |
| No tests | 0 |

### 1.2 Built (commit `e2dc10c`, 52 files, +6543/−1733)

**One data model, one source of truth**

- `src/config/blogRules.js` — statuses (`draft|published|hidden`),
  `ALLOWED_TRANSITIONS`, `ARTICLE_LIMITS`, validation, slug/date/description
  helpers. Shared by admin UI, service and edge.
- `src/config/sitePages.js` — every indexable static route (sitemap + meta).
- `src/config/siteFaqs.js` — FAQ copy (page + FAQPage schema).
- `src/config/supabase.js` — the only place the Supabase URL/publishable key
  live (public by design; env vars can override at the edge).
- `src/data/articleMapper.js` — DB row → UI shape (pure, shared browser/edge).
- `src/data/blogService.js` — the only data layer: list/get/save/status/delete/
  upload/auth, 15 s timeouts, friendly error mapping.
- **Deleted:** `src/data/blogs.js` (localStorage/seed), legacy `sections`
  renderer, `secondary_image`, stored `date`/`read_time` (both derived now).

**Admin (`/admin`)**

- `AdminPortal.jsx` — Supabase Auth gate (email/password), sign-out.
- `ArticleList.jsx` — **New / Edit / Preview / Publish / Hide / Restore /
  Delete**, search, status chips with counts, empty/loading/error states.
- `ArticleEditor.jsx` — details, Google-style **SERP snippet preview**,
  hero upload + required alt text, Tiptap body (images → Storage, never
  base64), comparison-table editor, FAQ builder, publish bar, dirty guard,
  split live preview.
- `TiptapEditor.jsx` — storage-backed image UX (no `confirm`/`prompt`).

**Public pages**

- `BlogPost.jsx` — single `content_html` body, real not-found state,
  `?preview=1` (signed-in only), TOC from `<h2>`, related articles.
- `NewsUpdate.jsx` — published-only cards, category filter, promo cards kept
  in their own section.
- `Home.jsx` — **Latest insights** section (3 newest published articles).
- `App.jsx` — `/blog/:slug` → redirect to `/news-update/:slug`, real 404 route.

**SEO (dynamic, derived from the article — never hand-maintained)**

- `src/seo/articleSeo.js` + `src/seo/pageSeo.js` — pure builders used by
  **both** the React `<SEO>` component and the edge function (one brain).
- Title `<article> | Prime Realtors`; description `meta_description` →
  `summary` → body excerpt (160 chars); `og:image` from hero; JSON-LD
  `BlogPosting` + `BreadcrumbList` + `FAQPage` (only if FAQs visible);
  `noindex` for drafts/hidden/preview/`/admin`; canonical only when indexable.
- `netlify/edge-functions/site.js` (registered via `netlify.toml` on `/*`):
  - `/news-update/:slug` → injects the real `<head>` into the SPA document
    (social crawlers see the article, not the homepage) and returns **404**
    for unknown/hidden slugs;
  - `/blog/:slug` → **301**;
  - static routes → their own meta (replaces homepage defaults in
    `index.html`);
  - `/sitemap.xml` → dynamic (static pages + published articles, real
    `<lastmod>`), falls back to `public/sitemap.xml` if Supabase is down;
  - unknown paths → real **404** + `noindex` (no more soft-404 `200`s);
  - `/admin` → `noindex, nofollow`.

**Security / database (applied to the live project 2026-11-19)**

- `supabase/migrations/0001_blog_cms.sql` — `status` (+ check constraint),
  `meta_description`, `hero_image_alt`, `published_at`, `updated_at` + trigger,
  backfills existing row → `published`, drops `date`/`read_time`/
  `secondary_image`, fixes one image path, **RLS**:
  - anon → `SELECT` only where `status='published'`
  - authenticated → full `INSERT/UPDATE/DELETE`
- `supabase/migrations/0002_blog_storage.sql` — `blog-images` public bucket,
  5 MB limit, `jpeg/png/webp/avif` only (mirrors `blogRules.js`), 4 storage
  policies (public read, authenticated insert/update/delete).
- Helpers: `RUN_ALL.sql` (both migrations + proof SELECTs),
  `PROOF.sql`, `SET_EDITOR_PASSWORD.sql`.

**Tests & docs**

- 7 vitest files, **65 tests** (`npm test`): rules/transitions/validation,
  row mapping, head injection (replacement/idempotence/escaping/noindex),
  sitemap, shared SEO, **edge dispatch end-to-end** (stubbed), guard tests
  (no credentials in bundle, no localStorage article reads, single Supabase
  config, RLS migration content, edge registered in `netlify.toml`).
- `docs/BLOG_CMS.md` (full reference) + README pointer.

---

## 2. What is verified (done)

| Area | How | Result |
| --- | --- | --- |
| Migrations applied | API probes after run | ✅ new columns live, `date`/`read_time` dropped, article `status=published` |
| RLS on `blogs` | anon `UPDATE`/`DELETE` with `return=representation` on the real row | ✅ `[]` (0 rows), article untouched |
| Storage bucket + limits | anon upload probe; direct bucket read | ✅ upload → **403 RLS denied**; bucket exists (5 MB, MIME list) |
| Public article page | browser, dev server | ✅ renders the real post, correct `<title>` |
| News index | browser | ✅ featured card with title/category/date/author + single-article note |
| Home "Latest insights" | browser | ✅ shows the published article |
| Error states | browser | ✅ pre-migration showed the actionable "run 0001" hint; unknown slug → 404 page; `/admin` → `noindex, nofollow`, private title, no canonical |
| Lint / tests / build | `npm run lint`, `npm test`, `npm run build` | ✅ no errors · **65/65** · builds |
| Code pushed | `git ls-remote` | ✅ `main` = `e2dc10c` on **primestackinde/primerealtors** |

---

## 3. What is NOT verified yet (test these)

### A. Editor flow end-to-end (highest priority)

Sign-in credentials today: `primestack02@gmail.com` /
`CHANGE-ME-Strong-Password1!` ← **placeholder; change it** (§4.1).

On `http://localhost:5174/admin` (or after deploy):

1. **Sign in** — wrong password must show *"Email or password is incorrect."*
2. **New Article** — slug auto-follows title; save a draft → row appears with
   `draft` chip; `/news-update/<slug>` must **404** while draft.
3. **Preview** — list/toolbar *Preview* opens `?preview=1`; visible only while
   signed in; `noindex`.
4. **Publish** — article appears on `/news-update`, Home insights, sitemap;
   public URL returns 200 with the article's own meta.
5. **Hide** — public URL returns **404**, leaves sitemap; *Restore* brings it
   back; nothing is deleted.
6. **Edit/Update** — change title/summary/body → save → `updated_at` changes,
   public page reflects it.
7. **Uploads** — hero image + in-body image: >5 MB must be rejected, `.pdf`
   must be rejected, image must appear via the public Storage URL.
8. **Validation limits** — try exceeding `ARTICLE_LIMITS` (title 150,
   summary 500, meta 160) → inline errors, no save.
9. **Delete** — confirm dialog removes the row permanently.
10. **Dirty guard** — edit without saving → navigation/preview is blocked with
    a warning.

### B. Security re-probes (after any auth change)

- anon `SELECT` of a **draft/hidden** row → 0 rows
- anon `INSERT` → `42501`
- signed-in `INSERT/UPDATE/DELETE` → works
- Auth → Providers → Email → **disable "Enable sign ups"** (still pending!)
- Confirm no password/hash anywhere in the built bundle
  (`grep -r "CHANGE-ME" dist/` must be empty; `npm test` guard also checks)

### C. Edge functions on Netlify (unit-tested under Node only — NOT run on Deno)

After the first deploy, check:

- `/news-update/<slug>` → view-source shows the **article's** `<title>`,
  `og:*`, JSON-LD (not the homepage defaults)
- unknown `/news-update/xyz` → **404** (curl -I, not a browser SPA render)
- `/blog/<old-slug>` → **301** to `/news-update/<slug>`
- `/sitemap.xml` → includes published articles, `<lastmod>`, excludes
  `/thank-you` and drafts
- `/admin` → `noindex, nofollow`
- WhatsApp/Facebook debugger preview shows the article title + hero image

### D. Lint warnings (pre-existing, non-blocking)

`npm run lint` passes with warnings — unused vars in untouched files
(`Home.jsx`, `About.jsx`) and `set-state-in-effect` in `BlogPost.jsx` /
`ArticleEditor.jsx`. Clean these up when convenient.

---

## 4. What to implement / do next

| # | Task | Where | Why |
| --- | --- | --- | --- |
| 1 | **Change the editor password** | run `supabase/SET_EDITOR_PASSWORD.sql` with your own password on line 2 (keep `'…'` quotes), then sign in with it | current password is a committed placeholder |
| 2 | **Run the §3.A editor flow** | dev server → `/admin` | only untested major feature path |
| 3 | **Disable public sign-ups** | Supabase → Authentication → Providers → Email → *Enable sign ups* **off** | otherwise anyone can self-register (RLS treats any signed-in user as an editor) |
| 4 | **Deploy to Netlify** | connect repo `primestackinde/primerealtors` — `netlify.toml` already registers the edge function | activates social-crawler SEO, dynamic sitemap, real 404s |
| 5 | *(optional)* env overrides | Netlify → Site settings → Environment: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | defaults already work from `src/config/supabase.js` |
| 6 | Post-deploy checks | §3.C list | the Deno runtime is the one untested environment |
| 7 | Clean lint warnings | files in §3.D | hygiene |
| 8 | Remove helper scripts if desired | `supabase/SET_EDITOR_PASSWORD.sql`, `RUN_ALL.sql`, `PROOF.sql` are committed for reproducibility — keep or delete | they contain no secrets (placeholder only) |

---

## 5. Commands

```bash
npm run dev      # local dev server (vite; port 5174 if 5173 busy)
npm test         # vitest — 65 tests
npm run lint     # oxlint
npm run build    # production bundle
git push origin main   # remote: https://github.com/primestackinde/primerealtors
```
