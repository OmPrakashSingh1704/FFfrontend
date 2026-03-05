import { useState } from 'react'
import { Link2, Check } from 'lucide-react'

type Props = {
  url?: string // defaults to window.location.href
  label?: string
}

export function CopyLinkButton({ url, label = 'Copy link' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const target = url ?? window.location.href
    try {
      await navigator.clipboard.writeText(target)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = target
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      className="btn-sm ghost"
      type="button"
      onClick={() => void handleCopy()}
      title="Copy link to clipboard"
      style={{ color: copied ? '#22c55e' : undefined, transition: 'color 200ms' }}
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}
