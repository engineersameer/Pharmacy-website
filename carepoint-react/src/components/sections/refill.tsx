import { MapPin, Navigation, Phone } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { GlassCard } from '@/components/shared/glass-card'
import { Reveal } from '@/components/shared/reveal'
import { SectionHeading } from '@/components/shared/section-heading'
import { buttonVariants } from '@/components/ui/button'
import { useStore } from '@/hooks/use-store'
import { groupHours } from '@/lib/hours'
import { cn } from '@/lib/utils'
import { OrderForm } from './order-form'

export function Refill() {
  return (
    <section id="refill" aria-labelledby="refill-title" className="border-y border-glass-border py-22 lg:py-32">
      <div className="mx-auto grid max-w-[1180px] items-start gap-12 px-4 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-18">
        <Reveal>
          <OrderForm />
        </Reveal>
        <Reveal delay={0.1}>
          <Visit />
        </Reveal>
      </div>
    </section>
  )
}

function Visit() {
  const store = useStore()
  const rows = useMemo(() => groupHours(store.hours), [store.hours])
  const today = new Date().getDay()
  const addressLines = store.address.split('\n').filter(Boolean)
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(', '))}`

  return (
    <div id="visit">
      <SectionHeading eyebrow="Visit us" title="Come say hello" className="mb-7" />
      <address className="mb-7 flex gap-3 text-[1.05rem] not-italic">
        <MapPin className="mt-1 size-5 shrink-0 text-primary" />
        <span>
          {addressLines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </span>
      </address>

      <p className="mb-3 font-heading text-lg">Opening hours</p>
      <GlassCard spotlight={false} className="mb-7 overflow-hidden p-0">
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">Opening hours</caption>
          <tbody>
            {rows.map((r) => {
              const isToday = r.days.includes(today)
              return (
                <tr key={r.label} className={cn(isToday && 'bg-secondary')}>
                  <th scope="row" className="border-b border-glass-border px-5 py-3.5 text-left font-medium [tr:last-child_&]:border-0">
                    <span className="inline-flex items-center gap-2">
                      {r.label}
                      {isToday && <Today />}
                    </span>
                  </th>
                  <td className="border-b border-glass-border px-5 py-3.5 text-right text-muted-foreground [tr:last-child_&]:border-0">
                    {r.text}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>

      <div className="flex flex-wrap gap-3">
        <a href={store.phoneHref} className={buttonVariants()}>
          <Phone />
          Call the pharmacy
        </a>
        <a href={mapsHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'ghost' })}>
          <Navigation />
          Get directions
        </a>
      </div>
    </div>
  )
}

function Today(): ReactNode {
  return <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide text-primary-foreground uppercase">Today</span>
}
