import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
      pushToast('Account created. Welcome to FoundersLib!', 'success')
      navigate('/app')
    } catch {
      setErrors({ form: 'Signup failed. Please review your details and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-card">
      <header className="auth-header">
        <h1>Create your account</h1>
        <p>Join the founders and investors building with clarity.</p>
      </header>
      <form onSubmit={handleSubmit} className="auth-form">
        {errors.form ? <div className="form-error">{errors.form}</div> : null}
        <FormField label="Full name" error={errors.full_name}>
          <input
            type="text"
            name="full_name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Alex Morgan"
            autoComplete="name"
            required
          />
        </FormField>
        <FormField label="Email" error={errors.email}>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </FormField>
        <FormField label="Role" error={errors.role}>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="founder">Founder</option>
            <option value="investor">Investor</option>
            <option value="both">Both</option>
          </select>
        </FormField>
        <FormField label="Password" error={errors.password}>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a strong password"
            autoComplete="new-password"
            required
          />
        </FormField>
        <FormField label="Confirm password" error={errors.confirm}>
          <input
            type="password"
            name="confirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Repeat your password"
            autoComplete="new-password"
            required
          />
        </FormField>
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="auth-footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </section>
  )
}
