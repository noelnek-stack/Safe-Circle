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

// Checks whether a transcript contains the target phrase.
// Does a direct substring match first, then a word-overlap fallback
// (handles slight mis-transcriptions or reordered words).
function phraseDetected(transcript, target) {
  if (!transcript || !target) return false
  const t = normalize(transcript)
  const p = normalize(target)
  if (!p) return false

  if (t.includes(p)) return true

  const phraseWords = p.split(/\s+/).filter(Boolean)
  if (phraseWords.length > 1) {
    const transcriptWords = t.split(/\s+/)
    return phraseWords.every((w) => transcriptWords.includes(w))
  }

  return false
}

// How long to wait (ms) before restarting recognition after it ends.
// Keep this very short so the mic gap is imperceptible to the user.
const RESTART_DELAY_MS = 150

// On a genuine network hiccup, back off longer before retrying.
const NETWORK_ERROR_BACKOFF_MS = 2000

export function VoiceSOSProvider({ children }) {
  const { voice, endCheckIn, contacts } = useSafety()
  const { user } = useAuth()

  // The person's *intent*: should listening be on? This is what persists.
  const [desiredActive, setDesiredActive] = useLocalStorage('sp_voice_desired_active', false)

  const [isListening, setIsListening] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const [sending, setSending] = useState(false)
  const [autoSent, setAutoSent] = useState(false)
  const [error, setError] = useState('')
  const [lastTranscript, setLastTranscript] = useState('')
  // sessionActive tracks the underlying recognition session state.
  // It cycles on/off as Chrome restarts sessions. We never expose this
  // directly — the UI button uses desiredActive instead so it never flickers.
  const [sessionActive, setSessionActive] = useState(false)

  const recognitionRef = useRef(null)
  const restartingRef = useRef(false)
  const restartTimerRef = useRef(null)   // holds the pending setTimeout id
  const lastNetworkErrorRef = useRef(0)  // timestamp of last network error
  // Tracks whether a session is truly active RIGHT NOW (not flickering
  // during the restart gap). Used to keep isListening=true continuously.
  const isSessionActiveRef = useRef(false)

  // Keep a ref to the latest voice/user/endCheckIn so handlers always see
  // current values without the recognition useEffect ever needing to re-run.
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  const userRef = useRef(user)
  userRef.current = user

  const endCheckInRef = useRef(endCheckIn)
  endCheckInRef.current = endCheckIn

  const desiredActiveRef = useRef(desiredActive)
  desiredActiveRef.current = desiredActive

  const priorityCount = contacts.filter((c) => c.priority).length
  const configured = !!voice.codeWord?.trim()
  const supported = !!SpeechRecognition

  // Stable — reads everything via refs, never causes the effect to re-run.
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

  // Schedule a delayed restart. Uses a ref so we can cancel any pending
  // restart if the user manually stops listening.
  function scheduleRestart(recognition, delayMs) {
    clearTimeout(restartTimerRef.current)
    restartTimerRef.current = setTimeout(() => {
      if (!restartingRef.current) return // user stopped while we were waiting
      try {
        recognition.start()
      } catch {
        // Already started — that's fine.
      }
    }, delayMs)
  }

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    clearTimeout(restartTimerRef.current)
    restartingRef.current = true
    isSessionActiveRef.current = true
    setError('')
    setSessionActive(true)
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      // start() throws if already running — already on, that's fine.
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    clearTimeout(restartTimerRef.current)
    restartingRef.current = false
    recognitionRef.current.stop()
    setIsListening(false)
    setSessionActive(false)
    setLastTranscript('')
  }, [])

  // Set up the recognizer ONCE. Never torn down while listening is active.
  // All dynamic values are read via refs inside handlers.
  useEffect(() => {
    if (!supported) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    // interimResults MUST be true — it keeps Chrome's WebSocket connection
    // alive between words so the session doesn't end after every utterance.
    // Without it, Chrome closes the session constantly causing the mic to
    // visibly cycle on/off every few seconds. We still only check isFinal
    // results for phrase detection — interim results are only used to keep
    // the connection alive and to show a live transcript in the UI.
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 3 // Try top-3 transcription guesses

    recognition.onresult = (event) => {
      const target = voiceRef.current.codeWord || ''
      if (!target.trim()) return

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]

        // Always show the best live transcript (interim or final) in the UI.
        if (result[0]) setLastTranscript(result[0].transcript)

        // Only check for the phrase in FINAL (committed) results.
        if (!result.isFinal) continue

        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript
          console.debug('[VoiceSOS] final:', JSON.stringify(transcript), '| target:', JSON.stringify(target))

          if (phraseDetected(transcript, target)) {
            console.info('[VoiceSOS] ✅ Code phrase detected!')
            if (voiceRef.current.autoSendOnDetect) {
              sendSOS()
            } else {
              setTriggered(true)
            }
            return
          }
        }
      }
    }

    recognition.onerror = (event) => {
      console.warn('[VoiceSOS] recognition error:', event.error)

      if (event.error === 'aborted') {
        // Aborted by us (e.g. during restart) — not a real error, ignore.
        return
      }

      if (event.error === 'no-speech') {
        // No speech detected in the current window — perfectly normal,
        // the recognizer will end and onend will restart it.
        return
      }

      if (event.error === 'network') {
        // Chrome returns "network" when the speech session is restarted
        // too quickly, or when Google's servers briefly hiccup. This is
        // almost always transient — do NOT show it to the user as a fatal
        // error. Instead, back off and let onend restart it automatically.
        lastNetworkErrorRef.current = Date.now()
        console.warn('[VoiceSOS] Transient network error — will retry automatically after backoff.')
        return
      }

      if (event.error === 'not-allowed') {
        setError('Microphone permission was denied. Allow mic access in your browser settings to use Voice SOS.')
        restartingRef.current = false // fatal — don't retry
        setIsListening(false)
        return
      }

      // For any other error, show a message but still try to recover.
      setError(`Voice detection paused (${event.error}) — retrying…`)
    }

    // Chrome's recognizer stops itself after silence or a network hiccup.
    // We restart it automatically. Crucially, we do NOT set isListening=false
    // during the restart gap — the mic appears to stay on continuously.
    recognition.onend = () => {
      isSessionActiveRef.current = false
      setSessionActive(false)

      if (!restartingRef.current) {
        setIsListening(false)
        return
      }

      // Keep isListening=true so the UI doesn't flicker during the restart gap.
      // The actual mic is briefly off for RESTART_DELAY_MS but the user won't
      // see or hear it as a toggle.
      const timeSinceNetworkError = Date.now() - lastNetworkErrorRef.current
      const delay = timeSinceNetworkError < 3000
        ? NETWORK_ERROR_BACKOFF_MS
        : RESTART_DELAY_MS

      console.debug('[VoiceSOS] session ended — restarting in', delay, 'ms')
      scheduleRestart(recognition, delay)
    }

    recognitionRef.current = recognition

    // Auto-resume if listening was on before (page reload / tab switch).
    if (desiredActiveRef.current) {
      restartingRef.current = true
      isSessionActiveRef.current = true
      setIsListening(true)
      setSessionActive(true)
      scheduleRestart(recognition, RESTART_DELAY_MS)
    }

    return () => {
      clearTimeout(restartTimerRef.current)
      restartingRef.current = false
      recognition.stop()
      setTimeout(() => {
        recognition.onresult = null
        recognition.onerror = null
        recognition.onend = null
      }, 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]) // Only runs once — never recreated while listening

  // Resume listening when the tab becomes visible again.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && desiredActive && !isListening) {
        startListening()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [desiredActive, isListening, startListening])

  function toggleListening() {
    if (isListening) {
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
    // isListening = the user's intent (desiredActive). Stays true the whole
    // time the user wants listening on, regardless of session cycling.
    // This is what drives the mic button visual — it never flickers.
    isListening,
    sessionActive,   // true only when the underlying session is actually running
    triggered, sending, autoSent, error,
    supported, configured, priorityCount,
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
