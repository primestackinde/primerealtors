/**
 * Helpers for the stored article HTML.
 *
 * The body is authored in the editor and stored as one HTML string, so the
 * table of contents is derived from it rather than kept as a separate list
 * that could drift out of sync.
 */

const H2_WITH_ID = /<h2([^>]*)\bid\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/h2>/gi
const H2_ANY = /<h2([^>]*)>([\s\S]*?)<\/h2>/gi

function stripTags(html) {
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

/**
 * Give every `<h2>` a stable id so TOC links and anchor tags work.
 * Ids already present are preserved and never duplicated.
 */
export function withHeadingIds(html) {
  const source = String(html || '')
  const used = new Set()

  H2_WITH_ID.lastIndex = 0
  let match
  while ((match = H2_WITH_ID.exec(source)) !== null) used.add(match[2])

  let counter = 0
  const nextId = () => {
    let id
    do {
      id = `section-${counter++}`
    } while (used.has(id))
    used.add(id)
    return id
  }

  H2_ANY.lastIndex = 0
  return source.replace(H2_ANY, (full, before, inner) => {
    if (/\bid\s*=/.test(before)) return full
    return `<h2${before} id="${nextId()}">${inner}</h2>`
  })
}

/**
 * Table of contents entries in document order.
 * @returns {Array<{id: string, title: string}>}
 */
export function extractHeadings(html) {
  const normalized = withHeadingIds(html)
  const items = []

  H2_WITH_ID.lastIndex = 0
  let match
  while ((match = H2_WITH_ID.exec(normalized)) !== null) {
    items.push({ id: match[2], title: stripTags(match[4]) })
  }
  return items
}
