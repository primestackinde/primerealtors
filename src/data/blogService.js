import { supabase } from './supabaseClient.js'
import { normalizeArticle, normalizeArticleCard } from './articleMapper.js'
import {
  ARTICLE_IMAGE_BUCKET,
  ARTICLE_IMAGE_MAX_BYTES,
  ARTICLE_IMAGE_MAX_WIDTH,
  ARTICLE_IMAGE_TYPES,
  ARTICLE_STATUSES,
  DEFAULT_AUTHOR,
  DEFAULT_CATEGORY,
  DEFAULT_HERO_IMAGE,
  PUBLIC_STATUS,
  canTransition,
  isValidStatus,
  slugify,
  validateArticle,
} from '../config/blogRules.js'

export { normalizeArticle }

/**
 * The one data layer for articles.
 *
 * Every screen (public list, article page, admin list, admin editor, SEO
 * component) reads and writes through these functions, so status filtering,
 * field mapping and validation have exactly one implementation.
 *
 * Access is enforced by Row Level Security in the database: anonymous callers
 * only ever receive `published` rows, and writes require a signed-in editor.
 * This module never decides who may see a record — it only asks.
 */

const SELECT_COLUMNS =
  'id,slug,title,subtitle,author,category,summary,meta_description,' +
  'hero_image,hero_image_alt,content_html,faqs,comparison_table,' +
  'status,published_at,updated_at,created_at'

/** Card listings never need the body — keep the payload small. */
const CARD_COLUMNS =
  'id,slug,title,category,author,summary,meta_description,hero_image,' +
  'hero_image_alt,status,published_at,created_at'

/** Network/PostgREST timeouts so a screen can fail fast instead of hanging. */
const QUERY_TIMEOUT_MS = 15000

export class BlogServiceError extends Error {
  constructor(message, code = 'unknown') {
    super(message)
    this.name = 'BlogServiceError'
    this.code = code
  }
}

export class ArticleValidationError extends Error {
  constructor(errors) {
    super('Fix the highlighted fields before saving.')
    this.name = 'ArticleValidationError'
    this.errors = errors
  }
}

/** Turn Postgres/PostgREST codes into messages an editor can act on. */
function readableError(error, fallback) {
  const code = error?.code || ''
  const message = String(error?.message || '')

  if (code === '42501' || code === 'PGRST301') {
    return new BlogServiceError('Your editor session has expired. Sign in again to continue.', 'auth')
  }
  if (code === 'PGRST204' || /column .* does not exist|schema cache/i.test(message)) {
    return new BlogServiceError(
      'The database schema is out of date. Run supabase/migrations/0001_blog_cms.sql, then reload.',
      'schema',
    )
  }
  if (code === '23505') {
    return new BlogServiceError('That URL slug is already used by another article.', 'slug')
  }
  if (code === 'PGRST116' || code === 'PGRST121') {
    return new BlogServiceError('That article no longer exists. It may have been deleted.', 'not-found')
  }
  if (error?.name === 'AbortError' || code === '20') {
    return new BlogServiceError('The database did not respond in time. Please try again.', 'timeout')
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new BlogServiceError('You appear to be offline. Reconnect and try again.', 'offline')
  }
  return new BlogServiceError(fallback, code || 'unknown')
}

function withTimeout(query) {
  return query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
}

function orderFor(status) {
  return status === PUBLIC_STATUS
    ? { column: 'published_at', ascending: false }
    : { column: 'updated_at', ascending: false }
}

/**
 * List articles.
 * @param {{status?: 'all'|'draft'|'published'|'hidden'}} [options]
 * @returns {Promise<Array<ReturnType<typeof normalizeArticle>>>}
 */
export async function listArticles({ status = PUBLIC_STATUS } = {}) {
  if (status !== 'all' && !ARTICLE_STATUSES.includes(status)) {
    throw new BlogServiceError(`Unknown article status "${status}".`, 'bad-request')
  }

  let query = supabase.from('blogs').select(SELECT_COLUMNS)
  if (status !== 'all') query = query.eq('status', status)

  const order = orderFor(status)
  const { data, error } = await withTimeout(
    query.order(order.column, { ascending: order.ascending, nullsFirst: false })
      .order('created_at', { ascending: false }),
  )

  if (error) throw readableError(error, 'Could not load articles.')
  return (data || []).map(normalizeArticle)
}

/**
 * Card-shaped listing (no article body) for the home page, the news index and
 * "more insights" blocks. Same status rules as `listArticles`.
 */
export async function listArticleCards({ status = PUBLIC_STATUS } = {}) {
  if (status !== 'all' && !ARTICLE_STATUSES.includes(status)) {
    throw new BlogServiceError(`Unknown article status "${status}".`, 'bad-request')
  }

  let query = supabase.from('blogs').select(CARD_COLUMNS)
  if (status !== 'all') query = query.eq('status', status)

  const order = orderFor(status)
  const { data, error } = await withTimeout(
    query.order(order.column, { ascending: order.ascending, nullsFirst: false })
      .order('created_at', { ascending: false }),
  )

  if (error) throw readableError(error, 'Could not load articles.')

  return (data || []).map(normalizeArticleCard)
}

/**
 * Fetch one article by slug. Returns null when it does not exist or when the
 * caller is not allowed to see it — Row Level Security makes that decision.
 */
export async function getArticle(slug) {
  if (!slug) return null
  const { data, error } = await withTimeout(
    supabase.from('blogs').select(SELECT_COLUMNS).eq('slug', slug).limit(1),
  )
  if (error) throw readableError(error, 'Could not load the article.')
  if (!data || data.length === 0) return null
  return normalizeArticle(data[0])
}

/** Fetch one article by its immutable id — used by the editor. */
export async function getArticleById(id) {
  if (!id) return null
  const { data, error } = await withTimeout(
    supabase.from('blogs').select(SELECT_COLUMNS).eq('id', id).limit(1),
  )
  if (error) throw readableError(error, 'Could not load the article.')
  if (!data || data.length === 0) return null
  return normalizeArticle(data[0])
}

/** True when no other article already owns this slug. */
export async function isSlugAvailable(slug, excludeId) {
  let query = supabase.from('blogs').select('id').eq('slug', slug).limit(1)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await withTimeout(query)
  if (error) throw readableError(error, 'Could not check the URL slug.')
  return !data || data.length === 0
}

function toRow(draft) {
  const status = isValidStatus(draft.status) ? draft.status : 'draft'
  const publishedAt =
    status === PUBLIC_STATUS
      ? draft.publishedAt || new Date().toISOString()
      : draft.publishedAt || null

  return {
    id: draft.id,
    slug: draft.slug,
    title: draft.title.trim(),
    subtitle: (draft.subtitle || '').trim(),
    author: (draft.author || DEFAULT_AUTHOR).trim() || DEFAULT_AUTHOR,
    category: (draft.category || DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY,
    summary: (draft.summary || '').trim(),
    meta_description: (draft.metaDescription || '').trim() || null,
    hero_image: (draft.heroImage || DEFAULT_HERO_IMAGE).trim() || DEFAULT_HERO_IMAGE,
    hero_image_alt: (draft.heroImageAlt || '').trim() || null,
    content_html: draft.contentHtml || '',
    faqs: (Array.isArray(draft.faqs) ? draft.faqs : []).map((faq) => ({
      question: String(faq.question || '').trim(),
      answer: String(faq.answer || '').trim(),
    })),
    comparison_table: draft.comparisonTable || null,
    status,
    published_at: publishedAt,
  }
}

/**
 * Create or update an article. Requires a signed-in editor.
 * @throws {ArticleValidationError} when the draft fails `validateArticle`
 * @throws {BlogServiceError} for database or connectivity problems
 */
export async function saveArticle(draft) {
  const errors = validateArticle(draft)
  if (Object.keys(errors).length > 0) throw new ArticleValidationError(errors)

  const session = await getAdminSession()
  if (!session) throw new BlogServiceError('Sign in to save articles.', 'auth')

  const slugAvailable = await isSlugAvailable(draft.slug, draft.id)
  if (!slugAvailable) {
    throw new ArticleValidationError({ slug: 'That URL slug is already used by another article.' })
  }

  const { data, error } = await supabase
    .from('blogs')
    .upsert(toRow(draft), { onConflict: 'id' })
    .select(SELECT_COLUMNS)
    .limit(1)

  if (error) throw readableError(error, 'Could not save the article.')
  if (!data || data.length === 0) {
    throw new BlogServiceError('The article was not saved. Reload and try again.', 'no-row')
  }
  return normalizeArticle(data[0])
}

/**
 * Move an article between draft / published / hidden.
 * The transition itself is validated here so the list, the editor and the
 * database cannot disagree about which moves are legal.
 */
export async function setArticleStatus(id, nextStatus) {
  if (!isValidStatus(nextStatus)) {
    throw new BlogServiceError(`Unknown article status "${nextStatus}".`, 'bad-request')
  }

  const session = await getAdminSession()
  if (!session) throw new BlogServiceError('Sign in to change article status.', 'auth')

  const { data: current, error: readError } = await withTimeout(
    supabase.from('blogs').select('id,status,published_at').eq('id', id).limit(1),
  )
  if (readError) throw readableError(readError, 'Could not load the article.')
  if (!current || current.length === 0) {
    throw new BlogServiceError('That article no longer exists.', 'not-found')
  }

  const row = current[0]
  if (!canTransition(row.status, nextStatus)) {
    throw new BlogServiceError(
      `An article cannot go from ${row.status} to ${nextStatus}.`,
      'invalid-transition',
    )
  }

  const patch = { status: nextStatus }
  if (nextStatus === PUBLIC_STATUS && !row.published_at) {
    patch.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('blogs')
    .update(patch)
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .limit(1)

  if (error) throw readableError(error, 'Could not update the article status.')
  if (!data || data.length === 0) throw new BlogServiceError('That article no longer exists.', 'not-found')
  return normalizeArticle(data[0])
}

export async function deleteArticle(id) {
  const session = await getAdminSession()
  if (!session) throw new BlogServiceError('Sign in to delete articles.', 'auth')

  const { error } = await supabase.from('blogs').delete().eq('id', id)
  if (error) throw readableError(error, 'Could not delete the article.')
  return true
}

/** Blank article ready for the editor. Status starts as a draft. */
export function createDraft({ id } = {}) {
  return {
    id: id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `post-${Date.now()}`),
    slug: '',
    title: '',
    subtitle: '',
    author: DEFAULT_AUTHOR,
    category: DEFAULT_CATEGORY,
    summary: '',
    metaDescription: '',
    heroImage: DEFAULT_HERO_IMAGE,
    heroImageAlt: '',
    contentHtml: '<p></p>',
    faqs: [],
    comparisonTable: null,
    status: 'draft',
    readingTime: 1,
    publishedAt: null,
    updatedAt: null,
    createdAt: null,
    searchDescription: '',
  }
}

/** Suggest a slug from a title while the title is still being typed. */
export function suggestSlug(title, currentSlug, { force = false } = {}) {
  if (!force && currentSlug) return currentSlug
  return slugify(title)
}

// ---------------------------------------------------------------------------
// Images — uploaded to Supabase Storage, never stored as base64 in the row.
// ---------------------------------------------------------------------------

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new BlogServiceError('That file could not be read as an image.', 'bad-image'))
    }
    image.src = url
  })
}

/** Downscale to ARTICLE_IMAGE_MAX_WIDTH and encode as WebP when possible. */
async function prepareImage(file) {
  try {
    const image = await loadImage(file)
    const scale = Math.min(1, ARTICLE_IMAGE_MAX_WIDTH / image.naturalWidth)
    if (scale === 1 && file.type === 'image/webp') return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
    return blob || file
  } catch (error) {
    if (error instanceof BlogServiceError) throw error
    return file
  }
}

function storageError(error) {
  const message = String(error?.message || '')
  if (/Bucket not found|bucket .* not found/i.test(message)) {
    return new BlogServiceError(
      'The image bucket is missing. Run supabase/migrations/0002_blog_storage.sql, then reload.',
      'schema',
    )
  }
  if (/row-level security|permission denied|42501/i.test(message)) {
    return new BlogServiceError('Your editor session has expired. Sign in again to upload images.', 'auth')
  }
  if (/too large|exceeded/i.test(message)) {
    return new BlogServiceError('That image is larger than 5 MB. Compress it and try again.', 'too-large')
  }
  return new BlogServiceError('Could not upload the image. Try again, or paste an image URL instead.', 'upload')
}

/** Resize, upload and return the public URL for an article image. */
export async function uploadArticleImage(file, { slug = 'article' } = {}) {
  if (!file) throw new BlogServiceError('Choose an image first.', 'bad-image')
  if (!ARTICLE_IMAGE_TYPES.includes(file.type)) {
    throw new BlogServiceError('Use a JPEG, PNG, WebP or AVIF image.', 'bad-image')
  }
  if (file.size > ARTICLE_IMAGE_MAX_BYTES) {
    throw new BlogServiceError('That image is larger than 5 MB. Compress it and try again.', 'too-large')
  }

  const session = await getAdminSession()
  if (!session) throw new BlogServiceError('Sign in to upload images.', 'auth')

  const prepared = await prepareImage(file)
  const safeSlug = slugify(slug) || 'article'
  const path = `${safeSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`

  const { error } = await supabase.storage
    .from(ARTICLE_IMAGE_BUCKET)
    .upload(path, prepared, { contentType: 'image/webp', upsert: false })

  if (error) throw storageError(error)

  const { data } = supabase.storage.from(ARTICLE_IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ---------------------------------------------------------------------------
// Editor authentication (Supabase Auth). The database is the authority: only
// a signed-in editor receives write access, enforced by RLS.
// ---------------------------------------------------------------------------

function authError(error) {
  const code = error?.code || error?.error_code || ''
  if (code === 'invalid_credentials' || code === 'invalid_grant') {
    return new BlogServiceError('Email or password is incorrect.', 'invalid-credentials')
  }
  if (code === 'email_not_confirmed') {
    return new BlogServiceError('Confirm the email address before signing in.', 'email-unconfirmed')
  }
  if (code === 'signup_disabled') {
    return new BlogServiceError('New sign-ups are disabled on this project.', 'signup-disabled')
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return new BlogServiceError('Too many attempts. Wait a moment and try again.', 'rate-limited')
  }
  return new BlogServiceError(
    'Could not sign in. Check the email and password, then try again.',
    code || 'unknown',
  )
}

export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: String(password || ''),
  })
  if (error) throw authError(error)
  return data.user
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut()
  if (error) throw authError(error)
}

export async function getAdminSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session || null
}

/** Subscribe to sign-in / sign-out changes. Returns an unsubscribe function. */
export function onAuthStateChange(handler) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session || null))
  return () => data.subscription.unsubscribe()
}

/** Used by the sign-in screen to explain first-time setup without guessing. */
export const FIRST_TIME_SETUP_HINT =
  'First time? Create the editor account in Supabase → Authentication → Users, then sign in here.'
