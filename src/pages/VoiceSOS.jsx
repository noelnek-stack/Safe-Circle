import { Link } from 'react-router-dom'
import { Mic, MicOff, AlertOctagon, Settings as SettingsIcon } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import { useVoiceSOS } from '../context/VoiceSOSContext'

export default function VoiceSOS() {
  const { voice } = useSafety()
  const {
    isListening, triggered, sending, autoSent, error,
    supported, configured, priorityCount, lastTranscript,
    toggleListening, sendSOS, setTriggered,
  } = useVoiceSOS()

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Voice SOS</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Say your code phrase while listening is on, and it's treated as a silent emergency signal — detection uses
        your browser's built-in speech recognition, which sends audio to your browser vendor's speech servers for
        transcription. Once it's on, it stays on — across pages, tabs, and even if you close this tab — until you
        turn it off yourself.
      </p>

      {!supported && (
        <div className="mt-6 rounded-xl border border-[var(--signal)]/40 bg-[var(--signal-soft)] px-4 py-3 text-sm text-[var(--signal-deep)]">
          Your browser doesn't support the Web Speech API. Try the latest Chrome or Edge.
        </div>
      )}

      {supported && !configured && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-3 text-sm text-[var(--amber)]">
          <span>Choose a code phrase in Settings before you can start listening.</span>
          <Link to="/settings" className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--amber)] px-3 py-1.5 text-xs font-semibold text-white">
            <SettingsIcon size={13} /> Settings
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-[var(--signal)]/40 bg-[var(--signal-soft)] px-4 py-3 text-sm text-[var(--signal-deep)]">
          {error}
        </div>
      )}

      {triggered && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-[var(--signal)]/40 bg-[var(--signal-soft)] px-5 py-4 text-[var(--signal-deep)]">
          <div className="flex items-center gap-2">
            <AlertOctagon size={18} />
            <div>
              <p className="text-sm font-semibold">Code phrase detected</p>
              <p className="text-xs">{priorityCount} priority contact{priorityCount !== 1 ? 's' : ''} would be notified now.</p>
            </div>
          </div>
          <button
            onClick={sendSOS}
            disabled={sending}
            className="rounded-lg bg-[var(--signal)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--signal-deep)] disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Confirm SOS'}
          </button>
          <button onClick={() => setTriggered(false)} className="text-xs font-medium underline">False alarm</button>
        </div>
      )}

      {autoSent && (
        <div className="mt-6 rounded-xl border border-[var(--moss)]/40 bg-[var(--moss-soft)] px-5 py-4 text-sm text-[var(--moss-deep)]">
          Your location was sent to {priorityCount} priority contact{priorityCount !== 1 ? 's' : ''} automatically.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
        <button
          onClick={toggleListening}
          disabled={!configured || !supported}
          className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-full transition disabled:opacity-40 ${
            isListening ? 'bg-[var(--moss)] text-white' : 'bg-[var(--moss-soft)] text-[var(--moss-deep)]'
          }`}
        >
          {isListening && <span className="pulse-ring absolute inset-0 text-[var(--moss)]" />}
          {isListening ? <Mic size={28} /> : <MicOff size={28} />}
        </button>
        <p className="mt-4 text-sm font-medium">
          {!configured ? 'Not set up yet' : isListening ? 'Listening…' : 'Listening is off'}
        </p>
        <p className="mt-1 font-[var(--font-mono)] text-xs uppercase tracking-wide text-[var(--ink-soft)]">
          Code phrase: "{voice.codeWord}"
        </p>
        {voice.autoSendOnDetect && (
          <p className="mt-2 text-[11px] font-medium text-[var(--signal-deep)]">Auto-send is ON — no confirmation step.</p>
        )}
      </div>

      {/* Live transcript debug panel — shown only while listening */}
      {isListening && (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">What the mic is hearing</p>
          <p className="mt-1 min-h-[1.5rem] text-sm text-[var(--ink)]">
            {lastTranscript
              ? <span>"{lastTranscript}"</span>
              : <span className="text-[var(--ink-soft)] italic">Waiting for speech…</span>
            }
          </p>
          <p className="mt-1 text-[10px] text-[var(--ink-soft)]">
            Speak naturally — say your code phrase: <strong>"{voice.codeWord}"</strong>
          </p>
        </div>
      )}
    </div>
  )
}
