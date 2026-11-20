import { SITE_NAME, SITE_URL } from '../../../src/config/blogRules.js'
import { buildArticleSeo } from '../../../src/seo/articleSeo.js'
import { injectHead } from './injectHead.js'
import { fetchPublishedArticle } from './supabaseRest.js'
import { htmlResponse, nextDocument } from './htmlResponse.js'

/**
 * Article URLs at the edge:
 *
 * - `/blog/:slug` — legacy URLs are 301'd to `/news-update/:slug`.
 * - `/news-update/:slug` — the SPA document is returned with the article's
 *   real title/description/Open Graph/JSON-LD injected into `<head>`, so
 *   WhatsApp, Facebook, X and search crawlers preview the article itself
 *   instead of the site homepage.
 * - Unknown or unpublished slugs get a real `404` status (with a `noindex`
 *   head) instead of the SPA's soft-404 `200`.
 * - `?preview=1` requests skip all of this: the editor previews drafts that
 *   only an authenticated session may read, and Row Level Security — not the
 *   edge — decides what the browser receives.
 */

const ARTICLE_PREFIX = '/news-update/'
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 301 from the old `/blog/...` URLs to the canonical `/news-update/...`. */
export function handleLegacyBlog(request) {
  const url = new URL(request.url)
  const rest = url.pathname.slice('/blog'.length)
  return Response.redirect(`${SITE_URL}/news-update${rest}${url.search}`, 301)
}

export async function handleArticleMeta(request, context) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || ARTICLE_PREFIX.slice(0, -1)

  if (url.searchParams.get('preview') === '1') {
    // Editor preview: serve the SPA untouched, RLS does the authorising.
    return context.next()
  }

  const { response, html } = await nextDocument(context)

  let slug = ''
  try {
    slug = decodeURIComponent(path.slice(ARTICLE_PREFIX.length))
  } catch {
    // Malformed percent-encoding — treat the URL as nonexistent.
    return notFound(html, path)
  }

  if (!slug || !SLUG_PATTERN.test(slug)) return notFound(html, path)

  let article = null
  try {
    article = await fetchPublishedArticle(slug)
  } catch {
    // Supabase unreachable: serving the page without injected tags is better
    // than telling crawlers a live article does not exist.
    return htmlResponse(html, { status: response.status })
  }

  if (!article) return notFound(html, path)

  const seo = buildArticleSeo(article, { path })
  return htmlResponse(injectHead(html, seo))
}

function notFound(html, path) {
  const seo = {
    title: `Page Not Found | ${SITE_NAME}`,
    description: 'The article you are looking for does not exist, is hidden, or has moved.',
    robots: 'noindex',
    url: `${SITE_URL}${path}`,
  }
  return htmlResponse(injectHead(html, seo), { status: 404 })
}
