import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ShieldCheck, Menu, X, LogOut, Mic, Sun, Moon, MonitorSmartphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSafety } from '../context/SafetyContext'
import { useVoiceSOS } from '../context/VoiceSOSContext'
import { useTheme } from '../context/ThemeContext'

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/alerts', label: 'Alerts' },
  { to: '/routes', label: 'Safe Routes' },
  { to: '/nearby', label: 'Nearby Places' },
  { to: '/checkin', label: 'Check-In' },
  { to: '/voice', label: 'Voice SOS' },
  { to: '/community', label: 'Community' },
  { to: '/contacts', label: 'Contacts' },
]

// Light -> Dark -> System -> Light… A quick cycle button for the navbar;
// the full 3-way picker with labels lives on the Settings page.
const THEME_CYCLE = { light: 'dark', dark: 'system', system: 'light' }
const THEME_ICON = { light: Sun, dark: Moon, system: MonitorSmartphone }
const THEME_LABEL = { light: 'Light theme', dark: 'Dark theme', system: 'Matching system theme' }

function ThemeToggleButton({ className = '', showLabel = false }) {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICON[theme]
  return (
    <button
      type="button"
      onClick={() => setTheme(THEME_CYCLE[theme])}
      aria-label={`${THEME_LABEL[theme]} — tap to change`}
      title={THEME_LABEL[theme]}
      className={className}
    >
      <Icon size={showLabel ? 16 : 15} />
      {showLabel && THEME_LABEL[theme]}
    </button>
  )
}

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const { profile } = useSafety()
  const { isListening } = useVoiceSOS()
  const navigate = useNavigate()
  const initial = (user?.name || profile?.name || user?.email || 'A').charAt(0).toUpperCase()

  function handleLogout() {
    setOpen(false)
    logout()
    navigate('/login')
  }

  const linkClasses = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-[var(--moss)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
        <NavLink to="/" className="flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--moss)] text-[var(--paper)]">
            <ShieldCheck size={18} strokeWidth={2.25} />
          </span>
          <span className="font-[var(--font-display)] text-lg font-semibold tracking-tight">SafeCircle</span>
        </NavLink>

        <nav className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggleButton className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]" />
          <NavLink to="/voice" className="flex items-center gap-1.5" aria-label="Voice SOS status">
            <span className="relative flex h-2 w-2">
              {isListening && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--moss)] opacity-60" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${isListening ? 'bg-[var(--moss)]' : 'bg-[var(--ink-soft)]/40'}`} />
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--ink-soft)]">
              <Mic size={12} /> {isListening ? 'Listening' : 'Voice SOS off'}
            </span>
          </NavLink>
          <NavLink
            to="/settings"
            className="ml-2 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--moss-soft)] text-sm font-semibold text-[var(--moss-deep)]"
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </NavLink>
          {user && (
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink)] lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--line)] bg-[var(--paper)] px-5 py-3 lg:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'bg-[var(--moss-soft)] text-[var(--moss-deep)]' : 'text-[var(--ink-soft)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive ? 'bg-[var(--moss-soft)] text-[var(--moss-deep)]' : 'text-[var(--ink-soft)]'
              }`
            }
          >
            Settings
          </NavLink>
          <ThemeToggleButton showLabel className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--ink-soft)]" />
          {user && (
            <button onClick={handleLogout} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--ink-soft)]">
              Log out
            </button>
          )}
        </nav>
      )}
    </header>
  )
}
