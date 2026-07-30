import { createContext, useContext, useEffect, useState } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'

const ThemeContext = createContext(null)

const THEMES = ['light', 'dark', 'system']

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  // 'light' | 'dark' | 'system' — what the person picked in Settings.
  const [theme, setThemeState] = useLocalStorage('sp_theme', 'system')
  // The actual light/dark value in effect right now (resolves 'system').
  const [resolved, setResolved] = useState(() => (theme === 'dark' || (theme === 'system' && systemPrefersDark()) ? 'dark' : 'light'))

  function setTheme(next) {
    setThemeState(THEMES.includes(next) ? next : 'system')
  }

  // Apply the resolved theme to <html>, and to the browser's own UI
  // (scrollbars, form controls, the mobile status bar color).
  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
    setResolved(isDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme])

  // When following the system, keep watching for OS-level changes (e.g.
  // the person's phone switches to dark mode at sunset) without needing a
  // page reload.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange(e) {
      setResolved(e.matches ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme: resolved }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
