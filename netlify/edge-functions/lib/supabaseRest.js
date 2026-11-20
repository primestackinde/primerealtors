import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../../src/config/supabase.js'
import { normalizeArticle, normalizeArticleCard } from '../../../src/data/articleMapper.js'
import { readEnv } from './env.js'

/**
 * Minimal PostgREST client for the edge: plain `fetch`, no supabase-js, so
 * nothing browser-shaped gets bundled into the Deno runtime. Queries use the
 * publishable key; Row Level Security still only exposes published articles.
 */

const REQUEST_TIMEOUT_MS = 5000

function endpoint() {
  return readEnv('SUPABASE_URL') || SUPABASE_URL
}

function key() {
  return readEnv('SUPABASE_PUBLISHABLE_KEY')
    || readEnv('SUPABASE_ANON_KEY')
    || SUPABASE_PUBLISHABLE_KEY
}

async function rest(query) {
  const response = await fetch(`${endpoint()}/rest/v1/${query}`, {
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Supabase responded with ${response.status}`)
  }
  return response.json()
}

/**
 * Published article for a slug, or null. Drafts and hidden articles are
 * invisible to this query — the edge never leaks unpublished content.
 */
export async function fetchPublishedArticle(slug) {
  const rows = await rest(
    `blogs?slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1&select=*`,
  )
  return rows.length ? normalizeArticle(rows[0]) : null
}

/** Lightweight rows (no body) for the sitemap. */
export async function fetchPublishedArticleDates() {
  const rows = await rest(
    'blogs?status=eq.published&select=slug,published_at,updated_at,created_at&order=published_at.desc',
  )
  return rows.map((row) => normalizeArticleCard(row))
}
