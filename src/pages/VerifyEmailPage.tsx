import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mail, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { apiRequest } from '../lib/api'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const { pushToast } = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [email] = useState(() => {
    const fromState = (location.state as { email?: string } | null)?.email
    const stored = sessionStorage.getItem('pendingSignupEmail')
    return fromState || stored || ''
  })
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (email) {
      sessionStorage.setItem('pendingSignupEmail', email)
    }
  }, [email])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (code.length !== 6 || !email) {
      setError(email ? 'Please enter the 6-digit code.' : 'Missing email. Please sign up again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await apiRequest('/users/auth/verify-email/', {
        method: 'POST',
        auth: false,
        body: { email, code },
      })
      const savedPassword = sessionStorage.getItem('pendingSignupPassword')
      sessionStorage.removeItem('pendingSignupEmail')
      sessionStorage.removeItem('pendingSignupPassword')
      if (savedPassword) {
        try {
          await login(email, savedPassword)
          pushToast('Email verified! Welcome to your workspace.', 'success')
          navigate('/app/profile', { replace: true })
          return
        } catch {
          // fall through to manual login prompt
        }
      }
      pushToast('Email verified! Please sign in to continue.', 'success')
      navigate('/login', { replace: true })
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error: string }).error
          : 'Verification failed. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || !email) return
    try {
      await apiRequest('/users/auth/resend-otp/', {
        method: 'POST',
        auth: false,
        body: { email },
      })
      pushToast('New verification code sent!', 'success')
      setCooldown(60)
      setCode('')
      setError('')
      inputRefs.current[0]?.focus()
    } catch {
      pushToast('Could not resend code. Please try again later.', 'error')
    }
  }

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newCode = code.split('')
    newCode[index] = digit
    const joined = newCode.join('').slice(0, 6)
    setCode(joined.padEnd(code.length > joined.length ? code.length : joined.length, ''))
    setCode(joined)
    if (error) setError('')

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    setCode(pasted)
    if (error) setError('')
    const focusIndex = Math.min(pasted.length, 5)
    inputRefs.current[focusIndex]?.focus()
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
      <section className="card max-w-sm w-full mx-4 p-8" data-testid="verify-email-card">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(249, 115, 22, 0.1)' }}
            >
              <Mail className="w-7 h-7" style={{ color: 'var(--gold)' }} />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
            Check your email
          </h1>
          {email ? (
            <p className="text-sm mt-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              We sent a 6-digit code to <strong style={{ color: 'var(--gold)' }}>{email}</strong>
            </p>
          ) : (
            <p className="text-sm mt-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              We couldn’t detect an email. Please{' '}
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="underline"
                style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                sign up again
              </button>{' '}
              to request a new code.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="verify-email-form">
          {error ? <div className="form-error">{error}</div> : null}

          <div className="flex justify-center gap-2" onPaste={handlePaste} data-testid="otp-input">
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={code[i] || ''}
                onChange={(event) => handleDigitChange(i, event.target.value)}
                onKeyDown={(event) => handleKeyDown(i, event)}
                className="input w-12 h-12 text-center text-lg font-mono rounded-lg"
                style={{ padding: 0 }}
              />
            ))}
          </div>

          <button
            className="btn primary w-full"
            type="submit"
            disabled={submitting || code.length !== 6}
            data-testid="verify-submit-btn"
          >
            {submitting ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Didn't get the code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="inline-flex items-center gap-1 font-medium transition-colors duration-200"
            style={{
              color: cooldown > 0 ? 'hsl(var(--muted-foreground))' : 'var(--gold)',
              background: 'none',
              border: 'none',
              cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
              opacity: cooldown > 0 ? 0.5 : 1,
            }}
            data-testid="resend-otp-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </p>
      </section>
    </div>
  )
}
