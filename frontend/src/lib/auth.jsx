import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import api from './api'

// AuthContext: global session state shared by the whole app.
// The token is kept in localStorage (simple for this educational project)
// and sent to the backend via the api.js interceptor.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'))
    } catch {
      return null
    }
  })

  const login = useCallback(async (username, password) => {
    // POST /auth/login -> { access_token, user_id, username, role }
    const { data } = await api.post('/auth/login', { username, password })

    // Keep a minimal user object next to the token.
    const sessionUser = { id: data.user_id, username: data.username, role: data.role }

    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(sessionUser))
    setToken(data.access_token)
    setUser(sessionUser)
    return sessionUser
  }, [])

  const logout = useCallback(async () => {
    try {
      // Best-effort: revoke the token server-side, then clear locally.
      await api.post('/auth/logout')
    } catch {
      // Ignore network errors — local cleanup happens anyway.
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isAdmin: user?.role === 'admin',
      login,
      logout,
    }),
    [token, user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook used by components: const { user, isAdmin, login } = useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
