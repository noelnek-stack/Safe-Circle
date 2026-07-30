import { useEffect, useState } from 'react'

// Maps Open-Meteo's numeric weather codes to a short label + whether it's
// "clear-ish" (used to pick an icon on the caller's side).
// https://open-meteo.com/en/docs#weathervariables
const CODE_MAP = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
}

// Free, keyless current-conditions lookup via Open-Meteo — same
// no-signup-required philosophy as the Nominatim/OSRM/Overpass calls
// used elsewhere in this app.
export default function useWeather(lat, lng) {
  const [weather, setWeather] = useState(null) // { tempC, condition, code }
  const [status, setStatus] = useState('idle') // idle | loading | ready | error

  useEffect(() => {
    if (lat == null || lng == null) return
    let cancelled = false

    async function fetchWeather() {
      setStatus('loading')
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`
        )
        if (!res.ok) throw new Error('Weather request failed')
        const data = await res.json()
        if (cancelled) return
        const code = data?.current?.weather_code
        setWeather({
          tempC: Math.round(data?.current?.temperature_2m),
          condition: CODE_MAP[code] || 'Unknown',
          code,
        })
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    fetchWeather()
    return () => { cancelled = true }
  }, [lat, lng])

  return { weather, status }
}
