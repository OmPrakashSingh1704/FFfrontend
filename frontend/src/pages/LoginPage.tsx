import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { FormField } from '../components/FormField'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { hasErrors, isEmail, validateRequired } from '../lib/forms'

type LoginFields = 'email' | 'password' | 'form'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { pushToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Partial<Record<LoginFields, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateRequired({ email, password })

    if (email && !isEmail(email)) {
      nextErrors.email = 'Enter a valid email address'
    }

    if (hasErrors(nextErrors)) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      await login(email, password)
      pushToast('Welcome back!', 'success')
      navigate('/app')
    } catch {
      setErrors({ form: 'Login failed. Check your credentials and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
      <section className="card max-w-sm w-full mx-4 p-8" data-testid="login-card">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--gold)' }}>
            FoundersLib
          </h2>
          <h1 className="text-2xl font-semibold tracking-tight mt-4" style={{ fontFamily: "'Inter', sans-serif" }}>
            Welcome back
          </h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Access your fundraising workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
          {errors.form ? <div className="form-error">{errors.form}</div> : null}

          <div className="form-group">
            <FormField label="Email" error={errors.email} icon={<Mail className="w-4 h-4" />}>
              <input
                type="email"
                name="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                data-testid="login-email-input"
              />
            </FormField>
          </div>

          <div className="form-group">
            <FormField label="Password" error={errors.password} icon={<Lock className="w-4 h-4" />}>
              <input
                type="password"
                name="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                data-testid="login-password-input"
              />
            </FormField>
          </div>

          <button className="btn primary w-full" type="submit" disabled={submitting} data-testid="login-submit-btn">
            {submitting ? 'Signing in...' : 'Sign in'}
            {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--gold)' }}>
            Sign up
          </Link>
        </p>
      </section>
    </div>
  )
}
