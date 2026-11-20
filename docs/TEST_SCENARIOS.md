# Blog CMS — Test Scenarios

Practical QA script. Run top to bottom after a change; every scenario states
**steps** and the **expected result**. Rules cited here come from
`src/config/blogRules.js` (the single source of truth) — if a scenario and the
code ever disagree, the code wins and this file gets updated in the same change.

**Environment:** dev server `npm run dev` → `http://localhost:5174`
**Actors:** **A** = anonymous visitor (incognito window), **E** = signed-in
editor at `/admin`.

---

## 1. Authentication

| # | Steps | Expected |
| --- | --- | --- |
| 1.1 | E opens `/admin` unauthenticated | Sign-in form (email + password); `title = Article Editor \| Prime Realtors`; `robots = noindex, nofollow`; **no** canonical tag |
| 1.2 | E signs in with wrong password | Inline message *"Email or password is incorrect."* — no redirect, no partial session |
| 1.3 | E signs in with correct password | Article list loads; header shows Sign out |
| 1.4 | A opens `/admin` with a valid editor session cookie in another profile | (If session shared) same list — there is **no** second role; RLS treats any signed-in user as editor. Verify sign-up is disabled (§7.3) so this can't happen by self-registration |
| 1.5 | E clicks Sign out, then refreshes `/admin` | Returns to sign-in form; back-button does not show the list from cache |
| 1.6 | E submits empty email/password | Client-side required validation; no network call |

## 2. Article list — states and actions

| # | Steps | Expected |
| --- | --- | --- |
| 2.1 | E opens `/admin` with articles present | Table with title, status chip (Draft/Published/Hidden), date, counts per status, search box, **New Article** button |
| 2.2 | E searches a title fragment | List filters live; clearing search restores all |
| 2.3 | E clicks a status chip | Filters to that status; counts still visible |
| 2.4 | Database unreachable (dev tools → offline, retry) | Friendly error panel + **Try Again** — no blank screen, no stack traces |
| 2.5 | Empty database | Empty state inviting creation of the first article |
| 2.6 | E hovers/clicks **Delete** on an article | Confirmation required; cancel keeps the row; confirm removes it permanently (no soft-delete) |
| 2.7 | E clicks **Edit** | Editor opens pre-filled with that row's data |
| 2.8 | E clicks **Preview** | Opens `/news-update/<slug>?preview=1` in a new tab |

## 3. Editor — create & validation

| # | Steps | Expected |
| --- | --- | --- |
| 3.1 | E clicks **New Article** | Fresh draft; **slug auto-follows the title** (slugified, lowercase/hyphens); editing the slug manually stops the auto-follow |
| 3.2 | E types a title with symbols, e.g. `Why Open Plots? Near Hyderabad!` | Slug becomes `why-open-plots-near-hyderabad` |
| 3.3 | E saves with empty **Title** | Inline error *"Title is required."* — no save |
| 3.4 | E saves with empty **Summary** | Inline error *"Summary is required — it is shown on cards and used for SEO."* |
| 3.5 | E saves with empty **body** | Inline error *"Write the article body before saving."* |
| 3.6 | E sets slug `My Slug_123` | Error *"Use lowercase letters, numbers and hyphens only."* |
| 3.7 | E exceeds limits: title >120, summary >400, meta >160, subtitle >180, alt >160 chars | Each shows its exact over-limit message; save blocked |
| 3.8 | E duplicates an existing article's slug | Save blocked: *"That URL slug is already used by another article."* (checked by `isSlugAvailable` before every save) |
| 3.9 | E adds 21 FAQs, or an FAQ with empty question/answer, or >200-char question | Errors *"Keep it to 20 FAQs or fewer."* / *"FAQ n needs both a question and an answer."* / *"FAQ n is too long."* |
| 3.10 | Comparison table with <2 columns or 0 rows | Errors *"A comparison table needs at least two columns."* / *"Add at least one row…"* |
| 3.11 | E types a 130-char title but keeps other fields valid, saves, reopens | Row persists; reopening shows exactly what was saved |

## 4. Editor — uploads

| # | Steps | Expected |
| --- | --- | --- |
| 4.1 | Hero image: pick a valid 2 MB `.jpg` | Uploads to `blog-images` bucket; preview appears; **alt text required** before save |
| 4.2 | Pick a `.png` >5 MB | Rejected client-side with the 5 MB message (bucket also enforces it server-side) |
| 4.3 | Pick a `.pdf` / `.txt` | Rejected — accepted types are jpeg/png/webp/avif only |
| 4.4 | In-body image via Tiptap image panel | Uploads to Storage and inserts a real `https://…/blog-images/…` URL (view-source: **no** `data:image/base64`) |
| 4.5 | Reopen the article after upload | Images still load (stored in DB row as URLs, not local blobs) |

## 5. Status lifecycle (the core: publish / hide / restore)

Rules: `draft→published`, `published→hidden|draft`, `hidden→published|draft`.

| # | Steps | Expected |
| --- | --- | --- |
| 5.1 | Create + save a draft; A opens `/news-update/<slug>` | **404** (page not found) — draft invisible to the public |
| 5.2 | A opens `/sitemap.xml` | Draft absent |
| 5.3 | E clicks **Publish** (draft → published) | Chip becomes Published; A refreshes the URL → **200**, full article; card appears on `/news-update` and Home "Latest insights"; draft enters `/sitemap.xml` |
| 5.4 | E clicks **Hide** (published → hidden) | A's URL → **404** immediately (after refresh); card disappears from news/home; leaves sitemap; **row still exists** in the admin list with Hidden chip |
| 5.5 | E clicks **Restore** (hidden → published) | Public URL works again; all listings/sitemap return |
| 5.6 | E moves published → draft (rework) | Same as hidden: public 404, list keeps the row as Draft |
| 5.7 | Hidden → draft → publish | Full round-trip works; no data lost (title/body/images intact) |
| 5.8 | E edits a published article's title, saves | Public page and news card show the new title; `updated_at` changed |
| 5.9 | E edits but doesn't save, clicks Preview/another article | Dirty-state warning blocks accidental loss |

## 6. Preview

| # | Steps | Expected |
| --- | --- | --- |
| 6.1 | E previews a **draft** while signed in | Full article renders at `?preview=1` |
| 6.2 | A (incognito, not signed in) opens the same `?preview=1` URL of a draft | Not shown — treated as not found (RLS returns no row) |
| 6.3 | Inspect head of any `?preview=1` page | `noindex` — never indexable even for signed-in editors |
| 6.4 | E previews a published article | Same article as the public URL |

## 7. Security (run after any auth/schema change)

| # | Steps | Expected |
| --- | --- | --- |
| 7.1 | anon `GET /rest/v1/blogs?select=slug,status` | Only `status=published` rows |
| 7.2 | anon `PATCH`/`DELETE` on a real article id (with `Prefer: return=representation`) | `[]` — **0 rows affected**; row unchanged (verified 2026-11-19) |
| 7.3 | Supabase → Authentication → Providers → Email | **Enable sign ups = OFF** (manual step — self-registration would grant editor rights) |
| 7.4 | anon upload to `blog-images` | `403` RLS denied (verified 2026-11-19) |
| 7.5 | `grep -r "CHANGE-ME\|password" dist/` after `npm run build` | No credentials/hashes in the bundle (`tests/adminSecurity.guard.test.js` also enforces) |
| 7.6 | Signed-out `POST` to REST with any write | `42501` insufficient privilege |
| 7.7 | Editor session + anon session side by side | Editor can write; anon cannot — same table, RLS decides |

## 8. Public pages & SEO (client side)

| # | Steps | Expected |
| --- | --- | --- |
| 8.1 | A opens `/news-update` | Hero + featured card (newest published) + all published cards; **no** drafts/hidden; category chips filter correctly |
| 8.2 | A opens Home | "Latest insights" shows ≤3 newest published articles, linking to their URLs |
| 8.3 | A opens `/news-update/<slug>` | `<title>` = *Article title \| Prime Realtors*; meta description from `meta_description` → `summary`; canonical present; `BlogPosting` JSON-LD; FAQ JSON-LD **only if** FAQs are visible on the page |
| 8.4 | A opens `/blog/<slug>` | Redirects (301 at edge / client redirect locally) to `/news-update/<slug>` |
| 8.5 | A opens `/totally-unknown` | Real 404 page ("Page Not Found"), `noindex`, no canonical |
| 8.6 | A opens an article with FAQs | Visible FAQ section **and** matching `FAQPage` schema (schema must never outlive visible content) |
| 8.7 | Reading time / dates on cards | Derived: ~word count ÷ 200 wpm (min 1), dates from `published_at` — no stored `date`/`read_time` |

## 9. Edge function / deployed behaviour (Netlify — **not yet run**, do after first deploy)

| # | Steps | Expected |
| --- | --- | --- |
| 9.1 | `curl -s https://site/news-update/<slug> \| grep "<title>"` | **Article's** title in raw HTML (crawler view), not the homepage default |
| 9.2 | `curl -I https://site/news-update/does-not-exist` | `HTTP/404` (not 200) |
| 9.3 | `curl -I https://site/blog/<slug>` | `301` → `/news-update/<slug>` (query strings preserved) |
| 9.4 | `curl -s https://site/sitemap.xml` | Published articles + static pages, `<lastmod>` from `updated_at`, no `/thank-you`, no drafts; `content-type: application/xml` |
| 9.5 | Stop Supabase / break the key, request sitemap | Falls back to `public/sitemap.xml` (no 500) |
| 9.6 | `curl -I https://site/admin` | 200 + `noindex, nofollow` in HTML |
| 9.7 | WhatsApp/Facebook share debugger on an article URL | Article title + hero image preview (not site-wide defaults) |
| 9.8 | Unknown path (e.g. `/foo/bar`) | `404` + `noindex` at the edge |
| 9.9 | Request with `?preview=1` | Edge leaves it to the SPA + RLS (no injection) |

## 10. Regression / quality gates

| # | Command / check | Expected |
| --- | --- | --- |
| 10.1 | `npm test` | 7 files, **65 tests** pass |
| 10.2 | `npm run lint` | No errors (pre-existing warnings acceptable) |
| 10.3 | `npm run build` | Succeeds |
| 10.4 | Add a public route | Registered in `src/config/sitePages.js` **and** `App.jsx`; sitemap + meta + 404 detection pick it up automatically |
| 10.5 | Re-run both migrations on a fresh DB | Idempotent — no errors, same end state (`RUN_ALL.sql`) |

---

### Suggested quick pass (smoke, ~5 min)

`1.2 → 1.3 → 3.1 → 3.3 → 5.1 → 5.3 → 5.4 → 5.5 → 8.1 → 8.3 → 10.1`

After deploy, add: `9.1 → 9.2 → 9.4 → 9.7`.
