import { motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { Check, Phone } from 'lucide-react'
import { useMemo, useRef, type PointerEvent } from 'react'
import { GlassCard } from '@/components/shared/glass-card'
import { Magnetic } from '@/components/shared/magnetic'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { buttonVariants } from '@/components/ui/button'
import { TextEffect } from '@/components/ui/text-effect'
import { useStore } from '@/hooks/use-store'
import { openStatus } from '@/lib/hours'
import { cn } from '@/lib/utils'
import { Capsule } from './capsule'

const ease = [0.22, 0.8, 0.2, 1] as const
const trust = ['Genuine medicines only', 'Same-day pickup', 'Licensed pharmacists']

export function Hero() {
  const store = useStore()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)

  // Capsule leans toward the cursor
  const tiltX = useSpring(0, { stiffness: 80, damping: 20 })
  const tiltY = useSpring(0, { stiffness: 80, damping: 20 })
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    tiltY.set(((e.clientX - r.left) / r.width - 0.5) * 30)
    tiltX.set(-((e.clientY - r.top) / r.height - 0.5) * 22)
  }
  const onLeave = () => {
    tiltX.set(0)
    tiltY.set(0)
  }

  // Light parallax: the visual drifts up slower than the page
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const parallax = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '-12%'])

  const fadeUp = (delay: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease } }

  return (
    <section
      id="top"
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative overflow-hidden pt-10 pb-20 lg:pt-8 lg:pb-32"
    >
      {/* The grid and glows behind this section now come from <SiteBackground />, fixed to the screen */}

      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 md:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <div>
          <motion.p className="eyebrow mb-4" {...fadeUp(0.1)}>
            Your neighborhood pharmacy
          </motion.p>
          <h1 className="mb-6 text-[clamp(2.5rem,6vw,4.4rem)]">
            <TextEffect as="span" per="word" preset="slide" speedReveal={1.3} delay={0.15}>
              Prescriptions ready
            </TextEffect>{' '}
            <TextEffect as="span" per="word" preset="slide" speedReveal={1.3} delay={0.35} className="text-primary italic">
              when you are.
            </TextEffect>
          </h1>
          <motion.p className="mb-8 max-w-[32em] text-lg text-muted-foreground" {...fadeUp(0.4)}>
            Fast refills, free local delivery, and pharmacists who know your name. Open 7 days a week.
          </motion.p>
          <motion.div className="mb-8 flex flex-wrap gap-3" {...fadeUp(0.5)}>
            <Magnetic>
              <a href="#refill" className={buttonVariants()}>
                Refill a prescription
              </a>
            </Magnetic>
            <Magnetic>
              <a href={store.phoneHref} className={buttonVariants({ variant: 'ghost' })}>
                <Phone />
                {store.phone}
              </a>
            </Magnetic>
          </motion.div>
          <motion.ul className="flex flex-wrap gap-x-6 gap-y-2.5 text-[0.92rem] text-muted-foreground" {...fadeUp(0.6)}>
            {trust.map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-secondary text-primary">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div className="relative mx-auto w-full max-w-[460px] lg:max-w-[420px] lg:[@media(max-height:820px)]:max-w-[330px]" style={{ y: parallax }}>
          <Capsule tiltX={tiltX} tiltY={tiltY} />
          <StatsCard />
        </motion.div>
      </div>
    </section>
  )
}

function StatsCard() {
  const store = useStore()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const status = useMemo(() => openStatus(store.hours), [store.hours])
  const n = (v: number) => (inView ? v : 0)
  const spring = { stiffness: 40, damping: 18 }

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.8, ease }}
      className="relative z-10 mx-auto -mt-10 max-w-[360px] lg:-mt-16 lg:mr-0 lg:ml-auto lg:max-w-[300px]"
    >
      <GlassCard className="px-6.5 py-6" aria-label="Today's status">
        <div
          className={cn(
            'mb-4.5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.85rem] font-semibold',
            status.isOpen ? 'bg-secondary text-secondary-foreground' : 'bg-glass-strong text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'size-2 rounded-full',
              status.isOpen ? 'bg-primary motion-safe:animate-[ping-soft_2s_infinite]' : 'bg-muted-foreground',
            )}
          />
          {status.label}
        </div>
        <p className="mb-0.5 text-[0.9rem] text-muted-foreground">Average refill time</p>
        <p className="font-heading text-[3.4rem] leading-none font-medium text-primary">
          <AnimatedNumber value={n(store.stats.avgRefillMinutes)} springOptions={spring} />{' '}
          <span className="font-sans text-lg font-medium text-muted-foreground">min</span>
        </p>
        <hr className="my-5 border-glass-border" />
        <dl className="grid grid-cols-2 gap-4">
          {/* Counted from real orders; hidden until there is something to show */}
          {store.stats.ordersCompleted > 0 && (
            <div>
              <dt className="text-[0.8rem] text-muted-foreground">Orders completed</dt>
              <dd className="font-heading text-[1.6rem] font-medium">
                <AnimatedNumber value={n(store.stats.ordersCompleted)} springOptions={spring} />
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[0.8rem] text-muted-foreground">Years serving you</dt>
            <dd className="font-heading text-[1.6rem] font-medium">
              <AnimatedNumber value={n(store.stats.yearsServing)} springOptions={spring} />
            </dd>
          </div>
        </dl>
      </GlassCard>
    </motion.div>
  )
}
