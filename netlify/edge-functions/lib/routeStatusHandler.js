import { notFoundSeo, resolveStaticSeo } from '../../../src/seo/pageSeo.js'
import { injectHead } from './injectHead.js'
import { htmlResponse, nextDocument } from './htmlResponse.js'

/**
 * Everything that is not an article URL:
 *
 * - static routes get their own title/description/OG tags injected, so a link
 *   preview of `/news-update` or `/faqs` no longer shows the homepage's meta;
 * - `/admin` stays reachable but is marked `noindex, nofollow`;
 * - unknown routes return a real `404` status (SPA body + `noindex`) instead
 *   of the `/*` rewrite's soft-404 `200`.
 *
 * Real files (assets, images, `robots.txt`, …) pass through untouched.
 */

const FILE_LIKE = /\.[a-z0-9]+$/i

export async function handleRouteStatus(request, context) {
  const url = new URL(request.url)
  const pathname = url.pathname

  if (pathname.startsWith('/assets/') || FILE_LIKE.test(pathname)) {
    return context.next()
  }

  const seo = resolveStaticSeo(pathname)
  const { response, html } = await nextDocument(context)

  // Known page (including /admin): swap the homepage defaults for this page's
  // own metadata, keep the normal 200.
  if (seo) return htmlResponse(injectHead(html, seo), { status: response.status })

  // Unknown path: real 404, never indexable.
  return htmlResponse(injectHead(html, notFoundSeo(pathname)), { status: 404 })
}
