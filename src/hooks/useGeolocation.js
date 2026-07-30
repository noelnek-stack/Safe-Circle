import { useState, useCallback } from 'react'

const FALLBACK = { lat: 24.8607, lng: 67.0011, label: 'Karachi, Pakistan' }

// Wraps the browser Geolocation API. Reverse-geocodes the coordinate through
// OpenStreetMap's free Nominatim service so we can show a human-readable area name.
export default function useGeolocation() {
  const [position, setPosition] = useState(null)
  const [status, setStatus] = useState('idle') // idle | locating | ready | denied | error
  const [label, setLabel] = useState(null)

  const locate = useCallback(() => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        setStatus('error')
        const fallback = { ...FALLBACK }
        setPosition(fallback)
        setLabel(fallback.label)
        resolve(fallback)
        return
      }

      setStatus('locating')
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setPosition(coords)
          setStatus('ready')

          let resolvedLabel = 'Current location'
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`
            )
            const data = await res.json()
            const addr = data.address || {}
            const area = addr.suburb || addr.neighbourhood || addr.town || addr.city_district
            const city = addr.city || addr.town || addr.state
            resolvedLabel = [area, city].filter(Boolean).join(', ') || data.display_name || 'Current location'
          } catch {
            resolvedLabel = 'Current location'
          }

          setLabel(resolvedLabel)
          resolve({ ...coords, label: resolvedLabel })
        },
        () => {
          setStatus('denied')
          const fallback = { ...FALLBACK }
          setPosition(fallback)
          setLabel(fallback.label + ' (approximate)')
          resolve({ ...fallback, label: fallback.label + ' (approximate)' })
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
  }, [])

  return { position, label, status, locate, fallback: FALLBACK }
}
