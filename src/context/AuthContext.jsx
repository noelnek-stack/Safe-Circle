import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, setAuthToken } from '../api/client'

const AuthContext = createContext(null)

const TOKEN_KEY = 'sp_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setAuthToken(token)
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  }, [token])

  // On first load, if we have a saved token, validate it against the API.
  useEffect(() => {
    let cancelled = false
    async function restore() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const { user: me } = await api.me()
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    restore()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signup = useCallback(async (name, email, password) => {
    setError(null)
    const { token: newToken, user: newUser } = await api.signup(name, email, password)
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    const { token: newToken, user: newUser } = await api.login(email, password)
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, error, setError, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
