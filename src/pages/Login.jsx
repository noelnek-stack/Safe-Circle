import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(form.email.trim(), form.password)
      const redirectTo = location.state?.from?.pathname || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Could not log in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--moss)] text-white">
          <ShieldCheck size={22} strokeWidth={2.25} />
        </span>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-[var(--ink-soft)]">Log in to your SafeCircle account.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        {error && (
          <div className="rounded-lg border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-3 py-2 text-xs text-[var(--signal-deep)]">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-[var(--ink-soft)]">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-[var(--moss)] hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[var(--moss)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)] disabled:opacity-50"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--ink-soft)]">
        Don't have an account?{' '}
        <Link to="/signup" className="font-medium text-[var(--moss)] hover:underline">Sign up</Link>
      </p>
    </div>
  )
}
