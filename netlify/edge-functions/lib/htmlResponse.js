/** Shared response helpers for the edge functions. */

/**
 * Rewritten HTML must never be cached — an editor saving a change has to show
 * up on the next fetch, and the edge output differs per article.
 */
export const HTML_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

export function htmlResponse(html, { status = 200, headers } = {}) {
  const responseHeaders = new Headers(headers || {})
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'text/html; charset=utf-8')
  }
  responseHeaders.set('cache-control', HTML_CACHE_CONTROL)
  // The body changed, so inherited length/encoding headers are no longer true.
  responseHeaders.delete('content-length')
  responseHeaders.delete('content-encoding')

  return new Response(html, { status, headers: responseHeaders })
}

/** Read the SPA document the redirect engine would have served. */
export async function nextDocument(context) {
  const response = await context.next()
  const html = await response.text()
  return { response, html }
}
