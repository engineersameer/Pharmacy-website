import { motion, useReducedMotion } from 'motion/react'
import { useId, useRef, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

/**
 * A big outlined word that wipes in when it scrolls into view, and lights up in
 * the brand color wherever the mouse is. Idea from 21st.dev's "Hover Footer"; written
 * here to use the site's own colors and font.
 */
export function TextHoverEffect({ text, className }: { text: string; className?: string }) {
  // React's ids contain characters like « » that break SVG url(#id) links: keep letters and digits only
  const id = 'thf' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduce = useReducedMotion()
  const ref = useRef<SVGSVGElement>(null)
  const [hovered, setHovered] = useState(false)
  const [spot, setSpot] = useState({ cx: '50%', cy: '50%' })

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setSpot({ cx: `${((e.clientX - r.left) / r.width) * 100}%`, cy: `${((e.clientY - r.top) / r.height) * 100}%` })
  }

  const textProps = {
    x: '50%',
    y: '54%',
    textAnchor: 'middle' as const,
    dominantBaseline: 'middle' as const,
    textLength: '96%',
    lengthAdjust: 'spacingAndGlyphs' as const,
    className: 'fill-transparent font-heading font-semibold',
    style: { fontSize: 72 },
  }

  return (
    <svg
      ref={ref}
      viewBox="0 0 600 110"
      aria-hidden="true"
      className={cn('w-full select-none', className)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerMove={onMove}
    >
      <defs>
        <linearGradient id={`${id}-brand`} gradientUnits="userSpaceOnUse" x1="0" x2="600" y1="0" y2="0">
          <stop offset="0%" style={{ stopColor: 'var(--primary)' }} />
          <stop offset="50%" style={{ stopColor: 'var(--mint)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--primary)' }} />
        </linearGradient>
        <motion.radialGradient
          id={`${id}-reveal`}
          gradientUnits="userSpaceOnUse"
          r="22%"
          initial={false}
          animate={spot}
          transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-reveal)`} />
        </mask>
        <mask id={`${id}-wipe`}>
          <motion.rect
            height="100%"
            fill="white"
            initial={reduce ? false : { width: 0 }}
            whileInView={{ width: 600 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 2.2, ease: [0.22, 0.8, 0.2, 1] }}
            width={reduce ? 600 : undefined}
          />
        </mask>
      </defs>

      {/* Faint outline, always visible */}
      <text {...textProps} strokeWidth="0.8" className={cn(textProps.className, 'stroke-glass-border')}>
        {text}
      </text>

      {/* Wipes in from left to right once, in the brand color */}
      <text {...textProps} strokeWidth="1" stroke={`url(#${id}-brand)`} mask={`url(#${id}-wipe)`} opacity="0.55">
        {text}
      </text>

      {/* Lights up around the mouse */}
      <text
        {...textProps}
        strokeWidth="2"
        stroke={`url(#${id}-brand)`}
        mask={`url(#${id}-mask)`}
        className="font-heading font-semibold"
        fill={`url(#${id}-brand)`}
        fillOpacity={0.18}
        style={{ ...textProps.style, opacity: hovered ? 1 : 0, transition: 'opacity 0.3s ease' }}
      >
        {text}
      </text>
    </svg>
  )
}
