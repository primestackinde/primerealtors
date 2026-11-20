import { useCallback, useEffect, useMemo, useState } from 'react'
import TiptapEditor from './TiptapEditor.jsx'
import BlogPost from '../Blog/BlogPost.jsx'
import {
  ArticleValidationError,
  createDraft,
  getArticleById,
  saveArticle,
  uploadArticleImage,
} from '../../data/blogService.js'
import {
  ARTICLE_LIMITS,
  CATEGORY_OPTIONS,
  STATUS_ACTIONS,
  STATUS_LABELS,
  canTransition,
  defaultMetaDescription,
  estimateReadingTime,
  formatDate,
  slugify,
  validateArticle,
} from '../../config/blogRules.js'

const VIEW_MODES = [
  { id: 'editor', label: 'Editor' },
  { id: 'split', label: 'Split View' },
  { id: 'preview', label: 'Preview' },
]

const emptyComparisonTable = () => ({
  heading: '',
  intro: '',
  headers: ['Feature', 'Option A', 'Option B'],
  rows: [['', '', '']],
})

/**
 * Article editor: details, search appearance, hero image, body, optional
 * comparison table and FAQs, with a live visitor preview on the right.
 *
 * Saving always goes through `saveArticle`, which validates first — the same
 * `validateArticle` the list screen and the edge functions rely on.
 */
export default function ArticleEditor({ articleId, onBack }) {
  const isNew = articleId === 'new'
  const [draft, setDraft] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [viewMode, setViewMode] = useState('split')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDraft(null)
    setLoadError('')
    setDirty(false)
    setErrors({})

    if (isNew) {
      setDraft(createDraft())
      setSlugTouched(false)
      return undefined
    }

    getArticleById(articleId)
      .then((article) => {
        if (cancelled) return
        if (!article) setLoadError('That article no longer exists. It may have been deleted.')
        else setDraft(article)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load the article.')
      })

    return () => {
      cancelled = true
    }
  }, [articleId, isNew])

  const update = useCallback((patch) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    setDirty(true)
    setNotice(null)
  }, [])

  const flash = useCallback((type, text) => {
    setNotice({ type, text })
    window.setTimeout(() => setNotice(null), 7000)
  }, [])

  // Warn before navigating away from unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const handleTitleChange = (title) => {
    const patch = { title }
    if (!slugTouched) patch.slug = slugify(title)
    update(patch)
  }

  const handleSave = async ({ status } = {}) => {
    if (!draft) return
    const candidate = status ? { ...draft, status } : draft

    if (status && !canTransition(draft.status, status)) {
      flash('error', `An article cannot go from ${draft.status} to ${status}.`)
      return
    }

    const validation = validateArticle(candidate)
    setErrors(validation)
    if (Object.keys(validation).length > 0) {
      flash('error', 'Fix the highlighted fields, then save again.')
      return
    }

    setSaving(true)
    try {
      const saved = await saveArticle(candidate)
      setDraft(saved)
      setDirty(false)
      setSlugTouched(true)
      setErrors({})
      flash('success', `Saved — ${STATUS_LABELS[saved.status].toLowerCase()}.`)
    } catch (err) {
      if (err instanceof ArticleValidationError) setErrors(err.errors)
      flash('error', err.message || 'Could not save the article.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusAction = () => {
    const action = STATUS_ACTIONS[draft.status]
    if (!action) return
    if (action.to === 'hidden' && !window.confirm('Hide this article? Its public URL stops working until you restore it.')) {
      return
    }
    handleSave({ status: action.to })
  }

  const handleHeroUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setNotice(null)
    try {
      const url = await uploadArticleImage(file, { slug: draft.slug || draft.title })
      update({ heroImage: url })
      flash('success', 'Image uploaded.')
    } catch (err) {
      flash('error', err.message || 'Could not upload the image.')
    } finally {
      setUploading(false)
    }
  }

  const handleFaq = (index, patch) => {
    const faqs = draft.faqs.map((faq, i) => (i === index ? { ...faq, ...patch } : faq))
    update({ faqs })
  }

  const addFaq = () => update({ faqs: [...(draft.faqs || []), { question: '', answer: '' }] })
  const removeFaq = (index) => update({ faqs: draft.faqs.filter((_, i) => i !== index) })

  const setComparison = (patch) =>
    update({ comparisonTable: { ...(draft.comparisonTable || emptyComparisonTable()), ...patch } })

  const setComparisonCell = (rowIndex, cellIndex, value) => {
    const rows = draft.comparisonTable.rows.map((row, r) =>
      r === rowIndex ? row.map((cell, c) => (c === cellIndex ? value : cell)) : row,
    )
    setComparison({ rows })
  }

  const addComparisonRow = () =>
    setComparison({
      rows: [...draft.comparisonTable.rows, draft.comparisonTable.headers.map(() => '')],
    })

  const removeComparisonRow = (rowIndex) =>
    setComparison({ rows: draft.comparisonTable.rows.filter((_, i) => i !== rowIndex) })

  const addComparisonColumn = () => {
    const headers = [...draft.comparisonTable.headers, `Option ${draft.comparisonTable.headers.length}`]
    setComparison({
      headers,
      rows: draft.comparisonTable.rows.map((row) => [...row, '']),
    })
  }

  const removeComparisonColumn = (colIndex) => {
    if (draft.comparisonTable.headers.length <= 2) return
    setComparison({
      headers: draft.comparisonTable.headers.filter((_, i) => i !== colIndex),
      rows: draft.comparisonTable.rows.map((row) => row.filter((_, i) => i !== colIndex)),
    })
  }

  const searchDescription = useMemo(() => {
    if (!draft) return ''
    return draft.metaDescription || defaultMetaDescription(draft)
  }, [draft])

  if (loadError) {
    return (
      <div className="admin-list-page">
        <div className="admin-error-panel">
          <p>{loadError}</p>
          <button type="button" className="admin-btn-secondary" onClick={onBack}>
            ← Back to articles
          </button>
        </div>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="admin-list-page">
        <p className="admin-list-empty">Loading article…</p>
      </div>
    )
  }

  const statusAction = STATUS_ACTIONS[draft.status]
  const canPublish = statusAction && canTransition(draft.status, statusAction.to)
  const previewUrl = draft.slug ? `/news-update/${encodeURIComponent(draft.slug)}?preview=1` : ''

  return (
    <div className="admin-editor-shell">
      {/* Editor top bar */}
      <div className="admin-editor-topbar">
        <button type="button" className="admin-back-btn" onClick={onBack}>
          ← Articles
        </button>

        <span className={`admin-status-chip admin-status-${draft.status}`}>
          {STATUS_LABELS[draft.status]}
        </span>
        {draft.publishedAt && (
          <span className="admin-editor-dates">Published {formatDate(draft.publishedAt)}</span>
        )}
        {dirty && <span className="admin-editor-dirty">Unsaved changes</span>}

        <div className="admin-view-toggle">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`admin-view-btn ${viewMode === mode.id ? 'active' : ''}`}
              onClick={() => setViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <p className={`admin-notice admin-notice-${notice.type}`} role="status">
          {notice.text}
        </p>
      )}

      <div className={`admin-split ${viewMode === 'editor' ? 'editor-only' : viewMode === 'preview' ? 'preview-only' : ''}`}>
        {viewMode !== 'preview' && (
          <div className="admin-editor-panel">
            {/* 1. Details */}
            <section className="admin-section-card">
              <h3>1. Article Details</h3>

              <div className="admin-form-group">
                <label htmlFor="article-title">Title</label>
                <input
                  id="article-title"
                  type="text"
                  className={`admin-input ${errors.title ? 'has-error' : ''}`}
                  placeholder="Article title…"
                  value={draft.title}
                  maxLength={ARTICLE_LIMITS.title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                />
                {errors.title && <p className="admin-field-error">{errors.title}</p>}
              </div>

              <div className="admin-form-group">
                <label htmlFor="article-subtitle">Subtitle</label>
                <input
                  id="article-subtitle"
                  type="text"
                  className={`admin-input ${errors.subtitle ? 'has-error' : ''}`}
                  placeholder="One line that expands on the title…"
                  value={draft.subtitle}
                  maxLength={ARTICLE_LIMITS.subtitle}
                  onChange={(event) => update({ subtitle: event.target.value })}
                />
                {errors.subtitle && <p className="admin-field-error">{errors.subtitle}</p>}
              </div>

              <div className="admin-grid-2">
                <div className="admin-form-group">
                  <label htmlFor="article-slug">URL Slug</label>
                  <div className="admin-input-row">
                    <input
                      id="article-slug"
                      type="text"
                      className={`admin-input ${errors.slug ? 'has-error' : ''}`}
                      value={draft.slug}
                      maxLength={ARTICLE_LIMITS.slug}
                      onChange={(event) => {
                        setSlugTouched(true)
                        update({ slug: event.target.value.toLowerCase() })
                      }}
                    />
                    <button
                      type="button"
                      className="admin-tool-btn"
                      title="Regenerate from title"
                      onClick={() => {
                        setSlugTouched(true)
                        update({ slug: slugify(draft.title) })
                      }}
                    >
                      ↻
                    </button>
                  </div>
                  {errors.slug && <p className="admin-field-error">{errors.slug}</p>}
                  {!errors.slug && draft.slug && (
                    <p className="admin-field-hint">prime-realtors.in/news-update/{draft.slug}</p>
                  )}
                </div>

                <div className="admin-form-group">
                  <label htmlFor="article-category">Category</label>
                  <input
                    id="article-category"
                    list="article-categories"
                    type="text"
                    className={`admin-input ${errors.category ? 'has-error' : ''}`}
                    value={draft.category}
                    maxLength={ARTICLE_LIMITS.category}
                    onChange={(event) => update({ category: event.target.value })}
                  />
                  <datalist id="article-categories">
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                  {errors.category && <p className="admin-field-error">{errors.category}</p>}
                </div>
              </div>

              <div className="admin-grid-2">
                <div className="admin-form-group">
                  <label htmlFor="article-author">Author</label>
                  <input
                    id="article-author"
                    type="text"
                    className={`admin-input ${errors.author ? 'has-error' : ''}`}
                    value={draft.author}
                    maxLength={ARTICLE_LIMITS.author}
                    onChange={(event) => update({ author: event.target.value })}
                  />
                  {errors.author && <p className="admin-field-error">{errors.author}</p>}
                </div>
                <div className="admin-form-group">
                  <label>Reading Time</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={`${estimateReadingTime(draft.contentHtml)} min read`}
                    readOnly
                    aria-readonly="true"
                  />
                  <p className="admin-field-hint">Calculated from the article body.</p>
                </div>
              </div>
            </section>

            {/* 2. Summary & search appearance */}
            <section className="admin-section-card">
              <h3>2. Summary &amp; Search Appearance</h3>

              <div className="admin-form-group">
                <label htmlFor="article-summary">Summary</label>
                <textarea
                  id="article-summary"
                  rows="3"
                  className={`admin-input admin-textarea ${errors.summary ? 'has-error' : ''}`}
                  placeholder="Two or three sentences shown on cards and used for SEO…"
                  value={draft.summary}
                  maxLength={ARTICLE_LIMITS.summary}
                  onChange={(event) => update({ summary: event.target.value })}
                />
                <p className="admin-field-hint">
                  {draft.summary.length}/{ARTICLE_LIMITS.summary}
                </p>
                {errors.summary && <p className="admin-field-error">{errors.summary}</p>}
              </div>

              <div className="admin-form-group">
                <label htmlFor="article-meta">Search Description</label>
                <textarea
                  id="article-meta"
                  rows="2"
                  className={`admin-input admin-textarea ${errors.metaDescription ? 'has-error' : ''}`}
                  placeholder="Leave blank to reuse the summary…"
                  value={draft.metaDescription}
                  maxLength={ARTICLE_LIMITS.metaDescription}
                  onChange={(event) => update({ metaDescription: event.target.value })}
                />
                <p className="admin-field-hint">
                  {(draft.metaDescription || '').length}/{ARTICLE_LIMITS.metaDescription}
                  {!draft.metaDescription && ' — derived from the summary'}
                </p>
                {errors.metaDescription && <p className="admin-field-error">{errors.metaDescription}</p>}

                <div className="admin-serp" aria-hidden="true">
                  <div className="admin-serp-url">
                    prime-realtors.in › news-update › {draft.slug || 'your-article'}
                  </div>
                  <div className="admin-serp-title">
                    {draft.title || 'Article title'} | Prime Realtors
                  </div>
                  <div className="admin-serp-desc">{searchDescription}</div>
                </div>
              </div>
            </section>

            {/* 3. Hero image */}
            <section className="admin-section-card">
              <h3>3. Hero Image</h3>
              <div className="admin-form-group">
                <label htmlFor="article-hero">Image URL</label>
                <input
                  id="article-hero"
                  type="text"
                  className={`admin-input ${errors.heroImageAlt ? 'has-error' : ''}`}
                  placeholder="/blog/your-image.webp"
                  value={draft.heroImage}
                  onChange={(event) => update({ heroImage: event.target.value })}
                />
                <div className="admin-upload-row">
                  <label className="admin-upload-btn">
                    {uploading ? 'Uploading…' : 'Upload from computer'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      disabled={uploading}
                      onChange={handleHeroUpload}
                    />
                  </label>
                  {draft.heroImage && (
                    <img className="admin-hero-thumb" src={draft.heroImage} alt="" />
                  )}
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="article-hero-alt">Image Description (alt text)</label>
                <input
                  id="article-hero-alt"
                  type="text"
                  className={`admin-input ${errors.heroImageAlt ? 'has-error' : ''}`}
                  placeholder="Describes the image for search engines and screen readers"
                  value={draft.heroImageAlt}
                  maxLength={ARTICLE_LIMITS.heroImageAlt}
                  onChange={(event) => update({ heroImageAlt: event.target.value })}
                />
                {errors.heroImageAlt && <p className="admin-field-error">{errors.heroImageAlt}</p>}
              </div>
            </section>

            {/* 4. Body */}
            <section className="admin-section-card">
              <h3>4. Article Body</h3>
              <TiptapEditor
                content={draft.contentHtml}
                onChange={(html) => update({ contentHtml: html })}
              />
              {errors.contentHtml && <p className="admin-field-error">{errors.contentHtml}</p>}
            </section>

            {/* 5. Comparison table */}
            <section className="admin-section-card">
              <div className="admin-card-heading">
                <h3>5. Comparison Table</h3>
                {draft.comparisonTable ? (
                  <button
                    type="button"
                    className="admin-remove-btn"
                    onClick={() => update({ comparisonTable: null })}
                  >
                    Remove table
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-tool-btn"
                    onClick={() => update({ comparisonTable: emptyComparisonTable() })}
                  >
                    + Add table
                  </button>
                )}
              </div>

              {errors.comparisonTable && <p className="admin-field-error">{errors.comparisonTable}</p>}

              {draft.comparisonTable && (
                <div className="admin-comparison">
                  <div className="admin-form-group">
                    <label htmlFor="cmp-heading">Table Heading</label>
                    <input
                      id="cmp-heading"
                      type="text"
                      className="admin-input"
                      placeholder="e.g. Open Plots vs Apartments"
                      value={draft.comparisonTable.heading}
                      onChange={(event) => setComparison({ heading: event.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="cmp-intro">Intro Line</label>
                    <input
                      id="cmp-intro"
                      type="text"
                      className="admin-input"
                      placeholder="One sentence introducing the table"
                      value={draft.comparisonTable.intro}
                      onChange={(event) => setComparison({ intro: event.target.value })}
                    />
                  </div>

                  <div className="admin-table-scroll">
                    <table className="admin-cmp-table">
                      <thead>
                        <tr>
                          {draft.comparisonTable.headers.map((header, colIndex) => (
                            <th key={colIndex}>
                              <input
                                type="text"
                                value={header}
                                aria-label={`Column ${colIndex + 1} heading`}
                                onChange={(event) => {
                                  const headers = draft.comparisonTable.headers.map((h, i) =>
                                    i === colIndex ? event.target.value : h,
                                  )
                                  setComparison({ headers })
                                }}
                              />
                              <button
                                type="button"
                                className="admin-cmp-x"
                                title="Remove column"
                                disabled={draft.comparisonTable.headers.length <= 2}
                                onClick={() => removeComparisonColumn(colIndex)}
                              >
                                ×
                              </button>
                            </th>
                          ))}
                          <th className="admin-cmp-add">
                            <button type="button" className="admin-tool-btn" onClick={addComparisonColumn}>
                              + Col
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.comparisonTable.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {draft.comparisonTable.headers.map((_, colIndex) => (
                              <td key={colIndex}>
                                <input
                                  type="text"
                                  value={row[colIndex] || ''}
                                  aria-label={`Row ${rowIndex + 1} column ${colIndex + 1}`}
                                  onChange={(event) => setComparisonCell(rowIndex, colIndex, event.target.value)}
                                />
                              </td>
                            ))}
                            <td className="admin-cmp-add">
                              <button
                                type="button"
                                className="admin-cmp-x"
                                title="Remove row"
                                onClick={() => removeComparisonRow(rowIndex)}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button type="button" className="admin-tool-btn" onClick={addComparisonRow}>
                    + Row
                  </button>
                </div>
              )}
            </section>

            {/* 6. FAQs */}
            <section className="admin-section-card">
              <div className="admin-card-heading">
                <h3>6. Frequently Asked Questions</h3>
                <button type="button" className="admin-tool-btn" onClick={addFaq}>
                  + Add FAQ
                </button>
              </div>
              {errors.faqs && <p className="admin-field-error">{errors.faqs}</p>}

              {(draft.faqs || []).map((faq, index) => (
                <div key={index} className="admin-faq-row">
                  <div className="admin-form-group">
                    <label htmlFor={`faq-q-${index}`}>Question {index + 1}</label>
                    <input
                      id={`faq-q-${index}`}
                      type="text"
                      className="admin-input"
                      value={faq.question}
                      maxLength={ARTICLE_LIMITS.faqQuestion}
                      onChange={(event) => handleFaq(index, { question: event.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor={`faq-a-${index}`}>Answer</label>
                    <textarea
                      id={`faq-a-${index}`}
                      rows="3"
                      className="admin-input admin-textarea"
                      value={faq.answer}
                      maxLength={ARTICLE_LIMITS.faqAnswer}
                      onChange={(event) => handleFaq(index, { answer: event.target.value })}
                    />
                  </div>
                  <button type="button" className="admin-remove-btn" onClick={() => removeFaq(index)}>
                    Remove FAQ
                  </button>
                </div>
              ))}

              {(draft.faqs || []).length === 0 && (
                <p className="admin-field-hint">No FAQs yet. They appear as an accordion and as FAQ rich results.</p>
              )}
            </section>

            {/* Publish bar */}
            <div className="admin-publish-bar">
              <div className={`admin-save-notice ${notice?.type === 'error' ? 'is-error' : ''}`}>
                {notice?.text || (dirty ? 'Unsaved changes' : 'All changes saved')}
              </div>
              <div className="admin-publish-actions">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  disabled={dirty || !previewUrl}
                  title={dirty ? 'Save your changes first' : 'Open the visitor view in a new tab'}
                  onClick={() => window.open(previewUrl, '_blank', 'noopener')}
                >
                  Preview
                </button>
                {canPublish && (
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    disabled={saving}
                    onClick={handleStatusAction}
                  >
                    {statusAction.label}
                  </button>
                )}
                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={saving}
                  onClick={() => handleSave()}
                >
                  {saving
                    ? 'Saving…'
                    : draft.status === 'published'
                      ? 'Save Changes'
                      : 'Save Draft'}
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode !== 'editor' && (
          <div className="admin-preview-panel">
            <div className="admin-preview-banner">
              <span>● REAL-TIME VISITOR PREVIEW</span>
              <span>{dirty ? 'Unsaved changes are shown below' : 'Matches the live article'}</span>
            </div>
            <BlogPost previewPost={draft} />
          </div>
        )}
      </div>
    </div>
  )
}
