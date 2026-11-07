import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Floating glass card that holds a footer. Same glass as the scrolled header pill
 * (background, border, blur, shadow, width and side spacing), so header and footer match.
 * `solid` gives it an opaque fill instead, to match a solid header.
 */
export function FooterCard({ children, className, solid = false }: { children: ReactNode; className?: string; solid?: boolean }) {
  return (
    <footer className={cn('mt-auto px-3 pt-10 pb-3 md:px-6 md:pb-6', className)}>
      <div
        className={cn(
          'relative mx-auto max-w-[1180px] overflow-hidden rounded-[2rem] border border-glass-border shadow-[var(--shadow)]',
          solid ? 'bg-popover' : 'bg-[color-mix(in_srgb,var(--background)_72%,transparent)] backdrop-blur-xl backdrop-saturate-150',
        )}
      >
        {/* Teal accent line, like the header's scroll bar */}
        <div aria-hidden="true" className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        {children}
      </div>
    </footer>
  )
}

/** The bottom row of a footer card: copyright on the left, links on the right. */
export function FooterBar({ left, right, className }: { left: ReactNode; right: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 px-6 py-5 text-[0.88rem] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-10',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{left}</div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">{right}</div>
    </div>
  )
}

export const footerLink = 'transition-colors hover:text-foreground'
