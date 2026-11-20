import { describe, expect, it } from 'vitest'
import { normalizeArticle, normalizeArticleCard } from '../src/data/articleMapper.js'
import { DEFAULT_AUTHOR, DEFAULT_CATEGORY, DEFAULT_HERO_IMAGE, PUBLIC_STATUS } from '../src/config/blogRules.js'

const row = {
  id: 'abc',
  slug: 'open-plots-guide',
  title: 'Open plots guide',
  subtitle: 'Everything you need to know',
  author: null,
  category: null,
  summary: 'A guide to open plots.',
  meta_description: '',
  hero_image: null,
  hero_image_alt: null,
  content_html: '<h2>One</h2><p>Body.</p>',
  faqs: [
    { question: 'Is it verified?', answer: 'Yes.' },
    { question: '   ', answer: 'No question text' },
    { question: 'Second?', answer: '' },
  ],
  comparison_table: {
    heading: 'Plots vs flats',
    intro: '',
    headers: ['Aspect', 'Plots', 'Flats'],
    rows: [
      ['Cost', 'Lower', 'Higher'],
      ['', '', ''],
    ],
  },
  status: 'published',
  published_at: '2026-11-01T10:00:00+00:00',
  updated_at: '2026-11-15T10:00:00+00:00',
  created_at: '2026-10-20T10:00:00+00:00',
}

describe('normalizeArticle', () => {
  it('applies defaults without inventing content', () => {
    const article = normalizeArticle(row)
    expect(article.author).toBe(DEFAULT_AUTHOR)
    expect(article.category).toBe(DEFAULT_CATEGORY)
    expect(article.heroImage).toBe(DEFAULT_HERO_IMAGE)
    expect(article.status).toBe(PUBLIC_STATUS)
    expect(article.contentHtml).toBe(row.content_html)
  })

  it('keeps only complete FAQs', () => {
    expect(normalizeArticle(row).faqs).toHaveLength(1)
    expect(normalizeArticle(row).faqs[0].question).toBe('Is it verified?')
  })

  it('drops unusable comparison rows and tables', () => {
    const table = normalizeArticle(row).comparisonTable
    expect(table.headers).toEqual(['Aspect', 'Plots', 'Flats'])
    expect(table.rows).toEqual([['Cost', 'Lower', 'Higher']])

    expect(
      normalizeArticle({ ...row, comparison_table: { headers: ['only'], rows: [['x']] } }).comparisonTable,
    ).toBeNull()
    expect(normalizeArticle({ ...row, comparison_table: null }).comparisonTable).toBeNull()
  })

  it('falls back to published when the stored status is unknown', () => {
    expect(normalizeArticle({ ...row, status: 'live' }).status).toBe(PUBLIC_STATUS)
  })

  it('derives reading time and the search description', () => {
    const article = normalizeArticle(row)
    expect(article.readingTime).toBeGreaterThanOrEqual(1)
    expect(article.searchDescription).toBe('A guide to open plots.')
    // Authored meta description wins when present.
    expect(
      normalizeArticle({ ...row, meta_description: 'Hand written' }).searchDescription,
    ).toBe('Hand written')
  })

  it('returns null for a missing row', () => {
    expect(normalizeArticle(null)).toBeNull()
    expect(normalizeArticleCard(undefined)).toBeNull()
  })
})

describe('normalizeArticleCard', () => {
  it('never carries the body but keeps dates and SEO description', () => {
    const card = normalizeArticleCard(row)
    expect(card).not.toHaveProperty('contentHtml')
    expect(card.publishedAt).toBe(row.published_at)
    expect(card.updatedAt).toBe(row.updated_at)
    expect(card.searchDescription).toBe('A guide to open plots.')
  })
})
