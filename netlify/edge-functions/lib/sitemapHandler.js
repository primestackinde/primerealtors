import { sitemapPages } from '../../../src/config/sitePages.js'
import { buildSitemap } from './sitemapXml.js'
import { fetchPublishedArticleDates } from './supabaseRest.js'

/**
 * Dynamic `/sitemap.xml`: static pages from the shared registry plus every
 * published article with its real `lastmod`. If Supabase is unreachable the
 * request falls through to the checked-in `public/sitemap.xml` rather than
 * publishing a sitemap that silently drops articles.
 */
export async function handleSitemap(request, context) {
  let articles = []
  try {
    articles = await fetchPublishedArticleDates()
  } catch {
    return context.next()
  }

  const xml = buildSitemap(sitemapPages(), articles)
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}
