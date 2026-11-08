import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bike, Inbox, RefreshCw, Search, Store, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { localPhone, STATUS_LABEL, STATUS_STYLE, timeAgo } from '../format'
import { useStaffApi } from '../staff-api'
import type { StaffOrder } from '../types'
import { NewOrderAlarm } from './new-order-alarm'
import { OrderDetail } from './order-detail'
import { useStoreName } from '../use-store-name'
import { useLiveOrders } from './use-live-orders'

type Tab = 'new' | 'progress' | 'done'
const TABS: { id: Tab; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
]
const IN_TAB: Record<Tab, (o: StaffOrder) => boolean> = {
  new: (o) => o.status === 'received',
  progress: (o) => ['confirmed', 'ready', 'out_for_delivery'].includes(o.status),
  done: (o) => o.status === 'completed' || o.status === 'cancelled',
}

/** Re-render every 30 s so "5 minutes ago" stays right */
function useTick(ms = 30_000) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}

export function OrdersPage({
  onNewOrders,
  onAlarm,
  soundOn,
  soundReady,
  onEnableSound,
  onShowOrders,
}: {
  onNewOrders: (orders: StaffOrder[]) => void
  /** Ring (true) or stop (false) the new-order alarm */
  onAlarm: (on: boolean) => void
  soundOn: boolean
  soundReady: boolean
  onEnableSound: () => void
  /** Bring staff back to the orders page, e.g. from Store settings */
  onShowOrders: () => void
}) {
  useTick()
  const api = useStaffApi()
  const live = useLiveOrders(onNewOrders)
  // Accepted on this screen, while the server is being told (so the alarm stops at once)
  const [accepting, setAccepting] = useState<Set<number>>(new Set())
  const storeName = useStoreName()
  const [tab, setTab] = useState<Tab>('new')
  const [selected, setSelected] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(t)
  }, [query])

  // Finished orders: the latest page, refreshed when the Done tab is opened
  const done = useQuery({
    queryKey: ['orders-done'],
    queryFn: () => api.ordersWithStatus(['completed', 'cancelled'], 1),
    enabled: tab === 'done',
  })
  const search = useQuery({
    queryKey: ['order-search', debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length >= 2,
  })

  const all = useMemo(() => {
    const map = new Map(live.orders)
    for (const o of done.data ?? []) if (!map.has(o.id)) map.set(o.id, o)
    return map
  }, [live.orders, done.data])

  const counts = useMemo(() => {
    const c = { new: 0, progress: 0, done: 0 }
    for (const o of live.orders.values()) for (const t of ['new', 'progress'] as const) if (IN_TAB[t](o)) c[t]++
    return c
  }, [live.orders])

  // The browser tab title shows how many orders are waiting
  useEffect(() => {
    const base = `${storeName} Staff`
    document.title = counts.new > 0 ? `(${counts.new}) New order${counts.new > 1 ? 's' : ''} · ${base}` : base
  }, [counts.new, storeName])

  const searching = debounced.length >= 2
  const list = useMemo(() => {
    const source = searching ? (search.data ?? []).map((o) => all.get(o.id) ?? o) : [...all.values()].filter(IN_TAB[tab])
    // Newest order at the top, in every tab and in search results
    return source.sort((a, b) => b.id - a.id)
  }, [searching, search.data, all, tab])

  const current = selected != null ? (all.get(selected) ?? search.data?.find((o) => o.id === selected)) : undefined

  // A newly opened order starts at the top of its details
  useEffect(() => {
    if (selected != null) window.scrollTo({ top: 0 })
  }, [selected])

  // Ringing: new orders nobody has accepted on any screen yet. Accepting is saved on the server,
  // so when one person accepts, every screen sees it at its next check and stops.
  const ringing = [...live.orders.values()]
    .filter((o) => o.status === 'received' && !o.acceptedAt && !accepting.has(o.id))
    .sort((a, b) => b.id - a.id) // newest first, like the list
  const isRinging = ringing.length > 0
  useEffect(() => {
    onAlarm(isRinging)
    return () => onAlarm(false) // e.g. logging out while it rings
  }, [isRinging, onAlarm])

  const open = (id: number) => {
    setSelected(id)
    live.markSeen(id)
  }

  // Accept: stop the alarm for everyone and open the newest waiting order (the top one).
  // Only that order loses its "new" dot; the others keep it until someone opens them.
  const accept = () => {
    const ids = ringing.map((o) => o.id)
    setAccepting((s) => new Set([...s, ...ids]))
    setQuery('')
    setDebounced('')
    setTab('new')
    onShowOrders()
    open(ids[0])
    void Promise.all(ids.map((id) => api.accept(id).then(live.upsert))).catch(() => {
      // Not saved (e.g. offline): ring again so the orders aren't missed
      toast.error('Could not accept. Check your internet.')
      setAccepting((s) => new Set([...s].filter((id) => !ids.includes(id))))
    })
  }

  if (live.loadError) {
    return (
      <div className="grid place-items-center gap-4 py-24 text-center">
        <p className="text-muted-foreground">{live.loadError}</p>
        <Button onClick={() => live.reload()}>
          <RefreshCw /> Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr] lg:items-start">
      {/* List. Wide screens: pinned under the header while the page scrolls the details,
          and only the list of orders scrolls inside it */}
      <section
        className={cn('flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100svh-7.5rem)]', current && 'hidden lg:flex')}
        aria-label="Orders"
      >
        <div className="flex items-center gap-3">
          <h1 className="mr-auto text-[2rem]">Orders</h1>
          <LiveBadge online={live.online} loaded={live.loaded} />
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            id="order-search"
            type="search"
            placeholder="Order no., name, phone or prescription no."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-field pr-10 pl-11 outline-none focus:border-primary"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>

        {!searching && (
          <div role="tablist" aria-label="Order status" className="grid grid-cols-3 rounded-full border border-input bg-field p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {t.id !== 'done' && counts[t.id] > 0 && (
                  <span className={cn('min-w-5 rounded-full px-1.5 text-xs', tab === t.id ? 'bg-primary-foreground/20' : 'bg-secondary text-secondary-foreground')}>
                    {counts[t.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* One box around the list in every tab */}
        <div className="rounded-lg border border-primary/40 bg-popover p-3 shadow-[var(--shadow)] lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
          {!live.loaded || (tab === 'done' && done.isLoading && !searching) || (searching && search.isLoading) ? (
            <p className="py-10 text-center text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <Empty searching={searching} tab={tab} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {list.map((o) => (
                <li key={o.id}>
                  <OrderRow order={o} active={o.id === selected} fresh={live.unseen.has(o.id)} onOpen={() => open(o.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Details */}
      <section className={cn('min-w-0', !current && 'hidden lg:block')} aria-label="Order details">
        {current ? (
          <OrderDetail key={current.id} order={current} onChanged={live.upsert} onBack={() => setSelected(null)} />
        ) : (
          <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-glass-border bg-popover text-center text-muted-foreground shadow-[var(--shadow)]">
            <div>
              <Inbox className="mx-auto mb-3 size-10 opacity-60" />
              Pick an order to see the details.
            </div>
          </div>
        )}
      </section>

      {/* Shows over every staff page (it renders on top of the whole screen) */}
      <NewOrderAlarm orders={ringing} soundOn={soundOn} soundReady={soundReady} onEnableSound={onEnableSound} onAccept={accept} />
    </div>
  )
}

function OrderRow({ order, active, fresh, onOpen }: { order: StaffOrder; active: boolean; fresh: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active}
      className={cn(
        // Same teal glow on every card; the pulsing dot below marks the unseen ones
        'glass flex w-full flex-col gap-2 border-primary/40 bg-popover p-4 text-left shadow-glow hover:border-primary/70',
        active && 'border-primary outline-1 outline-primary hover:border-primary',
      )}
    >
      <div className="flex items-center gap-2">
        {fresh && <span className="size-2 rounded-full bg-primary motion-safe:animate-[ping-soft_2s_infinite]" aria-label="New" />}
        <span className="font-semibold">#{order.id}</span>
        <span className="truncate">{order.customerName}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(order.createdAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Chip>
          {order.method === 'delivery' ? <Bike className="size-3.5" /> : <Store className="size-3.5" />}
          {order.method === 'delivery' ? 'Delivery' : 'Pickup'}
        </Chip>
        <Chip>
          {order.orderType === 'new_prescription' ? <Upload className="size-3.5" /> : null}
          {order.orderType === 'new_prescription' ? 'Upload' : 'Refill'}
        </Chip>
        <span className="text-muted-foreground">{localPhone(order.customerPhone)}</span>
        {order.warnings.length > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300" title={order.warnings.map((w) => w.message).join('\n')}>
            <AlertTriangle className="size-3.5" /> Check
          </span>
        )}
        <span className={cn('ml-auto rounded-full px-2 py-0.5 font-semibold', STATUS_STYLE[order.status])}>{STATUS_LABEL[order.status]}</span>
      </div>
    </button>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">{children}</span>
}

function LiveBadge({ online, loaded }: { online: boolean; loaded: boolean }) {
  if (!loaded) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        online ? 'bg-secondary text-secondary-foreground' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      )}
      role="status"
    >
      <span className={cn('size-2 rounded-full', online ? 'bg-primary motion-safe:animate-[ping-soft_2s_infinite]' : 'bg-amber-500')} />
      {online ? 'Live' : 'Reconnecting…'}
    </span>
  )
}

function Empty({ searching, tab }: { searching: boolean; tab: Tab }) {
  const text = searching
    ? 'No orders match your search.'
    : tab === 'new'
      ? 'No new orders right now. New ones appear here by themselves.'
      : tab === 'progress'
        ? 'Nothing in progress.'
        : 'No finished orders yet.'
  return (
    <div className="rounded-2xl border border-dashed border-glass-border bg-popover px-6 py-12 text-center text-muted-foreground shadow-[var(--shadow)]">
      <Inbox className="mx-auto mb-3 size-8 opacity-60" />
      {text}
    </div>
  )
}
