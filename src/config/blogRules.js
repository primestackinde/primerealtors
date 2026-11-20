/**
 * Single source of truth for article rules.
 *
 * Shared by the admin UI, the public pages and the Netlify edge functions that
 * inject SEO metadata and build the sitemap. Keep this module dependency-free
 * (no React, no Supabase, no browser APIs) so the exact same rules can be
 * bundled for the edge runtime and for the browser.
 */

/** Production origin. Used to build absolute URLs for canonical/OG tags. */
export const SITE_URL = 'https://prime-realtors.in'
export const SITE_NAME = 'Prime Realtors'

/** Every value the `blogs.status` column may hold. */
export const ARTICLE_STATUSES = ['draft', 'published', 'hidden']

/** The only status the public site, sitemap and crawlers may see. */
export const PUBLIC_STATUS = 'published'

export const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  hidden: 'Hidden',
}

/**
 * Status transitions offered on the article list screen. One rule per status,
 * so the list, the editor and the API all agree on what an action does.
 */
export const STATUS_ACTIONS = {
  draft: { to: 'published', label: 'Publish' },
  published: { to: 'hidden', label: 'Hide' },
  hidden: { to: 'published', label: 'Restore' },
}

export const CATEGORY_OPTIONS = [
  'Land Investment Guide',
  'Market Update',
  'Legal & Documentation',
  'Lifestyle & Community',
  'Project Update',
]

export const DEFAULT_CATEGORY = CATEGORY_OPTIONS[0]
export const DEFAULT_AUTHOR = 'Prime Realtors Team'
export const DEFAULT_HERO_IMAGE = '/blog/why-investing-open-plots-hyderabad.webp'
export const FALLBACK_OG_IMAGE = '/og-image.jpg'
/** Intrinsic size of `FALLBACK_OG_IMAGE`, advertised on Open Graph tags. */
export const FALLBACK_OG_IMAGE_WIDTH = 1200
export const FALLBACK_OG_IMAGE_HEIGHT = 630

/** Supabase Storage bucket that holds uploaded article images. */
export const ARTICLE_IMAGE_BUCKET = 'blog-images'
export const ARTICLE_IMAGE_MAX_WIDTH = 1600
export const ARTICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const ARTICLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Field limits. Enforced by `validateArticle()` in the editor and by the edge
 * functions, so the UI can never promise something the data layer refuses.
 */
export const ARTICLE_LIMITS = {
  title: 120,
  subtitle: 180,
  slug: 140,
  summary: 400,
  metaDescription: 160,
  category: 60,
  author: 60,
  heroImageAlt: 160,
  faqQuestion: 200,
  faqAnswer: 1000,
  faqs: 20,
  contentHtml: 500000,
}

export const WORDS_PER_MINUTE = 200
export const MIN_READING_TIME = 1

/** URL-safe slug from any title. */
export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ARTICLE_LIMITS.slug)
}

/** Strip tags/entities and collapse whitespace so text can be counted or excerpted. */
export function plainText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Reading time derived from the body itself, so it can never drift from the content. */
export function estimateReadingTime(html) {
  const words = plainText(html).split(' ').filter(Boolean).length
  return Math.max(MIN_READING_TIME, Math.ceil(words / WORDS_PER_MINUTE))
}

/** Cut a string on a word boundary and append an ellipsis when trimmed. */
export function truncate(text, max) {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const boundary = cut.lastIndexOf(' ')
  return `${(boundary > max * 0.6 ? cut.slice(0, boundary) : cut).trim()}…`
}

/**
 * Best available meta description: the authored summary first, otherwise an
 * excerpt of the body. Always non-empty and within the limit.
 */
export function defaultMetaDescription(article, limit = ARTICLE_LIMITS.metaDescription) {
  const source = String(article?.metaDescription || '').trim()
    || String(article?.summary || '').trim()
    || plainText(article?.contentHtml)
  return truncate(source, limit)
}

/**
 * Resolve a stored image path to an absolute URL. Data URIs and empty values
 * are not usable as Open Graph images and resolve to ''.
 */
export function absoluteUrl(pathOrUrl) {
  const value = String(pathOrUrl || '').trim()
  if (!value || value.startsWith('data:')) return ''
  if (/^(https?:)?\/\//i.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

/**
 * Format an ISO timestamp as "November 18, 2026" in UTC, so the published date
 * never shifts by a day depending on the visitor's timezone.
 */
export function formatDate(value, { day = 'numeric', month = 'long', year = 'numeric' } = {}) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-US', { day, month, year, timeZone: 'UTC' }).format(date)
}

/** YYYY-MM-DD for `<time datetime>` and sitemap `<lastmod>`. */
export function isoDateOnly(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function isValidStatus(status) {
  return ARTICLE_STATUSES.includes(status)
}

/**
 * Validate a draft before it reaches the database.
 * Returns `{ field: message }`; an empty object means the draft is saveable.
 */
export function validateArticle(article) {
  const errors = {}
  const limits = ARTICLE_LIMITS

  if (!String(article?.title || '').trim()) errors.title = 'Title is required.'
  else if (article.title.length > limits.title) errors.title = `Keep the title under ${limits.title} characters.`

  if (!String(article?.slug || '').trim()) errors.slug = 'URL slug is required.'
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) errors.slug = 'Use lowercase letters, numbers and hyphens only.'
  else if (article.slug.length > limits.slug) errors.slug = `Keep the slug under ${limits.slug} characters.`

  if (!String(article?.summary || '').trim()) errors.summary = 'Summary is required — it is shown on cards and used for SEO.'
  else if (article.summary.length > limits.summary) errors.summary = `Keep the summary under ${limits.summary} characters.`

  if (article?.subtitle && article.subtitle.length > limits.subtitle) errors.subtitle = `Keep the subtitle under ${limits.subtitle} characters.`
  if (article?.category && article.category.length > limits.category) errors.category = `Keep the category under ${limits.category} characters.`
  if (article?.author && article.author.length > limits.author) errors.author = `Keep the author under ${limits.author} characters.`
  if (article?.heroImageAlt && article.heroImageAlt.length > limits.heroImageAlt) errors.heroImageAlt = `Keep the image description under ${limits.heroImageAlt} characters.`

  const metaLength = String(article?.metaDescription || '').length
  if (metaLength > limits.metaDescription) errors.metaDescription = `Search description is ${metaLength} characters — trim it to ${limits.metaDescription} or fewer.`

  if (!String(article?.contentHtml || '').replace(/<[^>]*>|\s/g, '').length) {
    errors.contentHtml = 'Write the article body before saving.'
  } else if (article.contentHtml.length > limits.contentHtml) {
    errors.contentHtml = 'The article body is too large to store.'
  }

  const faqs = Array.isArray(article?.faqs) ? article.faqs : []
  if (faqs.length > limits.faqs) errors.faqs = `Keep it to ${limits.faqs} FAQs or fewer.`
  faqs.forEach((faq, index) => {
    if (!String(faq?.question || '').trim() || !String(faq?.answer || '').trim()) {
      errors.faqs = `FAQ ${index + 1} needs both a question and an answer.`
    } else if (faq.question.length > limits.faqQuestion || faq.answer.length > limits.faqAnswer) {
      errors.faqs = `FAQ ${index + 1} is too long.`
    }
  })

  if (article?.comparisonTable) {
    const { headers = [], rows = [] } = article.comparisonTable
    if (!Array.isArray(headers) || headers.length < 2) errors.comparisonTable = 'A comparison table needs at least two columns.'
    else if (!Array.isArray(rows) || rows.length < 1) errors.comparisonTable = 'Add at least one row to the comparison table.'
  }

  return errors
}

/**
 * Allowed status transitions, in one place. `draft → published` publishes,
 * `published → hidden` disables the public URL, `hidden → published` restores
 * it, and anything published can go back to `draft` to be taken offline while
 * it is reworked.
 */
export const ALLOWED_TRANSITIONS = {
  draft: ['published'],
  published: ['hidden', 'draft'],
  hidden: ['published', 'draft'],
}

export function canTransition(from, to) {
  if (from === to) return false
  return (ALLOWED_TRANSITIONS[from] || []).includes(to)
}
