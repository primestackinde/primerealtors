import { describe, expect, it } from 'vitest'
import { injectHead } from '../netlify/edge-functions/lib/injectHead.js'

/** Trimmed copy of the real index.html structure the edge receives. */
const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Prime Realtors | Janaharsha – Buy &amp; Sell Verified Plots in Hyderabad</title>
    <meta name="title" content="Prime Realtors | Janaharsha" />
    <meta name="description" content="Prime Realtors offers verified residential plots." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://prime-realtors.in/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prime Realtors" />
    <meta property="og:url" content="https://prime-realtors.in/" />
    <meta property="og:title" content="Prime Realtors | Janaharsha" />
    <meta property="og:image" content="https://prime-realtors.in/og-image.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Prime Realtors | Janaharsha" />
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "RealEstateAgent", "name": "Prime Realtors" }
    </script>
  </head>
  <body><div id="root"></div></body>
</html>`

function count(html, needle) {
  return html.split(needle).length - 1
}

const articleSeo = {
  title: 'Why Open Plots Win | Prime Realtors',
  description: 'The short description.',
  robots: 'index, follow',
  url: 'https://prime-realtors.in/news-update/why-open-plots',
  image: 'https://prime-realtors.in/blog/hero.webp',
  isArticle: true,
  article: {
    publishedAt: '2026-11-01T10:00:00+00:00',
    updatedAt: '2026-11-15T10:00:00+00:00',
    category: 'Land Investment Guide',
  },
  schemas: {
    blogPosting: { '@type': 'BlogPosting', headline: 'Why Open Plots Win' },
    breadcrumbList: { '@type': 'BreadcrumbList' },
    faqs: { '@type': 'FAQPage', mainEntity: [] },
  },
}

describe('injectHead', () => {
  it('replaces the homepage metadata with the article metadata', () => {
    const html = injectHead(INDEX_HTML, articleSeo)

    expect(count(html, '<title>')).toBe(1)
    expect(html).toContain('<title>Why Open Plots Win | Prime Realtors</title>')
    expect(html).toContain('content="The short description."')
    expect(html).toContain('<meta property="og:url" content="https://prime-realtors.in/news-update/why-open-plots">')
    expect(html).toContain('<link rel="canonical" href="https://prime-realtors.in/news-update/why-open-plots">')
    expect(html).toContain('<meta name="twitter:image" content="https://prime-realtors.in/blog/hero.webp">')
    expect(html).toContain('<meta property="article:published_time" content="2026-11-01T10:00:00+00:00">')
    expect(html).toContain('<meta property="article:section" content="Land Investment Guide">')
    // The homepage's own values must be gone, not duplicated.
    expect(html).not.toContain('content="Prime Realtors offers verified residential plots."')
    expect(html).not.toContain('href="https://prime-realtors.in/" />')
  })

  it('is idempotent — injecting twice never duplicates a managed tag', () => {
    const once = injectHead(INDEX_HTML, articleSeo)
    const twice = injectHead(once, articleSeo)

    expect(count(twice, '<title>')).toBe(1)
    expect(count(twice, 'name="description"')).toBe(1)
    expect(count(twice, 'rel="canonical"')).toBe(1)
    expect(count(twice, 'property="og:title"')).toBe(1)
    expect(count(twice, 'id="blogposting-schema-jsonld"')).toBe(1)
  })

  it('keeps tags it does not manage (charset, icons, organisation schema)', () => {
    const html = injectHead(INDEX_HTML, articleSeo)

    expect(html).toContain('<meta charset="UTF-8" />')
    expect(html).toContain('"@type": "RealEstateAgent"')
    expect(html).not.toContain('id="RealEstateAgent')
  })

  it('drops the canonical link and marks the page noindex when asked', () => {
    const html = injectHead(INDEX_HTML, {
      title: 'Page Not Found | Prime Realtors',
      description: 'gone',
      robots: 'noindex',
      url: 'https://prime-realtors.in/news-update/nope',
    })

    expect(html).toContain('content="noindex"')
    expect(html).not.toContain('rel="canonical"')
    expect(html).toContain('<meta property="og:url" content="https://prime-realtors.in/news-update/nope">')
    expect(count(html, '<title>')).toBe(1)
  })

  it('omits JSON-LD when there are no schemas and removes stale blocks', () => {
    const withSchema = injectHead(INDEX_HTML, articleSeo)
    expect(withSchema).toContain('id="faq-schema-jsonld"')

    const withoutSchema = injectHead(withSchema, { title: 'T', url: 'https://prime-realtors.in/x' })
    expect(withoutSchema).not.toContain('schema-jsonld')
  })

  it('escapes values so titles cannot break out of the head', () => {
    const html = injectHead(INDEX_HTML, {
      title: 'Plots <script>alert(1)</script> & "Quotes"',
      url: 'https://prime-realtors.in/x?a=1&b=2',
    })

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&amp;b=2')
  })

  it('serialises JSON-LD without a raw "<" inside the script', () => {
    const html = injectHead(INDEX_HTML, {
      ...articleSeo,
      schemas: { blogPosting: { headline: 'a < b' } },
    })
    const match = html.match(/<script[^>]*id="blogposting-schema-jsonld">([\s\S]*?)<\/script>/)
    expect(match).toBeTruthy()
    expect(match[1]).not.toContain('<')
    expect(JSON.parse(match[1]).headline).toBe('a < b')
  })
})
