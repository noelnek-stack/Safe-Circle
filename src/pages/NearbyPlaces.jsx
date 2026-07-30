import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hospital, Siren, Utensils, Store, ShoppingBag, Search, LocateFixed, ShieldAlert } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import useGeolocation from '../hooks/useGeolocation'
import MapView from '../components/MapView'

const CATEGORY_META = {
  restaurant: { label: 'Restaurant & café', icon: Utensils, color: '#B8863B' },
  hospital: { label: 'Hospital & clinic', icon: Hospital, color: '#C7402F' },
  police: { label: 'Police station', icon: Siren, color: '#2F5D42' },
  market: { label: 'Market', icon: ShoppingBag, color: '#5B5A8C' },
  shopping: { label: 'Mall & supermarket', icon: Store, color: '#5B5A8C' },
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

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function categorize(tags) {
  const amenity = tags.amenity
  const shop = tags.shop
  if (['restaurant', 'cafe', 'fast_food'].includes(amenity)) return 'restaurant'
  if (['hospital', 'clinic', 'pharmacy'].includes(amenity)) return 'hospital'
  if (amenity === 'police') return 'police'
  if (amenity === 'marketplace') return 'market'
  if (['mall', 'supermarket', 'convenience', 'department_store'].includes(shop)) return 'shopping'
  return null
}

// Free, no-key-required lookup via OpenStreetMap's Overpass API — same
// no-paid-API-key approach used elsewhere in the app (Nominatim, OSRM).
async function fetchNearbyPlaces(center, radiusMeters = 3000) {
  const filters = [
    '["amenity"~"^(restaurant|cafe|fast_food)$"]',
    '["amenity"~"^(hospital|clinic|pharmacy)$"]',
    '["amenity"="police"]',
    '["amenity"="marketplace"]',
    '["shop"~"^(mall|supermarket|convenience|department_store)$"]',
  ]
  const clauses = filters
    .map(
      (f) =>
        `node(around:${radiusMeters},${center.lat},${center.lng})${f};way(around:${radiusMeters},${center.lat},${center.lng})${f};`
    )
    .join('')
  const query = `[out:json][timeout:25];(${clauses});out center 120;`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) throw new Error('Overpass request failed')
  const data = await res.json()
  return data.elements || []
}

function processElements(elements, center) {
  const seen = new Set()
  const places = []
  for (const el of elements) {
    const tags = el.tags || {}
    const name = tags.name
    if (!name) continue
    const category = categorize(tags)
    if (!category) continue
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) continue

    const key = `${category}-${name}-${lat.toFixed(4)}-${lng.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)

    places.push({
      id: `${el.type}-${el.id}`,
      name,
      category,
      lat,
      lng,
      distanceKm: haversineDistanceKm(center, { lat, lng }),
      address: [tags['addr:street'], tags['addr:suburb'] || tags['addr:city']].filter(Boolean).join(', '),
    })
  }
  places.sort((a, b) => a.distanceKm - b.distanceKm)
  return places.slice(0, 40)
}

export default function NearbyPlaces() {
  const { dangerZones, nearbyPlaces, setNearbyPlaces } = useSafety()
  const { position, label, locate, fallback } = useGeolocation()
  const navigate = useNavigate()

  const [showZones, setShowZones] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const places = nearbyPlaces.places
  const searched = nearbyPlaces.searched

  useEffect(() => { locate() }, [locate])

  const here = position || fallback

  async function handleSearch() {
    setLoading(true)
    setError(null)
    try {
      const resolved = position || (await locate())
      const center = { lat: resolved.lat, lng: resolved.lng }
      const elements = await fetchNearbyPlaces(center)
      const processed = processElements(elements, center)
      setNearbyPlaces(processed, label || here.label)
      if (processed.length === 0) {
        setError('No nearby places found within 3 km — try again from a busier area.')
      }
    } catch {
      setError('Could not reach the places lookup right now — the free service may be busy. Try again shortly.')
    } finally {
      setLoading(false)
    }
  }

  function goToRoute(place) {
    const params = new URLSearchParams({
      toLat: String(place.lat),
      toLng: String(place.lng),
      toLabel: place.name,
    })
    navigate(`/routes?${params.toString()}`)
  }

  const markers = places.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    label: `${p.name} · ${formatDistance(p.distanceKm)}`,
    color: CATEGORY_META[p.category]?.color || '#5B5A8C',
    onClick: () => goToRoute(p),
  }))

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Nearby Safe Places</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Find restaurants, hospitals, police stations, markets, and malls close to where you are right now.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="flex flex-col gap-4 lg:col-span-4">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--moss)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--moss-deep)] disabled:opacity-60"
            >
              <Search size={16} /> {loading ? 'Searching nearby…' : searched ? 'Search again' : 'Search nearby safe places'}
            </button>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
              <LocateFixed size={12} />
              {searched
                ? `Showing results near ${nearbyPlaces.searchLabel || 'your last search'}`
                : `Searching from ${label || here.label || 'your current location'}`}
            </p>
            {error && <p className="mt-2 text-xs text-[var(--signal)]">{error}</p>}
          </div>

          <label className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <ShieldAlert size={15} className="text-[var(--signal)]" /> Show reported unsafe areas
            </span>
            <input
              type="checkbox"
              checked={showZones}
              onChange={(e) => setShowZones(e.target.checked)}
              className="h-4 w-4 accent-[var(--moss)]"
            />
          </label>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] px-5 py-3.5">
              <h2 className="text-sm font-semibold">Nearby places</h2>
            </div>
            <div className="max-h-[420px] divide-y divide-[var(--line)] overflow-y-auto">
              {places.map((p) => {
                const meta = CATEGORY_META[p.category]
                const Icon = meta?.icon || Store
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => goToRoute(p)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition hover:bg-[var(--paper)]"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${meta?.color || '#5B5A8C'}22`, color: meta?.color || '#5B5A8C' }}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-[var(--ink-soft)]">
                        {meta?.label}
                        {p.address ? ` · ${p.address}` : ''}
                      </p>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[var(--moss-deep)]">
                      {formatDistance(p.distanceKm)}
                    </span>
                  </button>
                )
              })}
              {searched && places.length === 0 && !loading && (
                <p className="px-5 py-4 text-xs text-[var(--ink-soft)]">No nearby places found yet.</p>
              )}
              {!searched && (
                <p className="px-5 py-4 text-xs text-[var(--ink-soft)]">
                  Tap "Search nearby safe places" to see what's around you.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] lg:col-span-8">
          <div className="h-[560px]">
            <MapView
              center={[here.lat, here.lng]}
              userPosition={{ ...here, label: label || 'You are here' }}
              dangerZones={showZones ? dangerZones : []}
              markers={markers}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
