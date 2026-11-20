import { describe, expect, it } from 'vitest'
import { buildArticleSeo, blogPostingSchema, breadcrumbSchema, faqSchema } from '../src/seo/articleSeo.js'
import { adminSeo, notFoundSeo, normalizePath, resolveStaticSeo } from '../src/seo/pageSeo.js'
import { SITE_FAQS } from '../src/config/siteFaqs.js'
import { SITE_URL, absoluteUrl, defaultMetaDescription } from '../src/config/blogRules.js'

const article = {
  slug: 'open-plots-guide',
  title: 'Open plots guide',
  category: 'Land Investment Guide',
  author: 'Prime Realtors Team',
  summary: 'A guide to open plots.',
  metaDescription: '',
  heroImage: '/blog/hero.webp',
  status: 'published',
  publishedAt: '2026-11-01T10:00:00+00:00',
  updatedAt: '2026-11-15T10:00:00+00:00',
  faqs: [{ question: 'Q?', answer: 'A.' }],
  searchDescription: defaultMetaDescription({ summary: 'A guide to open plots.' }),
}

describe('buildArticleSeo', () => {
  it('produces an indexable, absolute-URL head for a published article', () => {
    const seo = buildArticleSeo(article, { path: '/news-update/open-plots-guide' })

    expect(seo.robots).toBe('index, follow')
    expect(seo.url).toBe(`${SITE_URL}/news-update/open-plots-guide`)
    expect(seo.image).toBe(absoluteUrl('/blog/hero.webp'))
    expect(seo.title).toContain('Open plots guide')
    expect(seo.description).toBe(article.searchDescription)
    expect(seo.schemas.blogPosting.datePublished).toBe(article.publishedAt)
    expect(seo.schemas.blogPosting.dateModified).toBe(article.updatedAt)
    expect(seo.schemas.blogPosting.image).toBe(absoluteUrl('/blog/hero.webp'))
    expect(seo.schemas.breadcrumbList['@type']).toBe('BreadcrumbList')
    expect(seo.schemas.faqs.mainEntity).toHaveLength(1)
  })

  it('never indexes drafts, hidden articles or previews', () => {
    expect(buildArticleSeo({ ...article, status: 'draft' }, { path: '/x' }).robots).toBe('noindex, nofollow')
    expect(buildArticleSeo({ ...article, status: 'hidden' }, { path: '/x' }).robots).toBe('noindex, nofollow')
    expect(buildArticleSeo(article, { path: '/x', preview: true }).robots).toBe('noindex, nofollow')
  })

  it('falls back to the site image when the article has none usable', () => {
    const seo = buildArticleSeo({ ...article, heroImage: 'data:image/png;base64,AAAA' }, { path: '/x' })
    expect(seo.image).toBe(absoluteUrl('/og-image.jpg'))
  })

  it('omits FAQ schema when the article has no FAQs', () => {
    const seo = buildArticleSeo({ ...article, faqs: [] }, { path: '/x' })
    expect(seo.schemas.faqs).toBeNull()
  })
})

describe('schema builders', () => {
  it('match the page content they describe', () => {
    expect(faqSchema(SITE_FAQS).mainEntity).toHaveLength(SITE_FAQS.length)
    expect(blogPostingSchema({ ...article, searchDescription: 'd' }, `${SITE_URL}/a`, 'img').headline).toBe('Open plots guide')
    expect(breadcrumbSchema(article, `${SITE_URL}/a`).itemListElement).toHaveLength(3)
  })
})

describe('resolveStaticSeo', () => {
  it('resolves each registered route to its own metadata', () => {
    const seo = resolveStaticSeo('/news-update')
    expect(seo.title).toContain('News & Development Updates')
    expect(seo.robots).toBe('index, follow')
    expect(seo.url).toBe(`${SITE_URL}/news-update`)
    expect(seo.image).toBe(absoluteUrl('/og-image.jpg'))
    expect(seo.imageWidth).toBeGreaterThan(0)
  })

  it('treats trailing slashes as the same page', () => {
    expect(normalizePath('/news-update/')).toBe('/news-update')
    expect(resolveStaticSeo('/news-update/').url).toBe(resolveStaticSeo('/news-update').url)
    expect(resolveStaticSeo('/').url).toBe(SITE_URL)
  })

  it('publishes the shared FAQ schema on the FAQ page only', () => {
    expect(resolveStaticSeo('/faqs').schemas.faqs.mainEntity).toHaveLength(SITE_FAQS.length)
    expect(resolveStaticSeo('/contact').schemas.faqs).toBeUndefined()
  })

  it('returns null for unknown routes and noindex for admin', () => {
    expect(resolveStaticSeo('/totally-unknown')).toBeNull()
    expect(adminSeo().robots).toBe('noindex, nofollow')
    expect(notFoundSeo('/totally-unknown').robots).toBe('noindex')
    expect(notFoundSeo('/a/b/').url).toBe(`${SITE_URL}/a/b`)
  })
})
