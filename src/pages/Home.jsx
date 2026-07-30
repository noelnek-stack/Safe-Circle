import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Navigation2, Clock, Bookmark, MapPin, ArrowRight, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Compass } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import useGeolocation from '../hooks/useGeolocation'
import useWeather from '../hooks/useWeather'
import MapView from '../components/MapView'

// Groups Open-Meteo's weather codes into icon buckets.
function weatherIcon(code) {
  if (code == null) return CloudSun
  if (code === 0 || code === 1) return CloudSun
  if (code === 2 || code === 3) return Cloud
  if (code === 45 || code === 48) return CloudFog
  if (code >= 51 && code <= 82) return CloudRain
  if (code >= 71 && code <= 75) return CloudSnow
  if (code >= 95) return CloudLightning
  return CloudSun
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const { profile, alerts, routes, dangerZones, activeCheckIn, liveTracking, setLiveTracking } = useSafety()
  const { position, label, status, locate, fallback } = useGeolocation()

  useEffect(() => { locate() }, [locate])

  const nearby = position || fallback
  const { weather } = useWeather(nearby.lat, nearby.lng)
  const WeatherIcon = weatherIcon(weather?.code)
  const criticalCount = useMemo(() => alerts.filter((a) => a.severity === 'critical').length, [alerts])

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      {/* Hero status card — the single most characteristic thing this product does */}
      <section className="relative overflow-hidden rounded-2xl bg-[var(--moss)] p-6 text-[var(--paper)] sm:p-8">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--moss-soft)]/80">{greeting()}, {profile.name || 'there'}</p>
            <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">You're marked safe</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--moss-soft)]">
              <span className="flex items-center gap-1.5">
                <MapPin size={15} />
                {status === 'locating' ? 'Finding your location…' : label || nearby.label}
              </span>
              <span className="flex items-center gap-1.5">
                <WeatherIcon size={15} />
                {weather ? `${weather.condition}, ${weather.tempC}°C` : 'Loading weather…'}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              {liveTracking ? (
                <>
                  <span className="pulse-ring absolute inset-0 text-[var(--paper)]" />
                  <span className="relative h-3 w-3 rounded-full bg-[var(--paper)]" />
                </>
              ) : (
                <span className="relative h-3 w-3 rounded-full bg-white/40" />
              )}
            </span>
            <div className="text-sm">
              <p className="font-semibold">{liveTracking ? 'Live tracking on' : 'Live tracking off'}</p>
              <p className="text-[var(--moss-soft)]/80">
                {liveTracking ? 'Trusted contacts can see your status' : 'Your location is private right now'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={liveTracking}
              aria-label="Toggle live tracking"
              onClick={() => setLiveTracking(!liveTracking)}
              className={`relative ml-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${liveTracking ? 'bg-white/90' : 'bg-white/20'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-[var(--moss-deep)] transition ${liveTracking ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </div>
      </section>

      {activeCheckIn && (
        <Link
          to="/checkin"
          className="mt-4 flex items-center justify-between rounded-xl border border-[var(--moss)]/30 bg-[var(--moss-soft)] px-5 py-3 text-sm font-medium text-[var(--moss-deep)]"
        >
          <span>Silent check-in in progress — ends {new Date(activeCheckIn.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <ArrowRight size={16} />
        </Link>
      )}

      {criticalCount > 0 && (
        <Link
          to="/alerts"
          className="mt-4 flex items-center justify-between rounded-xl border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-5 py-3.5 text-[var(--signal-deep)]"
        >
          <div>
            <p className="text-sm font-semibold">{criticalCount} critical alert{criticalCount > 1 ? 's' : ''} nearby</p>
            <p className="text-xs opacity-90">Review before you head out</p>
          </div>
          <ArrowRight size={16} />
        </Link>
      )}

      {/* Quick actions */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Link to="/routes" className="group flex flex-col items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--moss)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--moss-soft)] text-[var(--moss-deep)]"><Navigation2 size={17} /></span>
          <span className="text-sm font-semibold">Navigate now</span>
        </Link>
        <Link to="/nearby" className="group flex flex-col items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--moss)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--moss-soft)] text-[var(--moss-deep)]"><Compass size={17} /></span>
          <span className="text-sm font-semibold">Nearby places</span>
        </Link>
        <Link to="/checkin" className="group flex flex-col items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--moss)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--amber-soft)] text-[var(--amber)]"><Clock size={17} /></span>
          <span className="text-sm font-semibold">Silent check-in</span>
        </Link>
        <Link to="/routes" className="group flex flex-col items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--moss)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--dusk-soft)] text-[var(--dusk)]"><Bookmark size={17} /></span>
          <span className="text-sm font-semibold">My routes</span>
        </Link>
        <Link to="/alerts" className="group flex flex-col items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--moss)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--signal-soft)] text-[var(--signal)]"><MapPin size={17} /></span>
          <span className="text-sm font-semibold">View alerts</span>
        </Link>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Frequent routes */}
        <section className="lg:col-span-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <h2 className="text-base font-semibold">Frequently used routes</h2>
            <Link to="/routes" className="text-xs font-medium text-[var(--moss)] hover:underline">See all</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {routes.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{r.from} → {r.to}</p>
                </div>
                <span className="text-xs font-semibold text-[var(--moss)]">★ {r.rating}</span>
              </div>
            ))}
            {routes.length === 0 && (
              <p className="px-5 py-6 text-sm text-[var(--ink-soft)]">No saved routes yet — plan one from Safe Routes.</p>
            )}
          </div>
        </section>

        {/* Live map preview */}
        <section className="lg:col-span-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <h2 className="text-base font-semibold">Your area right now</h2>
            <Link to="/routes" className="text-xs font-medium text-[var(--moss)] hover:underline">Open map</Link>
          </div>
          <div className="h-64">
            <MapView
              center={[nearby.lat, nearby.lng]}
              zoom={14}
              userPosition={{ ...nearby, label: label || 'You are here' }}
              dangerZones={dangerZones}
              scrollWheelZoom={false}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
