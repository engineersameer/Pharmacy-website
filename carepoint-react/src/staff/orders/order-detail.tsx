import { useMutation } from '@tanstack/react-query'
import {
  AlertTriangle,
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
import { BackLink } from '../back-link'
import { useStaffApi } from '../staff-api'
import type { OrderStatus, PrescriptionResult, StaffOrder, StaffPrescription } from '../types'
import { PrescriptionFiles, PrescriptionResults } from './prescription-files'

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
      {onBack && (
        <BackLink
          onClick={(e) => {
            e.preventDefault()
            onBack()
          }}
          className="-mb-3 lg:hidden"
        />
      )}
      <header className="flex flex-wrap items-start gap-3">
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
        <PrescriptionsPart order={order} onChanged={onChanged} />
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

/** What the customer typed, if their prescription number wasn't found (saved in the notes) */
function numberNotFound(order: StaffOrder) {
  return order.notes.match(/prescription number (\d+), not found/)?.[1] ?? null
}

/** The prescriptions part of an order, explained for each case */
function PrescriptionsPart({ order, onChanged }: { order: StaffOrder; onChanged: (o: StaffOrder) => void }) {
  const api = useStaffApi()
  const [addingAnother, setAddingAnother] = useState(false)
  const [toRemove, setToRemove] = useState<StaffPrescription | null>(null)
  const hasFiles = order.prescriptions.length > 0
  const finished = order.status === 'completed' || order.status === 'cancelled'

  const remove = useMutation({
    mutationFn: (p: StaffPrescription) => api.removePrescription(order.id, p.id),
    onSuccess: (o, p) => {
      onChanged(o)
      toast.success(`Prescription ${p.number} removed from order #${order.id}`)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not remove. Check your internet.'),
  })

  // Case 1: new customer uploaded photos (their own documents, so no Remove)
  if (order.orderType === 'new_prescription') {
    return (
      <>
        <p className="mb-3 text-[0.92rem] text-muted-foreground">Uploaded by the customer with this order. Click a photo to see it full size.</p>
        <PrescriptionFiles prescriptions={order.prescriptions} />
      </>
    )
  }

  // Case 2: refill with no prescription yet: explain what happened and how to fix it
  if (!hasFiles) {
    const typed = numberNotFound(order)
    if (finished) return <p className="text-muted-foreground">No prescription was attached to this order.</p>
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="mb-1 flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-4" /> No prescription attached yet
        </p>
        <p className="mb-4 text-[0.92rem]">
          {typed ? (
            <>
              The customer typed <span className="font-semibold">{typed}</span>, but no prescription has that number.
            </>
          ) : (
            "The customer didn't give a prescription number, or the one attached was removed."
          )}{' '}
          Find the right prescription, check its photo, and attach it before preparing the order.
        </p>
        <FindPrescription order={order} onChanged={onChanged} />
      </div>
    )
  }

  // Case 3: refill linked to one or more prescriptions
  return (
    <>
      <p className="mb-3 text-[0.92rem] text-muted-foreground">
        This refill is for {order.prescriptions.length === 1 ? 'the prescription' : 'the prescriptions'} below. Click a photo to see it full
        size.{!finished && ' If one is wrong, remove it and attach the right one.'}
      </p>
      <PrescriptionFiles
        prescriptions={order.prescriptions}
        onRemove={finished ? undefined : setToRemove}
        removing={remove.isPending}
      />
      {!finished &&
        (addingAnother ? (
          <div className="mt-4 border-t border-glass-border pt-4">
            <FindPrescription order={order} onChanged={onChanged} />
          </div>
        ) : (
          <button type="button" onClick={() => setAddingAnother(true)} className="mt-4 text-sm font-semibold text-primary hover:underline">
            + Attach another prescription
          </button>
        ))}

      <Dialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <DialogContent className="glass gap-4 bg-popover p-6 sm:max-w-sm">
          <DialogTitle className="text-xl">Remove prescription {toRemove?.number}?</DialogTitle>
          <DialogDescription>
            It will no longer be part of order #{order.id}. The prescription itself is kept, so you can attach it again later.
          </DialogDescription>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setToRemove(null)}>
              Keep it
            </Button>
            <Button
              className="flex-1 bg-destructive text-white hover:bg-destructive/90 hover:shadow-none"
              onClick={() => {
                if (toRemove) remove.mutate(toRemove)
                setToRemove(null)
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Find a prescription by the customer's phone or by its number, review the photos, then attach */
function FindPrescription({ order, onChanged }: { order: StaffOrder; onChanged: (o: StaffOrder) => void }) {
  const api = useStaffApi()
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')
  const [results, setResults] = useState<{ title: string; items: PrescriptionResult[] } | null>(null)

  const attach = useMutation({
    mutationFn: (n: number) => api.attachPrescription(order.id, n),
    onSuccess: (o, n) => {
      onChanged(o)
      setError('')
      toast.success(`Prescription ${n} attached to order #${order.id}`)
    },
    onError: (e) => setError(e instanceof ApiError ? Object.values(e.fields)[0] || e.message : 'Could not attach.'),
  })

  const search = useMutation({
    mutationFn: async (by: 'phone' | 'number') => ({
      by,
      items: by === 'phone' ? await api.prescriptionsByPhone(order.customerPhone) : await api.prescriptionsByNumber(number),
    }),
    onSuccess: ({ by, items }) => {
      setError('')
      setResults({
        title: by === 'phone' ? `Prescriptions used with ${localPhone(order.customerPhone)}` : `Prescription number ${number}`,
        items,
      })
    },
    onError: () => setError('Could not search. Check your internet.'),
  })

  const attached = new Set(order.prescriptions.map((p) => p.id))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (number) search.mutate('number')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Option 1: this customer's past prescriptions</p>
        <Button size="sm" variant="ghost" onClick={() => search.mutate('phone')} disabled={search.isPending}>
          <Search /> Search by {localPhone(order.customerPhone)}
        </Button>
      </div>

      <form onSubmit={submit}>
        <label htmlFor={`find-${order.id}`} className="mb-2 block text-sm font-semibold">
          Option 2: find by prescription number
        </label>
        <div className="flex gap-2">
          <input
            id={`find-${order.id}`}
            inputMode="numeric"
            placeholder="e.g. 12"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12))}
            className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-field px-4 outline-none focus:border-primary"
          />
          <Button type="submit" size="sm" variant="ghost" className="h-11" disabled={search.isPending || !number}>
            <Search /> Find
          </Button>
        </div>
      </form>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {results && (
        <div className="rounded-xl border border-glass-border bg-glass p-3">
          <p className="mb-1 text-sm font-semibold">{results.title}</p>
          {results.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing found. Check the number, or ask the customer to upload a photo instead.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">Open each photo to check it, then attach the right one or more.</p>
              <PrescriptionResults
                results={results.items}
                attachedIds={attached}
                onAttach={(p) => attach.mutate(p.number)}
                attaching={attach.isPending}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
