/**
 * Injects SEO metadata into the SPA's `index.html` at the edge.
 *
 * Social crawlers (WhatsApp, Facebook, X, Slack …) and search engines that do
 * not execute JavaScript read the HTML we return here, so this is what makes
 * article previews correct. The React `SEO` component writes the same values
 * client-side; both share `src/seo/articleSeo.js` and `src/config/sitePages.js`,
 * so the two paths cannot drift apart.
 *
 * The operation is idempotent: everything this module manages is stripped
 * first, then rewritten, so repeated injection never duplicates tags.
 */

const MANAGED_META = [
  'title',
  'description',
  'robots',
  'twitter:title',
  'twitter:description',
  'twitter:url',
  'twitter:image',
  'twitter:card',
  'og:type',
  'og:site_name',
  'og:url',
  'og:title',
  'og:description',
  'og:image',
  'og:image:width',
  'og:image:height',
  'article:published_time',
  'article:modified_time',
  'article:section',
]

const MANAGED_JSON_LD_IDS = [
  'blogposting-schema-jsonld',
  'breadcrumb-schema-jsonld',
  'faq-schema-jsonld',
]

const TITLE_TAG = /<title\b[^>]*>[\s\S]*?<\/title>/gi
const CANONICAL_TAG = /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi
const JSON_LD_TAG = new RegExp(
  `<script\\b[^>]*id\\s*=\\s*["'](?:${MANAGED_JSON_LD_IDS.join('|')})["'][^>]*>[\\s\\S]*?<\\/script>`,
  'gi',
)

function managedMetaPattern() {
  return new RegExp(
    `<meta\\b[^>]*(?:name|property)\\s*=\\s*["'](?:${MANAGED_META.join('|')})["'][^>]*>`,
    'gi',
  )
}

/** Escape a value for use inside a double-quoted HTML attribute or a tag body. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Serialize JSON-LD safely: no raw `<` may appear inside the script block. */
function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/**
 * @param {string} html full document (the SPA index.html)
 * @param {object} seo `{title, description, robots, url, image, imageWidth,
 *   imageHeight, isArticle, article, schemas:{blogPosting,breadcrumbList,faqs}}`
 * @returns {string} document with managed tags replaced
 */
export function injectHead(html, seo = {}) {
  let out = String(html)

  // 1. Strip every tag we manage (and only those), so re-injection is clean.
  out = out.replace(TITLE_TAG, '')
  out = out.replace(managedMetaPattern(), '')
  out = out.replace(CANONICAL_TAG, '')
  out = out.replace(JSON_LD_TAG, '')

  // 2. Build the replacement block.
  const tags = []
  const { article } = seo

  if (seo.title) tags.push(`<title>${escapeHtml(seo.title)}</title>`)
  if (seo.description) tags.push(`<meta name="description" content="${escapeHtml(seo.description)}">`)
  if (seo.robots) tags.push(`<meta name="robots" content="${escapeHtml(seo.robots)}">`)

  const noindex = Boolean(seo.robots && seo.robots.startsWith('noindex'))

  if (seo.url) {
    tags.push(`<meta property="og:url" content="${escapeHtml(seo.url)}">`)
    tags.push(`<meta name="twitter:url" content="${escapeHtml(seo.url)}">`)
    if (!noindex) tags.push(`<link rel="canonical" href="${escapeHtml(seo.url)}">`)
  }

  if (seo.title) {
    tags.push(`<meta property="og:title" content="${escapeHtml(seo.title)}">`)
    tags.push(`<meta name="twitter:title" content="${escapeHtml(seo.title)}">`)
  }
  if (seo.description) {
    tags.push(`<meta property="og:description" content="${escapeHtml(seo.description)}">`)
    tags.push(`<meta name="twitter:description" content="${escapeHtml(seo.description)}">`)
  }

  tags.push(`<meta property="og:type" content="${seo.isArticle ? 'article' : 'website'}">`)
  tags.push('<meta property="og:site_name" content="Prime Realtors">')
  tags.push('<meta name="twitter:card" content="summary_large_image">')

  if (seo.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(seo.image)}">`)
    tags.push(`<meta name="twitter:image" content="${escapeHtml(seo.image)}">`)
    if (seo.imageWidth) tags.push(`<meta property="og:image:width" content="${escapeHtml(seo.imageWidth)}">`)
    if (seo.imageHeight) tags.push(`<meta property="og:image:height" content="${escapeHtml(seo.imageHeight)}">`)
  }

  if (article) {
    if (article.publishedAt) {
      tags.push(`<meta property="article:published_time" content="${escapeHtml(article.publishedAt)}">`)
    }
    if (article.updatedAt) {
      tags.push(`<meta property="article:modified_time" content="${escapeHtml(article.updatedAt)}">`)
    }
    if (article.category) {
      tags.push(`<meta property="article:section" content="${escapeHtml(article.category)}">`)
    }
  }

  const schemas = seo.schemas || {}
  const jsonLdBlocks = [
    ['blogposting-schema-jsonld', schemas.blogPosting],
    ['breadcrumb-schema-jsonld', schemas.breadcrumbList],
    ['faq-schema-jsonld', schemas.faqs],
  ].filter(([, data]) => Boolean(data))

  // 3. Insert everything just before </head>.
  const block = [...tags, ...jsonLdBlocks.map(
    ([id, data]) => `<script type="application/ld+json" id="${id}">${jsonLd(data)}</script>`,
  )].join('\n    ')

  const headEnd = out.search(/<\/head\s*>/i)
  if (headEnd === -1) return `${block}\n${out}`
  return `${out.slice(0, headEnd)}    ${block}\n  ${out.slice(headEnd)}`
}
