import { useState, useEffect, useRef } from 'react'

// Persists a piece of state to localStorage under `key`, seeded with `initialValue`
// the first time the key doesn't exist yet. Safe to call with objects/arrays.
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false }
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage unavailable (private mode / quota) — fail silently, state still works in-memory
    }
  }, [key, value])

  return [value, setValue]
}
