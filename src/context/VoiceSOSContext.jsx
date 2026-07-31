import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'
import { useSafety } from './SafetyContext'
import { useAuth } from './AuthContext'
import { api } from '../api/client'

const VoiceSOSContext = createContext(null)

// Web Speech API's SpeechRecognition — free, built into Chrome/Edge, no
// signup or API key. It streams audio to the browser vendor's speech
// servers for transcription (so it needs an internet connection and isn't
// fully private/offline), but there's no cost and nothing to configure.
const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

function wordsOf(str) {
  return normalize(str).split(/\s+/).filter(Boolean)
}

// Word-boundary-aware contiguous match: "help" must not match inside "helping".
function containsPhraseContiguous(transcriptWords, phraseWords) {
  if (phraseWords.length === 0) return false
  if (phraseWords.length === 1) {
    return transcriptWords.includes(phraseWords[0])
  }
  outer: for (let i = 0; i <= transcriptWords.length - phraseWords.length; i++) {
    for (let j = 0; j < phraseWords.length; j++) {
      if (transcriptWords[i + j] !== phraseWords[j]) continue outer
    }
    return true
  }
  return false
}

// Ordered (not necessarily contiguous) match with a small gap budget.
// Allows "red … phoenix" when the recognizer inserts a filler word or
// splits the phrase across a brief pause, without matching arbitrary
// distant occurrences of the individual words.
function containsPhraseOrdered(transcriptWords, phraseWords, maxGap = 2) {
  if (phraseWords.length === 0) return false
  let ti = 0
  for (let pi = 0; pi < phraseWords.length; pi++) {
    let found = -1
    const limit = ti + maxGap + 1
    for (let k = ti; k < Math.min(limit, transcriptWords.length); k++) {
      if (transcriptWords[k] === phraseWords[pi]) {
        found = k
        break
      }
    }
    if (found < 0) return false
    ti = found + 1
  }
  return true
}

// Checks whether a transcript (or combined recent buffer) contains the target
// phrase. Prefers exact contiguous word sequence, then ordered match with
// limited gaps. Single-word phrases require a whole-word match.
function phraseDetected(transcript, target) {
  if (!transcript || !target) return false
  const phraseWords = wordsOf(target)
  if (phraseWords.length === 0) return false

  const transcriptWords = wordsOf(transcript)
  if (transcriptWords.length === 0) return false

  if (containsPhraseContiguous(transcriptWords, phraseWords)) return true
  if (phraseWords.length > 1 && containsPhraseOrdered(transcriptWords, phraseWords, 2)) {
    return true
  }
  return false
}

// How long (ms) recent final transcripts stay in the rolling buffer used for
// cross-utterance detection. Covers a natural pause between words of a phrase.
const TRANSCRIPT_BUFFER_MS = 6000

// Ignore further detections for this long after a successful trigger so the
// same utterance (or immediate echo) cannot fire SOS twice.
const DETECT_COOLDOWN_MS = 8000

// How long to wait (ms) before restarting recognition after it ends.
// Keep this very short so the mic gap is imperceptible to the user.
const RESTART_DELAY_MS = 80

// On a genuine network hiccup, back off longer before retrying.
const NETWORK_ERROR_BACKOFF_MS = 2000

// If start() fails (e.g. still tearing down), retry after this delay.
const START_RETRY_MS = 250

export function VoiceSOSProvider({ children }) {
  const { voice, endCheckIn, contacts } = useSafety()
  const { user } = useAuth()

  // The person's *intent*: should listening be on? This is what persists.
  // The UI mic button is driven from this so it never flickers when Chrome
  // ends and restarts the underlying SpeechRecognition session.
  const [desiredActive, setDesiredActive] = useLocalStorage('sp_voice_desired_active', false)

  const [triggered, setTriggered] = useState(false)
  const [sending, setSending] = useState(false)
  const [autoSent, setAutoSent] = useState(false)
  const [error, setError] = useState('')
  const [lastTranscript, setLastTranscript] = useState('')
  // True only while the underlying SpeechRecognition session is running.
  // Used for the subtle pulse ring — not for the main on/off control.
  const [sessionActive, setSessionActive] = useState(false)

  const recognitionRef = useRef(null)
  // When true, onend will automatically restart the session.
  // Cleared only when the user (or a fatal error) turns listening off.
  const shouldRunRef = useRef(false)
  const restartTimerRef = useRef(null)
  // Debounces the "session active" UI indicator (pulse ring) so a quick
  // onend -> restart -> onstart cycle (the common case, ~80-250ms) doesn't
  // visibly flash the indicator off and back on. Only shown as "paused" if
  // the gap actually lasts long enough for a person to notice.
  const sessionOffTimerRef = useRef(null)
  const SESSION_OFF_DEBOUNCE_MS = 350
  const lastNetworkErrorRef = useRef(0)
  const isSessionActiveRef = useRef(false)
  // Rolling buffer of recent final transcripts so a multi-word code phrase
  // still matches when the recognizer splits it across separate finals.
  const transcriptBufferRef = useRef([]) // [{ text, at }]
  const lastDetectAtRef = useRef(0)

  // Keep refs to latest values so the one-time recognition effect never
  // needs to re-subscribe.
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  const userRef = useRef(user)
  userRef.current = user

  const endCheckInRef = useRef(endCheckIn)
  endCheckInRef.current = endCheckIn

  const desiredActiveRef = useRef(desiredActive)
  desiredActiveRef.current = desiredActive

  const priorityCount = contacts.filter((c) => c.priority).length
  // Contacts that would actually receive an SOS email — priority AND has an
  // email saved. This is what the server actually emails on detection, so
  // it's what the UI should warn about (having priority contacts with no
  // email looks "set up" but silently notifies nobody).
  const priorityWithEmailCount = contacts.filter((c) => c.priority && c.email && c.email.trim()).length
  const configured = !!voice.codeWord?.trim()
  const supported = !!SpeechRecognition

  const sendSOS = useCallback(async () => {
    setSending(true)
    try {
      let lat, lng, accuracy
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        )
        lat = position.coords.latitude
        lng = position.coords.longitude
        accuracy = position.coords.accuracy
      } catch {
        // Location unavailable — still send the alert.
      }

      if (userRef.current) {
        await api.triggerSos({ lat, lng, accuracy, source: 'voice' })
      }
      endCheckInRef.current('sos')
      setAutoSent(true)
      setTriggered(false)
    } catch (err) {
      console.error('Failed to send SOS:', err)
    } finally {
      setSending(false)
    }
  }, [])

  // Attempt to start recognition. Retries once if the engine is still
  // tearing down from a previous session (common right after onend).
  function tryStart(recognition, attempt = 0) {
    if (!shouldRunRef.current || !recognition) return
    try {
      recognition.start()
    } catch {
      if (attempt < 3 && shouldRunRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(
          () => tryStart(recognition, attempt + 1),
          START_RETRY_MS
        )
      }
    }
  }

  function scheduleRestart(recognition, delayMs) {
    clearTimeout(restartTimerRef.current)
    restartTimerRef.current = setTimeout(() => {
      if (!shouldRunRef.current) return
      tryStart(recognition)
    }, delayMs)
  }

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    clearTimeout(restartTimerRef.current)
    shouldRunRef.current = true
    transcriptBufferRef.current = []
    setError('')
    // Optimistically mark active; onstart will confirm.
    setSessionActive(true)
    tryStart(recognitionRef.current)
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    clearTimeout(restartTimerRef.current)
    clearTimeout(sessionOffTimerRef.current)
    shouldRunRef.current = false
    transcriptBufferRef.current = []
    isSessionActiveRef.current = false
    setSessionActive(false)
    setLastTranscript('')
    try {
      recognitionRef.current.stop()
    } catch {
      // Not running — fine.
    }
  }, [])

  // Set up the recognizer ONCE. Never torn down while the provider is mounted.
  // All dynamic values are read via refs inside handlers.
  useEffect(() => {
    if (!supported) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    // interimResults MUST be true — it keeps Chrome's WebSocket connection
    // alive between words so the session doesn't end after every utterance.
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 3

    recognition.onstart = () => {
      isSessionActiveRef.current = true
      clearTimeout(sessionOffTimerRef.current)
      setSessionActive(true)
      setError((prev) => (prev && prev.startsWith('Voice detection paused') ? '' : prev))
      console.debug('[VoiceSOS] session started')
    }

    recognition.onresult = (event) => {
      const target = voiceRef.current.codeWord || ''
      if (!target.trim()) return

      const now = Date.now()
      transcriptBufferRef.current = transcriptBufferRef.current.filter(
        (e) => now - e.at <= TRANSCRIPT_BUFFER_MS
      )

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]

        if (result[0]) setLastTranscript(result[0].transcript)

        if (!result.isFinal) continue

        if (now - lastDetectAtRef.current < DETECT_COOLDOWN_MS) continue

        if (result[0]) {
          transcriptBufferRef.current.push({ text: result[0].transcript, at: now })
        }
        const combined = transcriptBufferRef.current.map((e) => e.text).join(' ')

        let matched = false
        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript
          console.debug('[VoiceSOS] final:', JSON.stringify(transcript), '| target:', JSON.stringify(target))
          if (phraseDetected(transcript, target)) {
            matched = true
            break
          }
        }
        if (!matched && phraseDetected(combined, target)) {
          matched = true
        }

        if (matched) {
          console.info('[VoiceSOS] ✅ Code phrase detected!')
          lastDetectAtRef.current = now
          transcriptBufferRef.current = []
          if (voiceRef.current.autoSendOnDetect) {
            sendSOS()
          } else {
            setTriggered(true)
          }
          return
        }
      }
    }

    recognition.onerror = (event) => {
      console.warn('[VoiceSOS] recognition error:', event.error)

      if (event.error === 'aborted') {
        // Aborted by us (stop / restart) — not a real error.
        return
      }

      if (event.error === 'no-speech') {
        // Normal silence window; onend will restart if shouldRunRef is true.
        return
      }

      if (event.error === 'network') {
        // Transient: restarting too quickly or a brief server hiccup.
        lastNetworkErrorRef.current = Date.now()
        console.warn('[VoiceSOS] Transient network error — will retry after backoff.')
        return
      }

      if (event.error === 'not-allowed') {
        setError('Microphone permission was denied. Allow mic access in your browser settings to use Voice SOS.')
        shouldRunRef.current = false
        setDesiredActive(false)
        isSessionActiveRef.current = false
        setSessionActive(false)
        return
      }

      // Other errors: surface a soft message; onend still restarts if desired.
      if (shouldRunRef.current) {
        setError(`Voice detection paused (${event.error}) — retrying…`)
      }
    }

    // Chrome ends continuous sessions after silence, network blips, or
    // internal timeouts. As long as the user still wants listening on
    // (shouldRunRef), restart immediately without flipping the main UI off.
    recognition.onend = () => {
      isSessionActiveRef.current = false
      // Don't flip the visible indicator off immediately — most restarts
      // land well inside this window and onstart will cancel the timer
      // before it fires, so the UI never shows the blip at all.
      clearTimeout(sessionOffTimerRef.current)
      sessionOffTimerRef.current = setTimeout(() => {
        if (!isSessionActiveRef.current) setSessionActive(false)
      }, SESSION_OFF_DEBOUNCE_MS)

      if (!shouldRunRef.current) {
        console.debug('[VoiceSOS] session ended — listening is off, not restarting')
        return
      }

      const timeSinceNetworkError = Date.now() - lastNetworkErrorRef.current
      const delay = timeSinceNetworkError < 3000
        ? NETWORK_ERROR_BACKOFF_MS
        : RESTART_DELAY_MS

      console.debug('[VoiceSOS] session ended — restarting in', delay, 'ms')
      scheduleRestart(recognition, delay)
    }

    recognitionRef.current = recognition

    // Auto-resume if listening was on before (page reload / provider remount).
    if (desiredActiveRef.current) {
      shouldRunRef.current = true
      scheduleRestart(recognition, RESTART_DELAY_MS)
    }

    return () => {
      // Critical: detach handlers BEFORE stop() so the resulting onend does
      // not run our logic with shouldRunRef already false (that was causing
      // isListening / UI flicker on React Strict Mode remounts and HMR).
      clearTimeout(restartTimerRef.current)
      clearTimeout(sessionOffTimerRef.current)
      shouldRunRef.current = false
      recognition.onstart = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  // Keep shouldRunRef in sync when desiredActive changes from outside
  // (e.g. localStorage hydrate) and resume if needed.
  useEffect(() => {
    if (desiredActive) {
      if (!shouldRunRef.current) {
        startListening()
      }
    } else if (shouldRunRef.current) {
      stopListening()
    }
  }, [desiredActive, startListening, stopListening])

  // Resume when the tab becomes visible again (Chrome often kills the
  // speech session while backgrounded).
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      if (!desiredActiveRef.current) return
      // Force a restart if the session is not currently active.
      if (!isSessionActiveRef.current && recognitionRef.current) {
        shouldRunRef.current = true
        scheduleRestart(recognitionRef.current, RESTART_DELAY_MS)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [])

  function toggleListening() {
    if (desiredActive) {
      setDesiredActive(false)
      stopListening()
    } else {
      setError('')
      setTriggered(false)
      setAutoSent(false)
      setDesiredActive(true)
      startListening()
    }
  }

  const value = {
    // Driven by user intent (desiredActive), not by Chrome's session cycling.
    // Stays true until the user turns listening off (or mic permission fails).
    isListening: desiredActive,
    sessionActive,
    triggered, sending, autoSent, error,
    supported, configured, priorityCount, priorityWithEmailCount,
    lastTranscript,
    toggleListening, sendSOS,
    setTriggered,
  }

  return <VoiceSOSContext.Provider value={value}>{children}</VoiceSOSContext.Provider>
}

export function useVoiceSOS() {
  const ctx = useContext(VoiceSOSContext)
  if (!ctx) throw new Error('useVoiceSOS must be used within VoiceSOSProvider')
  return ctx
}
