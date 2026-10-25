import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStaffApi } from '../staff-api'
import type { OrderStatus, StaffOrder } from '../types'

export const ACTIVE: OrderStatus[] = ['received', 'confirmed', 'ready', 'out_for_delivery']
const CHECK_EVERY_MS = 5000

/**
 * Keeps the list of open orders up to date without refreshing the page.
 *
 * 1. On open: load every order that isn't finished yet, so nothing that came in while
 *    the dashboard was closed is missed.
 * 2. Every 5 seconds: ask "what is new or changed since my last check?" and merge it in.
 *    Also checks right away when the tab comes back into view or the internet returns.
 */
export function useLiveOrders(onNewOrders: (orders: StaffOrder[]) => void) {
  const api = useStaffApi()
  const [orders, setOrders] = useState<Map<number, StaffOrder>>(new Map())
  const [unseen, setUnseen] = useState<Set<number>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const since = useRef<string | null>(null)
  const current = useRef(orders) // latest map, kept in step by merge() and load()
  const notify = useRef(onNewOrders)
  useEffect(() => {
    notify.current = onNewOrders
  }, [onNewOrders])

  const merge = useCallback((incoming: StaffOrder[]) => {
    if (incoming.length === 0) return
    const next = new Map(current.current)
    const fresh: StaffOrder[] = []
    for (const o of incoming) {
      if (!next.has(o.id) && o.status === 'received') fresh.push(o)
      next.set(o.id, o)
    }
    current.current = next
    setOrders(next)
    if (fresh.length) {
      setUnseen((s) => new Set([...s, ...fresh.map((o) => o.id)]))
      notify.current(fresh)
    }
  }, [])

  // 1. First load
  const load = useCallback(async () => {
    setLoadError(null)
    try {
      // Ask for the server's clock first, so changes made while the list loads are not missed
      const first = await api.changes(new Date(Date.now() - 60_000).toISOString())
      since.current = first.serverTime
      const open = await api.ordersWithStatus(ACTIVE)
      const map = new Map(open.map((o) => [o.id, o]))
      current.current = map
      setOrders(map)
      setUnseen(new Set(open.filter((o) => o.status === 'received').map((o) => o.id)))
      setLoaded(true)
    } catch {
      setLoadError('Could not load orders. Check your internet and try again.')
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  // 2. Live updates
  const live = useQuery({
    queryKey: ['order-changes'],
    enabled: loaded,
    queryFn: () => api.changes(since.current!),
    refetchInterval: CHECK_EVERY_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })

  useEffect(() => {
    if (!live.data) return
    since.current = live.data.serverTime // only moves forward after a successful check
    merge(live.data.orders)
  }, [live.data, merge])

  return {
    orders,
    loaded,
    loadError,
    reload: load,
    /** false while the last check failed (offline); it keeps retrying by itself */
    online: !live.isError,
    lastChecked: live.dataUpdatedAt,
    unseen,
    markSeen: (id: number) =>
      setUnseen((s) => {
        if (!s.has(id)) return s
        const n = new Set(s)
        n.delete(id)
        return n
      }),
    /** Put an order we just changed into the list right away */
    upsert: (order: StaffOrder) => merge([order]),
  }
}
