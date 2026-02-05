import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6" data-testid="not-found-page">
      <div className="text-center space-y-6">
        <div className="text-8xl font-bold font-display text-gradient">404</div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-slate-400 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <button 
            onClick={() => window.history.back()} 
            className="btn ghost"
            data-testid="go-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go back
          </button>
          <Link to="/" className="btn primary" data-testid="go-home-btn">
            <Home className="w-4 h-4 mr-2" />
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
