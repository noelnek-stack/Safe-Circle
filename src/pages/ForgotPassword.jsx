import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, MailCheck } from 'lucide-react'
import { api } from '../api/client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send a reset email right now.')
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
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-[var(--ink-soft)]">We'll email you a link to set a new password.</p>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
          <MailCheck size={28} className="text-[var(--moss)]" />
          <p className="text-sm">
            If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
            Check your inbox (and spam folder).
          </p>
        </div>
      ) : (
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[var(--moss)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)] disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-[var(--ink-soft)]">
        <Link to="/login" className="font-medium text-[var(--moss)] hover:underline">Back to log in</Link>
      </p>
    </div>
  )
}
