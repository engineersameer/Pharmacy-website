import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '@/lib/api'
import type { Admin } from './types'

// Staff login state.
// - The short-lived access token is kept only in memory (never in localStorage).
// - The 14-day refresh token is an HttpOnly cookie the browser sends to /api/auth/ by itself.
// - When a request gets 401, we get a new access token once and retry.

const BASE = import.meta.env.VITE_API_URL ?? '/api'

type AuthState = {
  admin: Admin | null
  checking: boolean
  /** devCode / devHint only come back on a developer laptop, never from the real server */
  requestCode: (email: string) => Promise<{ devCode?: string; devHint?: string }>
  verifyCode: (email: string, code: string) => Promise<void>
  logout: () => Promise<void>
  /** fetch() for admin endpoints: adds the token, renews it when needed */
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthState | null>(null)

async function errorFrom(res: Response) {
  let message = res.statusText
  let fields: Record<string, string> = {}
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string') message = body.detail
    fields = Object.fromEntries(
      Object.entries(body ?? {})
        .filter(([k]) => k !== 'detail')
        .map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)]),
    )
    if (message === res.statusText && Object.values(fields)[0]) message = Object.values(fields)[0]
  } catch {
    // no JSON body
  }
  if (res.status === 429) message = 'Too many tries. Please wait a few minutes and try again.'
  return new ApiError(res.status, message, fields)
}

const url = (path: string) => (path.startsWith('/api/') ? path : `${BASE}${path}`)

async function postJson(path: string, body?: unknown) {
  return fetch(url(path), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [checking, setChecking] = useState(true)
  const token = useRef<string | null>(null)
  const refreshing = useRef<Promise<boolean> | null>(null)

  // Get a new access token using the cookie. Several requests may ask at once: share one call.
  const refresh = useCallback(() => {
    refreshing.current ??= (async () => {
      try {
        const res = await postJson('/auth/refresh')
        if (!res.ok) throw new Error('expired')
        const body = await res.json()
        token.current = body.access
        setAdmin(body.admin)
        return true
      } catch {
        token.current = null
        setAdmin(null)
        return false
      } finally {
        refreshing.current = null
      }
    })()
    return refreshing.current
  }, [])

  // On first load: are we still logged in from before?
  useEffect(() => {
    refresh().finally(() => setChecking(false))
  }, [refresh])

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const send = () =>
        fetch(url(path), {
          ...init,
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
            ...init.headers,
            ...(token.current ? { Authorization: `Bearer ${token.current}` } : {}),
          },
        })
      let res = await send()
      if (res.status === 401 && (await refresh())) res = await send()
      if (!res.ok && res.status !== 409) throw await errorFrom(res)
      return res
    },
    [refresh],
  )

  const value = useMemo<AuthState>(
    () => ({
      admin,
      checking,
      apiFetch,
      requestCode: async (email) => {
        const res = await postJson('/auth/request-code', { email })
        if (!res.ok) throw await errorFrom(res)
        const body = await res.json()
        return { devCode: body.devCode, devHint: body.devHint }
      },
      verifyCode: async (email, code) => {
        const res = await postJson('/auth/verify-code', { email, code })
        if (!res.ok) throw await errorFrom(res)
        const body = await res.json()
        token.current = body.access
        setAdmin(body.admin)
      },
      logout: async () => {
        await postJson('/auth/logout').catch(() => undefined)
        token.current = null
        setAdmin(null)
      },
    }),
    [admin, checking, apiFetch],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
