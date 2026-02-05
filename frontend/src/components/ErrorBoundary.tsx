import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'
import * as Sentry from '@sentry/react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error boundary', error, info)
    Sentry.captureException(error, { extra: info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-loader">
          <div>
            <h2>Something went wrong.</h2>
            <p>Please refresh the page.</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
