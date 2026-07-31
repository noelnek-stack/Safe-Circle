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
// Uses a word-boundary aware match so "help" doesn't match "helpful",
// but is forgiving enough to catch slight mis-transcriptions by also
// doing a token-overlap check (useful for multi-word phrases).
function phraseDetected(transcript, target) {
  if (!transcript || !target) return false
  const t = normalize(transcript)
  const p = normalize(target)
  if (!p) return false

  // Direct substring match (covers most cases).
  if (t.includes(p)) return true

  // Token overlap: if the phrase has multiple words, check that all
  // words appear somewhere in the transcript (handles reordering/extra words).
  const phraseWords = p.split(/\s+/).filter(Boolean)
  if (phraseWords.length > 1) {
    const transcriptWords = t.split(/\s+/)
    return phraseWords.every((w) => transcriptWords.includes(w))
  }

  return false
}

// This provider is mounted once, above the app's routes, so the recognizer
// it owns keeps running no matter which page is on screen. Listening state
// is also persisted to localStorage, so it survives full page reloads and
// browser tab switches too — it only ever turns off if the person taps the
// mic to turn it off themselves.
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

  const recognitionRef = useRef(null)
  const restartingRef = useRef(false)

  // Keep a ref to the latest voice/user/endCheckIn so the recognition
  // onresult handler always sees current values without ever being
  // recreated (which would destroy the running recognition instance).
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

  // sendSOS is stable — it reads current values via refs so it never
  // needs to be recreated and never causes the recognition useEffect to re-run.
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
        // Location permission denied or unavailable — still send the alert.
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
  }, []) // No deps — reads everything via refs

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    restartingRef.current = true
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      // start() throws if already started — that's fine, it's already on.
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    restartingRef.current = false
    recognitionRef.current.stop()
    setIsListening(false)
  }, [])

  // Set up the recognizer ONCE (empty deps) so it is never torn down and
  // recreated while listening is active. All dynamic values (code phrase,
  // user, autoSendOnDetect) are read via refs inside the handlers so they
  // always see the latest values without needing the effect to re-run.
  useEffect(() => {
    if (!supported) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    // Use only FINAL results for matching — interim results are incomplete
    // mid-word fragments that cause missed detections and false negatives.
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 3 // Check top-3 alternatives for robustness

    recognition.onresult = (event) => {
      const target = voiceRef.current.codeWord || ''
      if (!target.trim()) return

      // Only iterate over NEW results from this event batch.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        // Skip interim results (belt-and-suspenders — interimResults=false
        // should prevent these, but be safe).
        if (!result.isFinal) continue

        // Check each alternative transcript (up to maxAlternatives).
        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript
          if (j === 0) setLastTranscript(transcript) // Show best guess in UI
          console.debug('[VoiceSOS] heard:', transcript, '| looking for:', target)

          if (phraseDetected(transcript, target)) {
            console.info('[VoiceSOS] ✅ Code phrase detected!')
            if (voiceRef.current.autoSendOnDetect) {
              sendSOS()
            } else {
              setTriggered(true)
            }
            return // Don't process further results once triggered
          }
        }
      }
    }

    recognition.onerror = (event) => {
      // 'no-speech' and 'aborted' are expected during normal operation.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.warn('[VoiceSOS] error:', event.error)
      setError(event.error === 'not-allowed'
        ? 'Microphone permission was denied. Allow mic access in your browser settings to use Voice SOS.'
        : `Voice detection error: ${event.error}`)
    }

    // Chrome's recognizer stops itself after a period of silence, and
    // browsers may also pause/kill it while the tab is hidden. Restart it
    // automatically so listening feels continuous, unless the person
    // explicitly turned it off.
    recognition.onend = () => {
      if (restartingRef.current) {
        try { recognition.start() } catch { /* already starting */ }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition

    // Resume listening automatically if it was on before (e.g. a page
    // reload, or the browser fully tore down recognition while the tab was
    // in the background) — as long as it wasn't manually turned off.
    if (desiredActiveRef.current) {
      restartingRef.current = true
      try { recognition.start(); setIsListening(true) } catch { /* already started */ }
    }

    return () => {
      // Stop the instance cleanly. Do NOT null out onend before stopping —
      // onend fires asynchronously after stop(), and we need it to NOT
      // restart (restartingRef is already false at this point).
      restartingRef.current = false
      recognition.stop()
      // Null handlers after stopping to prevent stale callbacks.
      setTimeout(() => {
        recognition.onresult = null
        recognition.onerror = null
        recognition.onend = null
      }, 200)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]) // ← ONLY depends on `supported`, never recreated while listening

  // If the tab becomes visible again (person switched back to this browser
  // tab, or came back from another app) and listening should be on but
  // isn't actually running right now, restart it.
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
    isListening, triggered, sending, autoSent, error,
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
