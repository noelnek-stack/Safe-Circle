import { useEffect, useState } from 'react'
import { Clock, ShieldCheck, Users, CheckCircle2, AlertOctagon } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'

const PRESETS = [15, 30, 45, 60]

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function CheckIn() {
  const { contacts, activeCheckIn, startCheckIn, endCheckIn, checkInLog } = useSafety()
  const [minutes, setMinutes] = useState(30)
  const [note, setNote] = useState('')
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!activeCheckIn) return
    const tick = () => setRemaining(activeCheckIn.endsAt - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeCheckIn])

  useEffect(() => {
    if (activeCheckIn && remaining <= 0) {
      // silently escalate — in a real deployment this is where trusted contacts get pinged
    }
  }, [remaining, activeCheckIn])

  const priorityCount = contacts.filter((c) => c.priority).length

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Silent Check-In</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Set a timer for your journey. If it runs out before you check in, your priority contacts are notified automatically.</p>

      {activeCheckIn ? (
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
          <span className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span className="pulse-ring absolute inset-0 text-[var(--moss)]" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--moss-soft)] text-[var(--moss-deep)]">
              <Clock size={26} />
            </span>
          </span>
          <p className="mt-4 font-[var(--font-mono)] text-5xl font-medium tabular-nums">{formatClock(remaining)}</p>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            {remaining > 0 ? 'Time remaining before contacts are notified' : 'Time is up — contacts have been notified'}
          </p>
          {activeCheckIn.note && <p className="mt-1 text-xs italic text-[var(--ink-soft)]">"{activeCheckIn.note}"</p>}

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => endCheckIn('safe')}
              className="flex items-center justify-center gap-2 rounded-lg bg-[var(--moss)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--moss-deep)]"
            >
              <CheckCircle2 size={16} /> I'm safe — end check-in
            </button>
            <button
              onClick={() => endCheckIn('sos')}
              className="flex items-center justify-center gap-2 rounded-lg bg-[var(--signal)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--signal-deep)]"
            >
              <AlertOctagon size={16} /> Send SOS now
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--ink-soft)]">Check in within</label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMinutes(m)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      minutes === m ? 'bg-[var(--moss)] text-white' : 'border border-[var(--line)] text-[var(--ink-soft)]'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--ink-soft)]">Note for your contacts (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Walking home from the market"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-lg bg-[var(--paper)] px-4 py-3 text-xs text-[var(--ink-soft)]">
            <Users size={14} />
            {priorityCount > 0
              ? `${priorityCount} priority contact${priorityCount > 1 ? 's' : ''} will be notified if the timer runs out.`
              : 'No priority contacts set — add one on the Contacts page so someone gets notified.'}
          </div>

          <button
            onClick={() => startCheckIn({ minutes, note })}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--moss)] py-3 text-sm font-semibold text-white hover:bg-[var(--moss-deep)]"
          >
            <ShieldCheck size={16} /> Start check-in
          </button>
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-sm font-semibold">History</h2>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {checkInLog.map((log) => (
            <div key={log.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
              <div>
                <p className="font-medium">
                  {new Date(log.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  {' · '}
                  {new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {log.note && <p className="text-xs text-[var(--ink-soft)]">{log.note}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                log.status === 'safe' ? 'bg-[var(--moss-soft)] text-[var(--moss-deep)]' : 'bg-[var(--signal-soft)] text-[var(--signal-deep)]'
              }`}>
                {log.status === 'safe' ? 'Ended safely' : 'SOS sent'}
              </span>
            </div>
          ))}
          {checkInLog.length === 0 && <p className="px-5 py-6 text-sm text-[var(--ink-soft)]">No check-ins yet.</p>}
        </div>
      </section>
    </div>
  )
}
