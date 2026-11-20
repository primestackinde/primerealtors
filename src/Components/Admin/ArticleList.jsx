import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteArticle, listArticles, setArticleStatus } from '../../data/blogService.js'
import {
  ARTICLE_STATUSES,
  STATUS_ACTIONS,
  STATUS_LABELS,
  formatDate,
  truncate,
} from '../../config/blogRules.js'

const FILTERS = ['all', ...ARTICLE_STATUSES]

function openPreview(slug) {
  window.open(`/news-update/${encodeURIComponent(slug)}?preview=1`, '_blank', 'noopener')
}

/**
 * Article list: the one place an editor creates, opens, publishes, hides,
 * restores and deletes articles. Status changes go through
 * `setArticleStatus`, which validates the transition before the database
 * accepts it.
 */
export default function ArticleList({ onOpen }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const rows = await listArticles({ status: 'all' })
      setArticles(rows)
    } catch (err) {
      setError(err.message || 'Could not load articles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const totals = { all: articles.length }
    ARTICLE_STATUSES.forEach((status) => {
      totals[status] = articles.filter((article) => article.status === status).length
    })
    return totals
  }, [articles])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return articles.filter((article) => {
      if (filter !== 'all' && article.status !== filter) return false
      if (!needle) return true
      return [article.title, article.slug, article.category, article.author]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [articles, filter, query])

  const flash = (type, text) => {
    setNotice({ type, text })
    window.setTimeout(() => setNotice(null), 6000)
  }

  const handleStatus = async (article, nextStatus) => {
    const action = STATUS_ACTIONS[article.status]
    if (!action || action.to !== nextStatus) return
    if (nextStatus === 'hidden' && !window.confirm(`Hide “${article.title}”? Its public URL stops working until you restore it.`)) {
      return
    }
    if (nextStatus === 'draft' && !window.confirm(`Move “${article.title}” back to draft? It will be removed from the public site.`)) {
      return
    }

    setBusyId(article.id)
    try {
      const updated = await setArticleStatus(article.id, nextStatus)
      setArticles((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      flash('success', `“${truncate(updated.title, 60)}” is now ${STATUS_LABELS[updated.status].toLowerCase()}.`)
    } catch (err) {
      flash('error', err.message || 'Could not update the article.')
    } finally {
      setBusyId('')
    }
  }

  const handleDelete = async (article) => {
    if (!window.confirm(`Delete “${article.title}” permanently? This cannot be undone.`)) return
    setBusyId(article.id)
    try {
      await deleteArticle(article.id)
      setArticles((current) => current.filter((row) => row.id !== article.id))
      flash('success', 'Article deleted.')
    } catch (err) {
      flash('error', err.message || 'Could not delete the article.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="admin-list-page">
      <div className="admin-list-toolbar">
        <div className="admin-list-heading">
          <h2>Articles</h2>
          <span className="admin-list-count">{counts.all} total</span>
        </div>

        <div className="admin-list-controls">
          <input
            type="search"
            className="admin-input admin-list-search"
            placeholder="Search title, slug or category…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search articles"
          />
          <button type="button" className="admin-btn-primary" onClick={() => onOpen('new')}>
            + New Article
          </button>
        </div>
      </div>

      <div className="admin-filter-row" role="tablist" aria-label="Filter by status">
        {FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={filter === status}
            className={`admin-filter-chip ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(status)}
          >
            {status === 'all' ? 'All' : STATUS_LABELS[status]}
            <span>{counts[status] ?? 0}</span>
          </button>
        ))}
      </div>

      {notice && (
        <p className={`admin-notice admin-notice-${notice.type}`} role="status">
          {notice.text}
        </p>
      )}

      {error && (
        <div className="admin-error-panel">
          <p>{error}</p>
          <button type="button" className="admin-btn-secondary" onClick={load}>
            Try Again
          </button>
        </div>
      )}

      {loading ? (
        <p className="admin-list-empty">Loading articles…</p>
      ) : !error && visible.length === 0 ? (
        <div className="admin-list-empty">
          <h3>{articles.length === 0 ? 'No articles yet' : 'Nothing matches this filter'}</h3>
          <p>
            {articles.length === 0
              ? 'Write your first article and publish it when you are ready.'
              : 'Try a different status filter or clear the search.'}
          </p>
          {articles.length === 0 && (
            <button type="button" className="admin-btn-primary" onClick={() => onOpen('new')}>
              + New Article
            </button>
          )}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col">Status</th>
                <th scope="col">Category</th>
                <th scope="col">Updated</th>
                <th scope="col" className="admin-table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((article) => {
                const action = STATUS_ACTIONS[article.status]
                const busy = busyId === article.id
                return (
                  <tr key={article.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-table-title"
                        onClick={() => onOpen(article.id)}
                      >
                        {article.title}
                      </button>
                      <span className="admin-table-slug">/news-update/{article.slug}</span>
                    </td>
                    <td>
                      <span className={`admin-status-chip admin-status-${article.status}`}>
                        {STATUS_LABELS[article.status]}
                      </span>
                    </td>
                    <td className="admin-table-muted">{article.category}</td>
                    <td className="admin-table-muted">
                      {formatDate(article.updatedAt)}
                      <span className="admin-table-sub">{article.readingTime} read</span>
                    </td>
                    <td className="admin-table-actions">
                      <button type="button" className="admin-row-btn" onClick={() => onOpen(article.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-row-btn"
                        onClick={() => openPreview(article.slug)}
                        title="Open the visitor view in a new tab"
                      >
                        Preview
                      </button>
                      {action && (
                        <button
                          type="button"
                          className={`admin-row-btn admin-row-btn-strong ${
                            action.to === 'hidden' ? 'is-warn' : ''
                          }`}
                          disabled={busy}
                          onClick={() => handleStatus(article, action.to)}
                        >
                          {busy ? '…' : action.label}
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-row-btn admin-row-btn-danger"
                        disabled={busy}
                        onClick={() => handleDelete(article)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
