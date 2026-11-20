import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getArticle } from '../../data/blogService.js'
import { buildArticleSeo } from '../../seo/articleSeo.js'
import { normalizePath, notFoundSeo, resolveStaticSeo } from '../../seo/pageSeo.js'
import { SITE_NAME } from '../../config/blogRules.js'

/**
 * Document metadata for every route, applied after each client-side
 * navigation.
 *
 * The Netlify edge function (`netlify/edge-functions/site.js`) injects the
 * same tags into the initial HTML so social crawlers — which do not run
 * JavaScript — see them too. Both paths resolve metadata through the shared
 * helpers in `src/seo/`, so they cannot drift apart.
 */

const ARTICLE_PATH = /^\/(?:news-update|blog)\/([^/]+)\/?$/

/** Resolve what the <head> should say for the current location. */
async function resolveSeo(pathname, wantsPreview) {
  const articleMatch = pathname.match(ARTICLE_PATH)
  if (articleMatch) {
    let slug = ''
    try {
      slug = decodeURIComponent(articleMatch[1])
    } catch {
      return notFoundSeo(pathname)
    }

    let article = null
    try {
      article = await getArticle(slug)
    } catch {
      return notFoundSeo(pathname)
    }

    if (!article || (article.status !== 'published' && !wantsPreview)) {
      return notFoundSeo(pathname)
    }

    return buildArticleSeo(article, { path: normalizePath(pathname), preview: wantsPreview })
  }

  return resolveStaticSeo(pathname) || notFoundSeo(pathname)
}

export default function SEO() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    let cancelled = false
    const wantsPreview = new URLSearchParams(search).get('preview') === '1'

    resolveSeo(pathname, wantsPreview)
      .then((seo) => {
        if (!cancelled) applySeo(seo)
      })
      .catch(() => {
        if (!cancelled) applySeo(notFoundSeo(pathname))
      })

    return () => {
      cancelled = true
    }
  }, [pathname, search])

  return null
}

/**
 * Set (or remove) a `<meta>` tag addressed by its `name`/`property` attribute.
 * Empty values delete the tag, so page-specific ones such as
 * `article:published_time` never linger after navigating to another route.
 */
function setMetaTag(attr, key, value) {
  const selector = `meta[${attr}="${key}"]`
  const existing = document.head.querySelector(selector)

  if (!value) {
    existing?.remove()
    return
  }

  const tag = existing || document.createElement('meta')
  if (!existing) {
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', value)
}

function setLinkTag(rel, href) {
  const selector = `link[rel="${rel}"]`
  const existing = document.head.querySelector(selector)

  if (!href) {
    existing?.remove()
    return
  }

  const tag = existing || document.createElement('link')
  if (!existing) {
    tag.setAttribute('rel', rel)
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

function setJsonLd(id, data) {
  const existing = document.getElementById(id)
  if (!data) {
    existing?.remove()
    return
  }
  const payload = JSON.stringify(data)
  if (existing) {
    existing.textContent = payload
    return
  }
  const script = document.createElement('script')
  script.id = id
  script.type = 'application/ld+json'
  script.textContent = payload
  document.head.appendChild(script)
}

function applySeo(seo) {
  const url = seo.url
  const description = seo.description || ''
  const article = seo.article

  document.title = seo.title
  setMetaTag('name', 'description', description)
  setMetaTag('name', 'robots', seo.robots || 'index, follow')
  setMetaTag('name', 'twitter:title', seo.title)
  setMetaTag('name', 'twitter:description', description)
  setMetaTag('name', 'twitter:url', url)
  setMetaTag('property', 'og:title', seo.title)
  setMetaTag('property', 'og:description', description)
  setMetaTag('property', 'og:url', url)
  setMetaTag('property', 'og:type', seo.isArticle ? 'article' : 'website')
  setMetaTag('property', 'og:site_name', SITE_NAME)

  setMetaTag('property', 'og:image', seo.image || '')
  setMetaTag('name', 'twitter:image', seo.image || '')
  setMetaTag('name', 'twitter:card', 'summary_large_image')
  setMetaTag('property', 'og:image:width', seo.imageWidth ? String(seo.imageWidth) : '')
  setMetaTag('property', 'og:image:height', seo.imageHeight ? String(seo.imageHeight) : '')

  setMetaTag('property', 'article:published_time', article?.publishedAt || '')
  setMetaTag('property', 'article:modified_time', article?.updatedAt || '')
  setMetaTag('property', 'article:section', article?.category || '')

  // Never advertise a canonical URL for a page that should not be indexed.
  const noindex = Boolean(seo.robots && seo.robots.startsWith('noindex'))
  setLinkTag('canonical', noindex ? null : url)

  setJsonLd('blogposting-schema-jsonld', seo.schemas?.blogPosting || null)
  setJsonLd('breadcrumb-schema-jsonld', seo.schemas?.breadcrumbList || null)
  setJsonLd('faq-schema-jsonld', seo.schemas?.faqs || null)
}
