import { useInView } from 'motion/react'
import { useRef } from 'react'
import { TextEffect } from '@/components/ui/text-effect'
import { cn } from '@/lib/utils'

/** Eyebrow label plus a serif heading that rises in word by word with a soft blur. */
export function SectionHeading({
  eyebrow,
  title,
  id,
  className,
}: {
  eyebrow?: string
  title: string
  id?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })

  return (
    <div ref={ref} className={cn('mb-12 max-w-2xl', className)}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h2 id={id} className="text-[clamp(2rem,4vw,2.9rem)]">
        <TextEffect as="span" per="word" preset="fade-in-blur" speedReveal={1.4} trigger={inView}>
          {title}
        </TextEffect>
      </h2>
    </div>
  )
}
