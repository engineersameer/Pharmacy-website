import { motion, type HTMLMotionProps } from 'motion/react'

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ delay = 0, ...props }: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 0.8, 0.2, 1] }}
      {...props}
    />
  )
}
