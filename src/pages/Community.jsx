import { useState } from 'react'
import { Heart, BadgeCheck, Send } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'

const TAG_OPTIONS = ['Well-lit', 'Crowded', 'Security present', 'Quiet', 'Poorly lit']

function timeAgo(ts) {
  const min = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (min < 60) return `${min} min ago`
  return `${Math.round(min / 60)} hr ago`
}

export default function Community() {
  const { community, addPost, likePost, profile } = useSafety()
  const [text, setText] = useState('')
  const [place, setPlace] = useState('')
  const [tags, setTags] = useState([])
  const [liked, setLiked] = useState({})

  function toggleTag(t) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  function submit(e) {
    e.preventDefault()
    if (!text.trim() || !place.trim()) return
    addPost({ author: profile.name || 'You', verified: false, place, text, tags })
    setText(''); setPlace(''); setTags([])
  }

  function handleLike(id) {
    if (liked[id]) return
    likePost(id)
    setLiked((l) => ({ ...l, [id]: true }))
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Community</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Share what you notice — every report helps someone else choose a safer path.</p>

      <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you notice on your walk?"
          rows={2}
          className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
        />
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="Location"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
        />
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => toggleTag(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                tags.includes(t) ? 'bg-[var(--dusk)] text-white' : 'border border-[var(--line)] text-[var(--ink-soft)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="submit" className="flex items-center gap-1.5 rounded-lg bg-[var(--moss)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--moss-deep)]">
            <Send size={14} /> Post
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {community.map((p) => (
          <article key={p.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--dusk-soft)] text-sm font-semibold text-[var(--dusk)]">
                {p.author.charAt(0)}
              </span>
              <div>
                <p className="flex items-center gap-1 text-sm font-semibold">
                  {p.author} {p.verified && <BadgeCheck size={14} className="text-[var(--moss)]" />}
                </p>
                <p className="text-xs text-[var(--ink-soft)]">{p.place} · {timeAgo(p.time)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm">{p.text}</p>
            {p.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span key={t} className="rounded-full bg-[var(--dusk-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--dusk)]">{t}</span>
                ))}
              </div>
            )}
            <button
              onClick={() => handleLike(p.id)}
              className={`mt-4 flex items-center gap-1.5 text-xs font-medium ${liked[p.id] ? 'text-[var(--signal)]' : 'text-[var(--ink-soft)]'}`}
            >
              <Heart size={14} fill={liked[p.id] ? 'currentColor' : 'none'} /> {p.likes}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
