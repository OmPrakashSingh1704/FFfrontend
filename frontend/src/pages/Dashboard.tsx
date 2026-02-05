import { Link } from 'react-router-dom'

export function Dashboard() {
  return (
    <section className="content-card">
      <h1>Dashboard</h1>
      <p>This is the starting point for your FoundersLib workspace.</p>
      <div className="data-actions">
        <Link className="btn ghost" to="/app/feed">
          View feed
        </Link>
        <Link className="btn ghost" to="/app/intros">
          Manage intros
        </Link>
        <Link className="btn ghost" to="/app/notifications">
          Check notifications
        </Link>
        <Link className="btn ghost" to="/app/search">
          Search platform
        </Link>
        <Link className="btn ghost" to="/app/founders">
          Browse founders
        </Link>
        <Link className="btn ghost" to="/app/startups">
          Explore startups
        </Link>
        <Link className="btn ghost" to="/app/investors">
          View investors
        </Link>
        <Link className="btn ghost" to="/app/funds">
          Browse funds
        </Link>
        <Link className="btn ghost" to="/app/applications">
          Track applications
        </Link>
        <Link className="btn ghost" to="/app/uploads">
          Manage uploads
        </Link>
      </div>
    </section>
  )
}
