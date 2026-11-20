import {
  FALLBACK_OG_IMAGE,
  FALLBACK_OG_IMAGE_HEIGHT,
  FALLBACK_OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from '../config/blogRules.js'
import { findSitePage } from '../config/sitePages.js'
import { SITE_FAQS } from '../config/siteFaqs.js'
import { faqSchema } from './articleSeo.js'

/**
 * Metadata for every non-article route (and the admin/404 special cases),
 * built once and shared by the React `SEO` component and the Netlify edge
 * function that rewrites the initial HTML — the two can never disagree.
 */

export const ADMIN_SEO = {
  title: `Article Editor | ${SITE_NAME}`,
  description: 'Private article editor for Prime Realtors.',
  robots: 'noindex, nofollow',
}

export const NOT_FOUND_SEO = {
  title: `Page Not Found | ${SITE_NAME}`,
  description: 'The page you are looking for does not exist or has moved.',
  robots: 'noindex',
}

/** `/news-update/` and `/news-update` are the same page. */
export function normalizePath(pathname) {
  const value = String(pathname || '/')
  if (value.length > 1) return value.replace(/\/+$/, '') || '/'
  return value
}

function pathUrl(path) {
  return `${SITE_URL}${path === '/' ? '' : path}`
}

function withDefaults(seo, url) {
  return {
    ...seo,
    url,
    image: absoluteUrl(FALLBACK_OG_IMAGE),
    imageWidth: FALLBACK_OG_IMAGE_WIDTH,
    imageHeight: FALLBACK_OG_IMAGE_HEIGHT,
    isArticle: false,
    schemas: seo.schemas || {},
  }
}

/** SEO for the private editor route. */
export function adminSeo() {
  return withDefaults(ADMIN_SEO, pathUrl('/admin'))
}

/** SEO for a URL that does not exist (or must not be indexed). */
export function notFoundSeo(pathname) {
  return withDefaults(NOT_FOUND_SEO, pathUrl(normalizePath(pathname)))
}

/**
 * SEO for a static route.
 * @returns {object|null} null when the path is not a known page (i.e. a 404)
 */
export function resolveStaticSeo(pathname) {
  const path = normalizePath(pathname)
  if (path === '/admin') return adminSeo()

  const page = findSitePage(path)
  if (!page) return null

  return withDefaults(
    {
      title: page.title,
      description: page.description,
      robots: page.robots || 'index, follow',
      schemaType: page.schemaType,
      schemas: page.schemaType === 'FAQPage' ? { faqs: faqSchema(SITE_FAQS) } : {},
    },
    pathUrl(path),
  )
}
