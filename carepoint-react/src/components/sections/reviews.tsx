import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Pause, Play, Quote, Star } from 'lucide-react'
import { useCallback, useState } from 'react'
import { GlassCard } from '@/components/shared/glass-card'
import { Reveal } from '@/components/shared/reveal'
import { SectionHeading } from '@/components/shared/section-heading'
import { buttonVariants } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { api } from '@/lib/api'
import { reviews as defaultReviews } from '@/lib/mock-api'
import { cn } from '@/lib/utils'

const SLIDE_MS = 6000

export function Reviews() {
  const { data: reviews } = useApi(api.getReviews, defaultReviews)
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(!!reduce)
  const [hovering, setHovering] = useState(false)
  const [direction, setDirection] = useState(1)

  // The progress bar is the timer: when it fills, the next review shows
  const progress = useMotionValue(0)

  const go = useCallback(
    (i: number, dir = 1) => {
      setDirection(dir)
      setIndex((i + reviews.length) % reviews.length)
      progress.set(0)
    },
    [reviews.length, progress],
  )

  useAnimationFrame((_, delta) => {
    if (userPaused || hovering || reviews.length < 2) return
    const next = progress.get() + delta / SLIDE_MS
    if (next >= 1) go(index + 1)
    else progress.set(next)
  })

  const review = reviews[index]
  if (!review) return null

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="py-22 lg:py-32">
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <SectionHeading eyebrow="Reviews" title="What our neighbors say" id="reviews-title" />

        <Reveal className="max-w-[820px]" aria-roledescription="carousel" aria-label="Customer reviews">
          <div onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
            <GlassCard className="overflow-hidden p-8 sm:p-10">
              <Quote aria-hidden="true" className="absolute top-6 right-8 size-16 text-primary opacity-15" />
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.figure
                  key={review.id}
                  custom={direction}
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${reviews.length}`}
                  initial={reduce ? false : { opacity: 0, x: 20 * direction, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={reduce ? undefined : { opacity: 0, x: -20 * direction, filter: 'blur(6px)' }}
                  transition={{ duration: 0.45, ease: [0.22, 0.8, 0.2, 1] }}
                  className="m-0 min-h-[200px]"
                >
                  <div className="mb-4 flex gap-1 text-primary" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-4 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                  <blockquote className="mb-7 font-heading text-[clamp(1.35rem,2.8vw,1.85rem)] leading-snug font-medium italic">
                    “{review.quote}”
                  </blockquote>
                  <figcaption className="flex items-center gap-3.5 text-[0.92rem] leading-snug text-muted-foreground">
                    <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-secondary text-[0.9rem] font-semibold text-primary">
                      {review.initials}
                    </span>
                    <span>
                      <strong className="text-foreground">{review.author}</strong>
                      <br />
                      {review.detail}
                    </span>
                  </figcaption>
                </motion.figure>
              </AnimatePresence>
            </GlassCard>
          </div>

          <div aria-hidden="true" className="mt-5 h-0.5 overflow-hidden rounded-full bg-glass-border">
            <motion.span
              className={cn('block h-full origin-left bg-primary', userPaused && 'opacity-45')}
              style={{ scaleX: progress }}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button type="button" className={buttonVariants({ size: 'icon-round', variant: 'ghost' })} aria-label="Previous review" onClick={() => go(index - 1, -1)}>
              <ChevronLeft />
            </button>
            <p className="m-0 min-w-12 text-center font-semibold text-muted-foreground" aria-live={userPaused ? 'polite' : 'off'}>
              {index + 1} / {reviews.length}
            </p>
            <button type="button" className={buttonVariants({ size: 'icon-round', variant: 'ghost' })} aria-label="Next review" onClick={() => go(index + 1)}>
              <ChevronRight />
            </button>

            {/* Jump straight to a review */}
            <div className="ml-4 hidden -space-x-2 sm:flex">
              {reviews.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => go(i, i > index ? 1 : -1)}
                  aria-label={`Show review from ${r.author}`}
                  aria-current={i === index}
                  className={cn(
                    'grid size-9 place-items-center rounded-full border-2 border-background bg-secondary text-xs font-semibold text-primary transition-transform duration-300 hover:z-10 hover:-translate-y-0.5',
                    i === index && 'z-10 bg-primary text-primary-foreground',
                  )}
                >
                  {r.initials}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={cn(buttonVariants({ size: 'icon-round', variant: 'ghost' }), 'ml-auto', userPaused && 'border-primary text-primary')}
              aria-label={userPaused ? 'Resume auto-rotation' : 'Pause auto-rotation'}
              aria-pressed={userPaused}
              onClick={() => setUserPaused((p) => !p)}
            >
              {userPaused ? <Play /> : <Pause />}
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
