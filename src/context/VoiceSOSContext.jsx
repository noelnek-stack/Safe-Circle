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

  const recognitionRef = useRef(null)
  const restartingRef = useRef(false)
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  const priorityCount = contacts.filter((c) => c.priority).length
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
        // Location permission denied or unavailable — still send the alert.
      }

      if (user) {
        await api.triggerSos({ lat, lng, accuracy, source: 'voice' })
      }
      endCheckIn('sos')
      setAutoSent(true)
      setTriggered(false)
    } catch (err) {
      console.error('Failed to send SOS:', err)
    } finally {
      setSending(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, endCheckIn])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    restartingRef.current = true
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      // start() throws if already started; that's fine, it's already on.
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    restartingRef.current = false
    recognitionRef.current.stop()
    setIsListening(false)
  }, [])

  // Set up (once) a recognizer that keeps restarting itself so it behaves
  // like always-on listening, and checks each transcript chunk for the
  // code phrase.
  useEffect(() => {
    if (!supported) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const target = normalize(voiceRef.current.codeWord || '')
      if (!target) return
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = normalize(event.results[i][0].transcript)
        if (transcript.includes(target)) {
          if (voiceRef.current.autoSendOnDetect) {
            sendSOS()
          } else {
            setTriggered(true)
          }
          break
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
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
    if (desiredActive) startListening()

    return () => {
      restartingRef.current = false
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, sendSOS])

  // If the tab becomes visible again (person switched back to this browser
  // tab, or came back from another app) and listening should be on but
  // isn't actually running right now, restart it. This is what makes Voice
  // SOS "turn back on when you return" instead of silently staying off.
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
