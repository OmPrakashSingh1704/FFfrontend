import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

function ProblemChild() {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders fallback UI on error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.getByText('Please refresh the page.')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })
})
