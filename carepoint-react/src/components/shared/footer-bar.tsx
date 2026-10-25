import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The thin bottom line of every footer (customer site and staff dashboard), so both look the same. */
export function FooterBar({ left, right, className }: { left: ReactNode; right: ReactNode; className?: string }) {
  return (
    <div className={cn('border-t border-glass-border', className)}>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-6 text-[0.88rem] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{left}</div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">{right}</div>
      </div>
    </div>
  )
}

export const footerLink = 'transition-colors hover:text-foreground'
