import { BellRing, Bike, Store, Upload, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { localPhone, timeAgo } from '../format'
import type { StaffOrder } from '../types'

/**
 * Full-screen popup for orders that just came in. It appears over whatever page staff are
 * on and stays until they press Accept (clicking outside or pressing Escape does nothing),
 * while the alarm keeps ringing.
 */
export function NewOrderAlarm({
  orders,
  soundOn,
  soundReady,
  onEnableSound,
  onAccept,
}: {
  orders: StaffOrder[]
  /** Staff turned alerts on */
  soundOn: boolean
  /** The browser lets the page play sound (it needs one click after every page load) */
  soundReady: boolean
  onEnableSound: () => void
  onAccept: () => void
}) {
  const count = orders.length
  return (
    <Dialog open={count > 0} onOpenChange={() => {}} disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="glass gap-5 bg-popover p-6 shadow-glow sm:max-w-md"
        aria-live="assertive"
      >
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground motion-safe:animate-[ping-soft_1.4s_infinite]">
            <BellRing className="size-7 motion-safe:animate-[ring-bell_1.2s_ease-in-out_infinite]" />
          </span>
          <div>
            <DialogTitle className="text-2xl">{count === 1 ? 'New order' : `${count} new orders`}</DialogTitle>
            <DialogDescription>The alarm keeps ringing until you accept.</DialogDescription>
          </div>
        </div>

        <ul className="flex max-h-[45svh] flex-col gap-2 overflow-y-auto">
          {orders.map((o) => (
            <li key={o.id} className="rounded-xl border border-primary/40 bg-popover p-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">#{o.id}</span>
                <span className="truncate">{o.customerName}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(o.createdAt)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
                  {o.method === 'delivery' ? <Bike className="size-3.5" /> : <Store className="size-3.5" />}
                  {o.method === 'delivery' ? 'Delivery' : 'Pickup'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
                  {o.orderType === 'new_prescription' ? <Upload className="size-3.5" /> : null}
                  {o.orderType === 'new_prescription' ? 'Upload' : 'Refill'}
                </span>
                <span className="text-muted-foreground">{localPhone(o.customerPhone)}</span>
              </div>
            </li>
          ))}
        </ul>

        {!soundOn ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <VolumeX className="size-4 shrink-0" /> Sound is off. Use “Turn on alerts” at the top to hear the alarm.
          </p>
        ) : (
          !soundReady && (
            <Button variant="outline" className="w-full" onClick={onEnableSound}>
              <Volume2 /> Tap to play the alarm sound
            </Button>
          )
        )}

        <Button
          className="w-full"
          onClick={onAccept}
          // Don't let this press reach the page's "click anywhere to turn on sound" listener:
          // turning sound on removes the "Tap to play" button above, this button jumps up
          // before the press ends, and the Accept never happens.
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          autoFocus
        >
          {count === 1 ? 'Accept and view order' : 'Accept and view orders'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
