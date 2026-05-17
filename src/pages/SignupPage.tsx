import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, ArrowRight } from 'lucide-react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { FormField } from '../components/FormField'
import { PageHead } from '../components/PageHead'
import { useToast } from '../context/ToastContext'
import { apiRequest } from '../lib/api'
import { TURNSTILE_SITE_KEY } from '../lib/env'
import { hasErrors, isEmail, validateRequired } from '../lib/forms'

type SignupFields = 'full_name' | 'email' | 'password' | 'confirm' | 'accept' | 'captcha' | 'form'

export function SignupPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  // Honeypot — real users never type here (the field is visually hidden + aria-hidden +
  // tabindex=-1). Bots that auto-fill every input on the page will populate it and the
  // backend will reject the request.
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<Partial<Record<SignupFields, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const captchaRef = useRef<TurnstileInstance | null>(null)
  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Role used to be required here. It moved to onboarding, where the user
    // can create either or both profiles independently. Backend silently
    // defaults to FOUNDER on registration; their role auto-promotes the
    // moment they create any profile (see User.recompute_role_from_profiles).
    // `validateRequired` returns a Partial keyed by only the fields it
    // received, so we widen here to the full SignupFields shape — we
    // tack on `accept` below for the consent gate.
    const nextErrors: Partial<Record<SignupFields, string>> = validateRequired({
      full_name: fullName,
      email,
      password,
      confirm,
    })

    if (email && !isEmail(email)) {
      nextErrors.email = 'Enter a valid email address'
    }

    if (password && password.length < 8) {
      nextErrors.password = 'Use at least 8 characters'
    }

    if (password && confirm && password !== confirm) {
      nextErrors.confirm = 'Passwords do not match'
    }

    // Explicit consent is required for DPDP / GDPR. We capture it at the
    // form level rather than relying on the browser `required` attribute
    // alone, so we can show a friendly error and keep the same data-shape
    // we use everywhere else.
    if (!acceptedLegal) {
      nextErrors.accept = 'Please accept the Terms of Service and Privacy Policy to continue.'
    }

    if (captchaEnabled && !captchaToken) {
      nextErrors.captcha = 'Please complete the captcha to continue.'
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
          website: honeypot,
          ...(captchaEnabled ? { captcha_token: captchaToken } : {}),
        },
      })
      sessionStorage.setItem('pendingSignupEmail', email)
      sessionStorage.setItem('pendingSignupPassword', password)
      pushToast('Account created! Enter the verification code sent to your email.', 'success')
      navigate('/verify-email', { state: { email } })
    } catch {
      setErrors({ form: 'Signup failed. Please review your details and try again.' })
      // Turnstile tokens are single-use — refresh the widget after any failure
      // so the user can retry without a stale token blocking them.
      if (captchaEnabled) {
        captchaRef.current?.reset()
        setCaptchaToken('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
      <PageHead
        title="Sign up"
        description="Join FoundersLib to connect with vetted founders and investors, run warm intros, and manage your fundraising pipeline."
        path="/signup"
      />
      <section className="card max-w-lg w-full mx-4 p-12" data-testid="signup-card">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold mb-1" style={{ color: 'var(--gold)' }}>
            FoundersLib
          </h2>
          <h1 className="text-3xl font-semibold tracking-tight mt-5" style={{ fontFamily: "'Inter', sans-serif" }}>
            Create your account
          </h1>
          <p className="text-base mt-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Join the founders and investors building with clarity.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="signup-form">
          {/* Honeypot — invisible to real users. Naming it "website" is intentional;
              it's a common field name that form-filling bots target. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-10000px',
              top: 'auto',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            <label htmlFor="signup-website">Website (leave blank)</label>
            <input
              id="signup-website"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>

          {errors.form ? <div className="form-error">{errors.form}</div> : null}

          <div className="form-group">
            <FormField label="Full name" error={errors.full_name} icon={<User className="w-5 h-5" />}>
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
            <FormField label="Email" error={errors.email} icon={<Mail className="w-5 h-5" />}>
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
            <FormField label="Password" error={errors.password} icon={<Lock className="w-5 h-5" />}>
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
            <FormField label="Confirm password" error={errors.confirm} icon={<Lock className="w-5 h-5" />}>
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

          <div className="form-group">
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              <input
                type="checkbox"
                checked={acceptedLegal}
                onChange={(event) => {
                  setAcceptedLegal(event.target.checked)
                  if (event.target.checked && errors.accept) {
                    setErrors((prev) => ({ ...prev, accept: undefined }))
                  }
                }}
                data-testid="signup-accept-legal"
                style={{ marginTop: '0.2rem', accentColor: 'var(--gold)', flexShrink: 0 }}
                aria-describedby={errors.accept ? 'signup-accept-error' : undefined}
              />
              <span>
                I agree to the{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--gold)', textDecoration: 'underline' }}
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--gold)', textDecoration: 'underline' }}
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.accept ? (
              <span
                id="signup-accept-error"
                className="field-error"
                role="alert"
                style={{ marginTop: '0.375rem', display: 'block' }}
              >
                {errors.accept}
              </span>
            ) : null}
          </div>

          {captchaEnabled ? (
            <div className="form-group" data-testid="signup-captcha-wrapper">
              <Turnstile
                ref={captchaRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => {
                  setCaptchaToken(token)
                  if (errors.captcha) setErrors((prev) => ({ ...prev, captcha: undefined }))
                }}
                onError={() => setCaptchaToken('')}
                onExpire={() => setCaptchaToken('')}
                options={{ theme: 'auto' }}
              />
              {errors.captcha ? (
                <span className="field-error" role="alert" style={{ marginTop: '0.375rem', display: 'block' }}>
                  {errors.captcha}
                </span>
              ) : null}
            </div>
          ) : null}

          <button className="btn primary w-full" type="submit" disabled={submitting} data-testid="signup-submit-btn">
            {submitting ? 'Creating account...' : 'Create account'}
            {!submitting && <ArrowRight className="w-5 h-5 ml-2" />}
          </button>
        </form>

        <p className="text-center text-base mt-8" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--gold)' }}>
            Log in
          </Link>
        </p>
      </section>
    </div>
  )
}
