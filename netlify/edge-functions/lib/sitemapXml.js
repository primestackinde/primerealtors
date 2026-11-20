import { SITE_URL, isoDateOnly } from '../../../src/config/blogRules.js'

/**
 * Builds `/sitemap.xml` from the static page registry (`src/config/sitePages`)
 * plus the currently published articles — hidden and draft articles are never
 * included because only published rows are fetched.
 */

const XMLNS = 'http://www.sitemaps.org/schemas/sitemap/0.9'

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function entry({ loc, lastmod, changefreq, priority }) {
  const lines = [`    <loc>${escapeXml(loc)}</loc>`]
  if (lastmod) lines.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`)
  if (changefreq) lines.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`)
  if (priority) lines.push(`    <priority>${escapeXml(priority)}</priority>`)
  return `  <url>\n${lines.join('\n')}\n  </url>`
}

/**
 * @param {Array} pages static pages from `sitemapPages()`
 * @param {Array} articles normalized article cards (published only)
 */
export function buildSitemap(pages, articles = []) {
  const entries = pages.map((page) => ({
    loc: `${SITE_URL}${page.path === '/' ? '' : page.path}`,
    changefreq: page.changefreq,
    priority: page.priority,
  }))

  for (const article of articles) {
    if (!article.slug) continue
    entries.push({
      loc: `${SITE_URL}/news-update/${encodeURIComponent(article.slug)}`,
      lastmod: isoDateOnly(article.updatedAt || article.publishedAt),
      changefreq: 'monthly',
      priority: '0.7',
    })
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="${XMLNS}">`,
    ...entries.map(entry),
    '</urlset>',
    '',
  ].join('\n')
}
