import { forwardRef, useState, type TextareaHTMLAttributes } from 'react'
import { Markdown } from './Markdown'
import { cn } from '../lib/cn'

type MarkdownTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> & {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  previewSize?: 'sm' | 'base'
  wrapperClassName?: string
  'data-testid'?: string
}

export const MarkdownTextarea = forwardRef<HTMLTextAreaElement, MarkdownTextareaProps>(
  function MarkdownTextarea({ value, onChange, previewSize = 'base', wrapperClassName, 'data-testid': testId, ...props }, ref) {
    const [mode, setMode] = useState<'write' | 'preview'>('write')

    return (
      <div className={cn('flex flex-col min-w-0', wrapperClassName)}>
        <div className="tabs" style={{ marginBottom: '0.375rem' }}>
          <button
            type="button"
            className={`tab ${mode === 'write' ? 'active' : ''}`}
            onClick={() => setMode('write')}
            data-testid={testId ? `${testId}-write-tab` : undefined}
          >
            Write
          </button>
          <button
            type="button"
            className={`tab ${mode === 'preview' ? 'active' : ''}`}
            onClick={() => setMode('preview')}
            data-testid={testId ? `${testId}-preview-tab` : undefined}
          >
            Preview
          </button>
        </div>

        {mode === 'write' ? (
          <textarea
            ref={ref}
            value={value}
            onChange={onChange}
            data-testid={testId}
            {...props}
          />
        ) : (
          <div className="markdown-preview-container" style={{ minHeight: props.style?.minHeight }}>
            {value.trim() ? (
              <Markdown size={previewSize}>{value}</Markdown>
            ) : (
              <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem', margin: 0 }}>
                Nothing to preview
              </p>
            )}
          </div>
        )}
      </div>
    )
  },
)
