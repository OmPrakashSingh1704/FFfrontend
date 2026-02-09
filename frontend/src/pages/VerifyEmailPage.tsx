import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Mail, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { apiRequest } from '../lib/api'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { pushToast } = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (user?.email_verified) {
    return <Navigate to="/app" replace />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (code.length !== 6) {
      setError('Please enter the 6-digit code.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await apiRequest('/users/auth/verify-email/', {
        method: 'POST',
        body: { code },
      })
      await refreshUser()
      pushToast('Email verified successfully!', 'success')
      navigate('/app')
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
    if (cooldown > 0) return
    try {
      await apiRequest('/users/auth/resend-otp/', { method: 'POST' })
      pushToast('New verification code sent!', 'success')
      setCooldown(60)
      setCode('')
      setError('')
    } catch {
      pushToast('Could not resend code. Please try again later.', 'error')
    }
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(value)
    if (error) setError('')
  }

  return (
    <section className="auth-card" data-testid="verify-email-card">
      <header className="auth-header">
        <div className="flex justify-center mb-4">
          <Mail className="w-10 h-10" style={{ color: 'var(--gold)' }} />
        </div>
        <h1 className="text-gradient">Check your email</h1>
        <p>
          We sent a 6-digit code to{' '}
          <strong>{user?.email}</strong>
        </p>
      </header>
      <form onSubmit={handleSubmit} className="auth-form" data-testid="verify-email-form">
        {error ? <div className="form-error">{error}</div> : null}
        <div className="otp-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={handleChange}
            placeholder="000000"
            className="otp-input"
            data-testid="otp-input"
          />
        </div>
        <button
          className="btn primary"
          type="submit"
          disabled={submitting || code.length !== 6}
          data-testid="verify-submit-btn"
        >
          {submitting ? 'Verifying...' : 'Verify email'}
        </button>
      </form>
      <p className="auth-footer">
        Didn't get the code?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="resend-btn"
          data-testid="resend-otp-btn"
        >
          <RefreshCw className="w-3.5 h-3.5 inline-block mr-1" />
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </p>
    </section>
  )
}
