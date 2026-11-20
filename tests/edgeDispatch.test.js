import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../netlify/edge-functions/site.js'

/**
 * Runs the real edge entry point under Node with a stubbed `context.next()`
 * (the SPA document the redirects would serve) so the dispatch, head
 * injection, redirects, status codes and sitemap output are exercised
 * together. Netlify's own Deno runtime is not simulated here — see
 * docs/BLOG_CMS.md for what remains unverified.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INDEX_HTML = readFileSync(join(ROOT, 'index.html'), 'utf8')

function makeContext(body = INDEX_HTML, status = 200) {
  return {
    next: vi.fn(async () => new Response(body, {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })),
  }
}

function request(path) {
  return new Request(`https://prime-realtors.in${path}`)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('edge dispatch: legacy blog URLs', () => {
  it('301 redirects /blog/:slug to the canonical /news-update/:slug URL', async () => {
    const response = await handler(request('/blog/why-open-plots?ref=x'), makeContext())

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://prime-realtors.in/news-update/why-open-plots?ref=x')
  })
})

describe('edge dispatch: static routes', () => {
  it('replaces the homepage defaults with the route metadata and keeps 200', async () => {
    const response = await handler(request('/faqs'), makeContext())
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('<title>Janaharsha Plot FAQs')
    expect(html).toContain('rel="canonical" href="https://prime-realtors.in/faqs"')
    expect(html).toContain('id="faq-schema-jsonld"')
    expect(html).toContain('<meta charset="UTF-8" />')
  })

  it('marks /admin noindex without blocking it', async () => {
    const response = await handler(request('/admin'), makeContext())
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('content="noindex, nofollow"')
    expect(html).not.toContain('rel="canonical"')
  })

  it('passes real files straight through untouched', async () => {
    const context = makeContext('<html>asset</html>')
    const response = await handler(request('/assets/index-abc123.js'), context)

    expect(response.status).toBe(200)
    expect(context.next).toHaveBeenCalledTimes(1)
    expect(await response.text()).toBe('<html>asset</html>')
  })
})

describe('edge dispatch: unknown routes', () => {
  it('answers a real 404 with a noindex head instead of a soft-404 200', async () => {
    const response = await handler(request('/does/not/exist'), makeContext())
    const html = await response.text()

    expect(response.status).toBe(404)
    expect(html).toContain('content="noindex"')
    expect(html).toContain('<title>Page Not Found | Prime Realtors</title>')
    expect(html).not.toContain('rel="canonical"')
  })
})

describe('edge dispatch: article URLs', () => {
  function stubArticle(rows) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })))
  }

  it('injects the article head so crawlers see the article, not the homepage', async () => {
    stubArticle([{
      id: '1',
      slug: 'why-open-plots',
      title: 'Why Open Plots Near Hyderabad',
      summary: 'A guide to open plots.',
      status: 'published',
      content_html: '<h2>Section</h2><p>Body.</p>',
      faqs: [],
      published_at: '2026-11-01T10:00:00+00:00',
      updated_at: '2026-11-15T10:00:00+00:00',
      created_at: '2026-10-01T10:00:00+00:00',
    }])

    const response = await handler(request('/news-update/why-open-plots'), makeContext())
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('<title>Why Open Plots Near Hyderabad | Prime Realtors</title>')
    expect(html).toContain('property="og:type" content="article"')
    expect(html).toContain('article:published_time')
    expect(html).toContain('rel="canonical" href="https://prime-realtors.in/news-update/why-open-plots"')
    expect(html).toContain('id="blogposting-schema-jsonld"')
    expect(html).not.toContain('content="Prime Realtors offers verified residential')
  })

  it('answers unknown, hidden or draft slugs with 404 + noindex', async () => {
    stubArticle([])

    const response = await handler(request('/news-update/not-a-real-slug'), makeContext())
    const html = await response.text()

    expect(response.status).toBe(404)
    expect(html).toContain('content="noindex"')
    expect(html).not.toContain('rel="canonical"')
  })

  it('leaves ?preview=1 requests to the SPA and RLS', async () => {
    const context = makeContext()
    const response = await handler(request('/news-update/a-draft?preview=1'), context)

    expect(context.next).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect((await response.text())).toContain('<div id="root">')
  })
})

describe('edge dispatch: sitemap', () => {
  it('combines the static pages with the published articles from Supabase', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify([{
        id: '1',
        slug: 'why-open-plots',
        title: 'Why open plots',
        status: 'published',
        published_at: '2026-11-01T10:00:00+00:00',
        updated_at: '2026-11-15T10:00:00+00:00',
        created_at: '2026-10-01T10:00:00+00:00',
      }]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )))

    const response = await handler(request('/sitemap.xml'), makeContext('<html>ignored</html>'))
    const xml = await response.text()

    expect(response.headers.get('content-type')).toContain('application/xml')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://prime-realtors.in/news-update/why-open-plots</loc>')
    expect(xml).toContain('<lastmod>2026-11-15</lastmod>')
    expect(xml).toContain('<loc>https://prime-realtors.in/faqs</loc>')
    expect(xml).not.toContain('/thank-you')
  })

  it('falls back to the checked-in sitemap when Supabase is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const context = makeContext('<urlset>static fallback</urlset>')
    const response = await handler(request('/sitemap.xml'), context)

    expect(context.next).toHaveBeenCalledTimes(1)
    expect(await response.text()).toContain('static fallback')
  })
})
