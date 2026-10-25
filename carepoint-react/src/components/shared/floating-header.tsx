import { motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The header shell used by both the customer site and the staff dashboard.
 * At the top of the page it has no box of its own, so the background shows through with no
 * visible edges. Once you scroll it becomes a floating glass pill with a teal progress line.
 */
export function FloatingHeader({
  children,
  after,
  className,
}: {
  children: ReactNode
  /** Rendered under the bar, e.g. a phone menu (positioned against the header) */
  after?: ReactNode
  /** Extra classes for the bar, e.g. a different max width */
  className?: string
}) {
  const [scrolled, setScrolled] = useState(false)
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 10))

  return (
    <header
      className="sticky top-0 z-50 px-0 transition-[padding] duration-500 ease-luxe data-[scrolled=true]:px-3 data-[scrolled=true]:pt-3 md:data-[scrolled=true]:px-6"
      data-scrolled={scrolled}
    >
      <div
        className={cn(
          'relative mx-auto flex min-h-[72px] max-w-[1180px] items-center gap-3 border border-transparent px-4 transition-[background-color,border-color,border-radius,box-shadow,min-height,backdrop-filter] duration-500 ease-luxe md:px-8',
          className,
          scrolled &&
            'min-h-16 rounded-full border-glass-border bg-[color-mix(in_srgb,var(--background)_72%,transparent)] shadow-[var(--shadow)] backdrop-blur-xl backdrop-saturate-150 md:px-6',
        )}
      >
        {children}
        {/* Only once scrolled: on a page too short to scroll, the progress would read as 100%
            and draw a full line under the header */}
        {scrolled && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-x-8 -bottom-px h-0.5 origin-left rounded-full bg-primary"
            style={{ scaleX: progress }}
          />
        )}
      </div>
      {after}
    </header>
  )
}
