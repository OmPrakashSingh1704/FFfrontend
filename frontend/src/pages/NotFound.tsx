import { Link } from 'react-router-dom'
import { Page } from '../components/Page'

export function NotFound() {
  return (
    <Page>
      <section className="content-card">
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <Link className="btn primary" to="/">
          Back to landing
        </Link>
      </section>
    </Page>
  )
}
