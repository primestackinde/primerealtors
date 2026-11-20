import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getAdminSession, getArticle, listArticleCards } from '../../data/blogService.js'
import { extractHeadings, withHeadingIds } from './articleHtml.js'
import { STATUS_LABELS, formatDate } from '../../config/blogRules.js'
import './BlogPost.css'

/**
 * Public article page (and the admin preview of an unpublished draft).
 *
 * There is no fallback to "some other article": an unknown slug, a hidden
 * article or a draft without an editor session all render the not-found state,
 * so one URL can never show another article's content.
 */
export default function BlogPost({ previewPost }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const wantsPreview = searchParams.get('preview') === '1'

  const [state, setState] = useState(previewPost ? 'ready' : 'loading')
  const [post, setPost] = useState(previewPost || null)
  const [others, setOthers] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [openFaq, setOpenFaq] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (previewPost) {
      setPost(previewPost)
      setState('ready')
      return undefined
    }

    let cancelled = false
    setState('loading')
    setPost(null)
    setOthers([])
    setErrorMessage('')

    async function load() {
      try {
        const session = await getAdminSession()
        if (cancelled) return

        // Previewing an unpublished article requires an editor session.
        if (wantsPreview && !session) {
          setState('notFound')
          return
        }

        const article = await getArticle(slug)
        if (cancelled) return

        if (!article || (article.status !== 'published' && !wantsPreview)) {
          setState('notFound')
          return
        }

        setPost(article)
        setState('ready')

        if (article.status === 'published') {
          listArticleCards({ status: 'published' })
            .then((cards) => {
              if (cancelled) return
              setOthers(cards.filter((card) => card.id !== article.id).slice(0, 3))
            })
            .catch(() => {
              // "More insights" is optional; the article itself already loaded.
            })
        }
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error.message || 'Could not load the article.')
        setState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug, previewPost, wantsPreview])

  useEffect(() => {
    setOpenFaq(null)
  }, [post?.id])

  const bodyHtml = useMemo(() => (post ? withHeadingIds(post.contentHtml) : ''), [post])
  const tocItems = useMemo(() => (post ? extractHeadings(post.contentHtml) : []), [post])

  if (state === 'loading') {
    return (
      <main className="blog-post-page">
        <div className="blog-status-message" role="status">
          Loading article…
        </div>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="blog-post-page">
        <div className="blog-status-message">
          <h2>Article could not be loaded</h2>
          <p>{errorMessage}</p>
          <Link to="/news-update">← Back to News &amp; Updates</Link>
        </div>
      </main>
    )
  }

  if (state === 'notFound' || !post) {
    return (
      <main className="blog-post-page">
        <div className="blog-status-message">
          <h2>Article not found</h2>
          <p>The article you are looking for does not exist, is hidden, or has moved.</p>
          <Link to="/news-update">← Back to News &amp; Updates</Link>
        </div>
      </main>
    )
  }

  const isUnpublished = post.status !== 'published'

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({ title: post.title, text: post.summary, url: window.location.href })
        .catch(() => {})
      return
    }
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="blog-post-page">
      {isUnpublished && (
        <div className="blog-preview-banner" role="status">
          <span>
            Preview — this article is <strong>{STATUS_LABELS[post.status]}</strong> and is not
            visible to the public.
          </span>
          <button type="button" onClick={() => navigate('/admin')}>
            Back to editor
          </button>
        </div>
      )}

      {/* Hero header */}
      <section className="blog-hero">
        <nav className="blog-breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigate('/news-update')}>
            News &amp; Updates
          </button>
          <span aria-hidden="true">/</span>
          <span>{post.category || 'Article'}</span>
        </nav>

        <h1>{post.title}</h1>
        {post.subtitle && <p className="blog-hero-subtitle">{post.subtitle}</p>}

        <div className="blog-meta-bar">
          <div className="blog-meta-left">
            <span className="blog-badge">{post.category || 'Guide'}</span>
            <span>
              By <strong>{post.author}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishedAt || undefined}>{formatDate(post.publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingTime} min read</span>
          </div>

          <div className="blog-meta-actions">
            <button type="button" className="blog-share-btn" onClick={handleShare}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {copied ? 'Link Copied!' : 'Share Article'}
            </button>
            <a
              className="blog-share-btn blog-share-whatsapp"
              href={`https://wa.me/?text=${encodeURIComponent(`${post.title} - ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      {post.heroImage && (
        <div className="blog-featured-image-wrap">
          <img
            className="blog-featured-image"
            src={post.heroImage}
            alt={post.heroImageAlt || post.title}
            loading="eager"
            fetchPriority="high"
          />
          {post.heroImageAlt && <div className="blog-featured-caption">{post.heroImageAlt}</div>}
        </div>
      )}

      <div className="blog-layout">
        {/* Sticky table of contents */}
        <aside className="blog-sidebar">
          {tocItems.length > 0 && (
            <>
              <div className="blog-toc-title">In This Article</div>
              <nav className="blog-toc-list" aria-label="Table of contents">
                {tocItems.map((item) => (
                  <a key={item.id} href={`#${item.id}`}>
                    {item.title}
                  </a>
                ))}
                {post.comparisonTable && <a href="#comparison-table">Comparison</a>}
                {post.faqs.length > 0 && <a href="#faqs">Frequently Asked Questions</a>}
              </nav>
            </>
          )}

          <div className="blog-sidebar-cta">
            <h4>Plan a Site Visit</h4>
            <p>Inspect layout road dimensions and teak surroundings in person.</p>
            <button type="button" onClick={() => navigate('/buy-sell?tab=visit#contact-details')}>
              Book Guided Tour
            </button>
          </div>
        </aside>

        <article className="blog-body">
          {post.summary && (
            <div className="blog-highlight-box">
              <h3>Key Takeaways</h3>
              <p>{post.summary}</p>
            </div>
          )}

          <div className="blog-body-rich" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

          {post.comparisonTable && (
            <div id="comparison-table" className="blog-comparison-block">
              <h2>{post.comparisonTable.heading || 'Comparison'}</h2>
              {post.comparisonTable.intro && <p>{post.comparisonTable.intro}</p>}
              <div className="blog-table-container">
                <table className="blog-comparison-table">
                  <thead>
                    <tr>
                      {post.comparisonTable.headers.map((header, index) => (
                        <th key={index} scope="col">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {post.comparisonTable.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) =>
                          cellIndex === 0 ? (
                            <th key={cellIndex} scope="row">
                              {cell}
                            </th>
                          ) : (
                            <td key={cellIndex}>{cell}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {post.faqs.length > 0 && (
            <section id="faqs" className="blog-faq-section">
              <h2>Frequently Asked Questions</h2>
              <p>Common questions answered by our land and site advisors.</p>

              {post.faqs.map((faq, index) => {
                const isOpen = openFaq === index
                return (
                  <div className="blog-faq-item" key={index}>
                    <button
                      type="button"
                      className="blog-faq-question"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                    >
                      <span>{faq.question}</span>
                      <span className="blog-faq-icon" aria-hidden="true">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="blog-faq-answer">
                        <p>{faq.answer}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          <div className="blog-author-footer">
            <div className="blog-author-avatar" aria-hidden="true">
              PR
            </div>
            <div className="blog-author-info">
              <h4>Published by {post.author}</h4>
              <p>
                Prime Realtors specializes in verified residential, farmhouse, and investment
                plots across 2,000+ acres in Janaharsha and Ibrahimpatnam, Hyderabad. Guided by
                experience and built on trust.
              </p>
            </div>
          </div>

          {others.length > 0 && (
            <section className="blog-more-section">
              <h2>More insights</h2>
              <div className="blog-more-list">
                {others.map((card) => (
                  <Link className="blog-more-card" to={`/news-update/${card.slug}`} key={card.id}>
                    <span className="blog-more-category">{card.category}</span>
                    <h3>{card.title}</h3>
                    <span className="blog-more-date">{formatDate(card.publishedAt)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </main>
  )
}
