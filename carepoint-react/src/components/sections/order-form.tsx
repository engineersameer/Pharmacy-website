import { AnimatePresence, motion } from 'motion/react'
import { Camera, FileText, Info, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { GlassCard } from '@/components/shared/glass-card'
import { SectionHeading } from '@/components/shared/section-heading'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import type { DeliveryMethod } from '@/lib/types'
import { cn } from '@/lib/utils'
import { OrderPlacedDialog, type PlacedOrder } from './order-placed-dialog'

// Two ways to order:
// - "number": returning customer types the prescription number we texted them (or we find it by their phone if lost)
// - "upload": new customer sends a photo or PDF of their paper prescription

type Mode = 'number' | 'upload'
type Status = 'idle' | 'sending' | 'error'

const MAX_FILES = 3
const MAX_MB = 10
const ACCEPT = 'image/*,application/pdf'

export function OrderForm() {
  const [mode, setMode] = useState<Mode>('number')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<DeliveryMethod>('pickup')
  const [prescriptionNumber, setPrescriptionNumber] = useState('')
  const [noNumber, setNoNumber] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [notes, setNotes] = useState('')
  const [address, setAddress] = useState('')

  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [status, setStatus] = useState<Status>('idle')
  const [placed, setPlaced] = useState<PlacedOrder | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLButtonElement>(null)
  const addressRef = useRef<HTMLTextAreaElement>(null)

  // Rules for the fields that are visible right now, in the order they appear
  const checks: { key: string; ok: () => boolean; message: string; focus: () => void }[] = [
    { key: 'name', ok: () => name.trim().length >= 2, message: 'Please enter your name.', focus: () => nameRef.current?.focus() },
    { key: 'phone', ok: () => phone.replace(/\D/g, '').length >= 10, message: 'Please enter a valid mobile number.', focus: () => phoneRef.current?.focus() },
    ...(mode === 'number' && !noNumber
      ? [{ key: 'prescriptionNumber', ok: () => /\d/.test(prescriptionNumber), message: 'Please enter your prescription number.', focus: () => numberRef.current?.focus() }]
      : []),
    ...(mode === 'upload'
      ? [{ key: 'files', ok: () => files.length > 0, message: 'Please add a photo of your prescription.', focus: () => uploadRef.current?.focus() }]
      : []),
    ...(method === 'delivery'
      ? [{ key: 'address', ok: () => address.trim().length >= 10, message: 'Please enter your full delivery address.', focus: () => addressRef.current?.focus() }]
      : []),
  ]

  const validateOne = (key: string) => {
    const c = checks.find((x) => x.key === key)
    if (c) setErrors((e) => ({ ...e, [key]: c.ok() ? undefined : c.message }))
  }

  function reset() {
    setName('')
    setPhone('')
    setPrescriptionNumber('')
    setNoNumber(false)
    setFiles([])
    setNotes('')
    setAddress('')
    setMethod('pickup')
    setErrors({})
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    const next: Record<string, string | undefined> = {}
    checks.forEach((c) => (next[c.key] = c.ok() ? undefined : c.message))
    setErrors(next)
    const firstBad = checks.find((c) => next[c.key])
    if (firstBad) {
      firstBad.focus()
      return
    }

    setStatus('sending')
    const deliveryAddress = method === 'delivery' ? address.trim() : undefined
    try {
      const res =
        mode === 'number'
          ? await api.createRefill(
              noNumber ? { name, phone, method, deliveryAddress } : { name, phone, method, deliveryAddress, prescriptionNumber },
            )
          : await api.uploadPrescription({ name, phone, method, deliveryAddress, files, notes: notes.trim() || undefined })
      setPlaced({
        firstName: name.trim().split(' ')[0],
        orderNumber: res.id,
        prescriptionNumbers: res.prescriptionNumbers,
        method,
        deliveryAddress,
        kind: mode === 'number' ? 'refill' : 'upload',
      })
      setStatus('idle')
      reset()
    } catch (err) {
      setStatus('error')
      setErrorMessage(showServerErrors(err))
    }
  }

  // Put the backend's messages under the right fields; return the message for the box under the button
  function showServerErrors(err: unknown) {
    if (!(err instanceof ApiError)) return 'Sorry, we couldn’t send that. Please check your internet and try again, or call us.'
    if (err.status === 429) return 'You’ve sent several orders in a short time. Please wait a while, or call us.'
    if (err.status >= 500) return 'Sorry, something went wrong on our side. Please try again in a minute, or call us.'

    const map: Record<string, string> = { name: 'name', phone: 'phone', prescriptionNumber: 'prescriptionNumber', deliveryAddress: 'address', files: 'files' }
    const next: Record<string, string> = {}
    for (const [field, msg] of Object.entries(err.fields)) if (map[field]) next[map[field]] = msg
    if (Object.keys(next).length) {
      setErrors((e) => ({ ...e, ...next }))
      checks.find((c) => next[c.key])?.focus()
      return 'Please fix the highlighted fields.'
    }
    return err.message || 'Sorry, we couldn’t send that. Please try again or call us.'
  }

  return (
    <GlassCard spotlight={false} className="px-6 py-8 sm:p-11">
      <SectionHeading title="Order your medicine" id="refill-title" className="mb-2" />
      <p className="mb-6 text-muted-foreground">Ordered with us before? Use your prescription number. New here? Upload a photo of your prescription.</p>

      <form onSubmit={onSubmit} noValidate>
        <Segmented
          label="How would you like to order?"
          value={mode}
          onChange={(m) => {
            setMode(m)
            setErrors({})
          }}
          options={[
            { value: 'number', label: 'Prescription number' },
            { value: 'upload', label: 'Upload prescription' },
          ]}
          className="mb-7"
          full
        />

        <TextField label="Full name" value={name} onChange={setName} onBlur={() => name && validateOne('name')} error={errors.name} inputRef={nameRef} autoComplete="name" />
        <TextField
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="03XX XXXXXXX"
          help="We'll text you when your order is ready. Our pharmacist may also call if we need more details."
          value={phone}
          onChange={setPhone}
          onBlur={() => phone && validateOne('phone')}
          error={errors.phone}
          inputRef={phoneRef}
        />

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={mode === 'number' ? (noNumber ? 'no-number' : 'number') : 'upload'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {mode === 'number' && !noNumber && (
              <TextField
                label="Prescription number"
                inputMode="numeric"
                help="We text this number to you after your first order."
                value={prescriptionNumber}
                onChange={setPrescriptionNumber}
                onBlur={() => prescriptionNumber && validateOne('prescriptionNumber')}
                error={errors.prescriptionNumber}
                inputRef={numberRef}
                after={
                  <LinkButton
                    onClick={() => {
                      setNoNumber(true)
                      setErrors((e) => ({ ...e, prescriptionNumber: undefined }))
                    }}
                  >
                    Don't have your number?
                  </LinkButton>
                }
              />
            )}

            {mode === 'number' && noNumber && (
              <div className="mb-5 rounded-xl bg-secondary px-4 py-3.5 text-[0.92rem] text-secondary-foreground">
                <p className="m-0">No problem. We'll find your prescription using your mobile number above, and call you if we need to check anything.</p>
                <div className="mt-2">
                  <LinkButton onClick={() => setNoNumber(false)}>Use my prescription number instead</LinkButton>
                </div>
              </div>
            )}

            {mode === 'upload' && (
              <>
                <FileDrop
                  files={files}
                  onChange={(f) => {
                    setFiles(f)
                    if (f.length) setErrors((e) => ({ ...e, files: undefined }))
                  }}
                  error={errors.files}
                  buttonRef={uploadRef}
                />
                <div className="mb-5">
                  <label htmlFor="order-notes" className="mb-2 block text-[0.92rem] font-medium">
                    Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    id="order-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. I only need the first two medicines"
                    className={cn(fieldClass, 'h-auto min-h-[80px] py-3')}
                  />
                </div>
                <p className="mb-6 flex gap-2.5 rounded-xl bg-secondary px-4 py-3 text-[0.88rem] text-secondary-foreground">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  A pharmacist checks every prescription before preparing it, and may call you to confirm details about your order. Please keep the original paper, as we may ask to see it.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <fieldset className="mb-6">
          <legend className="mb-2 text-[0.92rem] font-medium">How would you like it?</legend>
          <Segmented
            value={method}
            onChange={(m) => {
              setMethod(m)
              setErrors((e) => ({ ...e, address: undefined }))
            }}
            options={[
              { value: 'pickup', label: 'Pickup' },
              { value: 'delivery', label: 'Delivery' },
            ]}
          />
        </fieldset>

        {method === 'delivery' && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-1 duration-300">
            <label htmlFor="delivery-address" className="mb-2 block text-[0.92rem] font-medium">
              Delivery address
            </label>
            <textarea
              id="delivery-address"
              ref={addressRef}
              rows={3}
              required
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => address && validateOne('address')}
              aria-invalid={!!errors.address}
              aria-describedby="delivery-address-help"
              placeholder="e.g. House 477F Eden Valley, Faisalabad."
              className={cn(fieldClass, 'h-auto min-h-[96px] py-3')}
            />
            <p id="delivery-address-help" className="mt-1.5 text-[0.85rem] text-muted-foreground">
              Add a nearby landmark if it helps our rider find you.
            </p>
            {errors.address && <p className="mt-1.5 text-[0.85rem] font-medium text-destructive">{errors.address}</p>}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={status === 'sending'}>
          {status === 'sending' ? (
            <>
              <PillSpinner />
              Sending…
            </>
          ) : mode === 'number' ? (
            'Send refill request'
          ) : (
            'Send prescription'
          )}
        </Button>

        <AnimatePresence>
          {status === 'error' && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl bg-destructive/10 px-4 py-3.5 font-medium text-destructive"
            >
              {errorMessage}
            </motion.p>
          )}
        </AnimatePresence>
      </form>

      <OrderPlacedDialog order={placed} onClose={() => setPlaced(null)} />
    </GlassCard>
  )
}

const fieldClass =
  'h-[50px] w-full rounded-xl border border-input bg-field px-4 text-foreground transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_18%,transparent)] aria-invalid:border-destructive'

function TextField({
  label,
  help,
  error,
  value,
  onChange,
  onBlur,
  inputRef,
  after,
  ...input
}: {
  label: string
  help?: string
  error?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  after?: ReactNode
} & Pick<React.ComponentProps<'input'>, 'type' | 'inputMode' | 'autoComplete' | 'placeholder'>) {
  const id = useId()
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-[0.92rem] font-medium">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={input.type ?? 'text'}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={cn(fieldClass, input.type === 'date' && '[color-scheme:inherit]')}
        {...input}
      />
      {help && (
        <p id={`${id}-help`} className="mt-1.5 text-[0.85rem] text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[0.85rem] font-medium text-destructive">
          {error}
        </p>
      )}
      {after && <div className="mt-2">{after}</div>}
    </div>
  )
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[0.88rem] font-semibold text-primary underline-offset-4 hover:underline">
      {children}
    </button>
  )
}

/** Radio buttons drawn as a pill switch, with a highlight that slides to the chosen option */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  full,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label?: string
  full?: boolean
  className?: string
}) {
  const name = useId()
  const group = (
    <div className={cn('inline-flex rounded-full border border-input bg-field p-1', full && 'grid w-full grid-cols-2')}>
      {options.map((o) => (
        <label
          key={o.value}
          className="relative cursor-pointer rounded-full px-5 py-2.5 text-center text-[0.95rem] font-medium has-focus-visible:outline-2 has-focus-visible:outline-ring"
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {value === o.value && (
            <motion.span layoutId={`${name}-pill`} className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
          )}
          <span className={cn('relative transition-colors', value === o.value ? 'text-primary-foreground' : 'text-muted-foreground')}>{o.label}</span>
        </label>
      ))}
    </div>
  )
  if (!label) return group
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-[0.92rem] font-medium">{label}</legend>
      {group}
    </fieldset>
  )
}

/** Drop zone for prescription photos / PDFs, with previews. On phones, "Take a photo" opens the camera. */
function FileDrop({
  files,
  onChange,
  error,
  buttonRef,
}: {
  files: File[]
  onChange: (files: File[]) => void
  error?: string
  buttonRef: React.RefObject<HTMLButtonElement | null>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const previews = useMemo(() => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)), [files])
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews])

  function add(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    const ok = incoming.filter((f) => (f.type.startsWith('image/') || f.type === 'application/pdf') && f.size <= MAX_MB * 1024 * 1024)
    const room = MAX_FILES - files.length
    if (ok.length < incoming.length) setProblem(`Only photos or PDFs up to ${MAX_MB} MB, please.`)
    else if (ok.length > room) setProblem(`You can add up to ${MAX_FILES} files.`)
    else setProblem(null)
    if (room > 0) onChange([...files, ...ok.slice(0, room)])
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    add(e.dataTransfer.files)
  }

  const message = problem ?? error

  return (
    <div className="mb-5">
      <p className="mb-2 text-[0.92rem] font-medium">Prescription photo</p>
      {files.length < MAX_FILES && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-input bg-field px-5 py-7 text-center transition-colors',
            dragging && 'border-primary bg-secondary',
            error && !files.length && 'border-destructive',
          )}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
            <Camera className="size-6" />
          </span>
          <p className="m-0 text-[0.92rem] text-muted-foreground">
            Make sure the doctor's name and all medicines are easy to read.
            <span className="hidden sm:inline"> You can also drag files here.</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:hidden"
            >
              Take a photo
            </button>
            <button
              ref={buttonRef}
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-glass-border bg-glass px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              Choose file
            </button>
          </div>
          <p className="m-0 text-xs text-muted-foreground">
            Photo or PDF · up to {MAX_FILES} files · {MAX_MB} MB each
          </p>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {files.map((f, i) => (
            <motion.li key={`${f.name}-${f.size}-${f.lastModified}`} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative">
              <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl border border-glass-border bg-glass-strong">
                {previews[i] ? (
                  <img src={previews[i]!} alt={`Prescription ${i + 1}`} className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 p-2 text-center text-xs text-muted-foreground">
                    <FileText className="size-7 text-primary" />
                    <span className="line-clamp-2 break-all">{f.name}</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${f.name}`}
                className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-foreground text-background shadow-md"
              >
                <X className="size-4" />
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      {message && <p className="mt-1.5 text-[0.85rem] font-medium text-destructive">{message}</p>}
    </div>
  )
}

function PillSpinner() {
  return (
    <svg viewBox="0 0 44 44" aria-hidden="true" className="size-[22px] motion-safe:animate-spin">
      <g transform="translate(4 13)">
        <path d="M9 0h9v18H9a9 9 0 0 1 0-18z" className="fill-primary-foreground" />
        <path d="M18 1h9a8 8 0 0 1 0 16h-9z" fill="none" className="stroke-primary-foreground" strokeWidth="2" />
      </g>
    </svg>
  )
}
