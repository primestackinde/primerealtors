import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './NewsUpdate.css'
import heroImage from '../../assets/Home1.jpg'
import layoutImage from '../../assets/Gallery/layout.jpeg'
import greeneryImage from '../../assets/Gallery/park.jpeg'
import siteImage from '../../assets/Gallery/view.jpeg'
import { listArticleCards } from '../../data/blogService.js'
import { formatDate } from '../../config/blogRules.js'

/** Project highlights — kept apart from the article grid so the two are never mixed. */
const projectHighlights = [
    {
        category: 'Layout plans',
        title: 'Explore the plot plans',
        copy: 'Review sample plot boundaries, dimensions, road access and neighbouring plots before discussing a specific option with our team.',
        image: layoutImage,
        alt: 'Printed plotted land plan showing boundaries and dimensions',
        action: 'View plot options',
        href: '/buy-sell?tab=buy',
    },
    {
        category: 'The landscape',
        title: 'A greener setting outside the city',
        copy: 'Janaharsha includes established teak plantations and open surroundings. Visit to experience the landscape in person.',
        image: greeneryImage,
        alt: 'Green landscape and trees at the project',
        action: 'Plan a site visit',
        href: '/buy-sell?tab=visit',
    },
    {
        category: 'On-site views',
        title: 'See the surroundings for yourself',
        copy: 'Browse views from the project and talk with Prime Realtors about locality, access and the plans that interest you.',
        image: siteImage,
        alt: 'View across the Janaharsha project surroundings',
        action: 'Open the gallery',
        href: '/gallery',
    },
]

/**
 * News & Insights index: every published article, filterable by category.
 * Drafts and hidden articles never reach this page — the database only
 * returns published rows to an anonymous visitor.
 */
function NewsUpdate() {
    const navigate = useNavigate()
    const [articles, setArticles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [category, setCategory] = useState('all')

    const load = useCallback(async () => {
        setError('')
        try {
            const cards = await listArticleCards({ status: 'published' })
            setArticles(cards)
        } catch (err) {
            setError(err.message || 'Could not load articles.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const categories = useMemo(
        () => Array.from(new Set(articles.map((article) => article.category).filter(Boolean))),
        [articles],
    )

    const visible = useMemo(
        () => (category === 'all' ? articles : articles.filter((article) => article.category === category)),
        [articles, category],
    )

    const [featured, ...rest] = visible

    return (
        <main className="news-page">
            <section className="news-hero">
                <div className="news-hero-copy">
                    <p className="news-eyebrow">Prime Realtors · Insights &amp; News</p>
                    <h1>
                        News from<br />
                        <em>the landscape.</em>
                    </h1>
                    <p>
                        In-depth property investment guides, master plan developments, and updates
                        from Prime Realtors Janaharsha.
                    </p>
                </div>
                <div className="news-hero-image">
                    <img
                        src={heroImage}
                        alt="Aerial view of Janaharsha plotted landscape and roads"
                    />
                    <span>Janaharsha · Hyderabad</span>
                </div>
            </section>

            {error && (
                <div className="news-error" role="alert">
                    <p>{error}</p>
                    <button type="button" onClick={load}>
                        Try Again
                    </button>
                </div>
            )}

            {loading && !error && <p className="news-loading">Loading articles…</p>}

            {!loading && !error && articles.length === 0 && (
                <div className="news-empty">
                    <h2>No articles published yet</h2>
                    <p>New guides and updates will appear here as soon as they are published.</p>
                </div>
            )}

            {featured && (
                <section className="news-featured-section">
                    <div className="news-featured-card">
                        <div className="news-featured-media">
                            <img src={featured.heroImage} alt={featured.heroImageAlt || featured.title} />
                            <span className="news-featured-badge">{featured.category}</span>
                        </div>
                        <div className="news-featured-content">
                            <div className="news-featured-meta">
                                <time dateTime={featured.publishedAt || undefined}>
                                    {formatDate(featured.publishedAt)}
                                </time>
                                <span aria-hidden="true">·</span>
                                <span>{featured.category}</span>
                                <span aria-hidden="true">·</span>
                                <span>By {featured.author}</span>
                            </div>
                            <h2>{featured.title}</h2>
                            <p>{featured.summary}</p>
                            <div className="news-featured-actions">
                                <button
                                    type="button"
                                    className="news-read-btn"
                                    onClick={() => navigate(`/news-update/${featured.slug}`)}
                                >
                                    Read Complete Guide <span aria-hidden="true">→</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <section className="news-listing">
                <div className="news-listing-heading">
                    <div>
                        <p className="news-eyebrow">Explore More</p>
                        <h2>
                            All articles<br />
                            <em>&amp; guides.</em>
                        </h2>
                    </div>
                    <p>
                        Guidance on boundaries, site visits, legal checks and surrounding amenities
                        across Janaharsha and Ibrahimpatnam.
                    </p>
                </div>

                {categories.length > 1 && (
                    <div className="news-filter-row" role="tablist" aria-label="Filter articles by category">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={category === 'all'}
                            className={`news-filter-chip ${category === 'all' ? 'active' : ''}`}
                            onClick={() => setCategory('all')}
                        >
                            All
                        </button>
                        {categories.map((item) => (
                            <button
                                key={item}
                                type="button"
                                role="tab"
                                aria-selected={category === item}
                                className={`news-filter-chip ${category === item ? 'active' : ''}`}
                                onClick={() => setCategory(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                )}

                <div className="news-card-list">
                    {rest.map((article) => (
                        <article className="news-card" key={article.id}>
                            <div className="news-card-image">
                                <img src={article.heroImage} alt={article.heroImageAlt || article.title} />
                                <span className="news-card-badge">{article.category}</span>
                            </div>
                            <div className="news-card-copy">
                                <p className="news-card-category">{formatDate(article.publishedAt)}</p>
                                <h3>{article.title}</h3>
                                <p>{article.summary}</p>
                                <button type="button" onClick={() => navigate(`/news-update/${article.slug}`)}>
                                    Read Article <span aria-hidden="true">&#8599;</span>
                                </button>
                            </div>
                        </article>
                    ))}
                </div>

                {visible.length === 1 && (
                    <p className="news-single-note">More guides are on the way — check back soon.</p>
                )}
            </section>

            <section className="news-highlights">
                <div className="news-listing-heading">
                    <div>
                        <p className="news-eyebrow">The Project</p>
                        <h2>
                            Plan your<br />
                            <em>visit.</em>
                        </h2>
                    </div>
                    <p>Layouts, landscape and on-site views — the practical side of a visit.</p>
                </div>

                <div className="news-card-list">
                    {projectHighlights.map((item) => (
                        <article className="news-card" key={item.title}>
                            <div className="news-card-image">
                                <img src={item.image} alt={item.alt} />
                                <span className="news-card-badge">{item.category}</span>
                            </div>
                            <div className="news-card-copy">
                                <p className="news-card-category">Project highlight</p>
                                <h3>{item.title}</h3>
                                <p>{item.copy}</p>
                                <button type="button" onClick={() => navigate(item.href)}>
                                    {item.action} <span aria-hidden="true">&#8599;</span>
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="news-contact-band">
                <div>
                    <p className="news-eyebrow">Have a question?</p>
                    <h2>
                        Get the details<br />
                        <em>that matter to you.</em>
                    </h2>
                </div>
                <p>Talk with the Prime Realtors team about plot plans, locality or arranging a visit.</p>
                <button type="button" onClick={() => navigate('/contact')}>
                    Contact Prime Realtors<span aria-hidden="true">&#8599;</span>
                </button>
            </section>
        </main>
    )
}

export default NewsUpdate
