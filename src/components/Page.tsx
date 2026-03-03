import { type ReactNode } from 'react'
import { cn } from '../lib/cn'

type PageProps = {
  children: ReactNode
  className?: string
}

export function Page({ children, className }: PageProps) {
  return (
    <div className={cn('page', className)}>
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow glow-a" aria-hidden="true" />
      <div className="bg-glow glow-b" aria-hidden="true" />
      {children}
    </div>
  )
}
