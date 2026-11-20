import {
  FALLBACK_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  defaultMetaDescription,
  truncate,
} from '../config/blogRules.js'

/**
 * Builds everything the document head should say about one article — title,
 * description, robots rule, Open Graph values and the JSON-LD blocks.
 *
 * Pure and DOM-free so the React `SEO` component and the Netlify edge
 * function that rewrites the initial HTML produce identical metadata.
 */

export function faqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }
}

export function blogPostingSchema(article, url, image) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: truncate(article.title, 110),
    description: article.searchDescription,
    image,
    datePublished: article.publishedAt || undefined,
    dateModified: article.updatedAt || undefined,
    articleSection: article.category,
    author: { '@type': 'Organization', name: article.author, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
}

export function breadcrumbSchema(article, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'News & Updates', item: `${SITE_URL}/news-update` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  }
}

/**
 * @param {object} article normalized article (see src/data/articleMapper.js)
 * @param {{path: string, preview?: boolean}} location
 */
export function buildArticleSeo(article, { path, preview = false }) {
  const url = `${SITE_URL}${path}`
  const image = absoluteUrl(article.heroImage) || absoluteUrl(FALLBACK_OG_IMAGE)
  const isPublic = article.status === 'published'

  return {
    title: `${article.title} | ${SITE_NAME}`,
    description: article.searchDescription || defaultMetaDescription(article),
    // Drafts, hidden articles and previews must never be indexed.
    robots: isPublic && !preview ? 'index, follow' : 'noindex, nofollow',
    image,
    url,
    isArticle: true,
    article,
    schemas: {
      blogPosting: blogPostingSchema(article, url, image),
      breadcrumbList: breadcrumbSchema(article, url),
      faqs: article.faqs.length > 0 ? faqSchema(article.faqs) : null,
    },
  }
}
