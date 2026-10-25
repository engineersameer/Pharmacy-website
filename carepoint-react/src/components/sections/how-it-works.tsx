import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { GlassCard } from '@/components/shared/glass-card'
import { SectionHeading } from '@/components/shared/section-heading'

const steps = [
  { title: 'Send your request', body: 'Enter your prescription number, upload a photo of your prescription, or call us.' },
  { title: 'We prepare it', body: 'A qualified pharmacist checks your prescription and prepares your medicines.' },
  { title: 'Pick up or get delivery', body: "We text you when it's ready. Pick up or we bring it to you." },
]

const ECG_PATH =
  'M0 45H129l10 0 8-10 8 10 8 0 6-34 10 62 8-28 10 0 10-8 10 8H498l10 0 8-10 8 10 8 0 6-34 10 62 8-28 10 0 10-8 10 8H867l10 0 8-10 8 10 8 0 6-34 10 62 8-28 10 0 10-8 10 8H1076'
const DOTS = [
  { cx: 169, at: 0.2 },
  { cx: 538, at: 0.5 },
  { cx: 907, at: 0.82 },
]

export function HowItWorks() {
  const reduce = useReducedMotion()
  const ecgRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ecgRef, offset: ['start 85%', 'start 35%'] })
  const drawn = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  const length = reduce ? 1 : drawn

  return (
    <section id="how" aria-labelledby="how-title" className="py-22 lg:py-32">
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <SectionHeading eyebrow="How it works" title="Refills in three easy steps" id="how-title" />

        {/* Heartbeat line draws across the steps as you scroll */}
        <div ref={ecgRef} className="-mt-2 mb-4 hidden md:block">
        <svg viewBox="0 0 1076 80" aria-hidden="true" className="h-auto w-full overflow-visible">
          <path d={ECG_PATH} fill="none" className="stroke-glass-border" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <motion.path
            d={ECG_PATH}
            fill="none"
            className="stroke-primary drop-shadow-[0_0_6px_var(--primary)]"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pathLength: length }}
          />
          {DOTS.map((d) => (
            <Dot key={d.cx} cx={d.cx} at={d.at} progress={drawn} reduce={!!reduce} />
          ))}
        </svg>
        </div>

        <ol className="grid gap-4.5 md:grid-cols-3 md:gap-7">
          {steps.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -10% 0px' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 0.8, 0.2, 1] }}
            >
              <GlassCard className="h-full p-7.5">
                <div>
                  <motion.span
                    className="mb-4.5 inline-grid size-11 place-items-center rounded-full bg-glass-strong font-heading text-xl text-foreground italic shadow-[inset_0_0_0_1px_var(--primary),0_0_20px_-4px_var(--primary)]"
                    initial={reduce ? false : { scale: 0, rotate: -90 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 + i * 0.15 }}
                  >
                    {i + 1}
                  </motion.span>
                  <h3 className="mb-2 text-[1.1rem]">{s.title}</h3>
                  <p className="text-[0.95rem] text-muted-foreground">{s.body}</p>
                </div>
              </GlassCard>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Dot({ cx, at, progress, reduce }: { cx: number; at: number; progress: MotionValue<number>; reduce: boolean }) {
  const scale = useTransform(progress, [at, at + 0.06], [0, 1], { clamp: true })
  return (
    <motion.circle
      cx={cx}
      cy={11}
      r={6}
      className="fill-primary"
      style={{ scale: reduce ? 1 : scale, transformBox: 'fill-box', transformOrigin: 'center' }}
    />
  )
}
