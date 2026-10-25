import { motion } from 'motion/react'
import { ArrowUp, Clock, MapPin, Navigation, Phone, Siren } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { footerLink, FooterBar, FooterCard } from '@/components/shared/footer-bar'
import { buttonVariants } from '@/components/ui/button'
import { TextHoverEffect } from '@/components/ui/text-hover-effect'
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

const heading = 'mb-4 font-sans text-xs font-semibold tracking-[0.16em] text-eyebrow uppercase'

export function Footer() {
  const store = useStore()
  const status = useMemo(() => openStatus(store.hours), [store.hours])
  const addressLines = store.address.split('\n').filter(Boolean)
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(', '))}`
  const [active, setActive] = useState<string | null>(null)

  return (
    <FooterCard>
      {/* Soft glow behind the card, like the hero */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-(--aurora-1) blur-[110px]" />

      <div className="relative grid gap-10 px-6 pt-12 pb-6 sm:grid-cols-2 md:px-10 lg:grid-cols-[1.4fr_1fr_1.3fr] lg:gap-14">
        {/* Brand */}
        <div className="flex flex-col items-start gap-4 sm:col-span-2 lg:col-span-1">
          <a href="#top" className="inline-flex items-center gap-2.5 font-heading text-[1.4rem] font-semibold">
            <BrandMark className="size-8" />
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
            <span className={cn('size-2 rounded-full', status.isOpen ? 'bg-primary motion-safe:animate-[ping-soft_2s_infinite]' : 'bg-muted-foreground')} />
            {status.label}
          </span>
          <a href="#refill" className={cn(buttonVariants({ size: 'sm' }), 'mt-1')}>
            Order your medicine
          </a>
        </div>

        {/* Links: same sliding highlight as the header menu */}
        <nav aria-label="Footer" onMouseLeave={() => setActive(null)}>
          <h2 className={heading}>Explore</h2>
          <ul className="-ml-3 flex flex-col gap-0.5 text-[0.95rem]">
            {explore.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onMouseEnter={() => setActive(l.href)}
                  className="relative inline-flex rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {active === l.href && (
                    <motion.span
                      layoutId="footer-hover"
                      className="absolute inset-0 -z-10 rounded-full bg-muted"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <h2 className={heading}>Contact</h2>
          <ul className="flex flex-col gap-3 text-[0.95rem]">
            <li>
              <a href={store.phoneHref} className="group flex items-center gap-3 rounded-2xl border border-glass-border bg-glass px-4 py-3 transition-colors hover:border-primary">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Phone className="size-4" />
                </span>
                <span>
                  <span className="block text-xs text-muted-foreground">Call us</span>
                  <span className="font-semibold text-foreground">{store.phone}</span>
                </span>
              </a>
            </li>
            <li>
              <a href={mapsHref} target="_blank" rel="noreferrer" className="group flex gap-3 rounded-2xl border border-glass-border bg-glass px-4 py-3 transition-colors hover:border-primary">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <MapPin className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Visit us</span>
                  {addressLines.map((line, i) => (
                    <span key={i} className="block text-foreground">
                      {line}
                    </span>
                  ))}
                  <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    <Navigation className="size-3.5" /> Get directions
                  </span>
                </span>
              </a>
            </li>
            <li className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Clock className="size-4 text-primary" /> Open 7 days a week
            </li>
          </ul>
        </div>
      </div>

      {/* Giant wordmark: draws itself in, lights up under the mouse */}
      <div className="relative mb-1 px-4 md:-mb-4 md:px-8">
        <TextHoverEffect text={store.name} />
      </div>

      <div className="relative border-t border-glass-border">
        <FooterBar
          left={
            <span>
              © {new Date().getFullYear()} {store.name}. All rights reserved.
            </span>
          }
          right={
            <>
              <span className="inline-flex items-center gap-2">
                <Siren className="size-4 text-destructive" />
                Emergency?{' '}
                <a href="tel:1122" className={cn(footerLink, 'font-semibold text-foreground')}>
                  Call Rescue 1122
                </a>
              </span>
              <a href="#top" className={cn(buttonVariants({ size: 'icon-round', variant: 'ghost' }), 'size-9')} aria-label="Back to top">
                <ArrowUp className="size-4" />
              </a>
            </>
          }
        />
      </div>
    </FooterCard>
  )
}
