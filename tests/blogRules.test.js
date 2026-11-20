import { describe, expect, it } from 'vitest'
import {
  ALLOWED_TRANSITIONS,
  ARTICLE_LIMITS,
  SITE_URL,
  absoluteUrl,
  canTransition,
  defaultMetaDescription,
  estimateReadingTime,
  slugify,
  truncate,
  validateArticle,
} from '../src/config/blogRules.js'

function validArticle(overrides = {}) {
  return {
    title: 'Why open plots near Hyderabad make sense',
    slug: 'why-open-plots-near-hyderabad',
    summary: 'A short summary of the article.',
    contentHtml: '<h2>Section</h2><p>Body text for the article.</p>',
    ...overrides,
  }
}

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Why Open Plots near Hyderabad')).toBe('why-open-plots-near-hyderabad')
  })

  it('strips punctuation and collapses separators', () => {
    expect(slugify('Legal & Documentation: A/B guide!')).toBe('legal-documentation-ab-guide')
    expect(slugify('  Multiple   spaces  ')).toBe('multiple-spaces')
  })

  it('never exceeds the shared slug limit', () => {
    expect(slugify('a'.repeat(500)).length).toBeLessThanOrEqual(ARTICLE_LIMITS.slug)
  })
})

describe('canTransition', () => {
  it('allows exactly the documented transitions', () => {
    expect(canTransition('draft', 'published')).toBe(true)
    expect(canTransition('published', 'hidden')).toBe(true)
    expect(canTransition('published', 'draft')).toBe(true)
    expect(canTransition('hidden', 'published')).toBe(true)
    expect(canTransition('hidden', 'draft')).toBe(true)
  })

  it('refuses everything else', () => {
    expect(canTransition('draft', 'hidden')).toBe(false)
    expect(canTransition('hidden', 'hidden')).toBe(false)
    expect(canTransition('published', 'published')).toBe(false)
    expect(canTransition('nonsense', 'published')).toBe(false)
  })

  it('agrees with the exported table', () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of targets) expect(canTransition(from, to)).toBe(true)
    }
  })
})

describe('validateArticle', () => {
  it('accepts a valid draft', () => {
    expect(validateArticle(validArticle())).toEqual({})
  })

  it('requires title, slug, summary and body', () => {
    const errors = validateArticle({ contentHtml: '<p>text</p>' })
    expect(errors.title).toBeTruthy()
    expect(errors.slug).toBeTruthy()
    expect(errors.summary).toBeTruthy()
  })

  it('rejects malformed slugs', () => {
    expect(validateArticle(validArticle({ slug: 'Not A Slug' })).slug).toBeTruthy()
    expect(validateArticle(validArticle({ slug: 'UPPER' })).slug).toBeTruthy()
    expect(validateArticle(validArticle({ slug: '-leading' })).slug).toBeTruthy()
  })

  it('rejects an empty body (tags only counts as empty)', () => {
    expect(validateArticle(validArticle({ contentHtml: '<p></p>' })).contentHtml).toBeTruthy()
  })

  it('keeps every field within the shared limits', () => {
    expect(validateArticle(validArticle({ title: 'x'.repeat(ARTICLE_LIMITS.title + 1) })).title).toBeTruthy()
    expect(
      validateArticle(validArticle({ metaDescription: 'x'.repeat(ARTICLE_LIMITS.metaDescription + 1) })).metaDescription,
    ).toBeTruthy()
  })

  it('flags incomplete FAQs and undersized comparison tables', () => {
    const faqErrors = validateArticle(validArticle({ faqs: [{ question: 'Q?', answer: '' }] }))
    expect(faqErrors.faqs).toBeTruthy()

    const tableErrors = validateArticle(
      validArticle({ comparisonTable: { headers: ['only one'], rows: [['a']] } }),
    )
    expect(tableErrors.comparisonTable).toBeTruthy()
  })
})

describe('description helpers', () => {
  it('prefers the authored meta description, then summary, then body', () => {
    expect(defaultMetaDescription({ metaDescription: 'Authored', summary: 'Summary' })).toBe('Authored')
    expect(defaultMetaDescription({ summary: 'Summary' })).toBe('Summary')
    expect(defaultMetaDescription({ contentHtml: '<p>From the body</p>' })).toBe('From the body')
  })

  it('never exceeds the shared limit', () => {
    const long = 'word '.repeat(200)
    expect(defaultMetaDescription({ summary: long }).length).toBeLessThanOrEqual(ARTICLE_LIMITS.metaDescription)
    expect(truncate(long, 40).length).toBeLessThanOrEqual(41)
    expect(truncate('short', 40)).toBe('short')
  })
})

describe('estimateReadingTime', () => {
  it('never drops below one minute and tracks the body', () => {
    expect(estimateReadingTime('')).toBe(1)
    expect(estimateReadingTime('<p>three word body</p>')).toBe(1)
    expect(estimateReadingTime(`<p>${'word '.repeat(900)}</p>`)).toBeGreaterThan(3)
  })
})

describe('absoluteUrl', () => {
  it('resolves site paths against the production origin', () => {
    expect(absoluteUrl('/og-image.jpg')).toBe(`${SITE_URL}/og-image.jpg`)
    expect(absoluteUrl('blog/img.webp')).toBe(`${SITE_URL}/blog/img.webp`)
  })

  it('passes through absolute URLs and rejects data URIs', () => {
    expect(absoluteUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(absoluteUrl('data:image/png;base64,AAAA')).toBe('')
    expect(absoluteUrl('')).toBe('')
  })
})
