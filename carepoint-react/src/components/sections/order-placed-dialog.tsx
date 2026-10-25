import { motion } from 'motion/react'
import { Bike, MessageSquareText, PhoneCall, Store, UserCheck } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { buttonVariants } from '@/components/ui/button'
import type { DeliveryMethod } from '@/lib/types'
import { cn } from '@/lib/utils'

export type PlacedOrder = {
  firstName: string
  orderNumber: number
  prescriptionNumbers: string[]
  method: DeliveryMethod
  deliveryAddress?: string
  kind: 'refill' | 'upload'
}

/** Shown in the middle of the screen once an order goes through. */
export function OrderPlacedDialog({ order, onClose }: { order: PlacedOrder | null; onClose: () => void }) {
  const steps = order
    ? [
        {
          icon: UserCheck,
          text: order.kind === 'upload' ? 'A pharmacist checks your prescription.' : 'A pharmacist prepares your refill.',
        },
        {
          icon: PhoneCall,
          text: order.method === 'delivery' ? 'We may call to confirm your address or other details.' : 'We may call you if we need more details.',
        },
        {
          icon: MessageSquareText,
          text:
            order.method === 'delivery'
              ? 'We text you when it’s on the way.'
              : 'We text you when it’s ready to collect.',
        },
      ]
    : []

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass gap-0 overflow-hidden bg-popover p-0 text-center sm:max-w-md">
        {order && (
          <>
            <div className="relative px-7 pt-10 pb-6">
              {/* Soft glow behind the tick */}
              <div aria-hidden="true" className="absolute top-0 left-1/2 size-56 -translate-x-1/2 -translate-y-1/3 rounded-full bg-(--aurora-1) blur-3xl" />
              <BigCheck />
              <DialogTitle className="relative mt-5 font-heading text-[1.9rem] leading-tight">
                Order placed, {order.firstName}!
              </DialogTitle>
              <DialogDescription className="relative mt-2 text-[0.98rem]">
                {order.kind === 'upload' ? 'We’ve received your prescription.' : 'We’ve received your refill request.'}
              </DialogDescription>

              <div className="relative mt-5 inline-flex items-center gap-3 rounded-full border border-glass-border bg-glass-strong px-4 py-2 text-sm">
                <span className="text-muted-foreground">Order no.</span>
                <span className="font-semibold tracking-wider">#{order.orderNumber}</span>
                <span className="h-4 w-px bg-glass-border" />
                <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                  {order.method === 'delivery' ? <Bike className="size-4" /> : <Store className="size-4" />}
                  {order.method === 'delivery' ? 'Delivery' : 'Pickup'}
                </span>
              </div>
              {order.deliveryAddress && (
                <p className="relative mx-auto mt-3 max-w-xs text-[0.88rem] text-muted-foreground">
                  Delivering to: <span className="text-foreground">{order.deliveryAddress}</span>
                </p>
              )}
            </div>

            <div className="border-t border-glass-border bg-muted/40 px-7 py-6 text-left">
              <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-eyebrow uppercase">What happens next</p>
              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <motion.li
                    key={s.text}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}
                    className="flex items-center gap-3 text-[0.95rem]"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                      <s.icon className="size-4" />
                    </span>
                    {s.text}
                  </motion.li>
                ))}
              </ol>
              {order.kind === 'upload' && order.prescriptionNumbers.length > 0 && (
                <div className="mt-5 rounded-xl border border-glass-border bg-glass-strong p-4">
                  <p className="m-0 text-[0.88rem] text-muted-foreground">
                    {order.prescriptionNumbers.length === 1 ? 'Your prescription number' : 'Your prescription numbers'}. Save{' '}
                    {order.prescriptionNumbers.length === 1 ? 'it' : 'them'} to order refills next time:
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {order.prescriptionNumbers.map((n) => (
                      <li key={n} className="rounded-lg bg-secondary px-3 py-1.5 font-semibold tracking-[0.12em] text-secondary-foreground">
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <DialogClose className={cn(buttonVariants(), 'mt-6 w-full')}>Done</DialogClose>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function BigCheck() {
  return (
    <motion.div
      className="relative mx-auto grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
    >
      {/* Expanding ring */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full border-2 border-primary"
        initial={{ scale: 1, opacity: 0.8 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 1.2, delay: 0.35, ease: 'easeOut' }}
      />
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-10 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="m5 12.5 4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.35 }} />
      </svg>
    </motion.div>
  )
}
