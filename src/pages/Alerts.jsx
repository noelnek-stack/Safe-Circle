import { useMemo, useState } from 'react'
import { AlertTriangle, ShieldAlert, Info, X, Plus, ExternalLink, Link2 } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'

const SEVERITY = {
  critical: { label: 'Critical', icon: ShieldAlert, text: 'text-[var(--signal-deep)]', bg: 'bg-[var(--signal-soft)]', chip: 'bg-[var(--signal)] text-white' },
  warning: { label: 'Warning', icon: AlertTriangle, text: 'text-[var(--amber)]', bg: 'bg-[var(--amber-soft)]', chip: 'bg-[var(--amber)] text-white' },
  info: { label: 'Info', icon: Info, text: 'text-[var(--ink-soft)]', bg: 'bg-[var(--paper)]', chip: 'bg-[var(--ink-soft)] text-white' },
}

function timeAgo(ts) {
  const min = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  return `${Math.round(hr / 24)} d ago`
}

export default function Alerts() {
  const { alerts, reportAlert, dismissAlert } = useSafety()
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', place: '', severity: 'warning', sourceUrl: '' })

  const filtered = useMemo(
    () => (filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter)),
    [alerts, filter]
  )

  const counts = useMemo(() => ({
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  }), [alerts])

  function submit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.place.trim()) return

    let sourceUrl = form.sourceUrl.trim()
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      sourceUrl = `https://${sourceUrl}`
    }

    reportAlert({ ...form, sourceUrl })
    setForm({ title: '', body: '', place: '', severity: 'warning', sourceUrl: '' })
    setShowForm(false)
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Real-time safety updates from your community and area sensors.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--moss)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--moss-deep)]"
        >
          <Plus size={16} /> Report something
        </button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="text-2xl font-semibold text-[var(--signal)]">{counts.critical}</p>
          <p className="text-xs text-[var(--ink-soft)]">Critical</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="text-2xl font-semibold text-[var(--amber)]">{counts.warning}</p>
          <p className="text-xs text-[var(--ink-soft)]">Warnings</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="text-2xl font-semibold">{counts.all}</p>
          <p className="text-xs text-[var(--ink-soft)]">Total active</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-semibold">Report a safety concern</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">What happened</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Suspicious activity"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Location</label>
              <input
                value={form.place}
                onChange={(e) => setForm({ ...form, place: e.target.value })}
                placeholder="e.g. Tariq Road, near park"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Details</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)]">
              <Link2 size={12} /> Link a news source (optional)
            </label>
            <input
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              placeholder="e.g. a news article about this"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
              If there's a published news article covering this, paste the link here — the alert will be clickable
              and send people straight to it.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {Object.entries(SEVERITY).map(([key, s]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setForm({ ...form, severity: key })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.severity === key ? s.chip : 'bg-[var(--paper)] text-[var(--ink-soft)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button type="submit" className="rounded-lg bg-[var(--moss)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--moss-deep)]">
              Post alert
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 flex gap-2">
        {['all', 'critical', 'warning', 'info'].map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
              filter === key ? 'bg-[var(--ink)] text-white' : 'bg-[var(--surface)] text-[var(--ink-soft)] border border-[var(--line)]'
            }`}
          >
            {key} {key !== 'all' && `(${counts[key]})`}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((a) => {
          const s = SEVERITY[a.severity] || SEVERITY.info
          const Icon = s.icon
          return (
            <div key={a.id} className={`flex flex-col gap-3 rounded-xl border border-[var(--line)] p-4 sm:flex-row sm:items-start sm:justify-between ${s.bg}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 ${s.text}`}><Icon size={18} /></span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.sourceUrl ? (
                      <a
                        href={a.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-semibold underline decoration-dotted underline-offset-2 hover:text-[var(--moss-deep)]"
                      >
                        {a.title}
                        <ExternalLink size={12} className="shrink-0" />
                      </a>
                    ) : (
                      <h3 className="text-sm font-semibold">{a.title}</h3>
                    )}
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.chip}`}>{s.label}</span>
                    {a.verified && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[var(--moss-deep)]">Verified</span>}
                  </div>
                  {a.body && <p className="mt-1 text-xs text-[var(--ink-soft)]">{a.body}</p>}
                  <p className="mt-1.5 text-[11px] text-[var(--ink-soft)]">{a.place} · {timeAgo(a.time)}</p>
                  {a.sourceUrl && (
                    <a
                      href={a.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--moss-deep)] hover:underline"
                    >
                      Read the full article <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismissAlert(a.id)}
                className="flex shrink-0 items-center gap-1 self-end rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:bg-[var(--paper)] sm:self-start"
              >
                <X size={13} /> Dismiss
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--ink-soft)]">
            Nothing here. Clear skies for this filter.
          </div>
        )}
      </div>
    </div>
  )
}
