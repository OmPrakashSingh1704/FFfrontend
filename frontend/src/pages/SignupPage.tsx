import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, ArrowRight, Briefcase } from 'lucide-react'
import { FormField } from '../components/FormField'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { apiRequest } from '../lib/api'
import { hasErrors, isEmail, validateRequired } from '../lib/forms'

type SignupFields = 'full_name' | 'email' | 'password' | 'confirm' | 'role' | 'form'

export function SignupPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { pushToast } = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState('founder')
  const [errors, setErrors] = useState<Partial<Record<SignupFields, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateRequired({ full_name: fullName, email, password, confirm, role })

    if (email && !isEmail(email)) {
      nextErrors.email = 'Enter a valid email address'
    }

    if (password && password.length < 8) {
      nextErrors.password = 'Use at least 8 characters'
    }

    if (password && confirm && password !== confirm) {
      nextErrors.confirm = 'Passwords do not match'
    }

    if (hasErrors(nextErrors)) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      await apiRequest('/users/auth/register/', {
        method: 'POST',
        auth: false,
        body: {
          email,
          full_name: fullName,
          password,
          password_confirm: confirm,
          role,
        },
      })
      await login(email, password)
      pushToast('Account created! Check your email for a verification code.', 'success')
      navigate('/verify-email')
    } catch {
      setErrors({ form: 'Signup failed. Please review your details and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
      <section className="card max-w-sm w-full mx-4 p-8" data-testid="signup-card">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--gold)' }}>
            FoundersLib
          </h2>
          <h1 className="text-2xl font-semibold tracking-tight mt-4" style={{ fontFamily: "'Inter', sans-serif" }}>
            Create your account
          </h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Join the founders and investors building with clarity.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" data-testid="signup-form">
          {errors.form ? <div className="form-error">{errors.form}</div> : null}

          <div className="form-group">
            <FormField label="Full name" error={errors.full_name} icon={<User className="w-4 h-4" />}>
              <input
                type="text"
                name="full_name"
                className="input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Alex Morgan"
                autoComplete="name"
                required
                data-testid="signup-name-input"
              />
            </FormField>
          </div>

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
                data-testid="signup-email-input"
              />
            </FormField>
          </div>

          <div className="form-group">
            <FormField label="Role" error={errors.role} icon={<Briefcase className="w-4 h-4" />}>
              <select
                className="select"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                data-testid="signup-role-select"
              >
                <option value="founder">Founder</option>
                <option value="investor">Investor</option>
                <option value="both">Both</option>
              </select>
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
                placeholder="Create a strong password"
                autoComplete="new-password"
                required
                data-testid="signup-password-input"
              />
            </FormField>
          </div>

          <div className="form-group">
            <FormField label="Confirm password" error={errors.confirm} icon={<Lock className="w-4 h-4" />}>
              <input
                type="password"
                name="confirm"
                className="input"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
                data-testid="signup-confirm-input"
              />
            </FormField>
          </div>

          <button className="btn primary w-full" type="submit" disabled={submitting} data-testid="signup-submit-btn">
            {submitting ? 'Creating account...' : 'Create account'}
            {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--gold)' }}>
            Log in
          </Link>
        </p>
      </section>
    </div>
  )
}
