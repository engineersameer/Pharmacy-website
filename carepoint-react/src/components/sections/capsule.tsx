import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const ease = [0.22, 0.8, 0.2, 1] as const

/**
 * The hero's glossy capsule with two orbit rings.
 * Hover (or tap) it: it lifts and turns upright, a glint sweeps across, the halo fades in
 * and the rings speed up. `tiltX` / `tiltY` come from the hero so the capsule leans toward the cursor.
 */
export function Capsule({ tiltX, tiltY }: { tiltX: MotionValue<number>; tiltY: MotionValue<number> }) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(false)
  const [glintKey, setGlintKey] = useState(0)

  // Rings spin every frame; their speed eases between 1x and 3.5x on hover
  const speed = useSpring(1, { stiffness: 40, damping: 18 })
  const spin1 = useMotionValue(0)
  const spin2 = useMotionValue(0)
  useAnimationFrame((_, delta) => {
    if (reduce) return
    const s = speed.get()
    spin1.set(spin1.get() + (360 / 14000) * delta * s)
    spin2.set(spin2.get() - (360 / 20000) * delta * s)
  })

  const setOn = (on: boolean) => {
    if (on === active || reduce) return
    setActive(on)
    speed.set(on ? 3.5 : 1)
    if (on) setGlintKey((k) => k + 1)
  }

  return (
    <motion.div
      aria-hidden="true"
      className="relative aspect-square cursor-pointer [perspective:900px]"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOn(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOn(false)}
      onPointerDown={(e) => e.pointerType !== 'mouse' && setOn(!active)}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.3 }}
    >
      {/* Soft inner glow */}
      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.35),transparent_70%)] [:root:not(.dark)_&]:bg-[radial-gradient(circle,rgba(15,118,110,.12),transparent_70%)]" />
      {/* Halo, shown on hover */}
      <motion.div
        className="pointer-events-none absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.35),transparent_68%)] [:root:not(.dark)_&]:bg-[radial-gradient(circle,rgba(15,118,110,.16),transparent_68%)]"
        animate={{ opacity: active ? 1 : 0, scale: active ? 1.08 : 1 }}
        transition={{ duration: active ? 0.9 : 1.1, ease }}
      />

      <Ring className="inset-[8%] border-[rgba(94,234,212,.28)] [:root:not(.dark)_&]:border-[rgba(15,118,110,.3)]" tilt={[72, -14]} spin={spin1} active={active} dot="size-2.5 -top-[5px] -ml-[5px]" />
      <Ring className="inset-0 border-[rgba(94,234,212,.16)] [:root:not(.dark)_&]:border-[rgba(15,118,110,.18)]" tilt={[70, 18]} spin={spin2} active={active} dot="size-[7px] -top-[3.5px] -ml-[3.5px] opacity-70" />

      <motion.div
        className="absolute inset-0 grid place-items-center [transform-style:preserve-3d]"
        style={{ rotateX: tiltX, rotateY: tiltY }}
        animate={{ y: active ? -12 : 0, scale: active ? 1.05 : 1 }}
        transition={{ duration: active ? 0.9 : 1.1, ease }}
      >
        <motion.svg
          viewBox="0 0 120 300"
          className="w-[30%] overflow-visible drop-shadow-[0_30px_40px_rgba(0,0,0,.45)] [:root:not(.dark)_&]:drop-shadow-[0_30px_30px_rgba(11,31,42,.25)]"
          initial={reduce ? false : { y: 60, opacity: 0, scale: 0.8, rotate: 32 }}
          animate={{ y: 0, opacity: 1, scale: 1, rotate: active ? 18 : 32 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.33, 1, 0.68, 1], rotate: { duration: 0.9, ease } }}
        >
          <defs>
            <linearGradient id="cap-top" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#5eead4" />
              <stop offset=".55" stopColor="#14b8a6" />
              <stop offset="1" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="cap-bottom" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset=".6" stopColor="#e2e8f0" />
              <stop offset="1" stopColor="#a5b4c3" />
            </linearGradient>
            <linearGradient id="cap-glint" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset=".5" stopColor="#ffffff" stopOpacity=".85" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <clipPath id="cap-clip">
              <path d="M60 0a60 60 0 0 1 60 60v180a60 60 0 0 1-120 0V60A60 60 0 0 1 60 0z" />
            </clipPath>
          </defs>
          {/* Gentle float */}
          <motion.g
            animate={reduce ? undefined : { y: [0, -14, 0] }}
            transition={{ duration: 6.4, ease: 'easeInOut', repeat: Infinity, delay: 1.5 }}
          >
            <path d="M0 60a60 60 0 0 1 120 0v90H0z" fill="url(#cap-top)" />
            <rect x="22" y="28" width="14" height="118" rx="7" fill="#ffffff" opacity=".45" />
            <path d="M0 150h120v90a60 60 0 0 1-120 0z" fill="url(#cap-bottom)" />
            <rect x="0" y="150" width="120" height="5" fill="#0b1f2a" opacity=".16" />
            <rect x="22" y="156" width="14" height="112" rx="7" fill="#ffffff" opacity=".45" />
            <g clipPath="url(#cap-clip)">
              {glintKey > 0 && (
                <motion.rect
                  key={glintKey}
                  y="-40"
                  width="60"
                  height="380"
                  fill="url(#cap-glint)"
                  transform="rotate(18 60 150)"
                  initial={{ x: -90, opacity: 1 }}
                  animate={{ x: 150, opacity: [1, 1, 0] }}
                  transition={{ duration: 1.1, ease: 'easeInOut' }}
                />
              )}
            </g>
          </motion.g>
        </motion.svg>
      </motion.div>

      {/* Twinkling sparks */}
      {[
        'top-[14%] left-[22%] size-1.5',
        'top-[26%] right-[12%] size-1 [animation-delay:.8s]',
        'bottom-[20%] left-[10%] size-1 [animation-delay:1.6s]',
        'bottom-[12%] right-[26%] size-1.5 [animation-delay:2.4s]',
      ].map((c) => (
        <span key={c} className={cn('absolute rounded-full bg-mint opacity-70 shadow-[0_0_10px_var(--mint)] motion-safe:animate-[twinkle_3.2s_ease-in-out_infinite]', c)} />
      ))}
    </motion.div>
  )
}

function Ring({
  className,
  tilt,
  spin,
  active,
  dot,
}: {
  className: string
  tilt: [number, number]
  spin: MotionValue<number>
  active: boolean
  dot: string
}) {
  return (
    <motion.div
      className={cn('absolute rounded-full border', className)}
      style={{ rotateX: tilt[0], rotateY: tilt[1], rotate: spin }}
      animate={{ scale: active ? 1.06 : 1 }}
      transition={{ duration: 0.9, ease }}
    >
      <span className={cn('absolute left-1/2 rounded-full bg-primary shadow-[0_0_14px_var(--primary)]', dot)} />
    </motion.div>
  )
}
