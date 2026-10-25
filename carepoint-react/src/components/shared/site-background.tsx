import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'

/**
 * The site's background: a faint 56px grid and two slow teal glows. It is fixed to the
 * screen, so page content scrolls over it. Used by both the customer site and the staff
 * dashboard; the dashboard also lights up a few grid squares.
 */
export function SiteBackground({ animatedSquares = false }: { animatedSquares?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {animatedSquares ? (
        <AnimatedGridPattern
          width={56}
          height={56}
          numSquares={28}
          maxOpacity={0.1}
          duration={4}
          repeatDelay={1}
          className="stroke-(--grid-line) text-primary [mask-image:radial-gradient(ellipse_90%_75%_at_50%_0%,#000_45%,transparent_90%)]"
        />
      ) : (
        <div className="bg-grid absolute inset-0" />
      )}
      <div className="absolute -top-40 left-[10%] size-[520px] rounded-full bg-(--aurora-1) blur-[120px] motion-safe:animate-[aurora_18s_ease-in-out_infinite]" />
      <div className="absolute top-1/4 right-[-10%] size-[460px] rounded-full bg-(--aurora-2) blur-[120px] motion-safe:animate-[aurora_22s_ease-in-out_infinite_reverse]" />
    </div>
  )
}
