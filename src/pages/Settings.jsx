import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Trash2, Sun, Moon, MonitorSmartphone } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { requestPushToken } from '../firebase'
import { api } from '../api/client'


function fileToAvatarDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a readable image.'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        // Center-crop to a square before scaling down.
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function Section({ title, description, children }) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="mt-1 text-xs text-[var(--ink-soft)]">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-[var(--paper)] px-4 py-3 text-sm">
      <span>
        <span className="block font-medium">{label}</span>
        {desc && <span className="block text-xs text-[var(--ink-soft)]">{desc}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--moss)]"
      />
    </label>
  )
}

function ThemeOption({ label, Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition ${
        active
          ? 'border-[var(--moss)] bg-[var(--moss-soft)] text-[var(--moss-deep)]'
          : 'border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--paper)]'
      }`}
    >
      <Icon size={17} />
      {label}
    </button>
  )
}

export default function Settings() {
  const { profile, setProfile, voice, setVoice, notificationPrefs, setNotificationPrefs, liveTracking, setLiveTracking, isSynced } = useSafety()
  const { user, logout } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const navigate = useNavigate()

  const [profileForm, setProfileForm] = useState(profile)
  const [profileSaved, setProfileSaved] = useState(false)

  const [voiceForm, setVoiceForm] = useState(voice)
  const [voiceSaved, setVoiceSaved] = useState(false)

  const avatarInputRef = useRef(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  const [pushToken, setPushToken] = useState(() => localStorage.getItem('sp_fcm_token') || '')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')

  async function enablePush() {
    setPushError('')
    setPushBusy(true)
    try {
      const token = await requestPushToken()
      if (user) await api.registerFcmToken(token)
      localStorage.setItem('sp_fcm_token', token)
      setPushToken(token)
    } catch (err) {
      setPushError(err.message || 'Could not enable push notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePush() {
    setPushBusy(true)
    try {
      if (user && pushToken) await api.unregisterFcmToken(pushToken)
    } catch (err) {
      console.warn('unregisterFcmToken failed:', err.message)
    } finally {
      localStorage.removeItem('sp_fcm_token')
      setPushToken('')
      setPushBusy(false)
    }
  }

  function saveProfile(e) {
    e.preventDefault()
    setProfile(profileForm)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.')
      return
    }
    setAvatarError('')
    setAvatarBusy(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      const next = { ...profileForm, avatarUrl: dataUrl }
      setProfileForm(next)
      setProfile(next) // save immediately, like a normal profile-picture picker
    } catch (err) {
      setAvatarError(err.message || 'Could not use that image.')
    } finally {
      setAvatarBusy(false)
    }
  }

  function removeAvatar() {
    const next = { ...profileForm, avatarUrl: '' }
    setProfileForm(next)
    setProfile(next)
  }

  async function changePassword(e) {
    e.preventDefault()
    setPasswordError('')

    if (passwordForm.next.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('New passwords do not match.')
      return
    }

    setPasswordBusy(true)
    try {
      await api.changePassword(passwordForm.current, passwordForm.next)
      setPasswordForm({ current: '', next: '', confirm: '' })
      setPasswordSaved(true)
      setTimeout(() => setPasswordSaved(false), 2500)
    } catch (err) {
      setPasswordError(err.message || 'Could not change your password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  function saveVoice(e) {
    e.preventDefault()
    setVoice(voiceForm)
    setVoiceSaved(true)
    setTimeout(() => setVoiceSaved(false), 2000)
  }

  function resetData() {
    if (!confirm('This clears everything saved in this browser — contacts, routes, check-in history. Continue?')) return
    localStorage.clear()
    window.location.reload()
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        {isSynced ? 'Synced to your account.' : 'Stored only in this browser — log in to sync across devices.'}
      </p>

      {/* Appearance */}
      <Section title="Appearance" description={`Currently ${resolvedTheme === 'dark' ? 'dark' : 'light'}${theme === 'system' ? ' (matching your system)' : ''}.`}>
        <div className="flex gap-2">
          <ThemeOption label="Light" Icon={Sun} active={theme === 'light'} onClick={() => setTheme('light')} />
          <ThemeOption label="Dark" Icon={Moon} active={theme === 'dark'} onClick={() => setTheme('dark')} />
          <ThemeOption label="System" Icon={MonitorSmartphone} active={theme === 'system'} onClick={() => setTheme('system')} />
        </div>
      </Section>

      {/* Profile */}
      <Section title="Profile">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            {profileForm.avatarUrl ? (
              <img
                src={profileForm.avatarUrl}
                alt="Profile"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--moss-soft)] text-lg font-semibold text-[var(--moss-deep)]">
                {(profileForm.name || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarBusy}
              aria-label="Change profile picture"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--moss)] text-white shadow disabled:opacity-60"
            >
              <Camera size={12} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarPick}
              className="hidden"
            />
          </div>
          <div className="text-xs">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
                className="font-semibold text-[var(--moss)] hover:underline disabled:opacity-60"
              >
                {avatarBusy ? 'Uploading…' : 'Change photo'}
              </button>
              {profileForm.avatarUrl && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="flex items-center gap-1 font-semibold text-[var(--ink-soft)] hover:text-[var(--signal-deep)]"
                >
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>
            {avatarError && <p className="mt-1 text-[var(--signal-deep)]">{avatarError}</p>}
            {!avatarError && <p className="mt-1 text-[var(--ink-soft)]">JPG or PNG, cropped to a square automatically.</p>}
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Full name</label>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Email</label>
            <input
              value={user?.email || profileForm.email}
              disabled
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink-soft)] outline-none"
            />
            {isSynced && <p className="mt-1 text-[11px] text-[var(--ink-soft)]">This is your account login email.</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Phone</label>
            <input
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Home area</label>
            <input
              value={profileForm.homeArea}
              onChange={(e) => setProfileForm({ ...profileForm, homeArea: e.target.value })}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" className="rounded-lg bg-[var(--moss)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)]">
              Save changes
            </button>
            {profileSaved && <span className="text-xs font-medium text-[var(--moss)]">Saved</span>}
          </div>
        </form>
      </Section>

      {/* Privacy */}
      <Section title="Privacy" description="Control what trusted contacts can see about you.">
        <Toggle
          label="Live location tracking"
          desc={liveTracking ? 'Trusted contacts can currently see your status' : 'Your location is private — no one can see your status'}
          checked={liveTracking}
          onChange={setLiveTracking}
        />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <div className="rounded-lg bg-[var(--paper)] px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium">Push notifications on this device</span>
              <span className="block text-xs text-[var(--ink-soft)]">
                {pushToken ? 'Enabled — this browser can receive SOS pushes.' : 'Powered by Firebase Cloud Messaging.'}
              </span>
            </span>
            <button
              type="button"
              disabled={pushBusy}
              onClick={pushToken ? disablePush : enablePush}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                pushToken
                  ? 'border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface)]'
                  : 'bg-[var(--moss)] text-white hover:bg-[var(--moss-deep)]'
              }`}
            >
              {pushBusy ? 'Working…' : pushToken ? 'Disable' : 'Enable'}
            </button>
          </div>
          {pushError && <p className="mt-2 text-[11px] text-[var(--signal-deep)]">{pushError}</p>}
        </div>

        <Toggle
          label="Push notifications"
          desc="Instant alerts in this browser"
          checked={notificationPrefs.push}
          onChange={(v) => setNotificationPrefs({ ...notificationPrefs, push: v })}
        />
        <Toggle
          label="SMS alerts"
          desc="For critical, time-sensitive warnings"
          checked={notificationPrefs.sms}
          onChange={(v) => setNotificationPrefs({ ...notificationPrefs, sms: v })}
        />
        <Toggle
          label="Email digest"
          desc="Weekly summary of activity"
          checked={notificationPrefs.email}
          onChange={(v) => setNotificationPrefs({ ...notificationPrefs, email: v })}
        />
      </Section>

      
      <Section
        title="Voice SOS"
        description="Uses your browser's built-in speech recognition (free, no signup) — audio is sent to your browser vendor's speech servers for transcription, so this needs an internet connection."
      >
        <form onSubmit={saveVoice} className="space-y-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Code phrase</label>
            <input
              value={voiceForm.codeWord}
              onChange={(e) => setVoiceForm({ ...voiceForm, codeWord: e.target.value })}
              placeholder="e.g. red phoenix"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
              Say this out loud on the Voice SOS page while listening is on. Keep it short and distinctive so it
              doesn't trigger by accident during normal conversation.
            </p>
          </div>

          <Toggle
            label="Keep listening automatically when the tab restarts"
            checked={voiceForm.continuous}
            onChange={(v) => setVoiceForm({ ...voiceForm, continuous: v })}
          />

          <div className="rounded-xl border border-[var(--signal)]/30 bg-[var(--signal-soft)] p-4">
            <Toggle
              label="Skip confirmation — send my location automatically"
              desc="When your code phrase is detected, your location goes straight to priority contacts with no 'Confirm SOS' step."
              checked={voiceForm.autoSendOnDetect}
              onChange={(v) => setVoiceForm({ ...voiceForm, autoSendOnDetect: v })}
            />
            <p className="mt-2 text-[11px] text-[var(--signal-deep)]">
              Turning this on means a false detection also sends your location with no chance to cancel. Test your
              phrase with confirmation on first.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" className="rounded-lg bg-[var(--moss)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)]">
              Save voice settings
            </button>
            {voiceSaved && <span className="text-xs font-medium text-[var(--moss)]">Saved</span>}
          </div>
        </form>
      </Section>

      
      {user && (
        <Section title="Change password">
          <form onSubmit={changePassword} className="space-y-4">
            {passwordError && (
              <div className="rounded-lg border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-3 py-2 text-xs text-[var(--signal-deep)]">
                {passwordError}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">New password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
              />
              <p className="mt-1 text-[11px] text-[var(--ink-soft)]">At least 8 characters.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none focus:border-[var(--moss)]"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={passwordBusy}
                className="rounded-lg bg-[var(--moss)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)] disabled:opacity-50"
              >
                {passwordBusy ? 'Updating…' : 'Update password'}
              </button>
              {passwordSaved && <span className="text-xs font-medium text-[var(--moss)]">Password updated</span>}
            </div>
          </form>
        </Section>
      )}

      {/* Account */}
      <Section title="Account">
        {user ? (
          <button onClick={handleLogout} className="rounded-lg border border-[var(--line)] px-4 py-2 text-xs font-semibold hover:bg-[var(--paper)]">
            Log out
          </button>
        ) : (
          <p className="text-xs text-[var(--ink-soft)]">You're not logged in — your data only lives in this browser.</p>
        )}
      </Section>

      <section className="mt-6 rounded-2xl border border-[var(--signal)]/30 bg-[var(--signal-soft)] p-6">
        <h2 className="text-sm font-semibold text-[var(--signal-deep)]">Reset local data</h2>
        <p className="mt-1 text-xs text-[var(--signal-deep)]/80">Clears contacts, routes, and history stored in this browser. Cannot be undone.</p>
        <button onClick={resetData} className="mt-3 rounded-lg border border-[var(--signal)] px-4 py-2 text-xs font-semibold text-[var(--signal-deep)] hover:bg-[var(--surface)]">
          Clear all data
        </button>
      </section>
    </div>
  )
}
