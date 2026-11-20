import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FIRST_TIME_SETUP_HINT,
  getAdminSession,
  onAuthStateChange,
  signInAdmin,
  signOutAdmin,
} from '../../data/blogService.js'
import ArticleList from './ArticleList.jsx'
import ArticleEditor from './ArticleEditor.jsx'
import './AdminPortal.css'

/**
 * Admin shell: authenticates the editor, then shows either the article list or
 * the article editor. There is no client-side "unlock" state any more — the
 * session comes from Supabase Auth and the database decides what it may write.
 */

function SignIn({ onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setHint('')
    try {
      await signInAdmin(email, password)
      onSignedIn()
    } catch (err) {
      setError(err.message || 'Could not sign in.')
      setHint(FIRST_TIME_SETUP_HINT)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-login-wrap">
        <div className="admin-login-box">
          <h2>Prime Realtors Editor</h2>
          <p>Sign in to create, publish and hide articles.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              className="admin-login-input"
              placeholder="Editor email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
            <input
              type="password"
              className="admin-login-input"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            {error && <p className="admin-login-error">{error}</p>}
            {hint && <p className="admin-login-hint">{hint}</p>}
            <button type="submit" className="admin-login-btn" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to the editor →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

export default function AdminPortal() {
  const navigate = useNavigate()
  // undefined = session check in flight, null = signed out
  const [session, setSession] = useState(undefined)
  const [view, setView] = useState({ name: 'list' })

  useEffect(() => {
    let active = true
    getAdminSession().then((current) => {
      if (active) setSession(current)
    })
    const unsubscribe = onAuthStateChange((current) => {
      if (active) setSession(current)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (session === undefined) {
    return (
      <main className="admin-page">
        <div className="admin-login-wrap">
          <div className="admin-login-box">
            <h2>Prime Realtors Editor</h2>
            <p>Checking your session…</p>
          </div>
        </div>
      </main>
    )
  }

  if (!session) {
    return <SignIn onSignedIn={async () => setSession(await getAdminSession())} />
  }

  const handleSignOut = async () => {
    try {
      await signOutAdmin()
    } finally {
      setView({ name: 'list' })
      setSession(null)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>
          <span>Prime Realtors Articles</span>
          <span className="admin-header-badge">
            {view.name === 'editor' ? (view.id === 'new' ? 'New Article' : 'Editing') : 'Publishing'}
          </span>
        </h1>

        <div className="admin-header-actions">
          <button type="button" className="admin-exit-btn" onClick={() => navigate('/news-update')}>
            Exit to Site
          </button>
          <button type="button" className="admin-exit-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {view.name === 'editor' ? (
        <ArticleEditor
          key={view.id}
          articleId={view.id}
          onBack={() => setView({ name: 'list' })}
        />
      ) : (
        <ArticleList onOpen={(id) => setView({ name: 'editor', id })} />
      )}
    </div>
  )
}
