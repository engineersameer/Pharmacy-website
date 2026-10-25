import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { buttonVariants } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

const links = [
  { href: '#services', label: 'Services' },
  { href: '#how', label: 'How it works' },
  { href: '#reviews', label: 'Reviews' },
  { href: '#visit', label: 'Visit us' },
]

export function Header() {
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 10))

  return (
    <header className="sticky top-0 z-50 px-0 transition-[padding] duration-500 ease-luxe data-[scrolled=true]:px-3 data-[scrolled=true]:pt-3 md:data-[scrolled=true]:px-6" data-scrolled={scrolled}>
      <div
        className={cn(
          'relative mx-auto flex min-h-[72px] max-w-[1180px] items-center gap-3 border-b border-glass-border px-4 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-radius,box-shadow,min-height] duration-500 ease-luxe md:px-8',
          'bg-[color-mix(in_srgb,var(--background)_72%,transparent)]',
          scrolled && 'min-h-16 rounded-full border shadow-[var(--shadow)] md:px-6',
        )}
      >
        <a href="#top" className="mr-auto inline-flex items-center gap-2.5 font-heading text-[1.4rem] font-semibold text-foreground" aria-label="CarePoint Pharmacy home">
          <BrandMark />
          <span>CarePoint</span>
        </a>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex" onMouseLeave={() => setActive(null)}>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onMouseEnter={() => setActive(l.href)}
              className="relative rounded-full px-4 py-2 text-[0.95rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {active === l.href && (
                <motion.span
                  layoutId="nav-hover"
                  className="absolute inset-0 -z-10 rounded-full bg-muted"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {l.label}
            </a>
          ))}
          <a href="#refill" className={cn(buttonVariants({ size: 'sm' }), 'ml-3')}>
            Refill a prescription
          </a>
        </nav>

        <button
          type="button"
          onClick={toggle}
          className={cn(buttonVariants({ size: 'icon', variant: 'ghost' }), 'relative overflow-hidden')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.25 }}
              className="inline-flex"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </motion.span>
          </AnimatePresence>
        </button>

        <button
          type="button"
          className={cn(buttonVariants({ size: 'icon', variant: 'ghost' }), 'lg:hidden')}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </button>

        <motion.div
          aria-hidden="true"
          className={cn('absolute inset-x-0 -bottom-px h-0.5 origin-left bg-primary', scrolled && 'inset-x-8 rounded-full')}
          style={{ scaleX: progress }}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Main"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 0.8, 0.2, 1] }}
            className="glass absolute inset-x-3 top-full mt-2 flex flex-col gap-1 p-3 lg:hidden"
            style={{ background: 'var(--popover)' }}
          >
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                {l.label}
              </a>
            ))}
            <a href="#refill" onClick={() => setOpen(false)} className={cn(buttonVariants(), 'mt-2')}>
              Refill a prescription
            </a>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
