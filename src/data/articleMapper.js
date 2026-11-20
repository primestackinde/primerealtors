import {
  DEFAULT_AUTHOR,
  DEFAULT_CATEGORY,
  DEFAULT_HERO_IMAGE,
  PUBLIC_STATUS,
  defaultMetaDescription,
  estimateReadingTime,
  isValidStatus,
} from '../config/blogRules.js'

/**
 * Maps one `blogs` row to the shape every screen consumes.
 *
 * Kept free of Supabase and React so the same mapping can run in the browser
 * and inside the Netlify edge functions that render SEO metadata — there is
 * exactly one definition of what an article is.
 */

function normalizeComparisonTable(value) {
  if (!value || typeof value !== 'object') return null
  const headers = Array.isArray(value.headers) ? value.headers.filter(Boolean) : []
  const rows = Array.isArray(value.rows)
    ? value.rows.map((row) => (Array.isArray(row) ? row : [])).filter((row) => row.some(Boolean))
    : []
  if (headers.length < 2 || rows.length < 1) return null
  return {
    heading: value.heading || '',
    intro: value.intro || '',
    headers,
    rows,
  }
}

export function normalizeArticle(row) {
  if (!row) return null
  const contentHtml = row.content_html || ''
  const status = isValidStatus(row.status) ? row.status : PUBLIC_STATUS

  return {
    id: row.id,
    slug: row.slug,
    title: row.title || '',
    subtitle: row.subtitle || '',
    author: row.author || DEFAULT_AUTHOR,
    category: row.category || DEFAULT_CATEGORY,
    summary: row.summary || '',
    metaDescription: row.meta_description || '',
    heroImage: row.hero_image || DEFAULT_HERO_IMAGE,
    heroImageAlt: row.hero_image_alt || '',
    contentHtml,
    faqs: (Array.isArray(row.faqs) ? row.faqs : []).filter(
      (faq) => faq && String(faq.question || '').trim() && String(faq.answer || '').trim(),
    ),
    comparisonTable: normalizeComparisonTable(row.comparison_table),
    status,
    readingTime: estimateReadingTime(contentHtml),
    publishedAt: row.published_at || row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
    createdAt: row.created_at || null,
    /** What search engines actually show: authored, otherwise derived. */
    searchDescription: defaultMetaDescription({
      metaDescription: row.meta_description,
      summary: row.summary,
      contentHtml,
    }),
  }
}

/** Card shape: the same rows without the body, for listings. */
export function normalizeArticleCard(row) {
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || '',
    category: row.category || DEFAULT_CATEGORY,
    author: row.author || DEFAULT_AUTHOR,
    summary: row.summary || '',
    heroImage: row.hero_image || DEFAULT_HERO_IMAGE,
    heroImageAlt: row.hero_image_alt || '',
    status: isValidStatus(row.status) ? row.status : PUBLIC_STATUS,
    publishedAt: row.published_at || row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
    searchDescription: defaultMetaDescription({
      metaDescription: row.meta_description,
      summary: row.summary,
    }),
  }
}
