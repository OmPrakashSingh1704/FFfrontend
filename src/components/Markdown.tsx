import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../lib/cn'

type MarkdownProps = {
  children: string
  size?: 'sm' | 'base'
  className?: string
  'data-testid'?: string
}

export function Markdown({ children, size = 'base', className, 'data-testid': testId }: MarkdownProps) {
  return (
    <div
      className={cn('markdown-prose', size === 'sm' && 'markdown-prose-sm', className)}
      data-testid={testId}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
