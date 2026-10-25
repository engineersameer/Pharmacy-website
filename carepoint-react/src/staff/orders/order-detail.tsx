import { useMutation } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  Copy,
  MapPin,
  MessageCircle,
  Paperclip,
  Phone,
  Search,
  Store,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ACTION_LABEL, fullTime, localPhone, STATUS_LABEL, STATUS_STYLE, timeAgo, whatsappLink } from '../format'
import { useStaffApi } from '../staff-api'
import type { OrderStatus, StaffOrder, StaffPrescription } from '../types'
import { PrescriptionFiles } from './prescription-files'

export function OrderDetail({
  order,
  onChanged,
  onBack,
}: {
  order: StaffOrder
  onChanged: (o: StaffOrder) => void
  onBack?: () => void
}) {
  const api = useStaffApi()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const setStatus = useMutation({
    mutationFn: (status: OrderStatus) => api.setStatus(order, status),
    onSuccess: (res, status) => {
      onChanged(res.order)
      if (res.conflict) toast.warning(`Another staff member already updated order #${order.id}. Showing the latest.`)
      else toast.success(`Order #${order.id}: ${STATUS_LABEL[status]}`)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update. Check your internet.'),
  })

  const steps = order.nextStatuses.filter((s) => s !== 'cancelled')
  const canCancel = order.nextStatuses.includes('cancelled')

  return (
    <article className="flex flex-col gap-6" aria-labelledby={`order-${order.id}-title`}>
      <header className="flex flex-wrap items-start gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className={cn(buttonVariants({ size: 'icon', variant: 'ghost' }), 'lg:hidden')} aria-label="Back to orders">
            <ArrowLeft />
          </button>
        )}
        <div className="mr-auto">
          <h2 id={`order-${order.id}-title`} className="text-[1.8rem] leading-tight">
            Order #{order.id}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" title={fullTime(order.createdAt)}>
            {order.orderType === 'new_prescription' ? 'New prescription' : 'Refill'} · placed {timeAgo(order.createdAt)}
          </p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-sm font-semibold', STATUS_STYLE[order.status])}>{STATUS_LABEL[order.status]}</span>
      </header>

      {order.warnings.length > 0 && (
        <ul className="space-y-2">
          {order.warnings.map((w) => (
            <li key={w.code + w.message} className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[0.92rem] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {w.message}
            </li>
          ))}
        </ul>
      )}

      <Section title="Customer">
        <p className="text-lg font-semibold">{order.customerName}</p>
        <p className="mb-3 text-muted-foreground">{localPhone(order.customerPhone)}</p>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${order.customerPhone}`} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
            <Phone /> Call
          </a>
          <a href={whatsappLink(order.customerPhone)} target="_blank" rel="noreferrer" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
            <MessageCircle /> WhatsApp
          </a>
        </div>
      </Section>

      <Section title={order.method === 'delivery' ? 'Delivery' : 'Pickup'} icon={order.method === 'delivery' ? <Bike /> : <Store />}>
        {order.method === 'delivery' ? (
          <>
            <p className="mb-3 whitespace-pre-line">{order.deliveryAddress}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigator.clipboard?.writeText(order.deliveryAddress).then(() => toast.success('Address copied'))}
              >
                <Copy /> Copy address
              </Button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: 'sm', variant: 'ghost' })}
              >
                <MapPin /> Open in Maps
              </a>
            </div>
            {order.status === 'received' && (
              <p className="mt-3 text-sm text-muted-foreground">Check the address with the customer if it isn't clear, then confirm the order.</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">The customer will collect it from the pharmacy.</p>
        )}
      </Section>

      {order.notes && (
        <Section title="Notes">
          <p className="whitespace-pre-line">{order.notes}</p>
        </Section>
      )}

      <Section title="Prescriptions" icon={<Paperclip />}>
        {order.prescriptions.length > 0 ? (
          <PrescriptionFiles prescriptions={order.prescriptions} />
        ) : (
          <p className="mb-1 text-muted-foreground">No prescription attached yet.</p>
        )}
        {order.orderType === 'refill' && <AttachPrescription order={order} onChanged={onChanged} />}
      </Section>

      {(steps.length > 0 || canCancel) && (
        <div className="sticky bottom-0 -mx-1 flex flex-wrap gap-2 bg-gradient-to-t from-background via-background/95 to-transparent px-1 pt-6 pb-1">
          {steps.map((s) => (
            <Button key={s} onClick={() => setStatus.mutate(s)} disabled={setStatus.isPending} className="flex-1">
              {ACTION_LABEL[s]}
            </Button>
          ))}
          {canCancel && (
            <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={setStatus.isPending} className="hover:border-destructive hover:text-destructive">
              Cancel order
            </Button>
          )}
        </div>
      )}

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="glass gap-4 bg-popover p-6 sm:max-w-sm">
          <DialogTitle className="text-xl">Cancel order #{order.id}?</DialogTitle>
          <DialogDescription>This can't be undone. Let the customer know if they're expecting it.</DialogDescription>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmCancel(false)}>
              Keep order
            </Button>
            <Button
              className="flex-1 bg-destructive text-white hover:bg-destructive/90 hover:shadow-none"
              onClick={() => {
                setConfirmCancel(false)
                setStatus.mutate('cancelled')
              }}
            >
              Cancel order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  )
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-glass-border bg-glass p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-eyebrow uppercase [&_svg]:size-4">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Refills without a (known) number: attach one, or find the customer's earlier prescriptions by phone */
function AttachPrescription({ order, onChanged }: { order: StaffOrder; onChanged: (o: StaffOrder) => void }) {
  const api = useStaffApi()
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')
  const [found, setFound] = useState<StaffPrescription[] | null>(null)

  const attach = useMutation({
    mutationFn: (n: string) => api.attachPrescription(order.id, n),
    onSuccess: (o) => {
      onChanged(o)
      setNumber('')
      setError('')
      toast.success('Prescription attached')
    },
    onError: (e) => setError(e instanceof ApiError ? Object.values(e.fields)[0] || e.message : 'Could not attach.'),
  })

  const search = useMutation({
    mutationFn: () => api.prescriptionsByPhone(order.customerPhone),
    onSuccess: setFound,
    onError: () => setError('Could not search. Check your internet.'),
  })

  const attached = new Set(order.prescriptions.map((p) => p.id))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (number.trim()) attach.mutate(number.trim())
  }

  return (
    <div className="mt-4 border-t border-glass-border pt-4">
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <label htmlFor={`attach-${order.id}`} className="sr-only">
          Prescription number
        </label>
        <input
          id={`attach-${order.id}`}
          inputMode="numeric"
          placeholder="Prescription number"
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-field px-4 outline-none focus:border-primary"
        />
        <Button type="submit" size="sm" disabled={attach.isPending || number.length !== 8}>
          Attach
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => search.mutate()} disabled={search.isPending}>
          <Search /> Find by phone
        </Button>
      </form>
      {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
      {found && (
        <div className="mt-3">
          {found.length === 0 ? (
            <p className="text-sm text-muted-foreground">No earlier prescriptions for {localPhone(order.customerPhone)}.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {found.map((p) => (
                <li key={p.id}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={attached.has(p.id) || attach.isPending}
                    onClick={() => attach.mutate(p.number)}
                    title={`Uploaded ${fullTime(p.createdAt)}`}
                  >
                    {p.number} {attached.has(p.id) ? '· attached' : '· attach'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
