import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'

/**
 * Background behind every staff page. Same pieces as the landing page hero (56px grid in the
 * --grid-line color, two slow teal glows), plus a few grid squares that softly light up.
 */
export function StaffBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <AnimatedGridPattern
        width={56}
        height={56}
        numSquares={28}
        maxOpacity={0.1}
        duration={4}
        repeatDelay={1}
        className="stroke-(--grid-line) text-primary [mask-image:radial-gradient(ellipse_90%_75%_at_50%_0%,#000_45%,transparent_90%)]"
      />
      <div className="absolute -top-48 left-[5%] size-[560px] rounded-full bg-(--aurora-1) blur-[130px] motion-safe:animate-[aurora_18s_ease-in-out_infinite]" />
      <div className="absolute top-1/3 -right-40 size-[500px] rounded-full bg-(--aurora-2) blur-[130px] motion-safe:animate-[aurora_22s_ease-in-out_infinite_reverse]" />
    </div>
  )
}
