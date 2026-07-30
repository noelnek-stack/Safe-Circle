import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'
import { useAuth } from './AuthContext'
import { api } from '../api/client'

const SafetyContext = createContext(null)

const seedAlerts = [
  {
    id: 'a1',
    title: 'Harassment reported',
    body: 'Multiple reports of verbal harassment near the tea stall. Group of 3–4 men making unwanted comments — avoid the area if you can.',
    severity: 'critical',
    place: 'Mirpur Road, near City College',
    time: Date.now() - 12 * 60 * 1000,
    verified: true,
    reactions: 34,
  },
  {
    id: 'a2',
    title: 'Street light outage',
    body: 'Several street lights have been out for a week along this stretch. Poorly lit after 8pm.',
    severity: 'warning',
    place: 'Khayaban-e-Ittehad, Phase VI',
    time: Date.now() - 55 * 60 * 1000,
    verified: true,
    reactions: 11,
  },
  {
    id: 'a3',
    title: 'Construction detour',
    body: 'Road works have narrowed the footpath to a single file. Consider the parallel service road instead.',
    severity: 'info',
    place: 'Shahrah-e-Faisal, near Baloch Colony',
    time: Date.now() - 3 * 60 * 60 * 1000,
    verified: false,
    reactions: 6,
  },
]

const seedCommunity = [
  {
    id: 'c1',
    author: 'Fatima K.',
    verified: true,
    place: 'Dhanmondi 27',
    time: Date.now() - 12 * 60 * 1000,
    text: 'Well-lit tonight, tea stalls open and the street felt safe walking through around 9pm.',
    tags: ['Well-lit', 'Crowded'],
    likes: 24,
  },
  {
    id: 'c2',
    author: 'Anika R.',
    verified: true,
    place: 'Banani 10',
    time: Date.now() - 9 * 60 * 1000,
    text: 'New security guard posted at the corner shop — friendly and keeping an eye on the block.',
    tags: ['Security present'],
    likes: 15,
  },
]

const seedRoutes = [
  {
    id: 'r1',
    name: 'Home to University',
    from: 'Dhanmondi 15',
    to: 'Gulshan 2',
    rating: 4.5,
    lastUsed: '15 May, 6:00 PM',
    fromPoint: { lat: 23.7461, lng: 90.3742, label: 'Dhanmondi 15' },
    toPoint: { lat: 23.7925, lng: 90.4078, label: 'Gulshan 2' },
    travelMode: 'walking',
  },
  {
    id: 'r2',
    name: 'University to Home',
    from: 'Gulshan 2',
    to: 'Dhanmondi 15',
    rating: 4.5,
    lastUsed: '15 May, 6:00 PM',
    fromPoint: { lat: 23.7925, lng: 90.4078, label: 'Gulshan 2' },
    toPoint: { lat: 23.7461, lng: 90.3742, label: 'Dhanmondi 15' },
    travelMode: 'walking',
  },
]

const seedContacts = [
  { id: 'k1', name: 'Ayesha Malik', phone: '+92 300 1234567', relation: 'Sister', priority: true },
  { id: 'k2', name: 'Zara Ahmed', phone: '+92 321 7654321', relation: 'Friend', priority: false },
]

export function SafetyProvider({ children }) {
  const [profile, setProfile] = useLocalStorage('sp_profile', {
    name: 'Anika', email: '', phone: '', homeArea: 'Dhanmondi, Dhaka', avatarUrl: '',
  })
  const [contacts, setContacts] = useLocalStorage('sp_contacts', seedContacts)
  const [alerts, setAlerts] = useLocalStorage('sp_alerts', seedAlerts)
  const [community, setCommunity] = useLocalStorage('sp_community', seedCommunity)
  const [routes, setRoutes] = useLocalStorage('sp_routes', seedRoutes)
  const [voice, setVoice] = useLocalStorage('sp_voice', {
    codeWord: 'red phoenix', active: true, continuous: false,
    // Voice SOS settings (Web Speech API — browser built-in, no signup)
    autoSendOnDetect: false, // if true, skip the "Confirm SOS" step entirely
  })
  const [notificationPrefs, setNotificationPrefs] = useLocalStorage('sp_notifications', {
    push: true, sms: true, email: false,
  })
  const [activeCheckIn, setActiveCheckIn] = useLocalStorage('sp_checkin_active', null)
  const [checkInLog, setCheckInLog] = useLocalStorage('sp_checkin_log', [])
  const [liveTracking, setLiveTracking] = useLocalStorage('sp_live_tracking', true)
  const [dangerZones] = useLocalStorage('sp_zones', [
    { id: 'z1', name: 'Mirpur Road stretch', lat: 24.8707, lng: 67.0111, radius: 220, level: 'critical' },
    { id: 'z2', name: 'Khayaban-e-Ittehad', lat: 24.8480, lng: 66.9950, radius: 160, level: 'warning' },
  ])
  // Kept in plain component state (not localStorage) so results are cached
  // for the session — surviving tab switches — without persisting stale
  // nearby-place data across browser restarts.
  const [nearbyPlaces, setNearbyPlacesState] = useState({ places: [], searched: false, searchLabel: null })

  const { user } = useAuth()
  const hydrated = useRef(false)

  // When someone logs in, pull their profile/contacts/routes/voice settings,
  // plus the shared alerts & community feeds and their check-in state, from
  // MongoDB (via the API) and let that replace what's in localStorage, so
  // the account becomes the source of truth across devices.
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      if (!user) {
        hydrated.current = false
        return
      }
      try {
        const [{ user: full }, alertsRes, communityRes, checkinsRes] = await Promise.all([
          api.getSettings(),
          api.getAlerts().catch((err) => { console.warn('Could not load alerts from server:', err.message); return null }),
          api.getCommunity().catch((err) => { console.warn('Could not load community posts from server:', err.message); return null }),
          api.getCheckIns().catch((err) => { console.warn('Could not load check-ins from server:', err.message); return null }),
        ])
        if (cancelled) return

        setProfile({ name: full.name || '', email: full.email || '', phone: full.phone || '', homeArea: full.homeArea || '', avatarUrl: full.avatarUrl || '' })
        setVoice((prev) => ({ ...prev, ...full.voiceSettings }))
        setNotificationPrefs((prev) => ({ ...prev, ...full.notificationPrefs }))
        setContacts(full.contacts || [])
        setRoutes(full.routes || [])

        if (alertsRes) setAlerts(alertsRes.alerts)
        if (communityRes) setCommunity(communityRes.community)
        if (checkinsRes) {
          setActiveCheckIn(checkinsRes.activeCheckIn || null)
          setCheckInLog(checkinsRes.checkInLog || [])
        }

        hydrated.current = true
      } catch (err) {
        console.warn('Could not load settings from server, using local data instead:', err.message)
      }
    }
    hydrate()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function addContact(contact) {
    if (user) {
      api.addContact(contact)
        .then(({ contacts: fresh }) => setContacts(fresh))
        .catch((err) => console.warn('addContact sync failed:', err.message))
      return
    }
    setContacts((prev) => [...prev, { ...contact, id: crypto.randomUUID() }])
  }
  function removeContact(id) {
    if (user) {
      api.removeContact(id)
        .then(({ contacts: fresh }) => setContacts(fresh))
        .catch((err) => console.warn('removeContact sync failed:', err.message))
      return
    }
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  // Persist profile/voice settings to the backend whenever they change,
  // once we're logged in and have finished the initial hydration above
  // (otherwise we'd immediately overwrite the server copy with stale local
  // data on first render).
  function persistSettings(patch) {
    if (!user || !hydrated.current) return
    api.updateSettings(patch).catch((err) => console.warn('settings sync failed:', err.message))
  }

  function updateProfile(next) {
    setProfile(next)
    persistSettings({ name: next.name, phone: next.phone, homeArea: next.homeArea, avatarUrl: next.avatarUrl })
  }

  function updateVoice(next) {
    setVoice(next)
    persistSettings({ voiceSettings: next })
  }

  function updateNotificationPrefs(next) {
    setNotificationPrefs(next)
    persistSettings({ notificationPrefs: next })
  }

  function reportAlert(alert) {
    if (user) {
      api.reportAlert(alert)
        .then(({ alert: fresh }) => setAlerts((prev) => [fresh, ...prev]))
        .catch((err) => console.warn('reportAlert sync failed:', err.message))
      return
    }
    setAlerts((prev) => [{ ...alert, id: crypto.randomUUID(), time: Date.now(), reactions: 0, verified: false }, ...prev])
  }
  function dismissAlert(id) {
    // Optimistic: drop it locally right away, and if we're signed in, tell
    // the server so it stays dismissed for this account next time too.
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    if (user) {
      api.dismissAlert(id).catch((err) => console.warn('dismissAlert sync failed:', err.message))
    }
  }

  function addPost(post) {
    if (user) {
      api.addPost(post)
        .then(({ post: fresh }) => setCommunity((prev) => [fresh, ...prev]))
        .catch((err) => console.warn('addPost sync failed:', err.message))
      return
    }
    setCommunity((prev) => [{ ...post, id: crypto.randomUUID(), time: Date.now(), likes: 0 }, ...prev])
  }
  function likePost(id) {
    if (user) {
      api.likePost(id)
        .then(({ post: fresh }) => setCommunity((prev) => prev.map((p) => (p.id === id ? fresh : p))))
        .catch((err) => console.warn('likePost sync failed:', err.message))
      return
    }
    setCommunity((prev) => prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)))
  }

  function saveRoute(route) {
    if (user) {
      api.saveRoute(route)
        .then(({ routes: fresh }) => setRoutes(fresh))
        .catch((err) => console.warn('saveRoute sync failed:', err.message))
      return
    }
    setRoutes((prev) => [{ ...route, id: crypto.randomUUID() }, ...prev])
  }
  function removeRoute(id) {
    if (user) {
      api.removeRoute(id)
        .then(({ routes: fresh }) => setRoutes(fresh))
        .catch((err) => console.warn('removeRoute sync failed:', err.message))
      return
    }
    setRoutes((prev) => prev.filter((r) => r.id !== id))
  }

  function startCheckIn({ minutes, note }) {
    if (user) {
      api.startCheckIn({ minutes, note })
        .then(({ activeCheckIn: fresh }) => setActiveCheckIn(fresh))
        .catch((err) => console.warn('startCheckIn sync failed:', err.message))
      return
    }
    const startedAt = Date.now()
    const endsAt = startedAt + minutes * 60 * 1000
    setActiveCheckIn({ startedAt, endsAt, minutes, note, contactsNotified: contacts.filter((c) => c.priority).length })
  }
  function endCheckIn(status) {
    if (user) {
      api.endCheckIn(status)
        .then(({ entry }) => {
          setCheckInLog((log) => [entry, ...log])
          setActiveCheckIn(null)
        })
        .catch((err) => console.warn('endCheckIn sync failed:', err.message))
      return
    }
    setActiveCheckIn((current) => {
      if (current) {
        setCheckInLog((log) => [
          { id: crypto.randomUUID(), startedAt: current.startedAt, endedAt: Date.now(), status, note: current.note },
          ...log,
        ])
      }
      return null
    })
  }

  function setNearbyPlaces(places, searchLabel) {
    setNearbyPlacesState({ places, searched: true, searchLabel })
  }

  const value = useMemo(() => ({
    profile, setProfile: updateProfile,
    contacts, addContact, removeContact,
    alerts, reportAlert, dismissAlert,
    community, addPost, likePost,
    routes, saveRoute, removeRoute,
    voice, setVoice: updateVoice,
    notificationPrefs, setNotificationPrefs: updateNotificationPrefs,
    activeCheckIn, startCheckIn, endCheckIn,
    checkInLog,
    dangerZones,
    nearbyPlaces, setNearbyPlaces,
    liveTracking, setLiveTracking,
    // exposed so pages can tell whether settings are backed by an account
    // or only stored in this browser
    isSynced: !!user,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [profile, contacts, alerts, community, routes, voice, notificationPrefs, activeCheckIn, checkInLog, dangerZones, nearbyPlaces, liveTracking, user])

  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>
}

export function useSafety() {
  const ctx = useContext(SafetyContext)
  if (!ctx) throw new Error('useSafety must be used within SafetyProvider')
  return ctx
}
