import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: '60vh' }} data-testid="not-found-page">
      <div style={{ fontSize: '6rem', fontWeight: 800, lineHeight: 1, fontFamily: 'Inter, sans-serif' }} className="text-gradient">
        404
      </div>
      <h1 className="empty-title" style={{ fontSize: '1.375rem', fontWeight: 600, marginTop: 8 }}>
        Page not found
      </h1>
      <p className="empty-description" style={{ maxWidth: '24rem' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={() => window.history.back()}
          className="btn-sm ghost"
          data-testid="go-back-btn"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Go back
        </button>
        <Link to="/" className="btn-sm primary" data-testid="go-home-btn" style={{ textDecoration: 'none' }}>
          <Home size={14} strokeWidth={1.5} />
          Home
        </Link>
      </div>
    </div>
  )
}
