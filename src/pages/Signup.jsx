import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await signup(form.name.trim(), form.email.trim(), form.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not create your account.')
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
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-[var(--ink-soft)]">Set up SafeCircle to start tracking safe routes and alerts.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        {error && (
          <div className="rounded-lg border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-3 py-2 text-xs text-[var(--signal-deep)]">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Full name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
          />
        </div>
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
          <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Password</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
          />
          <p className="mt-1 text-[11px] text-[var(--ink-soft)]">At least 8 characters.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Confirm password</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[var(--moss)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)] disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--ink-soft)]">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-[var(--moss)] hover:underline">Log in</Link>
      </p>
    </div>
  )
}
