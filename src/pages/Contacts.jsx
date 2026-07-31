import { useState } from 'react'
import { Trash2, Star, Plus, Phone, Mail, AlertTriangle } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'

export default function Contacts() {
  const { contacts, addContact, removeContact } = useSafety()
  const [form, setForm] = useState({ name: '', phone: '', relation: '', priority: false, email: '' })

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return
    addContact(form)
    setForm({ name: '', phone: '', relation: '', priority: false, email: '' })
  }

  const priorityContacts = contacts.filter((c) => c.priority)
  const regularContacts = contacts.filter((c) => !c.priority)

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Trusted Contacts</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">These people get notified during check-in timeouts and voice SOS.</p>

      {/* Priority vs Regular explanation */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-[var(--amber)]">
            <Star size={13} className="fill-[var(--amber)]" /> Priority contacts
          </p>
          <p className="mt-1 text-[var(--ink-soft)]">
            Automatically notified by <strong>email</strong> when you trigger an SOS or a check-in expires. Used by Voice SOS.
            Add their email address to enable email alerts.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-xs">
          <p className="font-semibold">Regular contacts</p>
          <p className="mt-1 text-[var(--ink-soft)]">
            Stored in your circle for manual outreach. They are <em>not</em> auto-notified — only priority contacts receive automatic SOS emails.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Phone</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 0000000" className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Relation</label>
          <input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="Sister, friend, roommate…" className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="contact@email.com"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
          />
          {form.priority && !form.email.trim() && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--amber)]">
              <AlertTriangle size={11} /> Add email to receive SOS alerts automatically.
            </p>
          )}
          {!form.priority && (
            <p className="mt-1 text-[11px] text-[var(--ink-soft)]">Required for automatic SOS email alerts (priority contacts only).</p>
          )}
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-medium">
          <input type="checkbox" checked={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.checked })} className="h-4 w-4 accent-[var(--moss)]" />
          <Star size={13} className={form.priority ? 'fill-[var(--amber)] text-[var(--amber)]' : 'text-[var(--ink-soft)]'} />
          Priority contact (auto-notified on SOS)
        </label>
        <button type="submit" className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--moss)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)] sm:col-span-2">
          <Plus size={16} /> Add contact
        </button>
      </form>

      {/* Priority contacts section */}
      {priorityContacts.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            <Star size={12} className="fill-[var(--amber)] text-[var(--amber)]" /> Priority contacts
          </h2>
          <div className="space-y-2.5">
            {priorityContacts.map((c) => (
              <ContactCard key={c.id} contact={c} onRemove={removeContact} />
            ))}
          </div>
        </div>
      )}

      {/* Regular contacts section */}
      {regularContacts.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Regular contacts</h2>
          <div className="space-y-2.5">
            {regularContacts.map((c) => (
              <ContactCard key={c.id} contact={c} onRemove={removeContact} />
            ))}
          </div>
        </div>
      )}

      {contacts.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--ink-soft)]">
          No contacts yet — add someone you trust above.
        </div>
      )}
    </div>
  )
}

function ContactCard({ contact: c, onRemove }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--moss-soft)] text-sm font-semibold text-[var(--moss-deep)]">
          {c.name.charAt(0)}
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {c.name}
            {c.priority && <Star size={13} className="fill-[var(--amber)] text-[var(--amber)]" />}
            {c.linked && (
              <span className="rounded-full bg-[var(--moss-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--moss-deep)]">
                Gets push alerts
              </span>
            )}
          </p>
          <p className="flex items-center gap-1 text-xs text-[var(--ink-soft)]">
            <Phone size={11} /> {c.phone} {c.relation && `· ${c.relation}`}
          </p>
          {c.email && (
            <p className="flex items-center gap-1 text-xs text-[var(--ink-soft)]">
              <Mail size={11} /> {c.email}
              {c.priority && (
                <span className="ml-1 rounded-full bg-[var(--moss-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--moss-deep)]">
                  SOS emails enabled
                </span>
              )}
            </p>
          )}
          {c.priority && !c.email && (
            <p className="flex items-center gap-1 text-[11px] text-[var(--amber)]">
              <AlertTriangle size={10} /> No email — SOS emails won't be sent
            </p>
          )}
        </div>
      </div>
      <button onClick={() => onRemove(c.id)} className="text-[var(--ink-soft)] hover:text-[var(--signal)]">
        <Trash2 size={16} />
      </button>
    </div>
  )
}
