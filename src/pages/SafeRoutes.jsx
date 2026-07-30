import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bike, Bookmark, Bus, Car, Footprints, Navigation2, Trash2, ShieldAlert } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import useGeolocation from '../hooks/useGeolocation'
import MapView from '../components/MapView'

async function geocode(query) {
  if (!query || query.length < 3) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`
  )
  return res.json()
}

function toRad(value) {
  return (value * Math.PI) / 180
}

function haversineDistanceKm(from, to) {
  const earthRadiusKm = 6371
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function buildFallbackRoute(from, to, steps = 7) {
  const coords = []
  const startLat = from.lat
  const startLng = from.lng
  const endLat = to.lat
  const endLng = to.lng
  const curve = Math.max(0.0003, Math.min(0.0012, haversineDistanceKm(from, to) / 2000))

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const lat = startLat + (endLat - startLat) * t
    const lng = startLng + (endLng - startLng) * t
    const bend = Math.sin(t * Math.PI) * curve
    coords.push([lat + bend * 0.6, lng + bend])
  }

  return coords
}

async function route(from, to, { alternatives = false, profile = 'walking' } = {}) {
  const service = profile === 'car' || profile === 'bus' ? 'car' : profile === 'bike' ? 'bike' : 'foot'
  
  const speedByMode = {
    walking: 4.8,
    bike: 14,
    car: 32,
    bus: 18,
  }

  try {
    const url = `https://routing.openstreetmap.de/routed-${service}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson${alternatives ? '&alternatives=true' : ''}`
    
    const res = await fetch(url)
    if (!res.ok) throw new Error('routing failed')
    const data = await res.json()
    const legs = data.routes || []
    if (!legs.length) throw new Error('no route')

    return legs.map((leg) => ({
      coords: leg.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: (leg.distance / 1000).toFixed(1),
      minutes: Math.max(5, Math.round((leg.distance / 1000) / (speedByMode[profile] || speedByMode.walking) * 60 * (profile === 'walking' ? 1.1 : profile === 'bike' ? 1.08 : profile === 'car' ? 1.25 : 1.2))),
    }))
  } catch {
    const fallbackCoords = buildFallbackRoute(from, to)
    const distanceKm = haversineDistanceKm(from, to)
    const estimatedMinutes = Math.max(5, Math.round(distanceKm / (speedByMode[profile] || speedByMode.walking) * 60 * (profile === 'walking' ? 1.1 : profile === 'bike' ? 1.08 : profile === 'car' ? 1.25 : 1.2)))

    return [{
      coords: fallbackCoords,
      distanceKm: distanceKm.toFixed(1),
      minutes: estimatedMinutes,
    }]
  }
}

function LocationField({ label, value, onChange, onPick, placeholder, onUseCurrentLocation }) {
  const [query, setQuery] = useState(value?.label || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const debounce = useRef(null)

  useEffect(() => { setQuery(value?.label || '') }, [value])

  function onType(v) {
    setQuery(v)
    onChange?.(null)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      const r = await geocode(v)
      setResults(r)
      setOpen(true)
    }, 400)
  }

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-[var(--ink-soft)]">{label}</label>
        {onUseCurrentLocation && (
          <button
            type="button"
            onClick={onUseCurrentLocation}
            className="text-[10px] font-semibold uppercase tracking-wide text-[var(--moss)] transition hover:underline"
          >
            Use current location
          </button>
        )}
      </div>
      <input
        value={query}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-lg">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => {
                const picked = { lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: r.display_name.split(',').slice(0, 2).join(',') }
                onPick(picked)
                setQuery(picked.label)
                setOpen(false)
              }}
              className="block w-full truncate px-3 py-2 text-left text-xs hover:bg-[var(--paper)]"
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SafeRoutes() {
  const { dangerZones, routes, saveRoute, removeRoute } = useSafety()
  const { position, label, locate, fallback } = useGeolocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [showZones, setShowZones] = useState(true)
  const [travelMode, setTravelMode] = useState('walking')
  const [result, setResult] = useState(null)
  const [routeOptions, setRouteOptions] = useState([])
  const [routing, setRouting] = useState(false)
  const [error, setError] = useState(null)
  const [previewRoute, setPreviewRoute] = useState(null)

  useEffect(() => { locate() }, [locate])

  // A destination can arrive from the Nearby Places page (?toLat=&toLng=&toLabel=)
  useEffect(() => {
    const toLat = searchParams.get('toLat')
    const toLng = searchParams.get('toLng')
    const toLabel = searchParams.get('toLabel')
    if (toLat && toLng) {
      setTo({ lat: parseFloat(toLat), lng: parseFloat(toLng), label: toLabel || 'Selected place' })
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const fromAutoRef = useRef(true)

  const here = position || fallback

  useEffect(() => {
    if (fromAutoRef.current && here) {
      setFrom({ lat: here.lat, lng: here.lng, label: label || 'Current location' })
    }
  }, [here?.lat, here?.lng, label])

  function setFromManual(value) {
    fromAutoRef.current = false
    setFrom(value)
  }

  useEffect(() => {
    async function updatePreview() {
      if (!from || !to) {
        setPreviewRoute(null)
        return
      }
      try {
        const [primaryRoute] = await route(from, to, { profile: travelMode })
        setPreviewRoute(primaryRoute)
      } catch {
        setPreviewRoute(null)
      }
    }
    updatePreview()
  }, [from, to, travelMode])

  async function handleUseCurrentLocation() {
    const resolved = await locate()
    fromAutoRef.current = false
    setFrom({ lat: resolved.lat, lng: resolved.lng, label: resolved.label || 'Current location' })
  }

  async function findRoute(e) {
    e?.preventDefault()
    if (!from || !to) { setError('Choose both a starting point and a destination.'); return }
    setRouting(true)
    setError(null)
    setRouteOptions([])
    try {
      const [primaryRoute] = await route(from, to, { profile: travelMode })
      setResult(primaryRoute)
    } catch {
      setError('Could not fetch a route right now — the free routing service may be busy. Try again shortly.')
      setResult(null)
    } finally {
      setRouting(false)
    }
  }

  async function showAlternateRoutes(e) {
    e?.preventDefault()
    if (!from || !to) { setError('Choose both a starting point and a destination.'); return }
    setRouting(true)
    setError(null)
    try {
      const options = await route(from, to, { alternatives: true, profile: travelMode })
      setRouteOptions(options)
      setResult(options[0] || null)
    } catch {
      setError('Could not fetch alternate routes right now — the free routing service may be busy. Try again shortly.')
      setRouteOptions([])
      setResult(null)
    } finally {
      setRouting(false)
    }
  }

  function handleSave() {
    if (!from || !to) return
    saveRoute({
      name: `${from.label.split(',')[0]} to ${to.label.split(',')[0]}`,
      from: from.label,
      to: to.label,
      fromPoint: { lat: from.lat, lng: from.lng, label: from.label },
      toPoint: { lat: to.lat, lng: to.lng, label: to.label },
      travelMode,
      rating: '—',
    })
  }

  async function handleLoadSavedRoute(savedRoute) {
    if (!savedRoute.fromPoint || !savedRoute.toPoint) {
      setError('This saved route is missing location data — try saving it again to enable navigation.')
      return
    }
    setError(null)
    setRouteOptions([])
    fromAutoRef.current = false
    setFrom(savedRoute.fromPoint)
    setTo(savedRoute.toPoint)
    const mode = savedRoute.travelMode || travelMode
    setTravelMode(mode)
    setRouting(true)
    try {
      const [primaryRoute] = await route(savedRoute.fromPoint, savedRoute.toPoint, { profile: mode })
      setResult(primaryRoute)
    } catch {
      setError('Could not fetch this route right now — the free routing service may be busy. Try again shortly.')
      setResult(null)
    } finally {
      setRouting(false)
    }
  }

  function handleModeChange(nextMode) {
    setTravelMode(nextMode)
    setResult(null)       
    setRouteOptions([])   
  }

  const zonesOnMap = showZones ? dangerZones : []
  const markers = to ? [{ lat: to.lat, lng: to.lng, label: to.label, color: '#5B5A8C' }] : []
  const transportModes = [
    { key: 'walking', label: 'Walk', icon: Footprints, profile: 'foot' },
    { key: 'bike', label: 'Bike', icon: Bike, profile: 'bike' },
    { key: 'car', label: 'Car', icon: Car, profile: 'car' },
    { key: 'bus', label: 'Bus', icon: Bus, profile: 'bus' },
  ]
  const activeMode = transportModes.find((mode) => mode.key === travelMode) || transportModes[0]
  const activeRoute = result || previewRoute

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Safe Routes</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Plan a walking route and see reported unsafe areas before you go.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="flex flex-col gap-4 lg:col-span-4">
          <form onSubmit={findRoute} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <LocationField
              label="From"
              value={from}
              onChange={setFromManual}
              onPick={setFromManual}
              placeholder="Current location"
              onUseCurrentLocation={handleUseCurrentLocation}
            />
            <LocationField label="To" value={to} onChange={setTo} onPick={setTo} placeholder="Where are you headed?" />

            <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
              {transportModes.map((mode) => {
                const Icon = mode.icon
                const isActive = travelMode === mode.key
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => handleModeChange(mode.key)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold transition ${isActive ? 'bg-[var(--moss)] text-white' : 'bg-[var(--paper)] text-[var(--ink-soft)] hover:text-[var(--moss-deep)]'}`}
                    title={mode.label}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={routing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--moss)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--moss-deep)] disabled:opacity-60"
              >
                <Navigation2 size={16} /> {routing ? 'Finding a route…' : 'Navigate now'}
              </button>
              <button
                type="button"
                onClick={showAlternateRoutes}
                disabled={routing}
                className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--moss)] hover:text-[var(--moss-deep)] disabled:opacity-60"
              >
                Alternate routes
              </button>
            </div>
            {error && <p className="text-xs text-[var(--signal)]">{error}</p>}

            {routeOptions.length > 0 && (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Route options</p>
                  <span className="text-[11px] text-[var(--ink-soft)]">{routeOptions.length} found</span>
                </div>
                <div className="space-y-2">
                  {routeOptions.map((option, index) => {
                    const isActive = result?.distanceKm === option.distanceKm && result?.minutes === option.minutes
                    return (
                      <button
                        key={`${option.distanceKm}-${option.minutes}-${index}`}
                        type="button"
                        onClick={() => setResult(option)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${isActive ? 'border-[var(--moss)] bg-[var(--moss-soft)]' : 'border-[var(--line)] bg-[var(--paper)] hover:border-[var(--moss)]'}`}
                      >
                        <div>
                          <p className="font-medium">Route {index + 1}</p>
                          <p className="text-[11px] text-[var(--ink-soft)]">{activeMode.label} · {option.distanceKm} km</p>
                        </div>
                        <span className="text-xs font-semibold text-[var(--moss-deep)]">~{option.minutes} min</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {activeRoute && (
              <div className="flex items-center justify-between rounded-lg bg-[var(--moss-soft)] px-3 py-2.5 text-xs font-medium text-[var(--moss-deep)]">
                <span>{activeRoute.distanceKm} km · about {activeRoute.minutes} min {activeMode.label.toLowerCase()} (city-aware estimate)</span>
                <button type="button" onClick={handleSave} className="flex items-center gap-1 font-semibold hover:underline">
                  <Bookmark size={13} /> Save
                </button>
              </div>
            )}
          </form>

          <label className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium"><ShieldAlert size={15} className="text-[var(--signal)]" /> Show reported unsafe areas</span>
            <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} className="h-4 w-4 accent-[var(--moss)]" />
          </label>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] px-5 py-3.5">
              <h2 className="text-sm font-semibold">Saved routes</h2>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {routes.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <button
                    type="button"
                    onClick={() => handleLoadSavedRoute(r)}
                    disabled={routing}
                    className="flex-1 text-left transition hover:opacity-75 disabled:opacity-60"
                    title="Navigate this route"
                  >
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-[var(--ink-soft)]">{r.from} → {r.to}</p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeRoute(r.id) }}
                    className="ml-3 shrink-0 text-[var(--ink-soft)] hover:text-[var(--signal)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {routes.length === 0 && <p className="px-5 py-4 text-xs text-[var(--ink-soft)]">No saved routes yet.</p>}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] lg:col-span-8">
          <div className="h-[560px]">
            <MapView
              key={activeRoute ? `${travelMode}-${activeRoute.distanceKm}` : 'no-route'}
              center={[here.lat, here.lng]}
              userPosition={{ ...here, label: label || 'You are here' }}
              dangerZones={zonesOnMap}
              markers={markers}
              startLocation={from || (here ? { lat: here.lat, lng: here.lng, label: label || 'Current location' } : null)}
              routeCoords={activeRoute?.coords}
            />
          </div>
        </section>
      </div>
    </div>
  )
}