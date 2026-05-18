import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

type SkeletonTextProps = SkeletonProps & {
  lines?: number
  lastLineWidth?: string
}

export function SkeletonText({
  className,
  lines = 3,
  lastLineWidth = '60%',
  ...props
}: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={i === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  )
}

type SkeletonAvatarProps = SkeletonProps & {
  size?: number
}

export function SkeletonAvatar({ size = 40, className, style, ...props }: SkeletonAvatarProps) {
  return (
    <Skeleton
      className={cn('shrink-0 rounded-full', className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  )
}

type SkeletonListProps = {
  count: number
  className?: string
  itemClassName?: string
  children: (index: number) => ReactNode
}

export function SkeletonList({ count, className, itemClassName, children }: SkeletonListProps) {
  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={itemClassName}>
          {children(i)}
        </div>
      ))}
    </div>
  )
}
