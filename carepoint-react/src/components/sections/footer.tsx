import { Clock, MapPin, Phone, Siren } from 'lucide-react'
import { useMemo } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { footerLink, FooterBar } from '@/components/shared/footer-bar'
import { buttonVariants } from '@/components/ui/button'
import { useStore } from '@/hooks/use-store'
import { openStatus } from '@/lib/hours'
import { cn } from '@/lib/utils'

const explore = [
  { href: '#services', label: 'Services' },
  { href: '#how', label: 'How it works' },
  { href: '#reviews', label: 'Reviews' },
  { href: '#refill', label: 'Order medicine' },
  { href: '#visit', label: 'Visit us' },
]

export function Footer() {
  const store = useStore()
  const status = useMemo(() => openStatus(store.hours), [store.hours])
  const addressLines = store.address.split('\n').filter(Boolean)
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(', '))}`

  return (
    <footer className="mt-auto">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-14 sm:grid-cols-2 md:px-8 lg:grid-cols-[1.4fr_1fr_1.3fr] lg:gap-16">
        {/* Brand */}
        <div className="flex flex-col items-start gap-4 sm:col-span-2 lg:col-span-1">
          <a href="#top" className="inline-flex items-center gap-2.5 font-heading text-[1.35rem] font-semibold">
            <BrandMark className="size-7" />
            {store.name}
          </a>
          <p className="max-w-xs text-[0.95rem] text-muted-foreground">
            Your neighborhood pharmacy. Prescriptions ready when you are, with pickup or delivery.
          </p>
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.82rem] font-semibold',
              status.isOpen ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <Clock className="size-3.5" />
            {status.label}
          </span>
          <a href="#refill" className={buttonVariants({ size: 'sm' })}>
            Order your medicine
          </a>
        </div>

        {/* Links */}
        <nav aria-label="Footer">
          <h2 className="mb-4 font-sans text-xs font-semibold tracking-[0.16em] text-eyebrow uppercase">Explore</h2>
          <ul className="flex flex-col gap-2.5 text-[0.95rem] text-muted-foreground">
            {explore.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={footerLink}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <h2 className="mb-4 font-sans text-xs font-semibold tracking-[0.16em] text-eyebrow uppercase">Contact</h2>
          <ul className="flex flex-col gap-3.5 text-[0.95rem] text-muted-foreground">
            <li>
              <a href={store.phoneHref} className={cn('inline-flex items-center gap-2.5', footerLink)}>
                <Phone className="size-4 shrink-0 text-primary" />
                {store.phone}
              </a>
            </li>
            <li className="flex gap-2.5">
              <MapPin className="mt-1 size-4 shrink-0 text-primary" />
              <span>
                {addressLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
                <a href={mapsHref} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-primary hover:underline">
                  Get directions
                </a>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <FooterBar
        left={
          <span>
            © {new Date().getFullYear()} {store.name}. All rights reserved.
          </span>
        }
        right={
          <span className="inline-flex items-center gap-2">
            <Siren className="size-4 text-destructive" />
            In an emergency, call <a href="tel:1122" className="font-semibold text-foreground">Rescue 1122</a>
          </span>
        }
      />
    </footer>
  )
}
