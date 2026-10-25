import { ArrowLeft } from 'lucide-react'
import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils'

/** "← Back to orders" link shown at the top of staff pages */
export function BackLink({
  href = '/staff',
  label = 'Back to orders',
  onClick,
  className,
}: {
  href?: string
  label?: string
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void
  className?: string
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        'group inline-flex w-fit items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </a>
  )
}
