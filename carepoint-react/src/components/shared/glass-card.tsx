import type { ComponentProps } from 'react'
import { Spotlight } from '@/components/ui/spotlight'
import { cn } from '@/lib/utils'

/** Frosted glass panel with a soft teal glow that follows the cursor. */
export function GlassCard({
  className,
  spotlight = true,
  children,
  ...props
}: ComponentProps<'div'> & { spotlight?: boolean }) {
  return (
    <div className={cn('glass isolate', className)} {...props}>
      {spotlight && (
        <Spotlight
          size={280}
          className="-z-10 from-(--spot) via-(--spot) to-transparent blur-2xl dark:from-(--spot) dark:via-(--spot) dark:to-transparent"
        />
      )}
      {children}
    </div>
  )
}
