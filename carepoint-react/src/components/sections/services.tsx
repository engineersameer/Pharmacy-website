import { motion, type TargetAndTransition } from 'motion/react'
import { MessageCircle, Pill, Syringe, Truck, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassCard } from '@/components/shared/glass-card'
import { Reveal } from '@/components/shared/reveal'
import { SectionHeading } from '@/components/shared/section-heading'
import { cn } from '@/lib/utils'

type Service = {
  title: string
  body: string
  icon: LucideIcon
  // Little motion the icon makes when the card is hovered
  hover: TargetAndTransition
  wide?: boolean
  extra?: ReactNode
}

const services: Service[] = [
  {
    title: 'Prescription refills',
    body: "Order online or by phone. We'll text you the moment it's ready.",
    icon: Pill,
    hover: { rotate: [0, 200, 180], transition: { duration: 0.7 } },
    wide: true,
    extra: <ReadyText />,
  },
  {
    title: 'Vaccines',
    body: 'Flu, typhoid, hepatitis B and travel vaccines. Walk-ins welcome.',
    icon: Syringe,
    hover: { x: [0, -3, -3, 1, 0], y: [0, 3, 3, -1, 0], transition: { duration: 0.8 } },
  },
  {
    title: 'Free local delivery',
    body: 'Same-day delivery within 5 km on orders placed before 2 pm.',
    icon: Truck,
    hover: { x: [0, -3, 5, 5, 0], transition: { duration: 0.9 } },
  },
  {
    title: 'Talk to a pharmacist',
    body: 'Private consults about side effects, interactions, and dosing.',
    icon: MessageCircle,
    hover: { scale: [1, 1.15, 1.05, 1], rotate: [0, -8, 6, 0], transition: { duration: 0.7 } },
    wide: true,
    extra: <ChatBubbles />,
  },
]

export function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="py-22 lg:py-32">
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <SectionHeading eyebrow="What we do" title="Care that goes beyond the counter" id="services-title" />
        <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className={cn(s.wide && 'lg:col-span-2')}>
              <ServiceCard service={s} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function ServiceCard({ service: s }: { service: Service }) {
  const Icon = s.icon
  return (
    <motion.div className="group h-full" initial="rest" whileHover="hover" animate="rest">
      <GlassCard
        className={cn(
          'flex h-full flex-col p-7.5 hover:-translate-y-1.5',
          s.wide && 'lg:flex-row lg:items-center lg:justify-between lg:gap-8',
        )}
      >
        <div className={cn(s.wide && 'lg:max-w-sm')}>
          <div className="mb-5.5 inline-grid size-13 place-items-center rounded-2xl border border-glass-border bg-secondary text-primary transition-[background-color,color,box-shadow] duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-glow">
            <motion.span className="inline-flex" variants={{ rest: { rotate: 0, x: 0, y: 0, scale: 1 }, hover: s.hover }}>
              <Icon className="size-6" strokeWidth={1.75} />
            </motion.span>
          </div>
          <h3 className="mb-2 text-[1.1rem]">{s.title}</h3>
          <p className="text-[0.95rem] text-muted-foreground">{s.body}</p>
        </div>
        {s.extra && <div className="mt-6 hidden sm:block lg:mt-0">{s.extra}</div>}
      </GlassCard>
    </motion.div>
  )
}

/** Example text message: shows what customers get when the refill is ready */
function ReadyText() {
  return (
    <div aria-hidden="true" className="w-full max-w-[260px] rounded-2xl border border-glass-border bg-glass-strong p-3.5 text-sm shadow-[var(--shadow)]">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">CarePoint</span>
        <span>now</span>
      </div>
      <p className="leading-snug">Your refill is ready for pickup. 💊</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          variants={{ rest: { width: '70%' }, hover: { width: '100%' } }}
          transition={{ duration: 0.8, ease: [0.22, 0.8, 0.2, 1] }}
        />
      </div>
    </div>
  )
}

/** Example consult chat */
function ChatBubbles() {
  return (
    <div aria-hidden="true" className="flex w-full max-w-[280px] flex-col gap-2 text-sm">
      <div className="self-start rounded-2xl rounded-bl-md border border-glass-border bg-glass-strong px-3.5 py-2">
        Can I take this with ibuprofen?
      </div>
      <motion.div
        className="self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2 font-medium text-primary-foreground"
        variants={{ rest: { y: 0 }, hover: { y: -3 } }}
      >
        Yes, with food. Here's why…
      </motion.div>
    </div>
  )
}
