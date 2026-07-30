import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api, setAuthToken } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

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
      const { token: newToken, user } = await api.resetPassword(token, form.password)
      // Log them straight in with the fresh token, rather than sending
      // them back to a login form they'd have to fill out again.
      setAuthToken(newToken)
      localStorage.setItem('sp_token', newToken)
      setUser(user)
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (err) {
      setError(err.message || 'Could not reset your password.')
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
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-[var(--ink-soft)]">Choose a new password for your account.</p>
      </div>

      {!token ? (
        <div className="rounded-2xl border border-[var(--signal)]/30 bg-[var(--signal-soft)] p-6 text-center text-sm text-[var(--signal-deep)]">
          This link is missing its reset token. Request a new one from the{' '}
          <Link to="/forgot-password" className="font-medium underline">forgot password</Link> page.
        </div>
      ) : done ? (
        <div className="rounded-2xl border border-[var(--moss)]/40 bg-[var(--moss-soft)] p-6 text-center text-sm text-[var(--moss-deep)]">
          Password updated — taking you to SafeCircle…
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          {error && (
            <div className="rounded-lg border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-3 py-2 text-xs text-[var(--signal-deep)]">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">New password</label>
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
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Confirm new password</label>
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
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-[var(--ink-soft)]">
        <Link to="/login" className="font-medium text-[var(--moss)] hover:underline">Back to log in</Link>
      </p>
    </div>
  )
}
