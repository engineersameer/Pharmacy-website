import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Bell, BellOff, ClipboardList, ExternalLink, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { Toaster } from 'sonner'
import { BrandMark } from '@/components/brand-mark'
import { FloatingHeader } from '@/components/shared/floating-header'
import { footerLink, FooterBar, FooterCard } from '@/components/shared/footer-bar'
import { SiteBackground } from '@/components/shared/site-background'
import { buttonVariants } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { useOrderAlerts } from './alerts'
import { AuthProvider, useAuth } from './auth'
import { LoginPage } from './login-page'
import { OrdersPage } from './orders/orders-page'
import { SettingsPage } from './settings/settings-page'
import type { StaffOrder } from './types'
import { useStoreName } from './use-store-name'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

/** Entry point for /staff. Loaded only when someone opens that address. */
export default function StaffApp() {
  // Ask search engines not to list any staff page
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  const { theme } = useTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <SiteBackground animatedSquares />
      <AuthProvider>
        <Gate />
      </AuthProvider>
      <Toaster theme={theme} position="top-center" richColors closeButton />
    </QueryClientProvider>
  )
}

function Gate() {
  const { admin, checking } = useAuth()
  if (checking) return <div className="grid min-h-svh place-items-center text-muted-foreground">Loading…</div>
  return admin ? <Dashboard /> : <LoginPage />
}

/** Tiny router: /staff (orders) and /staff/settings */
function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = useCallback((to: string) => (e?: MouseEvent) => {
    e?.preventDefault()
    window.history.pushState(null, '', to)
    setPath(to)
  }, [])
  return { path, go }
}

function Dashboard() {
  const { admin, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const alerts = useOrderAlerts()
  const { path, go } = usePath()
  const storeName = useStoreName()
  const onSettings = path.startsWith('/staff/settings')
  const announce = useCallback((orders: StaffOrder[]) => alerts.announce(orders), [alerts])

  const nav = [
    { to: '/staff', label: 'Orders', icon: ClipboardList, active: !onSettings },
    { to: '/staff/settings', label: 'Store settings', icon: Settings, active: onSettings },
  ]

  return (
    <div className="flex min-h-svh flex-col">
      <FloatingHeader className="max-w-[1400px] gap-1 px-3 sm:gap-2 md:px-8">
        <a href="/staff" onClick={go('/staff')} className="mr-1 inline-flex min-w-0 items-center gap-2.5 font-heading text-[1.2rem] font-semibold text-foreground sm:mr-2 sm:text-[1.4rem]">
          <BrandMark />
          <span className="hidden max-w-[16ch] truncate sm:inline">{storeName}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-sans text-[0.65rem] font-semibold tracking-wide text-secondary-foreground uppercase">
            Staff
          </span>
        </a>
        <nav aria-label="Staff" className="flex gap-1">
          {nav.map((n) => (
            <a
              key={n.to}
              href={n.to}
              onClick={go(n.to)}
              aria-current={n.active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-2.5 py-2 text-sm font-medium transition-colors sm:px-3',
                n.active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <n.icon className="size-4" />
              <span className="hidden md:inline">{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={alerts.toggle}
            className={cn(buttonVariants({ size: 'sm', variant: alerts.enabled ? 'ghost' : 'default' }), 'h-10 px-3')}
            aria-pressed={alerts.enabled}
            title="Sound and desktop notifications for new orders"
          >
            {alerts.enabled ? <Bell /> : <BellOff />}
            <span className="hidden sm:inline">{alerts.enabled ? 'Alerts on' : 'Turn on alerts'}</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className={buttonVariants({ size: 'icon', variant: 'ghost' })}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <span className="hidden max-w-40 truncate text-sm text-muted-foreground lg:inline" title={admin?.email}>
            {admin?.name}
          </span>
          <button
            type="button"
            onClick={logout}
            className={cn(
              buttonVariants({ size: 'sm', variant: 'ghost' }),
              'size-10 px-0 hover:border-destructive hover:text-destructive sm:w-auto sm:px-3',
            )}
            aria-label="Log out"
          >
            <LogOut />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </FloatingHeader>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 md:px-8">
        {/* Orders stay mounted on the settings page so live updates and alerts keep running */}
        <div hidden={onSettings}>
          <OrdersPage onNewOrders={announce} />
        </div>
        {onSettings && <SettingsPage onBack={go('/staff')} />}
      </main>

      <FooterCard className="pt-6">
        <FooterBar
          left={
            <span>
              © {new Date().getFullYear()} {storeName} · Staff dashboard
            </span>
          }
          right={
            <>
              {nav.map((n) => (
                <a key={n.to} href={n.to} onClick={go(n.to)} className={footerLink}>
                  {n.label}
                </a>
              ))}
              <a href="/" target="_blank" rel="noreferrer" className={`${footerLink} inline-flex items-center gap-1`}>
                Public website <ExternalLink className="size-3.5" />
              </a>
              <button type="button" onClick={logout} className={`${footerLink} inline-flex items-center gap-1 hover:text-destructive`}>
                <LogOut className="size-3.5" /> Log out
              </button>
            </>
          }
        />
      </FooterCard>
    </div>
  )
}
