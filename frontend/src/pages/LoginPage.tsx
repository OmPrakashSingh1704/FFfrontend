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
    <section className="auth-card" data-testid="login-card">
      <header className="auth-header">
        <h1 className="text-gradient">Welcome back</h1>
        <p>Access your fundraising workspace.</p>
      </header>
      <form onSubmit={handleSubmit} className="auth-form" data-testid="login-form">
        {errors.form ? <div className="form-error">{errors.form}</div> : null}
        <FormField label="Email" error={errors.email} icon={<Mail className="w-4 h-4" />}>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
            data-testid="login-email-input"
          />
        </FormField>
        <FormField label="Password" error={errors.password} icon={<Lock className="w-4 h-4" />}>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            data-testid="login-password-input"
          />
        </FormField>
        <button className="btn primary" type="submit" disabled={submitting} data-testid="login-submit-btn">
          {submitting ? 'Signing in...' : 'Sign in'}
          {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
        </button>
      </form>
      <p className="auth-footer">
        New to FoundersLib? <Link to="/signup">Create an account</Link>
      </p>
    </section>
  )
}
