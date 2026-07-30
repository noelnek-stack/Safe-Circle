import { useEffect, useState } from 'react'
import { AlertOctagon, X } from 'lucide-react'
import { listenForForegroundMessages } from '../firebase'

export default function PushToast() {
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let unsubscribe = () => {}
    listenForForegroundMessages((payload) => {
      const { title, body } = payload.notification || {}
      setToast({ title: title || 'SafeCircle alert', body: body || '' })
    }).then((unsub) => { unsubscribe = unsub })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 8000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div className="fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-[var(--signal)]/40 bg-[var(--signal-soft)] px-4 py-3 text-[var(--signal-deep)] shadow-lg">
      <AlertOctagon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-xs">{toast.body}</p>}
      </div>
      <button onClick={() => setToast(null)} className="ml-auto shrink-0">
        <X size={15} />
      </button>
    </div>
  )
}
