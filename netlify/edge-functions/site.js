import { handleArticleMeta, handleLegacyBlog } from './lib/articleMetaHandler.js'
import { handleRouteStatus } from './lib/routeStatusHandler.js'
import { handleSitemap } from './lib/sitemapHandler.js'

/**
 * Single Netlify Edge Function for the whole site (`path = "/*"` in
 * netlify.toml), dispatching by URL. One entry point keeps the order of
 * operations explicit instead of relying on how multiple edge functions
 * would be chained:
 *
 *   /sitemap.xml      → dynamic sitemap (published articles + static pages)
 *   /blog/...         → 301 to the canonical /news-update/... URL
 *   /news-update/...  → SEO head injection or real 404 for the article
 *   everything else   → per-route meta, /admin noindex, real 404 for unknown
 *
 * Handlers only *add* metadata or status codes; the document itself always
 * comes from `context.next()` (the SPA + the `/*` rewrite), so what a browser
 * executes is exactly what `npm run build` produced.
 */
export default async function handler(request, context) {
  const { pathname } = new URL(request.url)

  if (pathname === '/sitemap.xml') return handleSitemap(request, context)

  if (pathname === '/blog' || pathname.startsWith('/blog/')) {
    return handleLegacyBlog(request)
  }

  if (pathname.startsWith('/news-update/')) {
    // `/news-update/` (trailing slash, no slug) is the article index page.
    if (!pathname.slice('/news-update/'.length)) return context.next()
    return handleArticleMeta(request, context)
  }

  return handleRouteStatus(request, context)
}
