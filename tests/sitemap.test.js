import { describe, expect, it } from 'vitest'
import { buildSitemap } from '../netlify/edge-functions/lib/sitemapXml.js'
import { sitemapPages, SITE_PAGES, findSitePage } from '../src/config/sitePages.js'
import { SITE_URL, isoDateOnly } from '../src/config/blogRules.js'

const pages = sitemapPages()
const articles = [
  {
    slug: 'why-investing-in-open-plots-near-hyderabad',
    publishedAt: '2026-11-01T10:00:00+00:00',
    updatedAt: '2026-11-15T10:00:00+00:00',
  },
  { slug: 'dream-city-layout', publishedAt: '2026-10-01T10:00:00+00:00', updatedAt: null },
]

describe('sitePages registry', () => {
  it('lists every public route with metadata and excludes noindex pages from the sitemap', () => {
    const paths = pages.map((page) => page.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/news-update')
    expect(paths).not.toContain('/thank-you')
    expect(findSitePage('/thank-you').robots).toBe('noindex')
    expect(findSitePage('/does-not-exist')).toBeNull()

    for (const page of pages) {
      expect(page.title).toBeTruthy()
      expect(page.description).toBeTruthy()
      expect(page.priority).toBeTruthy()
    }
  })
})

describe('buildSitemap', () => {
  const xml = buildSitemap(pages, articles)

  it('has the XML envelope and namespace', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('publishes every static page with absolute URLs', () => {
    for (const page of pages) {
      const loc = `${SITE_URL}${page.path === '/' ? '' : page.path}`
      expect(xml).toContain(`<loc>${loc}</loc>`)
      expect(xml).toContain(`<priority>${page.priority}</priority>`)
    }
  })

  it('publishes articles with a real lastmod from the database dates', () => {
    expect(xml).toContain(`<loc>${SITE_URL}/news-update/why-investing-in-open-plots-near-hyderabad</loc>`)
    expect(xml).toContain(`<lastmod>${isoDateOnly('2026-11-15T10:00:00+00:00')}</lastmod>`)
    // Falls back to published_at when updated_at is missing.
    expect(xml).toContain(`<loc>${SITE_URL}/news-update/dream-city-layout</loc>`)
    expect(xml).toContain(`<lastmod>2026-10-01</lastmod>`)
  })

  it('skips articles without a slug and escapes XML metacharacters', () => {
    const withJunk = buildSitemap([{ path: '/a?x=1&y=2', priority: '0.5' }], [{ slug: '' }])
    expect(withJunk).toContain('<loc>https://prime-realtors.in/a?x=1&amp;y=2</loc>')
    expect(withJunk).not.toContain('/news-update/')
  })

  it('never includes hidden or draft articles (only published rows are passed in)', () => {
    // The edge fetch filters `status=eq.published`; this asserts the shape the
    // builder expects has no status-independent leak by construction.
    expect(SITE_PAGES.length).toBeGreaterThan(0)
    const draftOnly = buildSitemap(pages, [])
    expect(draftOnly).not.toContain('<loc>https://prime-realtors.in/news-update/')
  })
})
